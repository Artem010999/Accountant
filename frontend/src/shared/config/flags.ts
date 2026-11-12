// Feature flags фронтенда. Решение владельца: оплаты пока нет, поэтому все функции доступны,
// по умолчанию тариф «Премиум», а прототипные элементы оплаты скрыты.
// Значения менять здесь, не в компонентах.

export const FLAGS = {
  /** TRUE = скрыть всё, что относится к платёжному шлюзу и прототипным кнопкам оплаты
   *  («ошибка», «ожидание», переключатели тарифа в окне оплаты). */
  HIDE_PAYMENT_GATEWAY: true,
  /** TRUE = все функции тарифа доступны независимо от подписки. */
  ALL_FEATURES_ENABLED: true,
} as const;

/** План, который считается текущим, пока оплаты нет. */
export const DEFAULT_PLAN_ID = 'premium' as const;

/** Функции тарифа, которые проверяет интерфейс (как в features billing_plans). */
export function planFeatures(planFeatures: {
  ai_parsing?: boolean;
  novelty_check?: boolean;
  consultant?: boolean;
}): { ai_parsing: boolean; novelty_check: boolean; consultant: boolean } {
  return {
    ai_parsing: FLAGS.ALL_FEATURES_ENABLED || Boolean(planFeatures.ai_parsing),
    novelty_check: FLAGS.ALL_FEATURES_ENABLED || Boolean(planFeatures.novelty_check),
    consultant: FLAGS.ALL_FEATURES_ENABLED || Boolean(planFeatures.consultant),
  };
}
