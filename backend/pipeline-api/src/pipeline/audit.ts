// Шаг 6: Первичный Аудит и Шаг 6.1: Точечный Ре-аудит (на канале Kimi k3).
import {
  PASSPORT_SECTIONS,
  type BlockAuditOut,
  type BudgetAuditOut,
  type FatalStopFactorOut,
} from '@passport/contracts';
import { checkBudget } from '@passport/passport-core';
import { callLlm, auditOutputSchema, type AuditOutput } from '../llm/schemas';
import { wrapUntrustedData } from '../promptGuard';
import { challengeDirectionMismatch, DIRECTION_CODES } from './fieldValidation';
import { getRagDb } from '../rag/db';
import { retrieveRagContext } from '../rag/retriever';
import type { DirectionCode } from '../rag/types';
import type { PipelineDeps } from './deps';

const CODE_FIELDS = new Set(['4/direction', '4/tech_challenge']);
const OPTIONAL_FIELDS = new Set(['4/tech_challenge']);
const MIN_FIELD_LENGTH = 10;

export interface AuditReport {
  mode: 'primary_audit' | 'delta_reaudit';
  fatal_stop_factors: FatalStopFactorOut[];
  block_audits: BlockAuditOut[];
  budget_audit: BudgetAuditOut;
  novelty_audit?: AuditOutput['novelty_audit'];
  created_at: string;
}

export async function auditPassport(deps: PipelineDeps, projectId: string): Promise<AuditReport> {
  const records = await deps.store.getRecords(projectId);
  const budgetItems = await deps.store.getBudgetItems(projectId);
  const limits = await deps.store.getBudgetLimits();

  // 1. Определение режима (primary vs delta) и разделение блоков
  const lockedSections: typeof PASSPORT_SECTIONS[number][] = [];
  const openSections: typeof PASSPORT_SECTIONS[number][] = [];

  for (const section of PASSPORT_SECTIONS) {
    const reqFields = section.fields.filter((f) => !OPTIONAL_FIELDS.has(`${section.id}/${f}`));
    const isLocked = reqFields.every((f) => {
      const rec = records.find((r) => r.section_id === section.id && r.field_key === f);
      const minLen = CODE_FIELDS.has(`${section.id}/${f}`) ? 0 : MIN_FIELD_LENGTH;
      const isFilled = !!rec?.value && rec.value.trim().length > minLen;
      return isFilled && rec.review_status === 'approved';
    });

    if (isLocked) {
      lockedSections.push(section);
    } else {
      openSections.push(section);
    }
  }

  // 2. Детерминированные проверки кодом до вызова Kimi (code_warnings)
  const codeWarnings: string[] = [];

  for (const s of openSections) {
    const emptyFields: string[] = [];
    for (const f of s.fields) {
      if (OPTIONAL_FIELDS.has(`${s.id}/${f}`)) continue;
      const rec = records.find((r) => r.section_id === s.id && r.field_key === f);
      const minLen = CODE_FIELDS.has(`${s.id}/${f}`) ? 0 : MIN_FIELD_LENGTH;
      if (!rec?.value || rec.value.trim().length <= minLen) {
        emptyFields.push(f);
      }
    }
    if (emptyFields.length > 0) {
      codeWarnings.push(`Блок ${s.id}: не заполнены обязательные поля: ${emptyFields.join(', ')}`);
    }
  }

  const budgetErrors = budgetItems.length > 0 ? checkBudget(budgetItems, limits) : [];
  for (const err of budgetErrors) {
    codeWarnings.push(`Смета: ${err.message}`);
  }
  if (budgetItems.some((b) => b.review_status === 'needs_review')) {
    codeWarnings.push('Смета: связанные блоки изменились. Подтвердите смету заново.');
  }

  const direction = records.find((r) => r.section_id === 4 && r.field_key === 'direction')?.value ?? null;
  const challenge = records.find((r) => r.section_id === 4 && r.field_key === 'tech_challenge')?.value ?? null;
  const mismatch = challengeDirectionMismatch(direction, challenge, deps.kb.tech_challenges);
  if (mismatch) {
    codeWarnings.push(`Направление и вызов: ${mismatch}`);
  }

  for (const r of records) {
    if (r.section_id < 2) continue;
    for (const c of r.claims) {
      if (c.claim_type === 'fact' && c.verification_status === 'unverified') {
        codeWarnings.push(`Неподтверждённый факт в Блоке ${r.section_id} (${r.field_key}): "${c.claim_text.slice(0, 80)}"`);
      }
    }
  }

  // 3. Подтягивание контекста из RAG (step: 'audit')
  const openSectionIds = openSections.map((s) => String(s.id));
  const targetBlockIds = Array.from(new Set([...openSectionIds, ...(budgetItems.length > 0 ? ['5', '7'] : [])]));

  const rawDirection = (direction ?? '').trim();
  const knownDirection: DirectionCode = (DIRECTION_CODES as readonly string[]).includes(rawDirection)
    ? (rawDirection as DirectionCode)
    : 'all';

  const openTexts = openSections
    .flatMap((s) => s.fields.map((f) => records.find((r) => r.section_id === s.id && r.field_key === f)?.value ?? ''))
    .filter(Boolean)
    .join(' ');
  const budgetTexts = budgetItems.map((b) => `${b.title} ${b.justification}`).join(' ');
  const queryText = [openTexts, budgetTexts, codeWarnings.join(' ')].filter(Boolean).join(' ').slice(0, 2000);

  let ragContextText = '';
  try {
    const ragDb = await getRagDb();
    try {
      const ragResult = await retrieveRagContext(ragDb.sql, {
        step: 'audit',
        targetBlocks: targetBlockIds,
        direction: knownDirection,
        queryText,
        topKSearch: 5,
        includePinned: true,
      });
      ragContextText = ragResult.formattedContext;
    } finally {
      await ragDb.close();
    }
  } catch (err) {
    deps.logger.warn('[auditPassport] RAG context unavailable, proceeding without RAG:', err);
  }

  // 4. Пакетный вызов Kimi
  const hasFilledOpenField = openSections.some((s) =>
    s.fields.some((f) => {
      const rec = records.find((r) => r.section_id === s.id && r.field_key === f);
      return !!rec?.value && rec.value.trim().length > 0;
    }),
  );
  const hasBudget = budgetItems.length > 0;
  const mode = lockedSections.length > 0 ? 'delta_reaudit' : 'primary_audit';

  let auditOutput: AuditOutput;
  if (hasFilledOpenField || hasBudget) {
    auditOutput = await callLlm(
      deps.llm,
      'audit',
      {
        mode,
        open_blocks: openSections.map((s) => ({
          section_id: s.id,
          fields: s.fields.map((f) => {
            const rec = records.find((r) => r.section_id === s.id && r.field_key === f);
            const val = rec?.value ?? null;
            return {
              field_key: f,
              value: val ? wrapUntrustedData(`field:${s.id}/${f}`, val) : null,
              review_status: rec?.review_status ?? 'draft',
              claims: (rec?.claims ?? []).map((c) => ({
                claim_text: c.claim_text,
                claim_type: c.claim_type,
                verification_status: c.verification_status,
              })),
            };
          }),
        })),
        locked_blocks: lockedSections.map((s) => ({
          section_id: s.id,
          fields: s.fields.map((f) => ({
            field_key: f,
            value: records.find((r) => r.section_id === s.id && r.field_key === f)?.value ?? null,
          })),
        })),
        budget_items: budgetItems.map((b) => ({
          stage: b.stage,
          category: b.category,
          title: b.title,
          quantity: b.quantity,
          unit_price: b.unit_price,
          amount: b.amount,
          justification: b.justification,
        })),
        code_warnings: codeWarnings,
        rag_context: ragContextText,
      },
      auditOutputSchema,
    );
  } else {
    auditOutput = {
      fatal_stop_factors: [],
      block_audits: openSections.map((s) => ({
        section_id: s.id,
        status: 'needs_revision',
        remark: `Блок ${s.id} не заполнен.`,
        how_to_fix: `Заполните обязательные поля блока ${s.id}.`,
        failed_fields: s.fields.filter((f) => !OPTIONAL_FIELDS.has(`${s.id}/${f}`)),
      })),
      budget_audit: {
        status: 'not_provided',
        remark: null,
        how_to_fix: null,
      },
    };
  }

  // 5. Обработка вердикта и обновление замков в БД
  const shouldUpdateDbLocks =
    typeof (deps.llm as any).hasOverride === 'function'
      ? (deps.llm as any).hasOverride('audit')
      : true;

  const fatalStopFactorsOut: FatalStopFactorOut[] = (auditOutput.fatal_stop_factors ?? []).map((f) => ({
    code: f.code,
    reason: f.reason,
    how_to_fix: f.how_to_fix,
    affected_sections: f.affected_sections?.length ? f.affected_sections : [3, 4],
  }));

  const fatalSections = new Set<number>();
  for (const f of fatalStopFactorsOut) {
    for (const s of f.affected_sections) {
      fatalSections.add(s);
    }
  }

  // При обнаружении фатального стоп-фактора затронутые секции принудительно размораживаются
  if (shouldUpdateDbLocks && fatalSections.size > 0) {
    for (const sId of fatalSections) {
      const sec = PASSPORT_SECTIONS.find((s) => s.id === sId);
      if (!sec) continue;
      const targets = sec.fields.map((f) => ({ section_id: sId, field_key: f }));
      await deps.store.markFieldsNeedsReview(projectId, targets);
    }
  }

  const finalBlockAudits: BlockAuditOut[] = [];
  const sectionsToApprove: number[] = [];

  for (const s of openSections) {
    const emptyFields: string[] = [];
    for (const f of s.fields) {
      if (OPTIONAL_FIELDS.has(`${s.id}/${f}`)) continue;
      const rec = records.find((r) => r.section_id === s.id && r.field_key === f);
      const minLen = CODE_FIELDS.has(`${s.id}/${f}`) ? 0 : MIN_FIELD_LENGTH;
      if (!rec?.value || rec.value.trim().length <= minLen) {
        emptyFields.push(f);
      }
    }

    const kimiAudit = auditOutput.block_audits.find((b) => b.section_id === s.id);
    const isFatal = fatalSections.has(s.id);
    const hasMismatch = s.id === 4 && !!mismatch;
    const noveltyPassed = s.id === 6
      ? (auditOutput.novelty_audit
          ? auditOutput.novelty_audit.passed !== false &&
            auditOutput.novelty_audit.analogues_count >= 2 &&
            auditOutput.novelty_audit.has_measurable_comparison
          : true)
      : true;

    const canApprove =
      emptyFields.length === 0 &&
      !isFatal &&
      !hasMismatch &&
      kimiAudit?.status === 'approved' &&
      noveltyPassed;

    if (canApprove) {
      sectionsToApprove.push(s.id);
      finalBlockAudits.push({
        section_id: s.id,
        status: 'approved',
        remark: null,
        how_to_fix: null,
        failed_fields: [],
      });
    } else {
      const failedFields = Array.from(new Set([...emptyFields, ...(kimiAudit?.failed_fields ?? [])]));
      if (failedFields.length === 0) {
        if (isFatal) failedFields.push(...s.fields.filter((f) => !OPTIONAL_FIELDS.has(`${s.id}/${f}`)));
        if (hasMismatch) failedFields.push('tech_challenge');
      }

      let remark = kimiAudit?.remark ?? null;
      let howToFix = kimiAudit?.how_to_fix ?? null;

      if (isFatal) {
        const fatal = fatalStopFactorsOut.find((f) => f.affected_sections.includes(s.id));
        if (fatal) {
          remark = `[Фатальный стоп-фактор: ${fatal.code}] ${fatal.reason}`;
          howToFix = fatal.how_to_fix;
        }
      } else if (hasMismatch) {
        remark = `[Критерий: Научно-техническая обоснованность] Несоответствие направления и технологического вызова: ${mismatch}`;
        howToFix = 'Выберите технологический вызов, соответствующий тематическому направлению проекта (Блок 4).';
      } else if (emptyFields.length > 0 && !remark) {
        remark = `В Блоке ${s.id} не заполнены обязательные поля: ${emptyFields.join(', ')}.`;
        howToFix = `Заполните обязательные поля: ${emptyFields.join(', ')}.`;
      }

      finalBlockAudits.push({
        section_id: s.id,
        status: 'needs_review',
        remark,
        how_to_fix: howToFix,
        failed_fields: failedFields,
      });

      if (shouldUpdateDbLocks) {
        const targetsToMark = (failedFields.length > 0 ? failedFields : s.fields).map((fk) => ({
          section_id: s.id,
          field_key: fk,
        }));
        await deps.store.markFieldsNeedsReview(projectId, targetsToMark);
      }
    }
  }

  if (shouldUpdateDbLocks && sectionsToApprove.length > 0) {
    await deps.store.approveSectionFields(projectId, sectionsToApprove);
  }

  // Обработка ранее заблокированных секций (locked)
  for (const s of lockedSections) {
    if (fatalSections.has(s.id)) {
      const fatal = fatalStopFactorsOut.find((f) => f.affected_sections.includes(s.id));
      finalBlockAudits.push({
        section_id: s.id,
        status: 'needs_review',
        remark: fatal ? `[Фатальный стоп-фактор: ${fatal.code}] ${fatal.reason}` : 'Обнаружен стоп-фактор проекта.',
        how_to_fix: fatal ? fatal.how_to_fix : 'Переформулируйте проект в гражданскую и научно-техническую плоскость.',
        failed_fields: s.fields.filter((f) => !OPTIONAL_FIELDS.has(`${s.id}/${f}`)),
      });
    } else {
      finalBlockAudits.push({
        section_id: s.id,
        status: 'approved',
        remark: null,
        how_to_fix: null,
        failed_fields: [],
      });
    }
  }

  finalBlockAudits.sort((a, b) => a.section_id - b.section_id);

  // Смысловая проверка сметы (budget_audit)
  let budgetAuditOut: BudgetAuditOut;
  if (budgetItems.length === 0) {
    budgetAuditOut = {
      status: 'not_provided',
      remark: null,
      how_to_fix: null,
      violations: [],
    };
  } else {
    const budgetHasNeedsReview = budgetItems.some((b) => b.review_status === 'needs_review');
    const budgetViolations = budgetErrors.map((e) => e.message);
    if (budgetHasNeedsReview) {
      budgetViolations.push('Смета: связанные блоки изменились. Подтвердите смету заново.');
    }
    const isBudgetKimiApproved = auditOutput.budget_audit?.status === 'approved' && !budgetHasNeedsReview;
    if (budgetViolations.length === 0 && isBudgetKimiApproved) {
      if (shouldUpdateDbLocks) await deps.store.approveBudgetItems(projectId);
      budgetAuditOut = {
        status: 'approved',
        remark: null,
        how_to_fix: null,
        violations: [],
      };
    } else {
      if (shouldUpdateDbLocks) await deps.store.markBudgetNeedsReview(projectId);
      budgetAuditOut = {
        status: 'needs_review',
        remark:
          auditOutput.budget_audit?.remark ??
          (budgetViolations.length > 0 ? budgetViolations.join('; ') : 'Смета требует доработки.'),
        how_to_fix:
          auditOutput.budget_audit?.how_to_fix ??
          'Скорректируйте статьи сметы в соответствии с правилами конкурса и ограничениями лимитов.',
        violations: budgetViolations,
      };
    }
  }

  const report: AuditReport = {
    mode,
    fatal_stop_factors: fatalStopFactorsOut,
    block_audits: finalBlockAudits,
    budget_audit: budgetAuditOut,
    novelty_audit: auditOutput.novelty_audit,
    created_at: new Date().toISOString(),
  };

  // Сохраняем сводный JSON отчёта аудита в служебную секцию 0
  await deps.store.upsertField(projectId, 0, 'latest_audit_report', JSON.stringify(report));

  return report;
}
