import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { States } from './States';

function renderStates() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <States />
    </MemoryRouter>,
  );
}

describe('States', () => {
  it('рендерит заголовок экрана из дизайна', () => {
    renderStates();
    expect(screen.getByRole('heading', { level: 1, name: 'Блокировки и лимиты' })).toBeInTheDocument();
  });

  it('показывает пять состояний с подписями ответа сервера', () => {
    renderStates();
    expect(screen.getByText('BLOCKED_PROJECT_SWAP · близость 0,38')).toBeInTheDocument();
    expect(screen.getByText('403 USER_BANNED')).toBeInTheDocument();
    expect(screen.getByText('402 PLAN_UPGRADE_REQUIRED')).toBeInTheDocument();
    expect(screen.getByText('429 FILE_QUOTA_EXCEEDED')).toBeInTheDocument();
    expect(screen.getByText('Подписка закончилась · баннер в кабинете')).toBeInTheDocument();
  });

  it('блокировка проекта: свой заголовок и переход к загрузке другого файла', () => {
    renderStates();
    const dialog = screen.getByRole('dialog', { name: 'Похоже, это материалы другого проекта' });
    expect(within(dialog).getByRole('link', { name: 'Загрузить другой файл' })).toHaveAttribute('href', '/files');
    expect(within(dialog).getByRole('link', { name: 'Написать в поддержку' })).toHaveAttribute('href', '/support');
  });

  it('бан: свой заголовок и переход на главную', () => {
    renderStates();
    const dialog = screen.getByRole('dialog', { name: 'Доступ к аккаунту ограничен' });
    expect(within(dialog).getByText('Работа с проектом приостановлена администратором. Данные проекта сохранены.')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'На главную' })).toHaveAttribute('href', '/');
    expect(within(dialog).getByRole('link', { name: 'Связаться с поддержкой' })).toHaveAttribute('href', '/support');
  });

  it('402 на Free: переход на тариф и на анкету', () => {
    renderStates();
    const dialog = screen.getByRole('dialog', { name: 'Загрузка документов — на платном тарифе' });
    expect(within(dialog).getByRole('link', { name: 'Подключить за 990 ₽' })).toHaveAttribute('href', '/billing');
    expect(within(dialog).getByRole('link', { name: 'Ответить на анкету' })).toHaveAttribute('href', '/brief');
  });

  it('429: заголовок с 10 из 10 и переходы на Премиум и к выбору файлов', () => {
    renderStates();
    const dialog = screen.getByRole('dialog', { name: 'Лимит файлов исчерпан: 10 из 10' });
    expect(within(dialog).getByRole('link', { name: 'Перейти на Премиум' })).toHaveAttribute('href', '/billing');
    expect(within(dialog).getByRole('link', { name: 'Выбрать меньше файлов' })).toHaveAttribute('href', '/files');
  });

  it('баннер окончания подписки: текст и продление', () => {
    renderStates();
    const banner = screen.getByRole('status');
    expect(within(banner).getByText('«Профессиональный» закончился 1 декабря.')).toBeInTheDocument();
    expect(within(banner).getByRole('link', { name: 'Продлить за 841 ₽' })).toHaveAttribute('href', '/billing');
  });

  it('каждое окно показывает свой текст из дизайна', () => {
    renderStates();
    const swap = screen.getByRole('dialog', { name: 'Похоже, это материалы другого проекта' });
    expect(within(swap).getByText('Если это ошибка и файл про ваш проект — напишите в поддержку, мы проверим вручную.')).toBeInTheDocument();
    const banned = screen.getByRole('dialog', { name: 'Доступ к аккаунту ограничен' });
    expect(within(banned).getByText('Работа с проектом приостановлена администратором. Данные проекта сохранены.')).toBeInTheDocument();
    const paywall = screen.getByRole('dialog', { name: 'Загрузка документов — на платном тарифе' });
    expect(within(paywall).getByText('На Базовом тарифе паспорт собирается по анкете. Чтобы разобрать презентацию и привязать факты к страницам, подключите «Профессиональный».')).toBeInTheDocument();
    const quota = screen.getByRole('dialog', { name: 'Лимит файлов исчерпан: 10 из 10' });
    expect(within(quota).getByText('Вы пытаетесь добавить ещё 2 файла. На «Премиуме» — до 50 файлов в проекте. Повторно загруженные копии в лимит не считаются.')).toBeInTheDocument();
  });
});
