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
import { checkFieldValue, challengeDirectionMismatch, DIRECTION_CODES } from './fieldValidation';
import { invalidateDependents, noteFieldChange } from './invalidation';
import { getRagDb } from '../rag/db';
import { retrieveRagContext } from '../rag/retriever';
import type { DirectionCode } from '../rag/types';
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

const isCodeField = (sectionId: number, fieldKey: string) =>
  sectionId === 4 && (fieldKey === 'direction' || fieldKey === 'tech_challenge');

/**
 * ШАГ 4–5: сборка и упаковка открытых блоков паспорта на DeepSeek Flash с подключением RAG.
 * Уже одобренные (review_status === 'approved') блоки передаются в LLM только как справочный контекст locked_fields
 * и защищены от перезаписи при сохранении.
 */
export async function extractPassport(
  deps: PipelineDeps,
  projectId: string,
  program: string,
  userInput: string,
  sources: SourceRow[],
  formFields?: { section_id: number; field_key: string; value: string }[],
  changedSet?: Set<DependencyNode>,
): Promise<void> {
  await deps.store.setProjectStatus(projectId, 'generating');

  const existingRecords = await deps.store.getRecords(projectId);

  // 1. locked_fields: approved блоки (только для чтения / справочного контекста)
  const locked_fields = PASSPORT_SECTIONS.flatMap((s) =>
    s.fields
      .map((f) => {
        const rec = existingRecords.find((r) => r.section_id === s.id && r.field_key === f);
        if (rec?.review_status === 'approved') {
          return { section_id: s.id, field_key: f, value: rec.value };
        }
        return null;
      })
      .filter((f): f is { section_id: number; field_key: string; value: string | null } => f !== null),
  );

  // 2. open_fields: открытые для упаковки/заполнения (review_status !== 'approved')
  type OpenFieldPayload = {
    section_id: number;
    field_key: string;
    question: string;
    criteria: string;
    current_value: string | null;
  };

  const open_fields: OpenFieldPayload[] = [];

  if (formFields && formFields.length > 0) {
    for (const ff of formFields) {
      const rec = existingRecords.find((r) => r.section_id === ff.section_id && r.field_key === ff.field_key);
      if (rec?.review_status === 'approved') continue;
      if (open_fields.some((o) => o.section_id === ff.section_id && o.field_key === ff.field_key)) continue;
      const kb = fieldKb(deps.kb, ff.section_id, ff.field_key);
      open_fields.push({
        section_id: ff.section_id,
        field_key: ff.field_key,
        question: kb.question,
        criteria: kb.criteria,
        current_value: ff.value ?? rec?.value ?? null,
      });
    }

    // Если студент не указал tech_challenge, но направление Н1–Н6, предлагаем вызов
    const formDir = formFields.find((f) => f.section_id === 4 && f.field_key === 'direction')?.value;
    const dbDir = existingRecords.find((r) => r.section_id === 4 && r.field_key === 'direction')?.value;
    const effDir = (formDir ?? dbDir ?? '').trim();
    const hasTcInForm = formFields.some((f) => f.section_id === 4 && f.field_key === 'tech_challenge' && f.value?.trim());
    const tcRec = existingRecords.find((r) => r.section_id === 4 && r.field_key === 'tech_challenge');
    if (!hasTcInForm && tcRec?.review_status !== 'approved' && !tcRec?.value && effDir && effDir !== 'Н7') {
      const kb = fieldKb(deps.kb, 4, 'tech_challenge');
      if (!open_fields.some((f) => f.section_id === 4 && f.field_key === 'tech_challenge')) {
        open_fields.push({
          section_id: 4,
          field_key: 'tech_challenge',
          question: kb.question,
          criteria: kb.criteria,
          current_value: null,
        });
      }
    }
  } else {
    for (const s of PASSPORT_SECTIONS) {
      for (const f of s.fields) {
        const rec = existingRecords.find((r) => r.section_id === s.id && r.field_key === f);
        if (rec?.review_status === 'approved') continue;
        const kb = fieldKb(deps.kb, s.id, f);
        open_fields.push({
          section_id: s.id,
          field_key: f,
          question: kb.question,
          criteria: kb.criteria,
          current_value: rec?.value ?? null,
        });
      }
    }
  }

  // Если все блоки approved — сразу выходим, не делая вызов к LLM
  if (open_fields.length === 0) {
    return;
  }

  // 3. Подключение RAG («Две кучки»)
  const openSectionIds = Array.from(new Set(open_fields.map((f) => String(f.section_id))));

  const formDir = formFields?.find((f) => f.section_id === 4 && f.field_key === 'direction')?.value;
  const dbDir = existingRecords.find((r) => r.section_id === 4 && r.field_key === 'direction')?.value;
  const rawDirection = (formDir ?? dbDir ?? '').trim();
  const knownDirection: DirectionCode = (DIRECTION_CODES as readonly string[]).includes(rawDirection)
    ? (rawDirection as DirectionCode)
    : 'all';

  const sourcesSnippet = sources.map((s) => s.extracted_text ?? '').join(' ').slice(0, 1500);
  const formTexts = formFields?.map((f) => f.value).join(' ') ?? '';
  const ragQueryText = [userInput, formTexts, sourcesSnippet].filter(Boolean).join(' ');

  let ragContextText = '';
  try {
    const ragDb = await getRagDb();
    try {
      const ragResult = await retrieveRagContext(ragDb.sql, {
        step: 'assembly',
        targetBlocks: openSectionIds,
        direction: knownDirection,
        queryText: ragQueryText.slice(0, 2000),
        topKSearch: 5,
        includePinned: true,
      });
      ragContextText = ragResult.formattedContext;
    } finally {
      await ragDb.close();
    }
  } catch (err) {
    deps.logger.warn('[extractPassport] RAG context unavailable, proceeding without RAG:', err);
  }

  // 4. Вызов LLM
  const out = await callLlm(
    deps.llm,
    'extract',
    {
      program,
      fields: open_fields,
      locked_fields,
      rag_context: ragContextText,
      user_input: userInput ? wrapUntrustedData('user_input', userInput) : undefined,
      form_inputs: formFields
        ? formFields.map((f) => ({
            section_id: f.section_id,
            field_key: f.field_key,
            value: wrapUntrustedData(`form:${f.section_id}/${f.field_key}`, f.value),
          }))
        : undefined,
      sources: toSourcePayload(sources),
    },
    extractSchema,
  );

  const sourcesById = Object.fromEntries(sources.map((s) => [s.id, { extracted_text: s.extracted_text }]));
  const validSourceIds = new Set(sources.map((s) => s.id));

  const changed = changedSet ?? new Set<DependencyNode>();
  const processedKeys = new Set<string>();
  const openFieldKeys = new Set(open_fields.map((f) => `${f.section_id}/${f.field_key}`));

  for (const item of out.fields) {
    if (!isValidPassportField(item.section_id, item.field_key)) continue;
    if (!openFieldKeys.has(`${item.section_id}/${item.field_key}`)) continue;

    // Железная защита на сохранении: approved-блоки ни при каких условиях не перезаписываются
    const existingRec = existingRecords.find(
      (r) => r.section_id === item.section_id && r.field_key === item.field_key,
    );
    if (existingRec?.review_status === 'approved') continue;

    const raw = item.value?.trim();
    if (!raw) continue;

    // Поля с допустимым набором (направление, вызов): невалидное значение от модели пропускаем
    const check = checkFieldValue(item.section_id, item.field_key, raw, deps.kb.tech_challenges);
    if (!check.ok) {
      deps.logger.info(`[extract] ${item.field_key}: ${check.reason}`);
      continue;
    }
    const value = check.value;

    // Проверка согласованности направления и технологического вызова
    if (item.section_id === 4 && item.field_key === 'tech_challenge') {
      const curDir =
        out.fields.find((f) => f.section_id === 4 && f.field_key === 'direction')?.value?.trim() ||
        formFields?.find((f) => f.section_id === 4 && f.field_key === 'direction')?.value?.trim() ||
        existingRecords.find((r) => r.section_id === 4 && r.field_key === 'direction')?.value?.trim();
      if (!curDir || curDir === 'Н7') {
        deps.logger.info(`[extract] tech_challenge #${value} not allowed without Н1-Н6 direction (curDir="${curDir}")`);
        continue;
      }
      const mismatch = challengeDirectionMismatch(curDir, value, deps.kb.tech_challenges);
      if (mismatch) {
        deps.logger.info(`[extract] tech_challenge #${value}: ${mismatch}`);
        continue;
      }
    }

    processedKeys.add(`${item.section_id}/${item.field_key}`);

    const prev = existingRec?.value ?? null;
    noteFieldChange(prev, value, item.section_id, changed);
    const recordId = await deps.store.upsertField(projectId, item.section_id, item.field_key, value);
    await writeClaims(deps, recordId, value, item.claims ?? [], sourcesById, validSourceIds);
  }

  // 5. Fallback для полей submit_form:
  // Если модель НЕ вернула какое-то из явно присланных в req.form полей, сохраняем исходное v.value
  if (formFields) {
    for (const ff of formFields) {
      const key = `${ff.section_id}/${ff.field_key}`;
      if (processedKeys.has(key)) continue;

      const existingRec = existingRecords.find(
        (r) => r.section_id === ff.section_id && r.field_key === ff.field_key,
      );
      if (existingRec?.review_status === 'approved') continue;

      const raw = ff.value?.trim();
      if (!raw) continue;
      const check = checkFieldValue(ff.section_id, ff.field_key, raw, deps.kb.tech_challenges);
      if (!check.ok) continue;

      const value = check.value;

      if (ff.section_id === 4 && ff.field_key === 'tech_challenge') {
        const curDir =
          formFields?.find((f) => f.section_id === 4 && f.field_key === 'direction')?.value?.trim() ||
          existingRecords.find((r) => r.section_id === 4 && r.field_key === 'direction')?.value?.trim();
        if (!curDir || curDir === 'Н7' || challengeDirectionMismatch(curDir, value, deps.kb.tech_challenges)) {
          continue;
        }
      }

      const prev = existingRec?.value ?? null;
      noteFieldChange(prev, value, ff.section_id, changed);
      const recordId = await deps.store.upsertField(projectId, ff.section_id, ff.field_key, value);
      const isCode = isCodeField(ff.section_id, ff.field_key);
      const fallbackClaims: LlmClaim[] = isCode
        ? []
        : [
            {
              claim_text: value,
              claim_type: 'client_statement',
              claim_kind: 'paragraph',
              source_id: null,
              source_locator: null,
              confidence: null,
            },
          ];
      await writeClaims(deps, recordId, value, fallbackClaims, sourcesById, validSourceIds);
    }
  }

  // Зависимые считаем после всех записей, если changedSet не передан из вызывающего контекста
  if (!changedSet) {
    await invalidateDependents(deps.store, projectId, changed);
  }
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
