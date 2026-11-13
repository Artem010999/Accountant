// Анкета первичного допуска (v1.1, задача 1.1). Чистая логика без БД и LLM.
// Сами вопросы и тексты отказа живут в kb (manifest.json → eligibility), чтобы их можно было менять без кода.

export interface EligibilityQuestion {
  key: string;
  question: string;
  /** Ответ, при котором заявитель проходит проверку. */
  required_answer: boolean;
  /** Что показать, если ответ не совпал с required_answer. */
  reject_reason: string;
  /** Как исправить / что делать дальше. */
  how_to_fix: string;
}

export type EligibilityAnswerMap = Record<string, boolean>;

export interface EligibilityFailure {
  key: string;
  reason: string;
  how_to_fix: string;
}

export interface EligibilityResult {
  /** Все вопросы отвечены и ни один не нарушен. */
  passed: boolean;
  /** Ключи вопросов без ответа. Непустой список — анкету нужно дозаполнить, а не отказывать. */
  missing: string[];
  /** Нарушенные пункты: по каждому — причина и способ исправления. */
  failures: EligibilityFailure[];
}

export function checkEligibility(
  questions: readonly EligibilityQuestion[],
  answers: Partial<EligibilityAnswerMap> | null | undefined,
): EligibilityResult {
  const answered = (key: string): boolean | undefined => {
    const v = answers?.[key];
    return typeof v === 'boolean' ? v : undefined;
  };

  const missing = questions.filter((q) => answered(q.key) === undefined).map((q) => q.key);
  const failures: EligibilityFailure[] = questions
    .filter((q) => {
      const a = answered(q.key);
      return a !== undefined && a !== q.required_answer;
    })
    .map((q) => ({ key: q.key, reason: q.reject_reason, how_to_fix: q.how_to_fix }));

  return { passed: missing.length === 0 && failures.length === 0, missing, failures };
}
