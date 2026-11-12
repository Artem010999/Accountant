import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { classifySimilarity, createDemoAdminGuardService, validateThresholds } from '../../shared/data/adminGuard';
import { AdminGuard } from './AdminGuard';

function renderGuard() {
  const service = createDemoAdminGuardService();
  const saveThresholds = vi.spyOn(service, 'saveThresholds');
  render(<AdminGuard service={service} />);
  return { service, saveThresholds, user: userEvent.setup() };
}

/** Ползунки: первый — блокировка, второй — предупреждение. */
async function sliders() {
  await screen.findByRole('heading', { level: 2, name: 'Пороги' });
  const [block, warn] = screen.getAllByRole('slider') as HTMLInputElement[];
  return { block, warn };
}

/** Строки журнала без строки заголовка. */
function journalRows() {
  return within(screen.getByRole('table')).getAllByRole('row').slice(1);
}

describe('AdminGuard', () => {
  it('рендерит заголовок, описание и секции из дизайна', async () => {
    renderGuard();
    expect(screen.getByRole('heading', { level: 1, name: 'Страж проекта' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Сравнивает каждую новую загрузку с якорем проекта. Низкая близость — значит, материалы, скорее всего, про другой проект.',
      ),
    ).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: 'Пороги' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Журнал событий' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сохранить пороги' })).toBeInTheDocument();
  });

  it('по умолчанию показывает пороги 0,50 и 0,75 и все пять событий журнала', async () => {
    renderGuard();
    const { block, warn } = await sliders();
    expect(block.value).toBe('0.5');
    expect(warn.value).toBe('0.75');
    expect(screen.getByText('0,50')).toBeInTheDocument();
    expect(screen.getByText('0,75')).toBeInTheDocument();
    expect(journalRows()).toHaveLength(5);
  });

  it('строки журнала показывают владельца и название проекта: «Владелец · Проект <название>», без «[проект]»', async () => {
    renderGuard();
    await sliders();
    const rows = journalRows();
    expect(within(rows[0]).getByText('Олег Носов · Проект Startup X')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Иван Иванов · Проект Monetrix')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Анна Смирнова · Проект Молодёжь рядом')).toBeInTheDocument();
    expect(screen.queryByText(/\[проект\]/)).toBeNull();
  });

  it('журнал классифицирует события по порогам: блокировка, предупреждение, пропуск', async () => {
    renderGuard();
    await sliders();
    const rows = journalRows();
    expect(within(rows[0]).getByText('Заблокировано')).toBeInTheDocument();
    expect(within(rows[1]).getByText('С предупреждением')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Пропущено')).toBeInTheDocument();
    expect(within(rows[0]).getByText('0,38')).toBeInTheDocument();
    expect(within(rows[0]).getByText('gpt-4o-mini')).toBeInTheDocument();
  });

  it('фильтр журнала по действию оставляет нужные строки', async () => {
    const { user } = renderGuard();
    await sliders();

    await user.click(screen.getByRole('button', { name: 'Заблокировано' }));
    expect(screen.getByRole('button', { name: 'Заблокировано' })).toHaveAttribute('aria-pressed', 'true');
    expect(journalRows()).toHaveLength(2);
    expect(screen.getByText('Бизнес-план кофейни на 40 посадочных мест…')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'С предупреждением' }));
    expect(journalRows()).toHaveLength(1);
    expect(screen.getByText('Вопрос по проекту: какие функции… Ответ: голосовой помощник…')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Пропущено' }));
    expect(journalRows()).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Все' }));
    expect(journalRows()).toHaveLength(5);
  });

  it('изменение порога блокировки пересчитывает журнал по текущим значениям', async () => {
    renderGuard();
    const { block } = await sliders();

    fireEvent.change(block, { target: { value: '0.3' } });
    expect(screen.getByText('0,30')).toBeInTheDocument();
    // При блокировке ниже 0,30 не попадает ни одно событие: близость 0,38 и 0,44 становятся предупреждениями.
    expect(journalRows().some((row) => within(row).queryByText('Заблокировано'))).toBe(false);
    expect(journalRows().filter((row) => within(row).queryByText('С предупреждением'))).toHaveLength(3);
  });

  it('ползунок блокировки не поднимается выше порога предупреждения (как в эталоне)', async () => {
    renderGuard();
    const { block } = await sliders();

    fireEvent.change(block, { target: { value: '0.9' } });
    expect(block.value).toBe('0.75');
    expect(block.closest('label')).toHaveTextContent('0,75');
  });

  it('сохранение с блокировкой, равной предупреждению, допустимо: без ошибки, пороги уходят в сервис', async () => {
    const { user, saveThresholds } = renderGuard();
    const { block } = await sliders();

    fireEvent.change(block, { target: { value: '0.75' } });
    expect(block.value).toBe('0.75');
    await user.click(screen.getByRole('button', { name: 'Сохранить пороги' }));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(saveThresholds).toHaveBeenCalledWith({ block: 0.75, warn: 0.75 });
    expect(await screen.findByText('Сохранено. Новые пороги действуют для следующих загрузок.')).toBeInTheDocument();
  });

  it('блокировка выше предупреждения при сохранении показывает ошибку и не отправляет пороги', async () => {
    const service = createDemoAdminGuardService();
    vi.spyOn(service, 'getThresholds').mockResolvedValue({ block: 0.8, warn: 0.6 });
    const saveThresholds = vi.spyOn(service, 'saveThresholds');
    const user = userEvent.setup();
    render(<AdminGuard service={service} />);
    await sliders();

    await user.click(screen.getByRole('button', { name: 'Сохранить пороги' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Порог блокировки не может быть выше порога предупреждения.');
    expect(saveThresholds).not.toHaveBeenCalled();
  });

  it('сохранение корректных порогов отправляет их в сервис и показывает подтверждение', async () => {
    const { user, saveThresholds } = renderGuard();
    const { warn } = await sliders();

    fireEvent.change(warn, { target: { value: '0.9' } });
    expect(screen.getByText('Решения в журнале ниже пересчитаны по текущим значениям для наглядности.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Сохранить пороги' }));
    expect(saveThresholds).toHaveBeenCalledWith({ block: 0.5, warn: 0.9 });
    expect(await screen.findByText('Сохранено. Новые пороги действуют для следующих загрузок.')).toBeInTheDocument();
  });

  it('любое изменение порога после сохранения возвращает подсказку', async () => {
    const { user } = renderGuard();
    const { warn } = await sliders();

    await user.click(screen.getByRole('button', { name: 'Сохранить пороги' }));
    expect(await screen.findByText('Сохранено. Новые пороги действуют для следующих загрузок.')).toBeInTheDocument();

    fireEvent.change(warn, { target: { value: '0.8' } });
    expect(screen.queryByText('Сохранено. Новые пороги действуют для следующих загрузок.')).not.toBeInTheDocument();
  });
});

describe('validateThresholds и classifySimilarity', () => {
  it('допускает значения 0–1 с блокировкой ниже предупреждения', () => {
    expect(validateThresholds({ block: 0.5, warn: 0.75 })).toBeNull();
    expect(validateThresholds({ block: 0, warn: 1 })).toBeNull();
  });

  it('равные пороги допустимы без ошибки', () => {
    expect(validateThresholds({ block: 0.6, warn: 0.6 })).toBeNull();
    expect(validateThresholds({ block: 0, warn: 0 })).toBeNull();
  });

  it('ошибка только когда блокировка больше предупреждения', () => {
    expect(validateThresholds({ block: 0.8, warn: 0.6 })).toBe('Порог блокировки не может быть выше порога предупреждения.');
    expect(validateThresholds({ block: 0.6001, warn: 0.6 })).toBe(
      'Порог блокировки не может быть выше порога предупреждения.',
    );
  });

  it('отвергает значения вне диапазона 0–1 и не числа', () => {
    expect(validateThresholds({ block: -0.1, warn: 0.5 })).toBe('Порог должен быть от 0 до 1.');
    expect(validateThresholds({ block: 0.1, warn: 1.2 })).toBe('Порог должен быть от 0 до 1.');
    expect(validateThresholds({ block: Number.NaN, warn: 0.5 })).toBe('Порог должен быть от 0 до 1.');
  });

  it('близость равная блокировке уже не блокируется (строгое неравенство, как в эталоне)', () => {
    const thresholds = { block: 0.5, warn: 0.75 };
    expect(classifySimilarity(0.5, thresholds)).toBe('warn');
    expect(classifySimilarity(0.49, thresholds)).toBe('blocked');
    expect(classifySimilarity(0.75, thresholds)).toBe('ok');
  });
});
