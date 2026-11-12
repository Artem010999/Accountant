import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Auth } from './Auth';
import { Main } from './Main';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderAuth(path = '/auth') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <Routes>
        <Route path="/" element={<Main />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/onboarding" element={<div>Экран онбординга</div>} />
        <Route path="/passport" element={<div>Экран паспорта</div>} />
        <Route path="/admin/users" element={<div>Экран админа</div>} />
        <Route path="/states" element={<div>Экран состояний</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const location = () => screen.getByTestId('location').textContent;

describe('Auth (вход и регистрация)', () => {
  it('рендерит заголовок экрана из дизайна', () => {
    renderAuth();
    expect(screen.getByRole('heading', { level: 1, name: 'Создайте аккаунт' })).toBeInTheDocument();
  });

  it('по умолчанию открыта регистрация: поля, согласие и CTA', () => {
    renderAuth();
    expect(screen.getByRole('tab', { name: 'Регистрация' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Электронная почта')).toHaveAttribute('placeholder', 'name@university.ru');
    expect(screen.getByLabelText('Пароль')).toHaveAttribute('placeholder', 'Не меньше 8 символов');
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByText('Один аккаунт — один проект. Начать можно бесплатно.')).toBeInTheDocument();
  });

  it('«Зарегистрироваться» ведёт на онбординг', async () => {
    renderAuth();
    const cta = screen.getByRole('link', { name: 'Зарегистрироваться' });
    expect(cta).toHaveAttribute('href', '/onboarding');
    await userEvent.click(cta);
    expect(location()).toBe('/onboarding');
  });

  it('переключение на «Вход» показывает форму входа с ссылками прототипа', async () => {
    renderAuth();
    await userEvent.click(screen.getByRole('tab', { name: 'Вход' }));
    expect(screen.getByRole('heading', { level: 1, name: 'С возвращением' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Вход' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('link', { name: 'Забыли пароль?' })).toBeInTheDocument();
    expect(screen.getByText('Для прототипа')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Войти как администратор' })).toHaveAttribute('href', '/admin/users');
    expect(screen.getByRole('link', { name: 'Аккаунт заблокирован (экран 403)' })).toHaveAttribute('href', '/states');
  });

  it('«Войти» в форме входа ведёт в кабинет (/passport)', async () => {
    renderAuth();
    await userEvent.click(screen.getByRole('tab', { name: 'Вход' }));
    await userEvent.click(screen.getByRole('link', { name: 'Войти' }));
    expect(location()).toBe('/passport');
  });

  it('ссылки прототипа в форме входа ведут на экраны админки и 403', async () => {
    renderAuth();
    await userEvent.click(screen.getByRole('tab', { name: 'Вход' }));
    await userEvent.click(screen.getByRole('link', { name: 'Войти как администратор' }));
    expect(location()).toBe('/admin/users');
  });

  it('логотип на входе ведёт на главную', async () => {
    renderAuth();
    const logo = screen.getByRole('link', { name: 'Буха Паспорт — на главную' });
    expect(logo).toHaveAttribute('href', '/');
    await userEvent.click(logo);
    expect(location()).toBe('/');
  });

  it('правая панель с заголовком и тремя шагами из дизайна', () => {
    renderAuth();
    expect(screen.getByRole('heading', { level: 2, name: 'Через 10 минут у вас будет черновик паспорта' })).toBeInTheDocument();
    const steps = screen.getByRole('list');
    expect(within(steps).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Ответьте на вопросы по пробелам')).toBeInTheDocument();
  });
});
