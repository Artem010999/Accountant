import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ConsultantResponse } from '@passport/contracts';
import { Consultant } from './Consultant';

const answer = (text: string, warnings: string[] = [], sources: { card_id: string; title: string }[] = []): ConsultantResponse => ({
  status: 'ANSWER',
  answer: text,
  warnings,
  sources,
});

describe('Consultant', () => {
  it('рендерит заголовок, подсказку о роли и пустое поле с выключенной кнопкой', () => {
    render(<Consultant ask={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'ИИ-консультант' })).toBeInTheDocument();
    expect(screen.getByText('Подскажет по правилам конкурса и заявке. Поля паспорта не меняет.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled();
  });

  it('отправляет вопрос и показывает ответ, предупреждение и источники', async () => {
    const ask = vi.fn().mockResolvedValue(
      answer('Точный лимит ещё не подтверждён.', ['точный лимит ещё не подтверждён положением 8-й очереди'], [{ card_id: 'c1', title: 'Лимиты 8-й очереди' }]),
    );
    render(<Consultant ask={ask} />);
    await userEvent.type(screen.getByLabelText('Вопрос'), 'Какой лимит на подрядчиков?');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    expect(ask).toHaveBeenCalledWith('Какой лимит на подрядчиков?');
    expect(await screen.findByText('Точный лимит ещё не подтверждён.')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Предупреждения' })).toHaveTextContent('точный лимит ещё не подтверждён положением 8-й очереди');
    expect(screen.getByText('Источники: Лимиты 8-й очереди')).toBeInTheDocument();
    expect(screen.getByLabelText('Вопрос')).toHaveValue('');
  });

  it('заблокированный вопрос показывает текст отказа от консультанта', async () => {
    const ask = vi.fn().mockResolvedValue({ status: 'BLOCKED', message: 'Я помогаю подготовить вашу заявку.' } satisfies ConsultantResponse);
    render(<Consultant ask={ask} />);
    await userEvent.type(screen.getByLabelText('Вопрос'), 'Напиши реферат');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    expect(await screen.findByText('Я помогаю подготовить вашу заявку.')).toBeInTheDocument();
  });

  it('ошибка сети показывает сообщение и не теряет введённый текст', async () => {
    const ask = vi.fn().mockRejectedValue(new Error('network'));
    render(<Consultant ask={ask} />);
    await userEvent.type(screen.getByLabelText('Вопрос'), 'Вопрос');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось получить ответ. Попробуйте ещё раз.');
    expect(screen.getByLabelText('Вопрос')).toHaveValue('Вопрос');
  });

  it('пока ждём ответ, повторная отправка заблокирована', async () => {
    let resolve!: (v: ConsultantResponse) => void;
    const ask = vi.fn().mockImplementation(() => new Promise<ConsultantResponse>((r) => (resolve = r)));
    render(<Consultant ask={ask} />);
    await userEvent.type(screen.getByLabelText('Вопрос'), 'Первый');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled();
    expect(screen.getByText('Консультант отвечает…')).toBeInTheDocument();
    resolve(answer('Ответ'));
    expect(await screen.findByText('Ответ')).toBeInTheDocument();
    expect(ask).toHaveBeenCalledTimes(1);
  });
});
