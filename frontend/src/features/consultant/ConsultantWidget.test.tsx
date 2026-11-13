import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsultantWidget } from './ConsultantWidget';
import type { ConsultantChatResponse, ConsultantHistoryResponse } from '@passport/contracts';

const fetchMock = vi.fn();

const mockHistoryResponse: ConsultantHistoryResponse = {
  status: 'OK',
  project_id: '550e8400-e29b-41d4-a716-446655440000',
  messages: [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Предыдущий вопрос пользователя',
      referenced_cards: [],
      created_at: '2026-11-13T10:00:00.000Z',
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: 'Предыдущий ответ консультанта с рекомендацией',
      referenced_cards: ['cmp_10_finance_stage2_limits'],
      created_at: '2026-11-13T10:00:05.000Z',
    },
  ],
};

const mockPostResponse: ConsultantChatResponse = {
  status: 'OK',
  project_id: '550e8400-e29b-41d4-a716-446655440000',
  user_message: {
    id: 'msg-3',
    role: 'user',
    content: 'Новый тестовый вопрос',
    referenced_cards: [],
    created_at: '2026-11-13T10:01:00.000Z',
  },
  assistant_message: {
    id: 'msg-4',
    role: 'assistant',
    content: 'Вот готовый черновик формулировки для вашего блока: Разработка программного модуля...',
    referenced_cards: ['cmp_10_finance_stage2_limits'],
    created_at: '2026-11-13T10:01:02.000Z',
  },
  history: [
    ...mockHistoryResponse.messages,
    {
      id: 'msg-3',
      role: 'user',
      content: 'Новый тестовый вопрос',
      referenced_cards: [],
      created_at: '2026-11-13T10:01:00.000Z',
    },
    {
      id: 'msg-4',
      role: 'assistant',
      content: 'Вот готовый черновик формулировки для вашего блока: Разработка программного модуля...',
      referenced_cards: ['cmp_10_finance_stage2_limits'],
      created_at: '2026-11-13T10:01:02.000Z',
    },
  ],
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);

  // Mock scrollIntoView
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ConsultantWidget: рендер, взаимодействие и API', () => {
  it('в свёрнутом состоянии отображается кнопка «ИИ-Консультант», сетевые запросы не отправляются, нет полей ввода', () => {
    render(<ConsultantWidget />);

    const triggerBtn = screen.getByRole('button', { name: 'Открыть чат с ИИ-Консультантом' });
    expect(triggerBtn).toBeInTheDocument();
    expect(triggerBtn).toHaveTextContent('ИИ-Консультант');

    // Нет сетевых запросов
    expect(fetchMock).not.toHaveBeenCalled();

    // Нет открытого диалога и нет textbox
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('при клике открывается диалог чата, подгружается история из GET /chat', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(mockHistoryResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const user = userEvent.setup();
    render(<ConsultantWidget activeSectionId={6} />);

    await user.click(screen.getByRole('button', { name: 'Открыть чат с ИИ-Консультантом' }));

    // Диалог открыт
    const dialog = screen.getByRole('dialog', { name: 'ИИ-Консультант по гранту ФСИ' });
    expect(dialog).toBeInTheDocument();

    // Проверяем элементы шапки
    expect(screen.getByText('ИИ-Консультант ФСИ')).toBeInTheDocument();
    expect(screen.getByText('Режим советчика — не меняет поля автоматически')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Закрыть консультант' })).toBeInTheDocument();

    // Проверяем сетевой запрос GET
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const getCall = fetchMock.mock.calls[0];
    expect(getCall[0]).toContain('/chat?user_id=');

    // Проверяем загруженные сообщения
    await waitFor(() => {
      expect(screen.getByText('Предыдущий вопрос пользователя')).toBeInTheDocument();
      expect(screen.getByText('Предыдущий ответ консультанта с рекомендацией')).toBeInTheDocument();
      expect(screen.getByText(/Источники RAG: cmp_10_finance_stage2_limits/)).toBeInTheDocument();
    });

    // Проверяем наличие 3 быстрых чипов
    expect(screen.getByRole('button', { name: 'Какие лимиты в смете 8-й очереди?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Как описать 2 аналога в Блоке 6?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Помоги сформулировать текущий блок по правилам ФСИ' })).toBeInTheDocument();
  });

  it('быстрые подсказки и отправка нового вопроса через POST /chat добавляет ответ консультанта в ленту', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'OK', project_id: 'p1', messages: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockPostResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const user = userEvent.setup();
    render(<ConsultantWidget activeSectionId={6} />);

    await user.click(screen.getByRole('button', { name: 'Открыть чат с ИИ-Консультантом' }));

    // Вводим текст и нажимаем «Отправить в чат»
    const textarea = screen.getByRole('textbox', { name: 'Вопрос ИИ-Консультанту' });
    await user.type(textarea, 'Новый тестовый вопрос');

    const submitBtn = screen.getByRole('button', { name: 'Отправить в чат' });
    expect(submitBtn).toBeEnabled();
    await user.click(submitBtn);

    // Проверяем вызов POST /chat
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    const postCall = fetchMock.mock.calls[1];
    expect(postCall[0]).toContain('/chat');
    expect(postCall[1].method).toBe('POST');
    const postBody = JSON.parse(postCall[1].body);
    expect(postBody.message).toBe('Новый тестовый вопрос');
    expect(postBody.active_section_id).toBe(6);

    // Ответ консультанта появился в ленте
    await waitFor(() => {
      expect(
        screen.getByText(/Вот готовый черновик формулировки для вашего блока/),
      ).toBeInTheDocument();
    });
  });

  it('кнопка «Скопировать» копирует текст ответа консультанта в буфер обмена и меняет текст на «Скопировано ✓»', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(mockHistoryResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const user = userEvent.setup();
    const writeSpy = vi.spyOn(navigator.clipboard, 'writeText');
    render(<ConsultantWidget />);

    await user.click(screen.getByRole('button', { name: 'Открыть чат с ИИ-Консультантом' }));

    await waitFor(() => {
      expect(screen.getByText('Предыдущий ответ консультанта с рекомендацией')).toBeInTheDocument();
    });

    const copyBtn = screen.getByRole('button', { name: 'Скопировать' });
    expect(copyBtn).toBeInTheDocument();

    await user.click(copyBtn);

    // Проверяем вызов clipboard.writeText
    expect(writeSpy).toHaveBeenCalledWith('Предыдущий ответ консультанта с рекомендацией');

    // Текст кнопки меняется на «Скопировано ✓»
    expect(screen.getByRole('button', { name: 'Скопировано ✓' })).toBeInTheDocument();
  });

  it('кнопка «Закрыть консультант» закрывает диалог', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'OK', project_id: 'p1', messages: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const user = userEvent.setup();
    render(<ConsultantWidget />);

    await user.click(screen.getByRole('button', { name: 'Открыть чат с ИИ-Консультантом' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Закрыть консультант' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
