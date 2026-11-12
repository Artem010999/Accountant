import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_ROUTES, AppRoutes } from './routes';

// Ключевой заголовок каждого маршрута (первый h1 эталона).
const HEADINGS: Record<string, string> = {
  '/': 'Соберите паспорт проекта для гранта. Без приукрашивания',
  '/pricing': 'Тарифы и цены',
  '/auth': 'Создайте аккаунт',
  '/onboarding': 'Расскажите о себе',
  '/brief': 'Есть материалы о проекте?',
  '/generating': 'Буха читает материалы',
  '/gaps': 'Закроем пробелы',
  '/result': 'Итог проверки',
  '/passport': 'Паспорт проекта',
  '/files': 'Материалы проекта',
  '/billing': 'Тариф и оплата',
  '/profile': 'Профиль',
  '/states': 'Блокировки и лимиты',
  '/support': 'Написать в поддержку',
  '/admin/users': 'Пользователи',
  '/admin/billing': 'Платежи и тарифы',
  '/admin/guard': 'Страж проекта',
  '/admin/kb': 'База знаний',
  '/design-system': 'Дизайн-система',
};

describe('маршруты приложения', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error');
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('карта содержит все 19 маршрутов: user-flows §1, поддержка и дизайн-система', () => {
    expect(APP_ROUTES.map((r) => r.path).sort()).toEqual(Object.keys(HEADINGS).sort());
  });

  for (const route of APP_ROUTES) {
    it(`${route.path} открывается с заголовком из дизайна и без ошибок в консоли`, () => {
      render(
        <MemoryRouter initialEntries={[route.path]}>
          <AppRoutes />
        </MemoryRouter>,
      );
      expect(screen.getByRole('heading', { level: 1, name: HEADINGS[route.path] })).toBeInTheDocument();
      expect(errorSpy).not.toHaveBeenCalled();
    });
  }

  it('неизвестный путь перенаправляет на главную', () => {
    render(
      <MemoryRouter initialEntries={['/нет-такой-страницы']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: HEADINGS['/'] })).toBeInTheDocument();
  });
});

// Заголовок вкладки каждого маршрута: <title> эталона из design/project/*.dc.html.
const TITLES: Record<string, string> = {
  '/': 'Буха — лендинг',
  '/pricing': 'Буха — тарифы',
  '/auth': 'Буха — вход и регистрация',
  '/onboarding': 'Буха — профиль основателя',
  '/brief': 'Буха — стартовый бриф',
  '/generating': 'Буха — сборка паспорта',
  '/gaps': 'Буха — пробелы и новизна',
  '/result': 'Буха — итог проверки',
  '/passport': 'Буха — паспорт проекта',
  '/files': 'Буха — материалы проекта',
  '/billing': 'Буха — тариф и оплата',
  '/profile': 'Буха — профиль',
  '/states': 'Буха — блокировки и лимиты',
  '/support': 'Буха — поддержка',
  '/admin/users': 'Буха — админка, пользователи',
  '/admin/billing': 'Буха — админка, платежи и тарифы',
  '/admin/guard': 'Буха — админка, Страж',
  '/admin/kb': 'Буха — админка, база знаний',
  '/design-system': 'Буха — дизайн-система',
};

describe('заголовок вкладки по маршруту', () => {
  it('карта заголовков совпадает с APP_ROUTES', () => {
    expect(APP_ROUTES.map((r) => [r.path, r.title])).toEqual(Object.entries(TITLES));
  });

  for (const route of APP_ROUTES) {
    it(`${route.path} → «${TITLES[route.path]}»`, () => {
      render(
        <MemoryRouter initialEntries={[route.path]}>
          <AppRoutes />
        </MemoryRouter>,
      );
      expect(document.title).toBe(TITLES[route.path]);
    });
  }

  it('переход между маршрутами обновляет заголовок', async () => {
    render(
      <MemoryRouter initialEntries={['/billing']}>
        <Link to="/profile">к профилю</Link>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(document.title).toBe('Буха — тариф и оплата');
    await userEvent.click(screen.getByRole('link', { name: 'к профилю' }));
    expect(document.title).toBe('Буха — профиль');
  });
});
