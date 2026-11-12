import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Auth } from './Auth';
import { Pricing } from './Pricing';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderPricing() {
  return render(
    <MemoryRouter initialEntries={['/pricing']}>
      <LocationProbe />
      <Routes>
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/auth" element={<Auth />} />
      </Routes>
    </MemoryRouter>,
  );
}

const location = () => screen.getByTestId('location').textContent;

describe('Pricing (тарифы)', () => {
  it('рендерит заголовок экрана из дизайна', () => {
    renderPricing();
    expect(screen.getByRole('heading', { level: 1, name: 'Тарифы и цены' })).toBeInTheDocument();
  });

  it('три карточки тарифов с ценами из дизайна при первой оплате', () => {
    renderPricing();
    for (const name of ['Базовый', 'Профессиональный', 'Премиум']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByText('0 ₽')).toBeInTheDocument();
    expect(screen.getByText('990 ₽')).toBeInTheDocument();
    expect(screen.getByText('4 990 ₽')).toBeInTheDocument();
    expect(screen.queryByText('Скидка 15% при продлении')).not.toBeInTheDocument();
  });

  it('переключатель «Продление» пересчитывает цены и показывает скидки', async () => {
    renderPricing();
    const toggle = screen.getByRole('group', { name: 'Период оплаты' });
    await userEvent.click(within(toggle).getByRole('button', { name: 'Продление' }));
    expect(screen.getByText('841 ₽')).toBeInTheDocument();
    expect(screen.getByText('4 491 ₽')).toBeInTheDocument();
    expect(screen.getByText('Скидка 15% при продлении')).toBeInTheDocument();
    expect(screen.getByText('Скидка 10% при продлении')).toBeInTheDocument();
    await userEvent.click(within(toggle).getByRole('button', { name: 'Первая оплата' }));
    expect(screen.getByText('990 ₽')).toBeInTheDocument();
  });

  it('«Начать бесплатно» и «Выбрать» на платных тарифах ведут на /auth', async () => {
    renderPricing();
    expect(screen.getByRole('link', { name: 'Начать бесплатно' })).toHaveAttribute('href', '/auth');
    expect(screen.getByRole('link', { name: 'Выбрать Профессиональный' })).toHaveAttribute('href', '/auth');
    expect(screen.getByRole('link', { name: 'Выбрать Премиум' })).toHaveAttribute('href', '/auth');

    await userEvent.click(screen.getByRole('link', { name: 'Выбрать Профессиональный' }));
    expect(location()).toBe('/auth');
    expect(screen.getByRole('heading', { level: 1, name: 'Создайте аккаунт' })).toBeInTheDocument();
  });

  it('таблица сравнения: 9 строк возможностей и три колонки тарифов', () => {
    renderPricing();
    const table = screen.getByRole('table');
    const headers = within(table).getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toEqual(['Возможность', 'Базовый', 'Профессиональный', 'Премиум']);
    expect(within(table).getAllByRole('rowheader')).toHaveLength(9);
    expect(within(table).getByRole('rowheader', { name: 'Файлов в проекте' })).toBeInTheDocument();
  });

  it('страница без подвала, как в эталоне', () => {
    renderPricing();
    expect(screen.queryByText('© 2026 Буха. Независимый сервис, не связан с ФСИ.')).not.toBeInTheDocument();
  });
});
