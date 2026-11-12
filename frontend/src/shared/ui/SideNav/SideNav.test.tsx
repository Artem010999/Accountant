import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SideNav, type SideNavItem } from './SideNav';

const ITEMS: SideNavItem[] = [
  { to: '/passport', label: 'Паспорт', icon: 'passport' },
  { to: '/gaps', label: 'Пробелы', icon: 'gaps' },
];

describe('SideNav', () => {
  it('ссылки ведут на свои маршруты, активный пункт помечен aria-current', () => {
    render(
      <MemoryRouter initialEntries={['/passport']}>
        <SideNav items={ITEMS} ariaLabel="Разделы кабинета" />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Разделы кабинета' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Паспорт' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Пробелы' })).toHaveAttribute('href', '/gaps');
    expect(screen.getByRole('link', { name: 'Пробелы' })).not.toHaveAttribute('aria-current');
  });

  it('тёмный вариант меню админки', () => {
    render(
      <MemoryRouter>
        <SideNav items={ITEMS} variant="dark" ariaLabel="Разделы админки" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('navigation', { name: 'Разделы админки' })).toHaveClass('sidenav--dark');
  });
});
