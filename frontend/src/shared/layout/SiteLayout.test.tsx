import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SiteLayout } from './SiteLayout';

function renderSite(path: string, withFooter = true) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<SiteLayout withFooter={withFooter}><p>содержимое</p></SiteLayout>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SiteLayout', () => {
  it('меню из четырёх пунктов в порядке дизайна', () => {
    renderSite('/');
    const nav = screen.getByRole('navigation', { name: 'Основная навигация' });
    expect(Array.from(nav.querySelectorAll('a')).map((a) => a.textContent)).toEqual([
      'Как это работает', 'Паспорт', 'Тарифы', 'Вопросы',
    ]);
  });

  it('«Войти» и «Собрать паспорт» ведут на /auth', () => {
    renderSite('/');
    expect(screen.getByRole('link', { name: 'Войти' })).toHaveAttribute('href', '/auth');
    expect(screen.getByRole('link', { name: 'Собрать паспорт' })).toHaveAttribute('href', '/auth');
  });

  it('пункт «Тарифы» ведёт на /pricing и подсвечен на этой странице', () => {
    renderSite('/pricing');
    const tariffs = screen.getByRole('link', { name: 'Тарифы' });
    expect(tariffs).toHaveAttribute('href', '/pricing');
    expect(tariffs).toHaveClass('site__nav-link--active');
  });

  it('подвал с текстом и документами есть по умолчанию и отключается', () => {
    const { unmount } = renderSite('/');
    expect(screen.getByText('© 2026 Буха. Независимый сервис, не связан с ФСИ.')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Документы' })).toBeInTheDocument();
    unmount();
    renderSite('/pricing', false);
    expect(screen.queryByText('© 2026 Буха. Независимый сервис, не связан с ФСИ.')).not.toBeInTheDocument();
  });

  it('пункт «Вопросы» ведёт на якорь #faq главной', () => {
    renderSite('/pricing');
    expect(screen.getByRole('link', { name: 'Вопросы' })).toHaveAttribute('href', '/#faq');
  });
});
