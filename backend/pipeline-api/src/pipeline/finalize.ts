// Блок 4–5: проверка новизны (ШАГ 7 / G6 / STOP_NOV), Rule Engine (ШАГ 8.1), навигатор (ШАГ 8.2).
import { PASSPORT_SECTIONS, type PipelineCompleted, type PipelineQuestion, type PipelinePassportField } from '@passport/contracts';
import { evaluatePassportRules, type AuditableClaim } from '@passport/passport-core';
import { fieldKb } from '../kb/manifest';
import { callLlm, navigatorSchema, noveltySchema } from '../llm/schemas';
import { wrapUntrustedData } from '../promptGuard';
import type { RecordRow, UserContext } from '../db/store';
import type { PipelineDeps } from './deps';

const NOVELTY_SECTION = 6;
const NOVELTY_FIELD = 'analogues_comparison';

function valueOf(records: RecordRow[], sectionId: number, fieldKey: string): string {
  return records.find((r) => r.section_id === sectionId && r.field_key === fieldKey)?.value ?? '';
}

/** Возвращает либо вопрос STOP_NOV, либо итоговый паспорт (COMPLETED). */
export async function noveltyAndFinalize(
  deps: PipelineDeps,
  ctx: UserContext,
  projectId: string,
  records: RecordRow[],
  program: string,
): Promise<PipelineQuestion | PipelineCompleted> {
  const warnings: string[] = [];
  const extraChecklist: string[] = [];
  const { rules } = deps.kb;

  if (ctx.features.novelty_check) {
    const attempts = Number(records.find((r) => r.section_id === 0 && r.field_key === 'novelty_attempts')?.value ?? 0);

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

    const passed = res.analogues_count >= rules.min_analogues && res.has_measurable_comparison;
    if (!passed) {
      if (attempts < rules.max_novelty_retries) {
        // STOP_NOV: поле уходит в needs_review и становится пробелом для следующего ответа.
        await deps.store.markNeedsReview(projectId, NOVELTY_SECTION, NOVELTY_FIELD);
        await deps.store.upsertField(projectId, 0, 'novelty_attempts', String(attempts + 1));
        const kb = fieldKb(deps.kb, NOVELTY_SECTION, NOVELTY_FIELD);
        return {
          status: 'STOP_NOV',
          step: 'NOVELTY',
          target_field: { section_id: NOVELTY_SECTION, field_key: NOVELTY_FIELD },
          question: res.missing_details_question ?? kb.question,
          example: kb.example,
        };
      }
      warnings.push(
        `Проверка новизны пропущена после ${attempts} попыток: найдено аналогов ${res.analogues_count}, требуется минимум ${rules.min_analogues}. Стоп-фактор новизны зафиксирован.`,
      );
    }
  } else {
    extraChecklist.push('Проверка научно-технической новизны недоступна на базовом тарифе.');
  }

  return finalize(deps, ctx, projectId, records, program, warnings, extraChecklist);
}

async function finalize(
  deps: PipelineDeps,
  ctx: UserContext,
  projectId: string,
  records: RecordRow[],
  program: string,
  extraWarnings: string[],
  extraChecklist: string[],
): Promise<PipelineCompleted> {
  // TODO(разработчик, S3): фатальные стоп-факторы «тема не подходит ФСИ» (узлы 14–15 схемы) — новый терминальный статус.
  // Полный список причин и кто их решает (правило или модель) не определены (docs/PLAN-v1.1.md Q4).
  // TODO(разработчик, S4): проверки сметы и цифр (узлы 13 и 16) — сходимость статей, лимиты программы.
  // Правила не определены (docs/PLAN-v1.1.md Q5).
  const passportRecords = records.filter((r) => r.section_id >= 2);
  const allClaims: AuditableClaim[] = passportRecords.flatMap((r) => r.claims as unknown as AuditableClaim[]);

  const rules = evaluatePassportRules(
    ctx.founderData as { name?: string; status?: string },
    passportRecords.map((r) => ({ section_id: r.section_id, value: r.value })),
    allClaims,
    program,
  );

  const stats = {
    total: allClaims.length,
    confirmed: allClaims.filter((c) => c.verification_status.startsWith('confirmed')).length,
    unverified: allClaims.filter((c) => c.verification_status === 'unverified').length,
    orphaned: allClaims.filter((c) => c.verification_status === 'orphaned').length,
  };

  const nav = await callLlm(
    deps.llm,
    'navigator',
    {
      program,
      eligibility_status: rules.eligibility_status,
      stop_factors: rules.stop_factors,
      warnings: [...rules.warnings, ...extraWarnings],
      passport: passportRecords.map((r) => ({ section_id: r.section_id, field_key: r.field_key, value: r.value })),
      claims_stats: stats,
    },
    navigatorSchema,
  );

  const warnings = [...rules.warnings, ...extraWarnings];
  const checklist = [
    ...nav.checklist,
    ...rules.stop_factors.map((s) => `Устранить: ${s}`),
    ...extraChecklist,
  ];

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

  const passport: PipelinePassportField[] = passportRecords
    .filter((r) => PASSPORT_SECTIONS.some((s) => s.id === r.section_id))
    .map((r) => ({
      section_id: r.section_id,
      field_key: r.field_key,
      value: r.value,
      review_status: r.review_status,
      claims: r.claims.map((c) => ({
        claim_text: c.claim_text,
        claim_type: c.claim_type,
        claim_kind: (c.claim_kind ?? null) as PipelineCompleted['passport'][number]['claims'][number]['claim_kind'],
        source_id: c.source_id,
        source_locator: c.source_locator,
        span_start: c.span_start,
        span_end: c.span_end,
        order_index: c.order_index ?? 0,
        verification_status: c.verification_status,
      })),
    }));

  return {
    status: 'COMPLETED',
    eligibility_status: rules.eligibility_status,
    summary: nav.summary,
    checklist,
    warnings,
    passport,
  };
}
