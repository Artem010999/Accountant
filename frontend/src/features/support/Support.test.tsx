import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../shared/config/env';
import { MESSAGE_MAX, NAME_MAX, Support, validateSupport } from './Support';

const fetchMock = vi.fn();

function renderSupport() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Support />
    </MemoryRouter>,
  );
}

const emailField = () => screen.getByRole('textbox', { name: 'Электронная почта' });
const nameField = () => screen.getByRole('textbox', { name: 'Имя' });
const messageField = () => screen.getByRole('textbox', { name: 'Проблема' });
const submitButton = () => screen.getByRole('button', { name: 'Отправить' });

function okResponse() {
  return new Response(JSON.stringify({ status: 'sent' }), { status: 200 });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Support: рендер', () => {
  it('рендерит заголовок, три поля и кнопку «Отправить»', () => {
    renderSupport();
    expect(screen.getByRole('heading', { level: 1, name: 'Написать в поддержку' })).toBeInTheDocument();
    expect(emailField()).toBeInTheDocument();
    expect(nameField()).toBeInTheDocument();
    expect(messageField()).toBeInTheDocument();
    expect(submitButton()).toBeEnabled();
  });

  it('логотип ведёт на главную', () => {
    renderSupport();
    expect(screen.getByRole('link', { name: 'Буха Паспорт — на главную' })).toHaveAttribute('href', '/');
  });
});

describe('Support: валидация', () => {
  it('пустая форма — три ошибки под полями и запрос не уходит', async () => {
    const user = userEvent.setup();
    renderSupport();
    await user.click(submitButton());

    expect(screen.getByText('Укажите e-mail.')).toBeInTheDocument();
    expect(screen.getByText('Укажите имя.')).toBeInTheDocument();
    expect(screen.getByText('Опишите проблему.')).toBeInTheDocument();
    expect(emailField()).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('некорректный e-mail — ошибка формата', async () => {
    const user = userEvent.setup();
    renderSupport();
    await user.type(emailField(), 'ivan@uni');
    await user.click(submitButton());
    expect(screen.getByText('Введите e-mail в формате name@university.ru.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('имя из одних пробелов считается пустым', async () => {
    const user = userEvent.setup();
    renderSupport();
    await user.type(nameField(), '   ');
    await user.click(submitButton());
    expect(screen.getByText('Укажите имя.')).toBeInTheDocument();
  });

  it('проблема длиннее 2000 символов — ошибка лимита', async () => {
    const user = userEvent.setup();
    renderSupport();
    await user.type(emailField(), 'ivan@university.ru');
    await user.type(nameField(), 'Иван');
    fireEvent.change(messageField(), { target: { value: 'а'.repeat(MESSAGE_MAX + 1) } });
    await user.click(submitButton());
    expect(screen.getByText('Сократите текст: не больше 2000 символов.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ошибка поля пропадает при правке этого поля, остальные остаются', async () => {
    const user = userEvent.setup();
    renderSupport();
    await user.click(submitButton());
    await user.type(nameField(), 'Иван');
    expect(screen.queryByText('Укажите имя.')).not.toBeInTheDocument();
    expect(screen.getByText('Укажите e-mail.')).toBeInTheDocument();
    expect(screen.getByText('Опишите проблему.')).toBeInTheDocument();
  });

  it('функция validateSupport возвращает ошибки только для неверных полей', () => {
    expect(validateSupport({ email: 'ivan@university.ru', name: 'Иван', message: 'Текст' })).toEqual({});
    expect(validateSupport({ email: '', name: 'x'.repeat(NAME_MAX + 1), message: 'Текст' })).toEqual({
      email: 'Укажите e-mail.',
      name: 'Сократите имя: не больше 200 символов.',
    });
  });
});

describe('Support: отправка', () => {
  it('успех: POST на адрес поддержки с полями email/name/message, сообщение об успехе и очистка формы', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(okResponse());
    renderSupport();

    await user.type(emailField(), 'ivan@university.ru');
    await user.type(nameField(), '  Иван Иванов  ');
    await user.type(messageField(), 'Не могу загрузить файл');
    await user.click(submitButton());

    expect(await screen.findByRole('status')).toHaveTextContent('Обращение отправлено. Мы ответим на указанную почту.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(env.supportEndpoint);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'ivan@university.ru',
      name: 'Иван Иванов',
      message: 'Не могу загрузить файл',
    });

    expect(emailField()).toHaveValue('');
    expect(nameField()).toHaveValue('');
    expect(messageField()).toHaveValue('');
  });

  it('во время отправки кнопка неактивна', async () => {
    const user = userEvent.setup();
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderSupport();

    await user.type(emailField(), 'ivan@university.ru');
    await user.type(nameField(), 'Иван');
    await user.type(messageField(), 'Текст');
    await user.click(submitButton());

    expect(submitButton()).toBeDisabled();
  });

  it('ошибка сети: сообщение об ошибке, данные формы сохраняются, кнопка снова активна', async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    renderSupport();

    await user.type(emailField(), 'ivan@university.ru');
    await user.type(nameField(), 'Иван');
    await user.type(messageField(), 'Текст');
    await user.click(submitButton());

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Не получилось отправить. Попробуйте ещё раз.')).toBeInTheDocument();
    expect(emailField()).toHaveValue('ivan@university.ru');
    expect(nameField()).toHaveValue('Иван');
    expect(messageField()).toHaveValue('Текст');
    expect(submitButton()).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('ошибка сервера (500): то же сообщение, форма не очищается', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'mail failed' }), { status: 500 }));
    renderSupport();

    await user.type(emailField(), 'ivan@university.ru');
    await user.type(nameField(), 'Иван');
    await user.type(messageField(), 'Текст');
    await user.click(submitButton());

    expect(await screen.findByText('Не получилось отправить. Попробуйте ещё раз.')).toBeInTheDocument();
    expect(messageField()).toHaveValue('Текст');
  });
});
