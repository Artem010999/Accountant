import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CodeLogin } from '../../features/site/CodeLogin';
import { AdminGate } from '../../features/admin/AdminGate';
import { RequireSession } from './RequireSession';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function stubFetch(handler: (url: string, init?: RequestInit) => Response) {
  const mock = vi.fn(async (url: string, init?: RequestInit) => handler(url, init));
  vi.stubGlobal('fetch', mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('вход по коду (CodeLogin)', () => {
  it('почта → код из письма → успешный вход отдаёт пользователя наверх', async () => {
    const onSuccess = vi.fn();
    stubFetch((url) => {
      if (url === '/auth/code/request') return json(200, { status: 'SENT' });
      if (url === '/auth/code/verify') return json(200, { status: 'OK', userId: 'u-1', email: 'a@b.ru', role: 'user' });
      return json(404, {});
    });
    render(<CodeLogin purpose="user" onSuccess={onSuccess} />);

    await userEvent.type(screen.getByLabelText('Электронная почта'), 'a@b.ru');
    await userEvent.click(screen.getByRole('button', { name: 'Получить код' }));
    await userEvent.type(await screen.findByLabelText('Код из письма'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(onSuccess).toHaveBeenCalledWith({ userId: 'u-1', email: 'a@b.ru', role: 'user' });
  });

  it('неверный код показывает сообщение от сервера и не пускает дальше', async () => {
    const onSuccess = vi.fn();
    stubFetch((url) => {
      if (url === '/auth/code/request') return json(200, { status: 'SENT' });
      return json(400, { status: 'ERROR', code: 'INVALID_CODE', message: 'Неверный код' });
    });
    render(<CodeLogin purpose="user" onSuccess={onSuccess} />);

    await userEvent.type(screen.getByLabelText('Электронная почта'), 'a@b.ru');
    await userEvent.click(screen.getByRole('button', { name: 'Получить код' }));
    await userEvent.type(await screen.findByLabelText('Код из письма'), '000000');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Неверный код');
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('при согласии на регистрацию без галочки код не запрашивается', async () => {
    const fetchMock = stubFetch(() => json(200, { status: 'SENT' }));
    render(<CodeLogin purpose="user" consent onSuccess={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Электронная почта'), 'a@b.ru');
    expect(screen.getByRole('button', { name: 'Получить код' })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('защита кабинета (RequireSession)', () => {
  it('без сессии отправляет на /auth', async () => {
    stubFetch(() => json(401, { status: 'UNAUTHORIZED' }));
    render(
      <MemoryRouter initialEntries={['/passport']}>
        <Routes>
          <Route path="/passport" element={<RequireSession><p>кабинет</p></RequireSession>} />
          <Route path="/auth" element={<p>экран входа</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('экран входа')).toBeInTheDocument();
    expect(screen.queryByText('кабинет')).not.toBeInTheDocument();
  });

  it('с сессией показывает кабинет', async () => {
    stubFetch(() => json(200, { status: 'OK', userId: 'u-1', email: 'a@b.ru', role: 'user' }));
    render(
      <MemoryRouter initialEntries={['/passport']}>
        <Routes>
          <Route path="/passport" element={<RequireSession><p>кабинет</p></RequireSession>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('кабинет')).toBeInTheDocument();
  });
});

describe('вход в админку (AdminGate)', () => {
  it('обычный пользователь видит форму входа админа и не видит админку', async () => {
    stubFetch(() => json(200, { status: 'OK', userId: 'u-1', email: 'a@b.ru', role: 'user' }));
    render(
      <MemoryRouter>
        <AdminGate>
          <p>секретная админка</p>
        </AdminGate>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Вход администратора' })).toBeInTheDocument();
    expect(screen.queryByText('секретная админка')).not.toBeInTheDocument();
  });

  it('аккаунт с role = admin открывает админку сразу', async () => {
    stubFetch(() => json(200, { status: 'OK', userId: 'u-9', email: 'boss@b.ru', role: 'admin' }));
    render(
      <MemoryRouter>
        <AdminGate>
          <p>секретная админка</p>
        </AdminGate>
      </MemoryRouter>,
    );
    expect(await screen.findByText('секретная админка')).toBeInTheDocument();
  });
});
