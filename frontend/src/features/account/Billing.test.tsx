import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Billing } from './Billing';

// Флаги: по умолчанию как в flags.ts (HIDE_PAYMENT_GATEWAY = TRUE). Тесты окна оплаты переключают флаг в FALSE,
// чтобы проверить код, который спрятан, но сохранён до подключения шлюза.
const flagState = vi.hoisted(() => ({ FLAGS: { HIDE_PAYMENT_GATEWAY: true, ALL_FEATURES_ENABLED: true } }));
vi.mock('../../shared/config/flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/config/flags')>();
  return { ...actual, FLAGS: flagState.FLAGS };
});

const PRO_SUMMARY = {
  plan: 'Профессиональный',
  base: '990 ₽',
  discount: '15%',
  price: '841 ₽',
};

function dialog(name = 'Оплата тарифа') {
  return screen.getByRole('dialog', { name });
}

// Значения «Тариф / Цена / Скидка / К оплате» внутри диалога оплаты: пары dt → dd.
function summaryValue(label: string) {
  const term = within(dialog()).getByText(label, { selector: 'dt' });
  return term.nextElementSibling;
}

// Блок текущего тарифа (первая секция с заголовком уровня 2 «название текущего тарифа»).
function heroSection(name = 'Премиум') {
  return screen.getByRole('heading', { level: 2, name }).closest('section') as HTMLElement;
}

// Карточка тарифа в «Других тарифах» по заголовку уровня 3.
function cardOf(name: string) {
  return screen.getByRole('heading', { level: 3, name }).closest('.billing__plan') as HTMLElement;
}

describe('Billing: флаг HIDE_PAYMENT_GATEWAY = TRUE (по умолчанию)', () => {
  beforeEach(() => {
    flagState.FLAGS.HIDE_PAYMENT_GATEWAY = true;
  });

  it('рендерит заголовок и текущий тариф «Премиум» по умолчанию', () => {
    render(<Billing />);
    expect(screen.getByRole('heading', { level: 1, name: 'Тариф и оплата' })).toBeInTheDocument();
    expect(screen.getByText('Текущий тариф')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Премиум' })).toBeInTheDocument();
    expect(screen.getByText('Действует до 1 декабря 2026 · осталось 23 дня')).toBeInTheDocument();
    expect(screen.getByText('Файлы: 3 из 50')).toBeInTheDocument();
    expect(screen.getByText('Проверка новизны: включена')).toBeInTheDocument();
  });

  it('полоска использования файлов: 3 из 50 → 6%', () => {
    render(<Billing />);
    expect(document.querySelector('.billing__bar-fill')).toHaveStyle({ width: '6%' });
  });

  it('текущий «Премиум»: кнопка блока и карточка Премиум — «Продлить» (без суммы)', () => {
    render(<Billing />);
    expect(within(heroSection()).getByRole('button', { name: 'Продлить' })).toBeInTheDocument();
    expect(within(cardOf('Премиум')).getByRole('button', { name: 'Продлить' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /841/ })).not.toBeInTheDocument();
  });

  it('текущий «Премиум»: карточка Базовый — текст про возврат через 23 дня, карточка Профессиональный — «Перейти на Pro»', () => {
    render(<Billing />);
    expect(within(cardOf('Базовый')).getByText('Вы вернётесь на данный тариф через 23 дня')).toBeInTheDocument();
    expect(within(cardOf('Базовый')).queryByRole('button')).not.toBeInTheDocument();
    expect(within(cardOf('Профессиональный')).getByRole('button', { name: 'Перейти на Pro' })).toBeInTheDocument();
  });

  it('секции «Другие тарифы» и «История платежей» с демо-строкой из эталона', () => {
    render(<Billing />);
    expect(screen.getByRole('heading', { level: 2, name: 'Другие тарифы' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Базовый' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Профессиональный' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Премиум' })).toBeInTheDocument();

    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Дата',
      'Тариф',
      'Сумма',
      'Скидка',
      'Статус',
      'Чек',
    ]);
    expect(within(table).getByText('1 ноября 2026')).toBeInTheDocument();
    expect(within(table).getByText('Оплачен')).toBeInTheDocument();
    // Только строка заголовка и одна демо-строка: новой оплаты без шлюза не появляется.
    expect(within(table).getAllByRole('row')).toHaveLength(2);
  });

  it('текст правила зачёта остатка выводится дословно из эталона (открытый вопрос владельцу)', () => {
    render(<Billing />);
    expect(screen.getByText('До 50 файлов и консультант. Остаток текущего периода [ПРАВИЛО ЗАЧЁТА ОСТАТКА].')).toBeInTheDocument();
  });

  it('кнопка «Тарифы» открывает окно тарифов, «Закрыть» его закрывает', async () => {
    render(<Billing />);
    await userEvent.click(screen.getByRole('button', { name: 'Тарифы' }));
    expect(screen.getByRole('dialog', { name: 'Тарифы' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('все кнопки покупки («Продлить», «Перейти на Pro») открывают окно тарифов, а не окно оплаты', async () => {
    render(<Billing />);

    await userEvent.click(within(cardOf('Профессиональный')).getByRole('button', { name: 'Перейти на Pro' }));
    expect(screen.getByRole('dialog', { name: 'Тарифы' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Оплата тарифа' })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(within(heroSection()).getByRole('button', { name: 'Продлить' }));
    expect(screen.getByRole('dialog', { name: 'Тарифы' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');

    await userEvent.click(within(cardOf('Премиум')).getByRole('button', { name: 'Продлить' }));
    expect(screen.getByRole('dialog', { name: 'Тарифы' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Оплата тарифа' })).not.toBeInTheDocument();
  });

  it('окно оплаты и прототипные кнопки не рендерятся: нет текстов «ошибка» и «ожидание»', async () => {
    render(<Billing />);
    await userEvent.click(within(cardOf('Премиум')).getByRole('button', { name: 'Продлить' }));
    expect(screen.queryByText('Оплата тарифа')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ошибка' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ожидание' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Перейти к оплате' })).not.toBeInTheDocument();
    expect(screen.queryByText('ошибка')).not.toBeInTheDocument();
    expect(screen.queryByText('ожидание')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('текущий «Профессиональный»: блок «Продлить», Профессиональный — «Продлить», Премиум — «Улучшить», Базовый — текст без действия', () => {
    render(<Billing currentPlan="pro" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Профессиональный' })).toBeInTheDocument();
    expect(within(heroSection('Профессиональный')).getByRole('button', { name: 'Продлить' })).toBeInTheDocument();
    expect(within(cardOf('Профессиональный')).getByRole('button', { name: 'Продлить' })).toBeInTheDocument();
    expect(within(cardOf('Премиум')).getByRole('button', { name: 'Улучшить' })).toBeInTheDocument();
    expect(within(cardOf('Базовый')).getByText('Включится автоматически после окончания платного тарифа')).toBeInTheDocument();
    expect(within(cardOf('Базовый')).queryByRole('button')).not.toBeInTheDocument();
  });

  it('окончание подписки (free): текущий тариф «Базовый», блока файлов и продления нет, в «Других тарифах» Профессиональный и Премиум с «Улучшить»', () => {
    render(<Billing currentPlan="free" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Базовый' })).toBeInTheDocument();
    expect(screen.getByText('Паспорт, анкета, стоп-факторы и экспорт. Без загрузки файлов и проверки новизны.')).toBeInTheDocument();
    expect(screen.queryByText('Файлы: 3 из 10')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Продлить' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Базовый' })).not.toBeInTheDocument();
    expect(within(cardOf('Профессиональный')).getByRole('button', { name: 'Улучшить' })).toBeInTheDocument();
    expect(within(cardOf('Премиум')).getByRole('button', { name: 'Улучшить' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Улучшить' })).toHaveLength(2);
  });
});

describe('Billing: окно оплаты (флаг HIDE_PAYMENT_GATEWAY = FALSE)', () => {
  beforeEach(() => {
    flagState.FLAGS.HIDE_PAYMENT_GATEWAY = false;
  });

  afterEach(() => {
    flagState.FLAGS.HIDE_PAYMENT_GATEWAY = true;
  });

  it('продление: кнопка «Продлить» в блоке тарифа открывает подтверждение с ценой и скидкой', async () => {
    render(<Billing />);
    await userEvent.click(within(heroSection()).getByRole('button', { name: 'Продлить' }));

    expect(dialog()).toBeInTheDocument();
    expect(within(dialog()).getByRole('heading', { level: 2, name: 'Оплата тарифа' })).toBeInTheDocument();
    expect(summaryValue('Тариф')).toHaveTextContent(PRO_SUMMARY.plan);
    expect(summaryValue('Цена')).toHaveTextContent(PRO_SUMMARY.base);
    expect(summaryValue('Скидка за продление')).toHaveTextContent(PRO_SUMMARY.discount);
    expect(summaryValue('К оплате')).toHaveTextContent(PRO_SUMMARY.price);
    expect(screen.getByText(/Чек придёт на ivan@university\.ru\./)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Ждём подтверждение от банка.', { exact: false })).not.toBeInTheDocument();
  });

  it('переход на Премиум (кнопка карточки Премиум): подтверждение без скидки за продление', async () => {
    render(<Billing />);
    await userEvent.click(within(cardOf('Премиум')).getByRole('button', { name: 'Продлить' }));

    expect(summaryValue('Тариф')).toHaveTextContent('Премиум');
    expect(summaryValue('Цена')).toHaveTextContent('4 990 ₽');
    expect(summaryValue('Скидка за продление')).toHaveTextContent('—');
    expect(summaryValue('К оплате')).toHaveTextContent('4 990 ₽');
  });

  it('успех: баннер «Оплата прошла», строка истории «Оплачен»; «Закрыть» убирает баннер', async () => {
    render(<Billing />);
    await userEvent.click(within(heroSection()).getByRole('button', { name: 'Продлить' }));
    await userEvent.click(screen.getByRole('button', { name: 'Перейти к оплате' }));

    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('Оплата прошла. Профессиональный действует до 31 декабря 2026.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByText('8 ноября 2026')).toBeInTheDocument();
    expect(within(table).getAllByText('Оплачен')).toHaveLength(2);

    await userEvent.click(within(banner).getByRole('button', { name: 'Закрыть' }));
    expect(screen.queryByText('Оплата прошла.', { exact: false })).not.toBeInTheDocument();
  });

  it('ошибка: alert с текстом «Деньги не списаны»; «Повторить» открывает оплату снова', async () => {
    render(<Billing />);
    await userEvent.click(within(heroSection()).getByRole('button', { name: 'Продлить' }));
    await userEvent.click(within(dialog()).getByRole('button', { name: 'ошибка' }));

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Платёж не прошёл. Деньги не списаны. Попробуйте другую карту или СБП.');
    expect(within(screen.getByRole('table')).getByText('Не прошёл')).toBeInTheDocument();

    await userEvent.click(within(alert).getByRole('button', { name: 'Повторить' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(dialog()).toBeInTheDocument();
    expect(within(screen.getByRole('table')).queryByText('Не прошёл')).not.toBeInTheDocument();
  });

  it('ожидание: статусный баннер; «Скрыть» убирает его', async () => {
    render(<Billing />);
    await userEvent.click(within(cardOf('Премиум')).getByRole('button', { name: 'Продлить' }));
    await userEvent.click(within(dialog()).getByRole('button', { name: 'ожидание' }));

    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('Ждём подтверждение от банка. Обычно это пара минут — доступ откроется сам, страницу можно закрыть.');
    expect(within(screen.getByRole('table')).getByText('Ожидает')).toBeInTheDocument();

    await userEvent.click(within(banner).getByRole('button', { name: 'Скрыть' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
