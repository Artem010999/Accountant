// Общий переход после изменения паспорта.
// Порядок: якорь (когда заполнены блоки 3 и 4) → досбор пустых секций в форме (0 токенов ИИ) →
// аудит Kimi (только по заполненному паспорту) → пробелы блоков → смета → новизна и выход (шаги 7–8).
import { PASSPORT_SECTIONS, type PipelineQuestion, type PipelineResponse, type TargetField } from '@passport/contracts';
import { fieldKb } from '../kb/manifest';
import type { RecordRow, UserContext } from '../db/store';
import type { PipelineDeps } from './deps';
import { findGaps, buildPassportFields } from './passport';
import { noveltyAndFinalize } from './finalize';
import { auditPassport, type AuditReport } from './audit';
import { anchorBriefFromRecords, createAnchor } from './anchor';
import { OPTIONAL_FIELDS } from './fieldValidation';

export async function nextStep(
  deps: PipelineDeps,
  ctx: UserContext,
  projectId: string,
  program: string,
): Promise<PipelineResponse> {
  let records: RecordRow[] = await deps.store.getRecords(projectId);

  // Якорь (анти-фрод) — один раз, когда в паспорте заполнены ключевые блоки 3 и 4.
  if (!ctx.project?.anchorReady) {
    const anchorText = anchorBriefFromRecords(records);
    if (anchorText) await createAnchor(deps, projectId, anchorText);
  }

  // Полностью пустая обязательная секция: сначала досбор в форме. Аудит Kimi по полупустому паспорту не запускаем.
  if (hasFullyEmptySection(records)) {
    const gap = findGaps(records)[0];
    if (gap) return gapQuestion(deps, gap, records, undefined);
  }

  const auditReport = await auditPassport(deps, projectId);
  records = await deps.store.getRecords(projectId);

  const gap = findGaps(records)[0];
  if (gap) return gapQuestion(deps, gap, records, auditReport);

  // Смета — часть проверки «Все блоки, смета и 2 аналога ОК?»: не одобрена → назад на шаг 7 (доработка).
  if (auditReport.budget_audit.status !== 'approved') {
    return budgetQuestion(records, auditReport);
  }

  return noveltyAndFinalize(deps, ctx, projectId, records, program, auditReport);
}

/** Есть ли в секциях 2–10 секция, где все обязательные поля пустые. */
function hasFullyEmptySection(records: readonly RecordRow[]): boolean {
  return PASSPORT_SECTIONS.some((section) =>
    section.fields
      .filter((f) => !OPTIONAL_FIELDS.has(`${section.id}/${f}`))
      .every((f) => !records.find((r) => r.section_id === section.id && r.field_key === f)?.value?.trim()),
  );
}

function gapQuestion(
  deps: PipelineDeps,
  gap: TargetField,
  records: RecordRow[],
  auditReport: AuditReport | undefined,
): PipelineQuestion {
  const kb = fieldKb(deps.kb, gap.section_id, gap.field_key);
  const blockAudit = auditReport?.block_audits.find((b) => b.section_id === gap.section_id);
  return {
    status: 'NEED_USER_INPUT',
    step: 'GAP_FILLING',
    target_field: gap,
    question: kb.question,
    example: kb.example,
    rejection_reason: blockAudit?.remark ?? null,
    block_audits: auditReport?.block_audits,
    budget_audit: auditReport?.budget_audit,
    fatal_stop_factors: auditReport?.fatal_stop_factors,
    passport: buildPassportFields(records),
  };
}

function budgetQuestion(records: RecordRow[], auditReport: AuditReport): PipelineQuestion {
  const budget = auditReport.budget_audit;
  return {
    status: 'NEED_USER_INPUT',
    step: 'BUDGET_REVIEW',
    question: 'Смета не одобрена: исправьте статьи бюджета или подтвердите их на этом шаге.',
    example: '',
    rejection_reason: budget.remark ?? (budget.violations.length > 0 ? budget.violations.join('; ') : 'Смета не одобрена.'),
    block_audits: auditReport.block_audits,
    budget_audit: budget,
    fatal_stop_factors: auditReport.fatal_stop_factors,
    passport: buildPassportFields(records),
  };
}
