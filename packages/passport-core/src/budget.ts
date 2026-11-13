// Калькулятор сметы и лимитов (v1.1, задача 1.3). Только арифметика и пороги, без ИИ.
// Лимиты передаются снаружи: в пайплайне — активная редакция из таблицы budget_limit_sets.

import type { BudgetCategory } from '@passport/contracts';

export interface BudgetLineItem {
  stage: 1 | 2;
  category: BudgetCategory;
  title: string;
  quantity: number;
  /** Цена за единицу. Для зарплаты — ₽ в месяц (quantity = число месяцев). */
  unit_price: number;
  amount: number;
}

export interface BudgetLimits {
  /** Общая сумма гранта, ₽. */
  total: number;
  stage_1_max: number;
  stage_2_max: number;
  /** Все работы подрядчиков вместе, ₽. */
  contractor_total_max: number;
  /** Цена одной единицы техники, ₽. */
  equipment_unit_price_max: number;
  /** Зарплата за месяц, ₽. */
  salary_monthly_max: number;
}

export type BudgetViolationCode =
  | 'EMPTY'
  | 'ARITHMETIC'
  | 'EQUIPMENT_UNIT_LIMIT'
  | 'SALARY_MONTHLY_LIMIT'
  | 'CONTRACTOR_LIMIT'
  | 'STAGE_1_LIMIT'
  | 'STAGE_2_LIMIT'
  | 'TOTAL_MISMATCH';

export interface BudgetViolation {
  code: BudgetViolationCode;
  message: string;
}

/** Разделитель тысяч — неразрывный пробел, как в типографике ТЗ. */
export function formatRub(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const [int, frac] = rounded.toFixed(2).split('.');
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return frac === '00' ? `${grouped} ₽` : `${grouped},${frac} ₽`;
}

const EPS = 0.005; // копейки

export function checkBudget(items: readonly BudgetLineItem[], limits: BudgetLimits): BudgetViolation[] {
  if (items.length === 0) {
    return [{ code: 'EMPTY', message: 'Смета не заполнена.' }];
  }

  const violations: BudgetViolation[] = [];

  for (const item of items) {
    const expected = item.quantity * item.unit_price;
    if (Math.abs(expected - item.amount) > EPS) {
      violations.push({
        code: 'ARITHMETIC',
        message: `Статья «${item.title}»: количество × цена = ${formatRub(expected)}, а в сумме указано ${formatRub(item.amount)}.`,
      });
    }
    if (item.category === 'equipment' && item.unit_price > limits.equipment_unit_price_max) {
      violations.push({
        code: 'EQUIPMENT_UNIT_LIMIT',
        message: `Статья «${item.title}»: цена за единицу техники ${formatRub(item.unit_price)} превышает лимит ${formatRub(limits.equipment_unit_price_max)}.`,
      });
    }
    if (item.category === 'salary' && item.unit_price > limits.salary_monthly_max) {
      violations.push({
        code: 'SALARY_MONTHLY_LIMIT',
        message: `Статья «${item.title}»: зарплата ${formatRub(item.unit_price)} в месяц превышает лимит ${formatRub(limits.salary_monthly_max)} в месяц.`,
      });
    }
  }

  const sum = (pred: (i: BudgetLineItem) => boolean) => items.filter(pred).reduce((s, i) => s + i.amount, 0);

  const contractors = sum((i) => i.category === 'contractor');
  if (contractors > limits.contractor_total_max + EPS) {
    violations.push({
      code: 'CONTRACTOR_LIMIT',
      message: `Работы подрядчиков составляют ${formatRub(contractors)}, лимит — ${formatRub(limits.contractor_total_max)}.`,
    });
  }

  const stage1 = sum((i) => i.stage === 1);
  if (stage1 > limits.stage_1_max + EPS) {
    violations.push({
      code: 'STAGE_1_LIMIT',
      message: `Расходы 1-го этапа составляют ${formatRub(stage1)}, лимит — ${formatRub(limits.stage_1_max)}.`,
    });
  }

  const stage2 = sum((i) => i.stage === 2);
  if (stage2 > limits.stage_2_max + EPS) {
    violations.push({
      code: 'STAGE_2_LIMIT',
      message: `Расходы 2-го этапа составляют ${formatRub(stage2)}, лимит — ${formatRub(limits.stage_2_max)}.`,
    });
  }

  const total = sum(() => true);
  if (Math.abs(total - limits.total) > EPS) {
    violations.push({
      code: 'TOTAL_MISMATCH',
      message: `Сумма сметы ${formatRub(total)} не равна ${formatRub(limits.total)}.`,
    });
  }

  return violations;
}
