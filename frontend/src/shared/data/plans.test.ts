import { describe, expect, it } from 'vitest';
import { AUTO_RESTORE_NOTE, formatRub, planActions, pluralDays, type PlanCardAction } from './plans';

describe('planActions: кнопки карточек по текущему тарифу', () => {
  it('текущий «Базовый» (free): Профессиональный и Премиум — «Улучшить», карточка Базовый не выводится', () => {
    expect(planActions('free', 23)).toEqual({
      free: { kind: 'hidden' },
      pro: { kind: 'button', label: 'Улучшить' },
      premium: { kind: 'button', label: 'Улучшить' },
    });
  });

  it('текущий «Профессиональный» (pro): Профессиональный — «Продлить», Премиум — «Улучшить», Базовый — текст без действия', () => {
    expect(planActions('pro', 23)).toEqual({
      free: { kind: 'note', text: AUTO_RESTORE_NOTE },
      pro: { kind: 'button', label: 'Продлить' },
      premium: { kind: 'button', label: 'Улучшить' },
    });
  });

  it('текущий «Премиум» (premium): Базовый — текст про возврат через N дней, Профессиональный — «Перейти на Pro», Премиум — «Продлить»', () => {
    expect(planActions('premium', 23)).toEqual({
      free: { kind: 'note', text: 'Вы вернётесь на данный тариф через 23 дня' },
      pro: { kind: 'button', label: 'Перейти на Pro' },
      premium: { kind: 'button', label: 'Продлить' },
    });
  });

  it('N берётся из параметра, а не захардкожен: 5 дней и 1 день', () => {
    const text = (action: PlanCardAction) => (action.kind === 'note' ? action.text : '');
    expect(text(planActions('premium', 5).free)).toBe('Вы вернётесь на данный тариф через 5 дней');
    expect(text(planActions('premium', 1).free)).toBe('Вы вернётесь на данный тариф через 1 день');
  });

  it('ни у одного текущего тарифа кнопок с суммой нет', () => {
    for (const current of ['free', 'pro', 'premium'] as const) {
      const actions = planActions(current, 23);
      for (const action of Object.values(actions)) {
        if (action.kind === 'button') expect(action.label).not.toMatch(/₽|\d/);
      }
    }
  });
});

describe('pluralDays: склонение «день»', () => {
  it.each([
    [1, 'день'],
    [2, 'дня'],
    [4, 'дня'],
    [5, 'дней'],
    [11, 'дней'],
    [12, 'дней'],
    [21, 'день'],
    [22, 'дня'],
    [23, 'дня'],
    [30, 'дней'],
    [111, 'дней'],
    [121, 'день'],
  ])('%i → %s', (count, word) => {
    expect(pluralDays(count)).toBe(word);
  });
});

describe('formatRub', () => {
  it('разряды пробелом, как в эталоне', () => {
    expect(formatRub(0)).toBe('0 ₽');
    expect(formatRub(990)).toBe('990 ₽');
    expect(formatRub(4990)).toBe('4 990 ₽');
  });
});
