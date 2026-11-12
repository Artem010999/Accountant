import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Auth } from './Auth';
import { Main } from './Main';
import { Pricing } from './Pricing';

// Показывает текущий путь, чтобы проверять переходы по ссылкам.
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderSite(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <Routes>
        <Route path="/" element={<Main />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/auth" element={<Auth />} />
      </Routes>
    </MemoryRouter>,
  );
}

const location = () => screen.getByTestId('location').textContent;

describe('Main (лендинг)', () => {
  it('рендерит заголовок экрана из дизайна', () => {
    renderSite('/');
    expect(screen.getByRole('heading', { level: 1, name: 'Соберите паспорт проекта для гранта. Без приукрашивания' })).toBeInTheDocument();
  });

  it('рендерит ключевые заголовки секций дизайна', () => {
    renderSite('/');
    for (const name of [
      'Как это работает',
      'Эксперт фонда заметит приукрашивание. Буха — раньше',
      '10 блоков паспорта',
      'Тарифы',
      'Вопросы',
      'Начните с того, что уже есть',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
  });

  it('CTA «Собрать паспорт бесплатно» есть дважды и ведёт на /auth', async () => {
    renderSite('/');
    const ctas = screen.getAllByRole('link', { name: 'Собрать паспорт бесплатно' });
    expect(ctas).toHaveLength(2);
    for (const cta of ctas) {
      expect(cta).toHaveAttribute('href', '/auth');
    }
    await userEvent.click(ctas[0]);
    expect(location()).toBe('/auth');
  });

  it('«Тарифы» в меню ведёт на /pricing', async () => {
    renderSite('/');
    const nav = screen.getByRole('navigation', { name: 'Основная навигация' });
    await userEvent.click(within(nav).getByRole('link', { name: 'Тарифы' }));
    expect(location()).toBe('/pricing');
    expect(screen.getByRole('heading', { level: 1, name: 'Тарифы и цены' })).toBeInTheDocument();
  });

  it('«Войти» ведёт на /auth', async () => {
    renderSite('/');
    await userEvent.click(screen.getByRole('link', { name: 'Войти' }));
    expect(location()).toBe('/auth');
    expect(screen.getByRole('heading', { level: 1, name: 'Создайте аккаунт' })).toBeInTheDocument();
  });

  it('«Посмотреть тарифы» и «Сравнить все возможности» ведут на /pricing', () => {
    renderSite('/');
    expect(screen.getByRole('link', { name: 'Посмотреть тарифы' })).toHaveAttribute('href', '/pricing');
    expect(screen.getByRole('link', { name: 'Сравнить все возможности' })).toHaveAttribute('href', '/pricing');
  });

  it('три тарифа с ценами из дизайна', () => {
    renderSite('/');
    expect(screen.getByRole('heading', { level: 3, name: 'Базовый' })).toBeInTheDocument();
    expect(screen.getByText('0 ₽')).toBeInTheDocument();
    expect(screen.getByText('990 ₽ за 30 дней')).toBeInTheDocument();
    expect(screen.getByText('4 990 ₽ за 30 дней')).toBeInTheDocument();
    expect(screen.getByText('Рекомендуем')).toBeInTheDocument();
  });

  it('пять вопросов FAQ, каждый — раскрывающийся блок', () => {
    renderSite('/');
    const items = document.querySelectorAll('details.main__faq-item');
    expect(items).toHaveLength(5);
    expect(screen.getByText('Буха гарантирует победу в конкурсе?')).toBeInTheDocument();
    expect(screen.getByText('Это официальный сервис фонда?')).toBeInTheDocument();
  });

  it('ссылки «Вопросы» и «Как это работает» — якоря на секции главной', () => {
    renderSite('/');
    const nav = screen.getByRole('navigation', { name: 'Основная навигация' });
    expect(within(nav).getByRole('link', { name: 'Вопросы' })).toHaveAttribute('href', '/#faq');
    expect(within(nav).getByRole('link', { name: 'Как это работает' })).toHaveAttribute('href', '/#how');
    expect(document.getElementById('faq')).not.toBeNull();
    expect(document.getElementById('how')).not.toBeNull();
    expect(document.getElementById('passport')).not.toBeNull();
  });
});
