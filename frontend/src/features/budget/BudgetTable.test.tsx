import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BudgetTable } from './BudgetTable';

describe('BudgetTable (смета)', () => {
  it('пустая статья не отправляется, показываем какую заполнить', async () => {
    const onSubmit = vi.fn();
    render(<BudgetTable onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить смету' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Заполните статью 1');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('заполненная статья уходит на бэкенд с числами и группой расходов', async () => {
    const onSubmit = vi.fn();
    render(<BudgetTable onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Статья'), 'Ноутбук');
    await userEvent.type(screen.getByLabelText('Количество'), '2');
    await userEvent.type(screen.getByLabelText('Цена за единицу, ₽'), '100000');
    // Сумма не вводится: считается как количество × цена (неразрывный пробел в тысячах — через \s).
    expect(screen.getByText(/Сумма: 200\s000 ₽ \(количество × цена\)/)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Группа расходов'), 'equipment');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить смету' }));
    expect(onSubmit).toHaveBeenCalledWith([
      {
        stage: 1,
        category: 'equipment',
        title: 'Ноутбук',
        quantity: 2,
        unit_price: 100000,
        amount: 200000,
        justification: '',
      },
    ]);
  });

  it('можно добавить и удалить статью, итог пересчитывается', async () => {
    render(<BudgetTable onSubmit={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Добавить статью' }));
    expect(screen.getAllByRole('group').filter((g) => g.tagName === 'FIELDSET')).toHaveLength(2);
    await userEvent.click(screen.getAllByRole('button', { name: 'Удалить статью' })[0]!);
    // Одна строка остаётся, кнопка удаления для единственной строки скрыта.
    expect(screen.queryAllByRole('button', { name: 'Удалить статью' })).toHaveLength(0);
    expect(screen.getAllByRole('group').filter((g) => g.tagName === 'FIELDSET')).toHaveLength(1);
  });

  it('нарушения с бэкенда видны над таблицей', () => {
    render(<BudgetTable onSubmit={vi.fn()} violations={['Статья «Ноутбук»: количество × цена = 200 000 ₽']} />);
    expect(screen.getByText('Смета требует доработки')).toBeInTheDocument();
    expect(screen.getByText(/Статья «Ноутбук»: количество × цена/)).toBeInTheDocument();
  });
});
