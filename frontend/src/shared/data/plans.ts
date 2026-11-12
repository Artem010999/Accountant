// Тарифы «Буха». Источник значений name, price_rub, duration_days, file_uploads_limit,
// renewal_discount_percent, features — backend/supabase/seed/0001_settings_and_plans.sql (billing_plans).
// Поля description в seed нет: тексты ниже временные, подменяются данными админки.

export type PlanId = 'free' | 'pro' | 'premium';

export interface PlanFeatures {
  ai_parsing: boolean;
  novelty_check: boolean;
  consultant: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  price_rub: number;
  duration_days: number;
  file_uploads_limit: number;
  renewal_discount_percent: number;
  features: PlanFeatures;
  /** временный текст, подменяется данными админки */
  description: string;
}

export const PLANS: readonly Plan[] = [
  {
    id: 'free',
    name: 'Базовый',
    price_rub: 0,
    duration_days: 30,
    file_uploads_limit: 0,
    renewal_discount_percent: 0,
    features: { ai_parsing: false, novelty_check: false, consultant: false },
    // временный текст, подменяется данными админки
    description: 'Паспорт, анкета, стоп-факторы и экспорт. Без загрузки файлов и проверки новизны.',
  },
  {
    id: 'pro',
    name: 'Профессиональный',
    price_rub: 990,
    duration_days: 30,
    file_uploads_limit: 10,
    renewal_discount_percent: 15,
    features: { ai_parsing: true, novelty_check: true, consultant: false },
    // временный текст, подменяется данными админки
    description: 'До 10 файлов, разбор документов ИИ и проверка новизны.',
  },
  {
    id: 'premium',
    name: 'Премиум',
    price_rub: 4990,
    duration_days: 30,
    file_uploads_limit: 50,
    renewal_discount_percent: 10,
    features: { ai_parsing: true, novelty_check: true, consultant: true },
    // временный текст, подменяется данными админки
    description: 'До 50 файлов, разбор документов ИИ, проверка новизны и консультант.',
  },
];

export function getPlan(id: PlanId): Plan {
  const plan = PLANS.find((p) => p.id === id);
  if (!plan) throw new Error(`Неизвестный тариф: ${id}`);
  return plan;
}

/** Склонение слова «день» по числу: 1 день, 2 дня, 5 дней, 23 дня. */
export function pluralDays(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
  return 'дней';
}

/** Текст на карточке «Базовый» (как в эталоне): тариф включится сам после окончания платного. */
export const AUTO_RESTORE_NOTE = 'Включится автоматически после окончания платного тарифа';

/** Действие карточки тарифа: карточка скрыта, поясняющий текст или кнопка. */
export type PlanCardAction =
  | { kind: 'hidden' }
  | { kind: 'note'; text: string }
  | { kind: 'button'; label: string };

export interface PlanCardActions {
  free: PlanCardAction;
  pro: PlanCardAction;
  premium: PlanCardAction;
}

/**
 * Кнопки карточек тарифов по текущему тарифу (решение владельца).
 * daysLeft — оставшиеся дни подписки; нужны для текста на карточке «Базовый» при текущем «Премиум».
 * Карточка «Базовый» при текущем «Профессиональный» не оговорена владельцем: только текст, без действия (допущение в G3r2).
 * Карточка «Базовый» при текущем «Базовый» не выводится (как было раньше).
 */
export function planActions(currentPlanId: PlanId, daysLeft: number): PlanCardActions {
  const hidden: PlanCardAction = { kind: 'hidden' };
  const button = (label: string): PlanCardAction => ({ kind: 'button', label });
  const note = (text: string): PlanCardAction => ({ kind: 'note', text });

  switch (currentPlanId) {
    case 'free':
      return { free: hidden, pro: button('Улучшить'), premium: button('Улучшить') };
    case 'pro':
      return { free: note(AUTO_RESTORE_NOTE), pro: button('Продлить'), premium: button('Улучшить') };
    case 'premium':
      return {
        free: note(`Вы вернётесь на данный тариф через ${daysLeft} ${pluralDays(daysLeft)}`),
        pro: button('Перейти на Pro'),
        premium: button('Продлить'),
      };
  }
}

/** Цена в рублях с пробелом между разрядами, как в эталоне: 0 ₽, 990 ₽, 4 990 ₽. */
export function formatRub(amount: number): string {
  return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₽`;
}
