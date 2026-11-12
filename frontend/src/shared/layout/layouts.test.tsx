import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AdminLayout } from './AdminLayout';
import { CabinetLayout, useCabinetShell } from './CabinetLayout';

function renderWithLayout(path: string, layoutPath: string, element: ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={element}>
          <Route path={layoutPath} element={<div>содержимое экрана</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('CabinetLayout', () => {
  it('меню кабинета из шести пунктов с маршрутами дизайна', () => {
    renderWithLayout('/passport', '/passport', <CabinetLayout />);
    const nav = screen.getByRole('navigation', { name: 'Разделы кабинета' });
    const links = nav.querySelectorAll('a');
    expect(Array.from(links).map((a) => a.querySelector('.sidenav__label')?.textContent)).toEqual([
      'Паспорт', 'Пробелы', 'Итог', 'Материалы', 'Тариф', 'Профиль',
    ]);
    expect(Array.from(links).map((a) => a.getAttribute('href'))).toEqual([
      '/passport', '/gaps', '/result', '/files', '/billing', '/profile',
    ]);
    expect(screen.getByRole('link', { name: 'Паспорт' })).toHaveAttribute('aria-current', 'page');
  });

  it('счётчик «1» у «Пробелов» по умолчанию из дизайна, не входит в имя ссылки', () => {
    renderWithLayout('/passport', '/passport', <CabinetLayout />);
    const gaps = screen.getByRole('link', { name: 'Пробелы' });
    expect(gaps).toHaveTextContent('1');
    expect(screen.getByRole('link', { name: 'Итог' })).not.toHaveTextContent(/\d/);
  });

  it('счётчик из props по умолчанию; null скрывает, 0 показывается как в Gaps.dc.html', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/passport']}>
        <Routes>
          <Route element={<CabinetLayout gapsCount={3} />}>
            <Route path="/passport" element={<div>экран</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Пробелы' })).toHaveTextContent('3');
    unmount();
    render(
      <MemoryRouter initialEntries={['/passport']}>
        <Routes>
          <Route element={<CabinetLayout gapsCount={null} />}>
            <Route path="/passport" element={<div>экран</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Пробелы' })).not.toHaveTextContent(/\d/);
  });

  it('на /result счётчика нет и отступы из Result.dc.html', () => {
    render(
      <MemoryRouter initialEntries={['/result']}>
        <Routes>
          <Route element={<CabinetLayout />}>
            <Route path="/result" element={<div>итог</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Пробелы' })).not.toHaveTextContent(/\d/);
    const main = document.querySelector('main') as HTMLElement;
    expect(main.style.getPropertyValue('--cabinet-main-padding')).toBe('36px 48px 64px');
    expect(main.style.getPropertyValue('--cabinet-main-gap')).toBe('28px');
  });

  it('экран переопределяет счётчик через useCabinetShell; при уходе значения сбрасываются', async () => {
    function GapsScreen() {
      useCabinetShell({ gapsCount: 4 });
      return <div>пробелы экрана</div>;
    }
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/gaps']}>
        <Link to="/passport">уйти</Link>
        <Routes>
          <Route element={<CabinetLayout />}>
            <Route path="/gaps" element={<GapsScreen />} />
            <Route path="/passport" element={<div>паспорт</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Пробелы' })).toHaveTextContent('4');
    await user.click(screen.getByRole('link', { name: 'уйти' }));
    expect(screen.getByRole('link', { name: 'Пробелы' })).toHaveTextContent('1');
  });

  it('данные проекта, тарифа и пользователя берутся из props, по умолчанию — из дизайна', () => {
    render(
      <MemoryRouter initialEntries={['/passport']}>
        <Routes>
          <Route element={<CabinetLayout project={{ name: 'Другой проект' }} user={{ name: 'Мария' }} />}>
            <Route path="/passport" element={<div>экран</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Другой проект')).toBeInTheDocument();
    expect(screen.getByText('Мария')).toBeInTheDocument();
    expect(screen.getByText('Профессиональный')).toBeInTheDocument();
    expect(screen.getByText('Файлы: 3 из 10')).toBeInTheDocument();
  });

  it('рендерит экран в main и переходит по пункту меню', async () => {
    render(
      <MemoryRouter initialEntries={['/passport']}>
        <Routes>
          <Route element={<CabinetLayout />}>
            <Route path="/passport" element={<div>экран паспорта</div>} />
            <Route path="/gaps" element={<div>экран пробелов</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('экран паспорта')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Пробелы' }));
    expect(screen.getByText('экран пробелов')).toBeInTheDocument();
  });
});

describe('AdminLayout', () => {
  it('меню админки из четырёх пунктов', () => {
    renderWithLayout('/admin/users', '/admin/users', <AdminLayout />);
    const nav = screen.getByRole('navigation', { name: 'Разделы админки' });
    expect(Array.from(nav.querySelectorAll('a')).map((a) => a.getAttribute('href'))).toEqual([
      '/admin/users', '/admin/billing', '/admin/guard', '/admin/kb',
    ]);
    expect(screen.getByRole('link', { name: 'Пользователи' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('админ')).toBeInTheDocument();
  });

  it('пункты админки ведут на свои маршруты и подсвечивают текущий', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route path="/admin/users" element={<div>экран пользователей</div>} />
            <Route path="/admin/billing" element={<div>экран платежей</div>} />
            <Route path="/admin/guard" element={<div>экран стража</div>} />
            <Route path="/admin/kb" element={<div>экран базы знаний</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('link', { name: 'Платежи и тарифы' }));
    expect(screen.getByText('экран платежей')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Платежи и тарифы' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Пользователи' })).not.toHaveAttribute('aria-current');

    await user.click(screen.getByRole('link', { name: 'Страж' }));
    expect(screen.getByText('экран стража')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'База знаний' }));
    expect(screen.getByText('экран базы знаний')).toBeInTheDocument();
  });
});
