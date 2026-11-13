// Блоки 3–4: экстрактор паспорта (ШАГ 4–5), поиск пробелов (ШАГ 6), валидация ответа (S6B / G5).
import {
  PASSPORT_SECTIONS,
  isValidPassportField,
  type ClaimKind,
  type ClaimType,
  type TargetField,
} from '@passport/contracts';
import { auditClaims, calculateClaimSpans, type DependencyNode, type RawClaim } from '@passport/passport-core';
import { callLlm, extractSchema, validateSchema, type LlmClaim } from '../llm/schemas';
import { fieldKb } from '../kb/manifest';
import { wrapUntrustedData } from '../promptGuard';
import { checkFieldValue } from './fieldValidation';
import { invalidateDependents, noteFieldChange } from './invalidation';
import type { ClaimDraft, RecordRow, SourceRow } from '../db/store';
import type { PipelineDeps } from './deps';

const MAX_SOURCE_CHARS = 60_000;
const MIN_FIELD_LENGTH = 10; // length(trim(value)) > 10 — ТЗ, ШАГ 6 (G4)
/** Коды (направление «Н1», номер вызова «1») — короткие по природе: для них достаточно непустого значения. */
const CODE_FIELDS = new Set(['4/direction', '4/tech_challenge']);
/** Необязательные поля: не попадают в пробелы. Технологический вызов пока необязателен для всех направлений (решение владельца). */
const OPTIONAL_FIELDS = new Set(['4/tech_challenge']);

/** Записывает claims поля: спаны (0-based), аудит источников, атомарная замена в БД. */
export async function writeClaims(
  deps: PipelineDeps,
  recordId: string,
  value: string,
  claims: LlmClaim[],
  sourcesById: Record<string, { extracted_text: string | null }>,
  validSourceIds: Set<string>,
): Promise<void> {
  const raw: RawClaim[] = claims.map((c) => {
    const sourceOk = !!c.source_id && validSourceIds.has(c.source_id);
    return {
      claim_text: c.claim_text,
      claim_type: c.claim_type as ClaimType,
      claim_kind: c.claim_kind ?? undefined,
      source_id: sourceOk ? c.source_id! : null,
      source_locator: sourceOk ? (c.source_locator ?? null) : null,
      confidence: c.confidence ?? undefined,
    };
  });

  const withSpans = calculateClaimSpans(value, raw).map((c) => ({
    ...c,
    source_id: c.source_id ?? null,
    source_locator: c.source_locator ?? null,
  }));
  const { auditedClaims, auditWarnings } = auditClaims(withSpans, sourcesById);
  for (const w of auditWarnings) deps.logger.info(`[audit] ${w.reason}: ${w.claim_text.slice(0, 80)}`);

  const drafts: ClaimDraft[] = auditedClaims.map((c, i) => ({
    claim_text: c.claim_text,
    claim_type: c.claim_type,
    claim_kind: (claims[i]?.claim_kind ?? null) as ClaimKind | null,
    source_id: c.source_id,
    source_locator: c.source_locator,
    confidence: claims[i]?.confidence ?? null,
    span_start: c.span_start,
    span_end: c.span_end,
    order_index: c.order_index,
    verification_status: c.verification_status,
  }));

  await deps.store.replaceClaims(recordId, drafts);
}

/** Пробелы паспорта в порядке реестра секций: нет записи / пустое / needs_review. */
export function findGaps(records: RecordRow[]): TargetField[] {
  const gaps: TargetField[] = [];
  for (const section of PASSPORT_SECTIONS) {
    for (const fieldKey of section.fields) {
      if (OPTIONAL_FIELDS.has(`${section.id}/${fieldKey}`)) continue;
      const rec = records.find((r) => r.section_id === section.id && r.field_key === fieldKey);
      const minLength = CODE_FIELDS.has(`${section.id}/${fieldKey}`) ? 0 : MIN_FIELD_LENGTH;
      const empty = !rec || !rec.value || rec.value.trim().length <= minLength;
      if (empty || rec.review_status === 'needs_review') {
        gaps.push({ section_id: section.id, field_key: fieldKey });
      }
    }
  }
  return gaps;
}

/**
 * ШАГ 4–5: извлечение полей паспорта из пользовательского ввода и документов.
 * Существующие значения не затираются пустым ответом LLM (value = null → пропуск).
 */
export async function extractPassport(
  deps: PipelineDeps,
  projectId: string,
  program: string,
  userInput: string,
  sources: SourceRow[],
): Promise<void> {
  await deps.store.setProjectStatus(projectId, 'generating');

  const fields = PASSPORT_SECTIONS.flatMap((s) =>
    s.fields.map((f) => ({ section_id: s.id, field_key: f, question: fieldKb(deps.kb, s.id, f).question })),
  );

  const out = await callLlm(
    deps.llm,
    'extract',
    { program, fields, user_input: wrapUntrustedData('user_input', userInput), sources: toSourcePayload(sources) },
    extractSchema,
  );

  const sourcesById = Object.fromEntries(sources.map((s) => [s.id, { extracted_text: s.extracted_text }]));
  const validSourceIds = new Set(sources.map((s) => s.id));

  const changed = new Set<DependencyNode>();
  for (const item of out.fields) {
    if (!isValidPassportField(item.section_id, item.field_key)) continue;
    const raw = item.value?.trim();
    if (!raw) continue;
    // Поля с допустимым набором (направление, вызов): невалидное значение от модели пропускаем — поле останется пробелом.
    const check = checkFieldValue(item.section_id, item.field_key, raw, deps.kb.tech_challenges);
    if (!check.ok) {
      deps.logger.info(`[extract] ${item.field_key}: ${check.reason}`);
      continue;
    }
    const value = check.value;

    const prev = await deps.store.getFieldValue(projectId, item.section_id, item.field_key);
    noteFieldChange(prev, value, item.section_id, changed);
    const recordId = await deps.store.upsertField(projectId, item.section_id, item.field_key, value);
    await writeClaims(deps, recordId, value, item.claims, sourcesById, validSourceIds);
  }
  // Зависимые считаем после всех записей: иначе перезапись claims сбросит пометку (триггер пересчёта статуса).
  await invalidateDependents(deps.store, projectId, changed);
}

export type AnswerResult = { ok: true } | { ok: false; reason: string };

/** Дозаполнение (S6B → G5): валидация ответа по критериям КБ, сохранение поля и claims. */
export async function answerField(
  deps: PipelineDeps,
  projectId: string,
  target: TargetField,
  question: string,
  answer: string,
): Promise<AnswerResult> {
  const kb = fieldKb(deps.kb, target.section_id, target.field_key);
  const out = await callLlm(
    deps.llm,
    'validate_answer',
    {
      section_id: target.section_id,
      field_key: target.field_key,
      question,
      criteria: kb.criteria,
      answer: wrapUntrustedData('user_answer', answer),
    },
    validateSchema,
  );

  const value = out.formatted_value?.trim();
  if (!out.is_valid || !value) {
    return { ok: false, reason: out.rejection_reason ?? 'Ответ не закрывает требование поля' };
  }
  const code = checkFieldValue(target.section_id, target.field_key, value, deps.kb.tech_challenges);
  if (!code.ok) return { ok: false, reason: code.reason };

  // Claims из ответа клиента — без привязки к файлам.
  const claims: LlmClaim[] = out.claims.map((c) => ({ ...c, source_id: null, source_locator: null }));
  const recordId = await deps.store.upsertField(projectId, target.section_id, target.field_key, code.value);
  await writeClaims(deps, recordId, code.value, claims, {}, new Set());
  return { ok: true };
}

/** Тексты источников для LLM с лимитом размера; постраничная разбивка сохраняется для traceability. */
function toSourcePayload(sources: SourceRow[]) {
  let budget = MAX_SOURCE_CHARS;
  return sources.map((s) => {
    const pages = s.metadata?.pages?.length
      ? s.metadata.pages
      : [{ page: 1, text: s.extracted_text ?? '' }];
    const trimmed = pages.map((p) => {
      const text = p.text.slice(0, Math.max(0, budget));
      budget -= text.length;
      return { page: p.page, text: wrapUntrustedData(`file:${s.file_name}:page_${p.page}`, text) };
    });
    return { source_id: s.id, file_name: s.file_name, pages: trimmed };
  });
}
