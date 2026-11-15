import { useState, type FormEvent } from 'react';
import type { BudgetItemInput } from '@passport/contracts';
import { Button, Notice } from '../../shared/ui';
import '../onboarding/common.css';
import './BudgetTable.css';

// Таблица сметы (блок «Смета»): статьи по этапам, группы расходов, количество, цена, сумма, обоснование.
// Новый элемент: макета в дизайне нет, оформлен классами онбординга и токенами.

type Category = BudgetItemInput['category'];

export const BUDGET_CATEGORIES: { id: Category; label: string }[] = [
  { id: 'salary', label: 'Оплата труда' },
  { id: 'equipment', label: 'Оборудование' },
  { id: 'ip_and_premises', label: 'ИС и помещения' },
  { id: 'contractor', label: 'Сторонние исполнители' },
  { id: 'other', label: 'Иные расходы' },
];

interface Row {
  stage: '1' | '2';
  category: Category;
  title: string;
  quantity: string;
  unit_price: string;
  amount: string;
  justification: string;
}

function emptyRow(): Row {
  return { stage: '1', category: 'other', title: '', quantity: '', unit_price: '', amount: '', justification: '' };
}

export interface BudgetTableProps {
  onSubmit: (items: BudgetItemInput[]) => void;
  /** Нарушения, которые пришли с бэкенда (budget_audit.violations или причина шага сметы). */
  violations?: string[];
  busy?: boolean;
}

export function BudgetTable({ onSubmit, violations = [], busy = false }: BudgetTableProps) {
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [error, setError] = useState<string | null>(null);

  function update(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  const total = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const items: BudgetItemInput[] = [];
    for (const [i, r] of rows.entries()) {
      const quantity = Number(r.quantity);
      const unit_price = Number(r.unit_price);
      const amount = Number(r.amount);
      if (!r.title.trim() || !(quantity > 0) || !(unit_price >= 0) || !(amount >= 0)) {
        setError(`Заполните статью ${i + 1}: название, количество (больше нуля), цена и сумма.`);
        return;
      }
      items.push({
        stage: Number(r.stage) as 1 | 2,
        category: r.category,
        title: r.title.trim(),
        quantity,
        unit_price,
        amount,
        justification: r.justification.trim(),
      });
    }
    setError(null);
    onSubmit(items);
  }

  return (
    <form className="bt-form" onSubmit={submit} noValidate>
      {violations.map((v) => (
        <Notice key={v} tone="warning" title="Смета требует доработки">
          {v}
        </Notice>
      ))}
      {rows.map((r, i) => (
        <fieldset key={i} className="bt-row">
          <legend className="ob-label ob-label--strong">{`Статья ${i + 1}`}</legend>
          <label className="ob-label">
            Этап
            <select className="ob-select" value={r.stage} onChange={(e) => update(i, { stage: e.target.value as '1' | '2' })}>
              <option value="1">Этап 1</option>
              <option value="2">Этап 2</option>
            </select>
          </label>
          <label className="ob-label">
            Группа расходов
            <select className="ob-select" value={r.category} onChange={(e) => update(i, { category: e.target.value as Category })}>
              {BUDGET_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="ob-label">
            Статья
            <input className="ob-input" type="text" value={r.title} onChange={(e) => update(i, { title: e.target.value })} />
          </label>
          <label className="ob-label">
            Количество
            <input className="ob-input" type="number" min="0" step="any" value={r.quantity} onChange={(e) => update(i, { quantity: e.target.value })} />
          </label>
          <label className="ob-label">
            Цена за единицу, ₽
            <input className="ob-input" type="number" min="0" step="any" value={r.unit_price} onChange={(e) => update(i, { unit_price: e.target.value })} />
          </label>
          <label className="ob-label">
            Сумма, ₽
            <input className="ob-input" type="number" min="0" step="any" value={r.amount} onChange={(e) => update(i, { amount: e.target.value })} />
          </label>
          <label className="ob-label">
            Обоснование
            <textarea className="ob-textarea" rows={2} value={r.justification} onChange={(e) => update(i, { justification: e.target.value })} />
          </label>
          {rows.length > 1 && (
            <Button variant="outline" onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}>
              Удалить статью
            </Button>
          )}
        </fieldset>
      ))}
      <p className="bt-total">{`Итого по смете: ${total.toLocaleString('ru-RU')} ₽`}</p>
      <Button variant="outline" onClick={() => setRows((prev) => [...prev, emptyRow()])}>
        Добавить статью
      </Button>
      {error && (
        <p role="alert" className="bt-error">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={busy}>
        Сохранить смету
      </Button>
    </form>
  );
}
