import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Notice } from './Notice';

function renderNotice(props: Parameters<typeof Notice>[0]) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Notice {...props} />
    </MemoryRouter>,
  );
}

describe('Notice', () => {
  it('выводит заголовок и текст', () => {
    renderNotice({ tone: 'info', title: 'Загрузка документов — на платном тарифе', children: 'Пояснение.' });
    expect(screen.getByRole('region', { name: 'Загрузка документов — на платном тарифе' })).toBeInTheDocument();
    expect(screen.getByText('Пояснение.')).toBeInTheDocument();
  });

  it('три тона: предупреждение, информация и ошибка (ошибка объявляется как alert)', () => {
    const { unmount } = renderNotice({ tone: 'warning', title: 'Предупреждение' });
    expect(screen.getByRole('region', { name: 'Предупреждение' })).toHaveClass('notice', 'notice--warning');
    unmount();

    const info = renderNotice({ tone: 'info', title: 'Информация' });
    expect(screen.getByRole('region', { name: 'Информация' })).toHaveClass('notice--info');
    info.unmount();

    renderNotice({ tone: 'danger', title: 'Ошибка' });
    expect(screen.getByRole('alert', { name: 'Ошибка' })).toHaveClass('notice--danger');
  });

  it('кнопка действия — ссылка на маршрут', () => {
    renderNotice({ tone: 'info', title: 'Пейволл', action: { label: 'Тарифы', to: '/billing' } });
    expect(screen.getByRole('link', { name: 'Тарифы' })).toHaveAttribute('href', '/billing');
  });

  it('без action ссылки нет; без onDismiss кнопки закрытия нет', () => {
    renderNotice({ tone: 'warning', title: 'Без действий', children: 'Текст' });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Закрыть' })).not.toBeInTheDocument();
  });

  it('кнопка «Закрыть» вызывает onDismiss', async () => {
    const onDismiss = vi.fn();
    renderNotice({ tone: 'danger', title: 'Блокировка', onDismiss });
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
