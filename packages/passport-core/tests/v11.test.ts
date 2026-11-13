// v1.1, блок 1: чистая логика — анкета допуска, калькулятор сметы, карта связанных блоков.
import { describe, expect, it } from 'vitest';
import {
  checkBudget,
  checkEligibility,
  dependentsOf,
  formatRub,
  BUDGET_NODE,
  type BudgetLimits,
  type BudgetLineItem,
  type EligibilityQuestion,
  evaluatePassportRules,
} from '../src/index';

const QUESTIONS: EligibilityQuestion[] = [
  { key: 'student', question: 'Студент?', required_answer: true, reject_reason: 'Нет статуса.', how_to_fix: 'Нужен статус.' },
  { key: 'open_fsi', question: 'Открытые заявки?', required_answer: false, reject_reason: 'Есть заявки.', how_to_fix: 'Закройте.' },
];

describe('checkEligibility (задача 1.1)', () => {
  it('все ответы совпали с требуемыми — пройдено', () => {
    expect(checkEligibility(QUESTIONS, { student: true, open_fsi: false })).toEqual({ passed: true, missing: [], failures: [] });
  });

  it('нарушенный пункт — не пройдено, с причиной и способом исправления', () => {
    const r = checkEligibility(QUESTIONS, { student: false, open_fsi: false });
    expect(r.passed).toBe(false);
    expect(r.failures).toEqual([{ key: 'student', reason: 'Нет статуса.', how_to_fix: 'Нужен статус.' }]);
    expect(r.missing).toEqual([]);
  });

  it('без ответа — не отказ, а список недостающих ключей', () => {
    const r = checkEligibility(QUESTIONS, { student: true });
    expect(r.passed).toBe(false);
    expect(r.failures).toEqual([]);
    expect(r.missing).toEqual(['open_fsi']);
  });

  it('ответ не boolean считается отсутствующим', () => {
    const r = checkEligibility(QUESTIONS, { student: 'да' as unknown as boolean, open_fsi: false });
    expect(r.missing).toEqual(['student']);
  });

  it('null/undefined ответы — все пункты недостающие', () => {
    expect(checkEligibility(QUESTIONS, null).missing).toEqual(['student', 'open_fsi']);
  });
});

const LIMITS: BudgetLimits = {
  total: 1_000_000,
  stage_1_max: 20_000,
  stage_2_max: 980_000,
  contractor_total_max: 250_000,
  equipment_unit_price_max: 150_000,
  salary_monthly_max: 100_000,
};

const VALID: BudgetLineItem[] = [
  { stage: 1, category: 'other', title: 'Консультации', quantity: 1, unit_price: 20_000, amount: 20_000 },
  { stage: 2, category: 'contractor', title: 'Подрядчик', quantity: 1, unit_price: 250_000, amount: 250_000 },
  { stage: 2, category: 'equipment', title: 'Ноутбук', quantity: 2, unit_price: 100_000, amount: 200_000 },
  { stage: 2, category: 'salary', title: 'Разработчик', quantity: 10, unit_price: 50_000, amount: 500_000 },
  { stage: 2, category: 'other', title: 'Хостинг', quantity: 1, unit_price: 30_000, amount: 30_000 },
];

const codes = (items: BudgetLineItem[], limits = LIMITS) => checkBudget(items, limits).map((v) => v.code);

describe('checkBudget (задача 1.3)', () => {
  it('корректная смета — нарушений нет', () => {
    expect(checkBudget(VALID, LIMITS)).toEqual([]);
  });

  it('пустая смета — EMPTY', () => {
    expect(codes([])).toEqual(['EMPTY']);
  });

  it('количество × цена не равно сумме — ARITHMETIC', () => {
    const items = VALID.map((i) => (i.title === 'Ноутбук' ? { ...i, amount: 150_000 } : i));
    expect(codes(items)).toContain('ARITHMETIC');
  });

  it('цена единицы техники выше лимита — EQUIPMENT_UNIT_LIMIT', () => {
    const items = VALID.map((i) => (i.category === 'equipment' ? { ...i, unit_price: 160_000, amount: 320_000 } : i));
    expect(codes(items)).toContain('EQUIPMENT_UNIT_LIMIT');
  });

  it('зарплата в месяц выше лимита — SALARY_MONTHLY_LIMIT', () => {
    const items = VALID.map((i) => (i.category === 'salary' ? { ...i, unit_price: 120_000, amount: 1_200_000 } : i));
    expect(codes(items)).toContain('SALARY_MONTHLY_LIMIT');
  });

  it('подрядчики суммарно выше лимита — CONTRACTOR_LIMIT', () => {
    const items: BudgetLineItem[] = [
      ...VALID.filter((i) => i.category !== 'contractor'),
      { stage: 2, category: 'contractor', title: 'Подрядчик А', quantity: 1, unit_price: 150_000, amount: 150_000 },
      { stage: 2, category: 'contractor', title: 'Подрядчик Б', quantity: 1, unit_price: 150_000, amount: 150_000 },
    ];
    expect(codes(items)).toContain('CONTRACTOR_LIMIT');
  });

  it('расходы 1-го этапа выше лимита — STAGE_1_LIMIT', () => {
    const items = VALID.map((i) => (i.title === 'Консультации' ? { ...i, unit_price: 30_000, amount: 30_000 } : i));
    expect(codes(items)).toContain('STAGE_1_LIMIT');
  });

  it('расходы 2-го этапа выше лимита — STAGE_2_LIMIT', () => {
    const items = [...VALID, { stage: 2 as const, category: 'other' as const, title: 'Доп', quantity: 1, unit_price: 10_000, amount: 10_000 }];
    expect(codes(items)).toContain('STAGE_2_LIMIT');
  });

  it('сумма не равна 1 000 000 — TOTAL_MISMATCH', () => {
    const items = VALID.map((i) => (i.title === 'Хостинг' ? { ...i, unit_price: 29_000, amount: 29_000 } : i));
    expect(codes(items)).toContain('TOTAL_MISMATCH');
  });

  it('лимиты читаются из параметров: поменяли — поменялась проверка', () => {
    expect(codes(VALID, { ...LIMITS, contractor_total_max: 100_000 })).toContain('CONTRACTOR_LIMIT');
  });

  it('сообщения по-русски с разделителем тысяч из неразрывных пробелов', () => {
    const items = VALID.map((i) => (i.title === 'Ноутбук' ? { ...i, amount: 150_000 } : i));
    const msg = checkBudget(items, LIMITS).find((v) => v.code === 'ARITHMETIC')!.message;
    expect(msg).toContain('200 000 ₽');
    expect(formatRub(1234.5)).toBe('1 234,50 ₽');
  });
});

describe('dependentsOf (задача 1.5)', () => {
  it('блок 2 → блоки 5, 9 и смета', () => {
    expect(dependentsOf([2]).sort(sortNodes)).toEqual([5, 9, BUDGET_NODE].sort(sortNodes));
  });

  it('блок 3 → блоки 4 и 7', () => {
    expect(dependentsOf([3]).sort(sortNodes)).toEqual([4, 7]);
  });

  it('смета → блоки 5 и 2', () => {
    expect(dependentsOf([BUDGET_NODE]).sort(sortNodes)).toEqual([2, 5]);
  });

  it('блок 8 → блок 9 и смета (регистрация ООО)', () => {
    expect(dependentsOf([8]).sort(sortNodes)).toEqual([9, BUDGET_NODE].sort(sortNodes));
  });

  it('узлы, изменённые в том же запросе, не помечаются повторно', () => {
    // 2 → 5 и 9; 5 изменён сам — из результата уходит
    expect(dependentsOf([2, 5]).sort(sortNodes)).toEqual([9, BUDGET_NODE].sort(sortNodes));
  });

  it('без изменений — пусто; каскада нет (только прямые зависимые)', () => {
    expect(dependentsOf([])).toEqual([]);
    // 2 → 5 → (смета, 2): транзитивно смета и 2 не добавляются сверх прямых для узла 2
    expect(dependentsOf([2])).not.toContain(2);
  });

  it('одинаковые зависимые от нескольких узлов — один раз', () => {
    const r = dependentsOf([2, 8]); // оба ведут к 9 и смете
    expect(r.filter((n) => n === 9)).toHaveLength(1);
    expect(r.filter((n) => n === BUDGET_NODE)).toHaveLength(1);
  });
});

describe('evaluatePassportRules: ФИО и дополнительные стоп-факторы', () => {
  const full = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((section_id) => ({ section_id, value: 'заполнено текстом' }));

  it('ФИО в ключе full_name — ФИО найдено', () => {
    const r = evaluatePassportRules({ full_name: 'Иван Иванов', status: 'student' }, full, []);
    expect(r.stop_factors.join(' ')).not.toContain('ФИО');
  });

  it('старый ключ name больше не считается ФИО', () => {
    const r = evaluatePassportRules({ name: 'Иван Иванов' } as { full_name?: string }, full, []);
    expect(r.stop_factors.join(' ')).toContain('ФИО');
  });

  it('дополнительные стоп-факторы попадают в итог и делают статус NOT_ELIGIBLE', () => {
    const r = evaluatePassportRules({ full_name: 'Иван', status: 'student' }, full, [], 'Студенческий стартап', ['Смета: тест']);
    expect(r.stop_factors).toContain('Смета: тест');
    expect(r.eligibility_status).toBe('NOT_ELIGIBLE');
  });
});

function sortNodes(a: number | string, b: number | string): number {
  return String(a).localeCompare(String(b));
}
