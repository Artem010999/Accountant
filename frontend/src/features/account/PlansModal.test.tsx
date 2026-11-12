import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PlansModal } from './PlansModal';

describe('PlansModal', () => {
  it('показывает три тарифа из админки: название, цена и описание', () => {
    render(<PlansModal onClose={() => {}} />);

    const dialog = screen.getByRole('dialog', { name: 'Тарифы' });
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Тарифы' })).toBeInTheDocument();

    const items = within(dialog).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByRole('heading', { level: 3, name: 'Базовый' })).toBeInTheDocument();
    expect(items[0]).toHaveTextContent('0 ₽');
    expect(items[0]).toHaveTextContent('Паспорт, анкета, стоп-факторы и экспорт. Без загрузки файлов и проверки новизны.');

    expect(within(items[1]).getByRole('heading', { level: 3, name: 'Профессиональный' })).toBeInTheDocument();
    expect(items[1]).toHaveTextContent('990 ₽');
    expect(items[1]).toHaveTextContent('До 10 файлов, разбор документов ИИ и проверка новизны.');

    expect(within(items[2]).getByRole('heading', { level: 3, name: 'Премиум' })).toBeInTheDocument();
    expect(items[2]).toHaveTextContent('4 990 ₽');
    expect(items[2]).toHaveTextContent('До 50 файлов, разбор документов ИИ, проверка новизны и консультант.');
  });

  it('при открытии фокус внутри окна', () => {
    render(<PlansModal onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Тарифы' })).toHaveFocus();
  });

  it('закрывается по крестику', async () => {
    const onClose = vi.fn();
    render(<PlansModal onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('закрывается по Esc', async () => {
    const onClose = vi.fn();
    render(<PlansModal onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('закрывается по клику на подложку, но не по клику внутри окна', async () => {
    const onClose = vi.fn();
    const { container } = render(<PlansModal onClose={onClose} />);

    await userEvent.click(screen.getByRole('heading', { level: 3, name: 'Премиум' }));
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(container.querySelector('.plans-modal__overlay') as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
