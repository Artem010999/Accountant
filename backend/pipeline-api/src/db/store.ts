// Слой данных пайплайна. Вся бизнес-логика статусов (review_status, инвалидация спанов, guard-порог)
// выполняется триггерами и функциями из migrations/0003 — здесь только согласованные запросы.
import type { ClaimKind, ClaimType, ClaimVerificationStatus } from '@passport/contracts';
import type { SqlClient } from './sql';
import { toVectorLiteral } from './sql';

export interface UserContext {
  founderData: Record<string, any>;
  isBanned: boolean;
  features: { ai_parsing?: boolean; novelty_check?: boolean; consultant?: boolean };
  fileUploadsLimit: number;
  uploadedFilesCount: number;
  thresholds: { block: number; warn: number };
  project: ProjectInfo | null;
}

export interface ProjectInfo {
  id: string;
  briefText: string;
  /** anchor_status = 'ready' и есть эмбеддинг. Иначе проект считается «новым» (холодный старт). */
  anchorReady: boolean;
  status: string;
}

export interface SourceRow {
  id: string;
  file_name: string;
  extracted_text: string | null;
  metadata: { pages?: { page: number; text: string }[] } | null;
}

export interface ClaimRow {
  claim_text: string;
  claim_type: ClaimType;
  claim_kind: string | null;
  source_id: string | null;
  source_locator: { page: number; quote: string } | null;
  span_start: number | null;
  span_end: number | null;
  order_index: number | null;
  verification_status: ClaimVerificationStatus;
}

export interface RecordRow {
  id: string;
  section_id: number;
  field_key: string;
  value: string | null;
  review_status: string;
  claims: ClaimRow[];
}

export interface ClaimDraft {
  claim_text: string;
  claim_type: ClaimType;
  claim_kind: ClaimKind | null;
  source_id: string | null;
  source_locator: { page: number; quote: string } | null;
  confidence: number | null;
  span_start: number | null;
  span_end: number | null;
  order_index: number;
  verification_status: ClaimVerificationStatus;
}

const CONTEXT_SQL = `
SELECT p.founder_data, p.is_banned,
       COALESCE(pl.features, '{}'::jsonb)            AS features,
       COALESCE(pl.file_uploads_limit, 0)            AS file_uploads_limit,
       (SELECT COUNT(*)::int
          FROM project_sources s
          JOIN app_projects ap ON ap.id = s.project_id
         WHERE ap.user_id = p.id)                    AS uploaded_count,
       pr.id                                         AS project_id,
       pr.brief_text,
       pr.status                                     AS project_status,
       (pr.anchor_status = 'ready' AND pr.anchor_embedding IS NOT NULL) AS anchor_ready,
       st.guard_threshold_block,
       st.guard_threshold_warn
FROM app_profiles p
LEFT JOIN LATERAL (
    SELECT bs.plan_id
      FROM billing_subscriptions bs
     WHERE bs.user_id = p.id AND bs.expires_at > now()
     ORDER BY bs.expires_at DESC
     LIMIT 1
) sub ON true
LEFT JOIN billing_plans pl ON pl.id = COALESCE(sub.plan_id, 'free')
LEFT JOIN app_projects pr ON pr.user_id = p.id
CROSS JOIN app_settings st
WHERE p.id = $1::uuid AND st.id = 1`;

export class PassportStore {
  constructor(private readonly sql: SqlClient) {}

  async loadContext(userId: string): Promise<UserContext | null> {
    const { rows } = await this.sql.query(CONTEXT_SQL, [userId]);
    const r = rows[0];
    if (!r) return null;
    return {
      founderData: r.founder_data ?? {},
      isBanned: Boolean(r.is_banned),
      features: r.features ?? {},
      fileUploadsLimit: Number(r.file_uploads_limit),
      uploadedFilesCount: Number(r.uploaded_count),
      thresholds: { block: Number(r.guard_threshold_block), warn: Number(r.guard_threshold_warn) },
      project: r.project_id
        ? { id: r.project_id, briefText: r.brief_text ?? '', anchorReady: Boolean(r.anchor_ready), status: r.project_status }
        : null,
    };
  }

  /** Создаёт проект пользователя (1 юзер = 1 проект) или возвращает существующий. */
  async ensureProject(userId: string): Promise<string> {
    const { rows } = await this.sql.query(
      `INSERT INTO app_projects (user_id, brief_text, anchor_status, status)
       VALUES ($1::uuid, '', 'pending', 'draft')
       ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
       RETURNING id`,
      [userId],
    );
    return rows[0].id;
  }

  /** Фиксирует якорь проекта (один раз: pending → ready). */
  async setAnchor(projectId: string, a: { briefText: string; summary: string; embedding: number[]; model: string }) {
    await this.sql.query(
      `UPDATE app_projects
          SET brief_text = $2, anchor_summary = $3, anchor_embedding = $4::vector,
              anchor_status = 'ready', anchor_model = $5, anchor_generated_at = now(), updated_at = now()
        WHERE id = $1::uuid`,
      [projectId, a.briefText, a.summary, toVectorLiteral(a.embedding), a.model],
    );
  }

  /** Guard (ШАГ 2): cosine similarity с якорем + запись в project_guard_events. */
  async guardCheck(
    projectId: string,
    embedding: number[],
    preview: string,
    thresholds: { block: number; warn: number },
  ): Promise<{ action: 'allowed' | 'allowed_with_warning' | 'blocked'; score: number }> {
    const { rows } = await this.sql.query(
      `WITH calc AS (
         SELECT cosine_similarity(anchor_embedding, $2::vector) AS score, anchor_model
           FROM app_projects WHERE id = $1::uuid
       )
       INSERT INTO project_guard_events (project_id, action, similarity_score, anchor_model, input_preview)
       SELECT $1::uuid,
              (CASE WHEN c.score < $3::float8 THEN 'blocked'
                    WHEN c.score < $4::float8 THEN 'allowed_with_warning'
                    ELSE 'allowed' END)::guard_action,
              c.score, c.anchor_model, $5::text
         FROM calc c
       RETURNING action::text AS action, similarity_score AS score`,
      [projectId, toVectorLiteral(embedding), thresholds.block, thresholds.warn, preview],
    );
    return { action: rows[0].action, score: Number(rows[0].score) };
  }

  async findSourceBySha(projectId: string, sha256: string): Promise<string | null> {
    const { rows } = await this.sql.query(
      'SELECT id FROM project_sources WHERE project_id = $1::uuid AND sha256_hash = $2',
      [projectId, sha256],
    );
    return rows[0]?.id ?? null;
  }

  async insertSource(
    projectId: string,
    s: { file_name: string; file_url: string; sha256_hash: string; extracted_text: string; metadata: unknown },
  ): Promise<string> {
    const { rows } = await this.sql.query(
      `INSERT INTO project_sources (project_id, file_name, file_url, sha256_hash, extracted_text, metadata)
       VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb) RETURNING id`,
      [projectId, s.file_name, s.file_url, s.sha256_hash, s.extracted_text, JSON.stringify(s.metadata ?? {})],
    );
    return rows[0].id;
  }

  async listSources(projectId: string): Promise<SourceRow[]> {
    const { rows } = await this.sql.query(
      'SELECT id, file_name, extracted_text, metadata FROM project_sources WHERE project_id = $1::uuid ORDER BY created_at, id',
      [projectId],
    );
    return rows;
  }

  /** UPSERT поля паспорта (UNIQUE project_id, section_id, field_key). Возвращает id записи. */
  async upsertField(projectId: string, sectionId: number, fieldKey: string, value: string): Promise<string> {
    const { rows } = await this.sql.query(
      `INSERT INTO project_passport_records (project_id, section_id, field_key, value)
       VALUES ($1::uuid, $2, $3, $4)
       ON CONFLICT (project_id, section_id, field_key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = now()
       RETURNING id`,
      [projectId, sectionId, fieldKey, value],
    );
    return rows[0].id;
  }

  /** Атомарно заменяет все claims записи (DELETE + INSERT в одном операторе). */
  async replaceClaims(recordId: string, claims: ClaimDraft[]): Promise<void> {
    await this.sql.query(
      `WITH del AS (DELETE FROM project_claims WHERE record_id = $1::uuid RETURNING id)
       INSERT INTO project_claims (record_id, claim_text, claim_type, claim_kind, source_id, source_locator,
                                   span_start, span_end, order_index, confidence, verification_status)
       SELECT $1::uuid, c.claim_text, c.claim_type::claim_type, c.claim_kind, c.source_id::uuid, c.source_locator,
              c.span_start, c.span_end, c.order_index, c.confidence, c.verification_status::claim_verification_status
         FROM jsonb_to_recordset($2::jsonb) AS c(
              claim_text text, claim_type text, claim_kind text, source_id text, source_locator jsonb,
              span_start int, span_end int, order_index int, confidence float8, verification_status text)`,
      [recordId, JSON.stringify(claims)],
    );
  }

  async getRecords(projectId: string): Promise<RecordRow[]> {
    const { rows } = await this.sql.query(
      `SELECT r.id, r.section_id, r.field_key, r.value, r.review_status::text AS review_status,
              COALESCE(json_agg(json_build_object(
                 'claim_text', c.claim_text, 'claim_type', c.claim_type, 'claim_kind', c.claim_kind,
                 'source_id', c.source_id, 'source_locator', c.source_locator,
                 'span_start', c.span_start, 'span_end', c.span_end, 'order_index', c.order_index,
                 'verification_status', c.verification_status
               ) ORDER BY c.order_index) FILTER (WHERE c.id IS NOT NULL), '[]'::json) AS claims
         FROM project_passport_records r
         LEFT JOIN project_claims c ON c.record_id = r.id
        WHERE r.project_id = $1::uuid
        GROUP BY r.id
        ORDER BY r.section_id, r.field_key`,
      [projectId],
    );
    return rows as RecordRow[];
  }

  async markNeedsReview(projectId: string, sectionId: number, fieldKey: string): Promise<void> {
    await this.sql.query(
      `UPDATE project_passport_records SET review_status = 'needs_review', updated_at = now()
        WHERE project_id = $1::uuid AND section_id = $2 AND field_key = $3`,
      [projectId, sectionId, fieldKey],
    );
  }

  async setProjectStatus(projectId: string, status: 'draft' | 'generating' | 'review' | 'completed'): Promise<void> {
    await this.sql.query(
      'UPDATE app_projects SET status = $2::project_status, updated_at = now() WHERE id = $1::uuid',
      [projectId, status],
    );
  }
}
