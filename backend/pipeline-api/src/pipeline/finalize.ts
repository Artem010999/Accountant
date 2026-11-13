// Блок 4–5: проверка новизны (ШАГ 7 / G6 / STOP_NOV), Rule Engine (ШАГ 8.1), детерминированный навигатор (ШАГ 8.2).
import { PASSPORT_SECTIONS, type PipelineCompleted, type PipelineQuestion, type PipelinePassportField } from '@passport/contracts';
import { checkBudget, evaluatePassportRules, type AuditableClaim } from '@passport/passport-core';
import { fieldKb } from '../kb/manifest';
import { callLlm, noveltySchema } from '../llm/schemas';
import { wrapUntrustedData } from '../promptGuard';
import type { BudgetRow, RecordRow, UserContext } from '../db/store';
import type { PipelineDeps } from './deps';
import { challengeDirectionMismatch } from './fieldValidation';
import { invalidateDependents } from './invalidation';
import { buildPassportFields } from './passport';
import type { AuditReport } from './audit';

const NOVELTY_SECTION = 6;
const NOVELTY_FIELD = 'analogues_comparison';
const OPTIONAL_FIELDS = new Set(['4/tech_challenge']);

function valueOf(records: RecordRow[], sectionId: number, fieldKey: string): string {
  return records.find((r) => r.section_id === sectionId && r.field_key === fieldKey)?.value ?? '';
}

export interface DeterministicNavigatorOpts {
  eligibility_status: 'ELIGIBLE' | 'NEEDS_CLARIFICATION' | 'NOT_ELIGIBLE';
  stop_factors: string[];
  records: RecordRow[];
  claims_stats: {
    total: number;
    confirmed: number;
    unverified: number;
    orphaned: number;
  };
  budgetItems: BudgetRow[];
  extraChecklist: string[];
}

/** Детерминированный генератор финального резюме и чек-листа (ШАГ 8 без LLM). */
export function buildDeterministicNavigator(opts: DeterministicNavigatorOpts): {
  summary: string;
  checklist: string[];
} {
  const { eligibility_status, stop_factors, records, claims_stats, budgetItems, extraChecklist } = opts;

  // 1. Статус допуска
  const statusText =
    eligibility_status === 'ELIGIBLE'
      ? 'проект допущен к конкурсу (ELIGIBLE)'
      : eligibility_status === 'NEEDS_CLARIFICATION'
        ? 'проект требует подтверждения данных (NEEDS_CLARIFICATION)'
        : 'проект не допущен к конкурсу (NOT_ELIGIBLE)';

  // 2. Сколько секций из 9 (блоки 2-10) получили статус approved
  let approvedSectionsCount = 0;
  for (const s of PASSPORT_SECTIONS) {
    const reqFields = s.fields.filter((f) => !OPTIONAL_FIELDS.has(`${s.id}/${f}`));
    const isApproved = reqFields.every((f) => {
      const rec = records.find((r) => r.section_id === s.id && r.field_key === f);
      return rec && rec.review_status === 'approved';
    });
    if (isApproved) approvedSectionsCount++;
  }

  // 3. Выбранное направление и технологический вызов
  const direction = records.find((r) => r.section_id === 4 && r.field_key === 'direction')?.value;
  const challenge = records.find((r) => r.section_id === 4 && r.field_key === 'tech_challenge')?.value;
  const dirText = direction ? `Тематическое направление: ${direction}` : 'Тематическое направление: не указано';
  const chalText = challenge ? `, технологический вызов №${challenge}` : '';

  // 4. Статистика утверждений
  const allClaims = records.flatMap((r) => r.claims);
  const planCount = allClaims.filter((c) => c.claim_type === 'plan').length;
  const hypothesisCount = allClaims.filter((c) => c.claim_type === 'hypothesis').length;
  const claimsText = `Утверждения: подтверждено документами — ${claims_stats.confirmed}, заявлено со слов — ${claims_stats.unverified}, планов — ${planCount}, гипотез — ${hypothesisCount}.`;

  // 5. Статус сметы
  let budgetText = 'Смета не заполнена.';
  if (budgetItems.length > 0) {
    const allApproved = budgetItems.every((b) => b.review_status === 'approved');
    budgetText = allApproved ? 'Смета: утверждена (approved 🔒).' : 'Смета: требует проверки/доработки.';
  }

  const summary = [
    `Статус допуска: ${statusText}.`,
    `Согласовано разделов: ${approvedSectionsCount} из 9.`,
    `${dirText}${chalText}.`,
    claimsText,
    budgetText,
  ].join(' ');

  // Пошаговый чек-лист подачи в АС «Фонд-М» по правилам 8-й очереди
  const checklist: string[] = [
    'Подготовить справку об обучении из вуза на официальном бланке (выдана не ранее даты объявления конкурса — 29.10.2026).',
    'Подготовить справку от вуза о согласии на участие и об использовании РИД на бланке организации (не ранее 29.10.2026).',
    'Подготовить скан паспорта РФ (разворот с фото + страница с действующей регистрацией) единым PDF-файлом.',
    'Подготовить презентацию стартап-проекта (PDF или PPTX) и согласие на обработку персональных данных.',
    'Проверить подписи документов: при использовании откреплённой электронной подписи (ЭП) приложить файлы .sig, .sgn или .p7s вместе с PDF.',
  ];

  if (claims_stats.unverified > 0) {
    checklist.push(
      'Приложить подтверждающие документы (протоколы испытаний, письма поддержки или акты пилотов) для заявленных фактических достижений.',
    );
  }

  for (const s of stop_factors) {
    checklist.push(`Устранить: ${s}`);
  }

  for (const extra of extraChecklist) {
    checklist.push(extra);
  }

  return { summary, checklist };
}

/** Возвращает либо вопрос STOP_NOV, либо итоговый паспорт (COMPLETED). */
export async function noveltyAndFinalize(
  deps: PipelineDeps,
  ctx: UserContext,
  projectId: string,
  records: RecordRow[],
  program: string,
  auditReport?: AuditReport,
): Promise<PipelineQuestion | PipelineCompleted> {
  const warnings: string[] = [];
  const extraChecklist: string[] = [];
  const { rules } = deps.kb;

  if (ctx.features.novelty_check) {
    const attempts = Number(records.find((r) => r.section_id === 0 && r.field_key === 'novelty_attempts')?.value ?? 0);

    const hasNoveltyOverride =
      typeof (deps.llm as any).hasOverride === 'function'
        ? (deps.llm as any).hasOverride('novelty')
        : Boolean((deps.llm as any).overrides?.novelty);

    let passed: boolean;
    let missingQuestion: string | null | undefined;
    let analoguesCount: number;

    if (hasNoveltyOverride || !auditReport?.novelty_audit) {
      const res = await callLlm(
        deps.llm,
        'novelty',
        {
          tech_approach: wrapUntrustedData('tech_approach', valueOf(records, 4, 'tech_approach')),
          analogues_comparison: wrapUntrustedData('analogues_comparison', valueOf(records, NOVELTY_SECTION, NOVELTY_FIELD)),
          novelty_hypothesis: wrapUntrustedData('novelty_hypothesis', valueOf(records, NOVELTY_SECTION, 'novelty_hypothesis')),
          verification_protocol: wrapUntrustedData('verification_protocol', valueOf(records, NOVELTY_SECTION, 'verification_protocol')),
          criteria: deps.kb.novelty_criteria,
          min_analogues: rules.min_analogues,
        },
        noveltySchema,
      );
      analoguesCount = res.analogues_count;
      passed = res.analogues_count >= rules.min_analogues && res.has_measurable_comparison;
      missingQuestion = res.missing_details_question;
    } else {
      const na = auditReport.novelty_audit;
      analoguesCount = na.analogues_count;
      passed = na.passed !== false && na.analogues_count >= rules.min_analogues && na.has_measurable_comparison;
      missingQuestion = na.how_to_fix ?? na.remark;
    }

    if (!passed) {
      if (attempts < rules.max_novelty_retries) {
        // STOP_NOV: поле уходит в needs_review и становится пробелом для следующего ответа.
        await deps.store.markNeedsReview(projectId, NOVELTY_SECTION, NOVELTY_FIELD);
        await invalidateDependents(deps.store, projectId, [NOVELTY_SECTION]);
        await deps.store.upsertField(projectId, 0, 'novelty_attempts', String(attempts + 1));
        const kb = fieldKb(deps.kb, NOVELTY_SECTION, NOVELTY_FIELD);
        const passport = buildPassportFields(records);
        return {
          status: 'STOP_NOV',
          step: 'NOVELTY',
          target_field: { section_id: NOVELTY_SECTION, field_key: NOVELTY_FIELD },
          question: missingQuestion ?? kb.question,
          example: kb.example,
          block_audits: auditReport?.block_audits,
          budget_audit: auditReport?.budget_audit,
          fatal_stop_factors: auditReport?.fatal_stop_factors,
          passport,
        };
      }
      warnings.push(
        `Проверка новизны пропущена после ${attempts} попыток: найдено аналогов ${analoguesCount}, требуется минимум ${rules.min_analogues}. Стоп-фактор новизны зафиксирован.`,
      );
    }
  } else {
    extraChecklist.push('Проверка научно-технической новизны недоступна на базовом тарифе.');
  }

  return finalize(deps, ctx, projectId, records, program, warnings, extraChecklist, auditReport);
}

async function finalize(
  deps: PipelineDeps,
  ctx: UserContext,
  projectId: string,
  records: RecordRow[],
  program: string,
  extraWarnings: string[],
  extraChecklist: string[],
  auditReport?: AuditReport,
): Promise<PipelineCompleted> {
  const passportRecords = records.filter((r) => r.section_id >= 2);
  const allClaims: AuditableClaim[] = passportRecords.flatMap((r) => r.claims as unknown as AuditableClaim[]);

  // Смета — арифметика и лимиты
  const budgetItems = await deps.store.getBudgetItems(projectId);
  const limits = await deps.store.getBudgetLimits();
  const budgetStopFactors = checkBudget(budgetItems, limits).map((v) => `Смета: ${v.message}`);
  if (budgetItems.some((b) => b.review_status === 'needs_review')) {
    budgetStopFactors.push('Смета: связанные блоки изменились. Подтвердите смету заново.');
  }

  // Согласованность направления и технологического вызова
  const direction = valueOf(passportRecords, 4, 'direction');
  const challenge = valueOf(passportRecords, 4, 'tech_challenge');
  const mismatch = challengeDirectionMismatch(direction || null, challenge || null, deps.kb.tech_challenges);
  if (mismatch) budgetStopFactors.push(`Направление и вызов: ${mismatch}`);

  const rules = evaluatePassportRules(
    ctx.founderData,
    passportRecords.map((r) => ({ section_id: r.section_id, value: r.value })),
    allClaims,
    program,
    budgetStopFactors,
  );

  const stats = {
    total: allClaims.length,
    confirmed: allClaims.filter((c) => c.verification_status.startsWith('confirmed')).length,
    unverified: allClaims.filter((c) => c.verification_status === 'unverified').length,
    orphaned: allClaims.filter((c) => c.verification_status === 'orphaned').length,
  };

  // Детерминированный Шаг 8 (без вызова navigator в LLM)
  const nav = buildDeterministicNavigator({
    eligibility_status: rules.eligibility_status,
    stop_factors: rules.stop_factors,
    records: passportRecords,
    claims_stats: stats,
    budgetItems,
    extraChecklist,
  });

  const warnings = [...rules.warnings, ...extraWarnings];
  const checklist = nav.checklist;

  await deps.store.upsertField(
    projectId,
    0,
    'navigator_summary_and_checklist',
    JSON.stringify({
      eligibility_status: rules.eligibility_status,
      summary: nav.summary,
      checklist,
      warnings,
      calculated_at: new Date().toISOString(),
    }),
  );
  await deps.store.setProjectStatus(projectId, 'review');

  const passport = buildPassportFields(records);

  return {
    status: 'COMPLETED',
    eligibility_status: rules.eligibility_status,
    summary: nav.summary,
    checklist,
    warnings,
    passport,
    block_audits: auditReport?.block_audits,
    budget_audit: auditReport?.budget_audit,
    fatal_stop_factors: auditReport?.fatal_stop_factors,
  };
}
