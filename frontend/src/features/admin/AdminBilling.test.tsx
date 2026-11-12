import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createDemoAdminBillingService } from '../../shared/data/adminBilling';
import { AdminBilling } from './AdminBilling';

function renderBilling() {
  const service = createDemoAdminBillingService();
  const savePlans = vi.spyOn(service, 'savePlans');
  render(<AdminBilling service={service} />);
  return { service, savePlans, user: userEvent.setup() };
}

describe('AdminBilling', () => {
  it('рендерит заголовок экрана и переключатель разделов из дизайна', () => {
    renderBilling();
    expect(screen.getByRole('heading', { level: 1, name: 'Платежи и тарифы' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Платежи' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Тарифы' })).toHaveAttribute('aria-selected', 'false');
  });

  it('сводка без данных сервиса: все три плейсхолдера показывают «—», а не демо-значения', async () => {
    renderBilling();
    const revenue = await screen.findByText('Выручка за месяц');
    expect(revenue.parentElement).toHaveTextContent(/^Выручка за месяц—$/);
    expect(screen.getByText('Активных подписок').parentElement).toHaveTextContent(/^Активных подписок—$/);
    expect(screen.getByText('Ожидают подтверждения').parentElement).toHaveTextContent(/^Ожидают подтверждения—$/);
  });

  it('когда сервис отдал значения сводки, экран показывает их (подключение на G5)', async () => {
    const demo = createDemoAdminBillingService();
    const service = {
      ...demo,
      getSummary: async () => ({ revenueMonthRub: 1234, activeSubscriptions: 7, pendingCount: 3 }),
    };
    render(<AdminBilling service={service} />);
    await waitFor(() => expect(screen.getByText('Выручка за месяц').parentElement).toHaveTextContent('1 234 ₽'));
    expect(screen.getByText('Активных подписок').parentElement).toHaveTextContent(/^Активных подписок7$/);
    expect(screen.getByText('Ожидают подтверждения').parentElement).toHaveTextContent(/^Ожидают подтверждения3$/);
  });

  it('показывает строки платежей из сервиса', async () => {
    renderBilling();
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(6));

    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'ID платежа' })).toBeInTheDocument();
    expect(within(table).getAllByRole('row')).toHaveLength(6);
    expect(within(table).getAllByText('Мария Ли')).toHaveLength(2);
    expect(within(table).getByText('4 990 ₽')).toBeInTheDocument();
    expect(within(table).getByText('2f9a…c41e')).toBeInTheDocument();
    expect(screen.getByText('Повторное уведомление ЮKassa с тем же ID не создаёт второй платёж.')).toBeInTheDocument();
  });

  it('фильтр платежей по статусу оставляет строки выбранного статуса и возвращается к «Все»', async () => {
    const { user } = renderBilling();
    const table = await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Ошибка' }));
    expect(screen.getByRole('button', { name: 'Ошибка' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByText('Анна Смирнова')).toBeInTheDocument();
    expect(within(table).queryByText('Мария Ли')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Все' }));
    expect(within(table).getAllByRole('row')).toHaveLength(6);
  });

  it('вкладка «Тарифы» показывает три тарифа с полями из дизайна', async () => {
    const { user } = renderBilling();
    await user.click(screen.getByRole('tab', { name: 'Тарифы' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Базовый' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Профессиональный' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Премиум' })).toBeInTheDocument();

    // Порядок карточек: Базовый, Профессиональный, Премиум.
    const prices = screen.getAllByRole('spinbutton', { name: 'Цена, ₽' });
    expect(prices.map((input) => (input as HTMLInputElement).value)).toEqual(['0', '990', '4990']);
    const premiumFeatures = screen.getAllByRole('checkbox', { name: 'Консультант' });
    expect(premiumFeatures.map((input) => (input as HTMLInputElement).checked)).toEqual([false, false, true]);
  });

  it('изменение тарифа и «Сохранить тарифы» отправляет новые значения в сервис', async () => {
    const { user, savePlans } = renderBilling();
    await user.click(screen.getByRole('tab', { name: 'Тарифы' }));
    await screen.findByRole('heading', { level: 2, name: 'Премиум' });

    const premiumPrice = screen.getAllByRole('spinbutton', { name: 'Цена, ₽' })[2];
    await user.clear(premiumPrice);
    await user.type(premiumPrice, '5990');
    await user.click(screen.getByRole('button', { name: 'Сохранить тарифы' }));

    expect(savePlans).toHaveBeenCalledTimes(1);
    const saved = savePlans.mock.calls[0][0];
    expect(saved.find((plan) => plan.id === 'premium')?.price_rub).toBe(5990);
    expect(saved.find((plan) => plan.id === 'pro')?.price_rub).toBe(990);
    expect(await screen.findByText('Сохранено. Уже оплаченные подписки не меняются.')).toBeInTheDocument();
  });

  it('после правки тарифа статус снова показывает подсказку до сохранения', async () => {
    const { user } = renderBilling();
    await user.click(screen.getByRole('tab', { name: 'Тарифы' }));
    await screen.findByRole('heading', { level: 2, name: 'Премиум' });

    await user.click(screen.getByRole('button', { name: 'Сохранить тарифы' }));
    expect(await screen.findByText('Сохранено. Уже оплаченные подписки не меняются.')).toBeInTheDocument();

    await user.click(screen.getAllByRole('checkbox', { name: 'Проверка новизны' })[0]);
    expect(screen.getByText('Новые цены применятся к следующим оплатам.')).toBeInTheDocument();
  });

  it('флаги функций тарифа переключаются', async () => {
    const { user } = renderBilling();
    await user.click(screen.getByRole('tab', { name: 'Тарифы' }));
    await screen.findByRole('heading', { level: 2, name: 'Премиум' });

    const consultant = screen.getAllByRole('checkbox', { name: 'Консультант' })[2];
    await user.click(consultant);
    expect(consultant).not.toBeChecked();
  });
});
