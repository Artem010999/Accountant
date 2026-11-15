import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DirectionChallenge } from './DirectionChallenge';

const CHALLENGES = [
  { number: 1, direction: 'Н1', partner: 'АО «Тест»', topic: 'Алгоритмы для ИИ' },
  { number: 12, direction: 'Н2', partner: 'ООО «Мед»', topic: 'Диагностика по снимкам' },
  { number: 40, direction: 'Н2', partner: 'ООО «Мед»', topic: 'Тест-системы' },
];

describe('DirectionChallenge (направление и вызов)', () => {
  it('без выбранного направления отправку не делает', async () => {
    const onSubmit = vi.fn();
    render(<DirectionChallenge onSubmit={onSubmit} loadChallenges={async () => CHALLENGES} />);
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить направление' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Выберите направление.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('вызовы фильтруются по выбранному направлению', async () => {
    render(<DirectionChallenge onSubmit={vi.fn()} loadChallenges={async () => CHALLENGES} />);
    await userEvent.click(screen.getByRole('button', { name: 'Н2' }));
    const select = screen.getByLabelText('Технологический вызов (необязательно)');
    await waitFor(() => expect(select).toBeEnabled());
    expect(screen.getByRole('option', { name: '№ 12. Диагностика по снимкам' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '№ 40. Тест-системы' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Алгоритмы для ИИ/ })).not.toBeInTheDocument();
  });

  it('отправляет направление и выбранный вызов', async () => {
    const onSubmit = vi.fn();
    render(<DirectionChallenge onSubmit={onSubmit} loadChallenges={async () => CHALLENGES} />);
    await userEvent.click(screen.getByRole('button', { name: 'Н2' }));
    await userEvent.selectOptions(screen.getByLabelText('Технологический вызов (необязательно)'), '12');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить направление' }));
    expect(onSubmit).toHaveBeenCalledWith({ direction: 'Н2', challenge: '12' });
  });

  it('вызов необязателен: без него отправляется только направление', async () => {
    const onSubmit = vi.fn();
    render(<DirectionChallenge onSubmit={onSubmit} loadChallenges={async () => CHALLENGES} />);
    await userEvent.click(screen.getByRole('button', { name: 'Н1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить направление' }));
    expect(onSubmit).toHaveBeenCalledWith({ direction: 'Н1', challenge: undefined });
  });
});
