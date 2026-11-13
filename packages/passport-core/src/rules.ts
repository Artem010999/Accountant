// ШАГ 8.1 [Rule Engine] (ТЗ 3.6, п. 4). Детерминированная проверка стоп-факторов программы.
// Правила программы «Студенческий стартап» пока захардкожены; в целевой версии брать из kb (Вопрос 1).

import type { AuditableClaim } from './audit';

export type EligibilityStatus = 'ELIGIBLE' | 'NEEDS_CLARIFICATION' | 'NOT_ELIGIBLE';

export interface RuleRecord {
  section_id: number;
  value: string | null;
}

export interface RuleEngineResult {
  program: string;
  eligibility_status: EligibilityStatus;
  stop_factors: string[];
  warnings: string[];
}

/**
 * extraStopFactors — проверки, которые считаются вне правил (смета, согласованность направления и вызова).
 */
export function evaluatePassportRules(
  founderData: { full_name?: string; status?: string } | null,
  records: RuleRecord[],
  allClaims: AuditableClaim[],
  program = 'Студенческий стартап',
  extraStopFactors: readonly string[] = [],
): RuleEngineResult {
  const stopFactors: string[] = [];
  const warnings: string[] = [];

  if (program === 'Студенческий стартап') {
    if (!founderData?.full_name) {
      stopFactors.push('Не заполнено ФИО заявителя в профиле основателя (Блок 1).');
      // Ключ ФИО везде один — full_name (см. contracts FOUNDER_FIELD_KEYS).
    }
    if (!founderData?.status || !['student', 'postgraduate'].includes(founderData.status)) {
      warnings.push('Для программы «Студенческий стартап» необходимо подтвердить статус обучающегося вуза.');
    }
  }

  for (const secId of [2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    const filled = records.some((r) => r.section_id === secId && (r.value ?? '').trim().length > 0);
    if (!filled) stopFactors.push(`Не заполнен обязательный блок паспорта №${secId}.`);
  }

  stopFactors.push(...extraStopFactors);

  const bad = allClaims.filter((c) => c.verification_status === 'orphaned' || c.verification_status === 'rejected');
  if (bad.length > 0) {
    warnings.push(`Утверждения требуют перепроверки (${bad.length} шт. в статусе orphaned/rejected).`);
  }

  const unverifiedFacts = allClaims.filter((c) => c.claim_type === 'fact' && c.verification_status === 'unverified');
  if (unverifiedFacts.length > 0) {
    warnings.push(`Фактические достижения без подтверждающих документов (${unverifiedFacts.length} шт.).`);
  }

  const eligibility_status: EligibilityStatus =
    stopFactors.length > 0 ? 'NOT_ELIGIBLE' : warnings.length > 0 ? 'NEEDS_CLARIFICATION' : 'ELIGIBLE';

  return { program, eligibility_status, stop_factors: stopFactors, warnings };
}
