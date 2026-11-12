import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import {
  createDemoAdminUsersApi,
  DEMO_ADMIN_USERS,
  type AdminUser,
  type AdminUsersApi,
} from '../../shared/data/adminUsers';
import { AdminUsers } from './AdminUsers';

// Дата и время фиксированы: срок выданной подписки считается от неё (30 дней от 12.11.2026 — 12.12),
// а время событий журнала — 12.11.2026 14:05.
const NOW = () => new Date(2026, 10, 12, 14, 5);

function renderScreen(api: AdminUsersApi = createDemoAdminUsersApi({ now: NOW })) {
  return render(
    <MemoryRouter>
      <AdminUsers api={api} />
    </MemoryRouter>,
  );
}

// Имена в строках таблицы в порядке отображения.
function tableNames(): string[] {
  const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
  return rows.map((row) => row.querySelector('.users__name-title')?.textContent ?? '');
}

function rowOf(name: string): HTMLElement {
  const cell = screen.getAllByText(name).find((el) => el.classList.contains('users__name-title'));
  if (!cell) throw new Error(`нет строки: ${name}`);
  return cell.closest('tr') as HTMLElement;
}

// Ждём загрузки списка: демо-API отвечает асинхронно.
async function waitForRows(): Promise<void> {
  await waitFor(() => expect(document.querySelector('.users__name-title')).not.toBeNull());
}

function card(): HTMLElement {
  return screen.getByRole('complementary', { name: 'Карточка пользователя' });
}

describe('AdminUsers: рендер', () => {
  it('«Всего» равно общему количеству пользователей из данных (не зашито в экране)', async () => {
    const three = DEMO_ADMIN_USERS.slice(0, 3);
    renderScreen(createDemoAdminUsersApi({ now: NOW, users: three }));
    await waitForRows();
    expect(screen.getByText('Всего').parentElement).toHaveTextContent(/^Всего3$/);
    expect(screen.getByText('С платным тарифом').parentElement).toHaveTextContent(/^С платным тарифом2$/);
  });

  it('рендерит заголовок, поиск, статистику, фильтры и шапку таблицы из дизайна', async () => {
    renderScreen();
    await waitForRows();

    expect(screen.getByRole('heading', { level: 1, name: 'Пользователи' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Поиск' })).toHaveAttribute('placeholder', 'Почта, имя или проект');

    expect(screen.getByText('Всего').parentElement).toHaveTextContent(/^Всего5$/);
    expect(screen.getByText('С платным тарифом').parentElement).toHaveTextContent(/^С платным тарифом3$/);
    expect(screen.getByText('Паспорт на проверке').parentElement).toHaveTextContent(/^Паспорт на проверке2$/);
    expect(screen.getByText('Блокировки Стража за 7 дней').parentElement).toHaveTextContent(/^Блокировки Стража за 7 дней2$/);

    const group = screen.getByRole('group', { name: 'Фильтр' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Все', 'Платные', 'На проверке', 'Заблокированные',
    ]);

    expect(screen.getByRole('columnheader', { name: 'Пользователь' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Проект' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Статус' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Тариф' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Регистрация' })).toBeInTheDocument();

    expect(tableNames()).toEqual(['Иван Иванов', 'Анна Смирнова', 'Мария Ли', 'Пётр Котов', 'Олег Носов']);
    expect(rowOf('Олег Носов')).toHaveTextContent('Заблокирован');
    expect(rowOf('Иван Иванов')).toHaveTextContent('На проверке');
  });

  it('роль только показывается: кнопки смены роли нет', async () => {
    renderScreen();
    await waitForRows();
    expect(card().querySelector('dd')).toHaveTextContent('user · меняется только через SQL');
    // Единственный выбор в карточке — тариф для выдачи подписки.
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
  });

  it('карточка по умолчанию — первый пользователь, без сообщения о выдаче и с журналом регистрации', async () => {
    renderScreen();
    await waitForRows();
    expect(within(card()).getByText('ivan@university.ru')).toBeInTheDocument();
    expect(within(card()).getByRole('link', { name: '1 предупреждение' })).toHaveAttribute('href', '/admin/guard');
    expect(within(card()).getByText('Журнал действий')).toBeInTheDocument();
    expect(within(card()).getByText('Регистрация')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('показывает заданные данные из подменённого API, а не демо-список', async () => {
    const single: AdminUser = {
      id: 'x1', name: 'Тест Тестов', email: 'test@example.ru', project: 'Проект', status: 'draft',
      plan: 'Базовый', created: '01.01.2026', createdAt: '2026-01-01T00:00', banEventAt: null, grantEventAt: null,
      anchor: '—', files: '0 из 0', guard: 'нет событий',
      guardBlocks7d: 0, paid: false, role: 'user', banned: false,
    };
    const api = createDemoAdminUsersApi({ users: [single] });
    const list = vi.spyOn(api, 'list');
    renderScreen(api);
    await waitForRows();
    expect(list).toHaveBeenCalledTimes(1);
    expect(tableNames()).toEqual(['Тест Тестов']);
  });

  it('при ошибке загрузки показывает уведомление', async () => {
    const api: AdminUsersApi = {
      list: () => Promise.reject(new Error('сеть')),
      setBanned: vi.fn(),
      grantSubscription: vi.fn(),
    };
    renderScreen(api);
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить пользователей');
  });
});

describe('AdminUsers: поиск и фильтры', () => {
  it('поиск по почте, имени и проекту без учёта регистра', async () => {
    const user = userEvent.setup();
    renderScreen();
    await waitForRows();
    const search = screen.getByRole('searchbox', { name: 'Поиск' });

    await user.type(search, 'ANNA@');
    expect(tableNames()).toEqual(['Анна Смирнова']);

    await user.clear(search);
    await user.type(search, 'monetrix');
    expect(tableNames()).toEqual(['Иван Иванов']);

    await user.clear(search);
    await user.type(search, 'мария');
    expect(tableNames()).toEqual(['Мария Ли']);

    await user.clear(search);
    await user.type(search, 'нет такого');
    expect(tableNames()).toEqual([]);

    await user.clear(search);
    expect(tableNames()).toHaveLength(5);
  });

  it('фильтры «Платные», «На проверке», «Заблокированные», «Все»; активный помечен aria-pressed', async () => {
    const user = userEvent.setup();
    renderScreen();
    await waitForRows();
    const filter = (label: string) => screen.getByRole('button', { name: label });

    await user.click(filter('Платные'));
    expect(tableNames()).toEqual(['Иван Иванов', 'Мария Ли', 'Олег Носов']);
    expect(filter('Платные')).toHaveAttribute('aria-pressed', 'true');
    expect(filter('Все')).toHaveAttribute('aria-pressed', 'false');

    await user.click(filter('На проверке'));
    expect(tableNames()).toEqual(['Иван Иванов', 'Олег Носов']);

    await user.click(filter('Заблокированные'));
    expect(tableNames()).toEqual(['Олег Носов']);

    await user.click(filter('Все'));
    expect(tableNames()).toHaveLength(5);
    expect(filter('Все')).toHaveAttribute('aria-pressed', 'true');
  });

  it('фильтр и поиск работают вместе', async () => {
    const user = userEvent.setup();
    renderScreen();
    await waitForRows();
    await user.click(screen.getByRole('button', { name: 'Платные' }));
    await user.type(screen.getByRole('searchbox', { name: 'Поиск' }), 'Олег');
    expect(tableNames()).toEqual(['Олег Носов']);
  });
});

describe('AdminUsers: карточка пользователя', () => {
  it('клик по пользователю открывает его карточку и выделяет строку', async () => {
    const user = userEvent.setup();
    renderScreen();
    await waitForRows();

    await user.click(screen.getByRole('button', { name: /Анна Смирнова/ }));
    expect(within(card()).getByText('Анна Смирнова')).toBeInTheDocument();
    expect(within(card()).getByText('anna@example.ru')).toBeInTheDocument();
    expect(within(card()).getByText('Молодёжь рядом')).toBeInTheDocument();
    expect(within(card()).getByText('готов · gpt-4o-mini')).toBeInTheDocument();
    expect(within(card()).getByText('Базовый')).toBeInTheDocument();
    expect(rowOf('Анна Смирнова')).toHaveClass('users__row--selected');
    expect(rowOf('Иван Иванов')).not.toHaveClass('users__row--selected');
  });

  it('карточка заблокированного пользователя показывает плашку «Заблокирован» и кнопку «Разблокировать»', async () => {
    const user = userEvent.setup();
    renderScreen();
    await waitForRows();
    await user.click(screen.getByRole('button', { name: /Олег Носов/ }));
    expect(within(card()).getAllByText('Заблокирован')).toHaveLength(2);
    expect(within(card()).getByRole('button', { name: 'Разблокировать' })).toBeInTheDocument();
    expect(within(card()).getByText('Журнал действий').parentElement).toHaveTextContent('Заблокирован');
  });

  it('ссылка «Страж» ведёт на /admin/guard', async () => {
    renderScreen();
    await waitForRows();
    expect(within(card()).getByRole('link', { name: '1 предупреждение' })).toHaveAttribute('href', '/admin/guard');
  });
});

describe('AdminUsers: блокировка', () => {
  it('«Заблокировать» просит подтверждение; после подтверждения статус меняется в таблице', async () => {
    const user = userEvent.setup();
    const api = createDemoAdminUsersApi({ now: NOW });
    const setBanned = vi.spyOn(api, 'setBanned');
    renderScreen(api);
    await waitForRows();

    await user.click(within(card()).getByRole('button', { name: 'Заблокировать' }));
    expect(within(card()).getByRole('group', { name: 'Подтверждение блокировки' })).toBeInTheDocument();
    expect(setBanned).not.toHaveBeenCalled();
    expect(rowOf('Иван Иванов')).toHaveTextContent('На проверке');

    await user.click(within(card()).getByRole('button', { name: 'Подтвердить' }));
    expect(setBanned).toHaveBeenCalledWith('u1', true);
    await waitFor(() => expect(rowOf('Иван Иванов')).toHaveTextContent('Заблокирован'));
    expect(within(card()).getByRole('button', { name: 'Разблокировать' })).toBeInTheDocument();
    expect(within(card()).queryByRole('group', { name: 'Подтверждение блокировки' })).toBeNull();
  });

  it('«Отмена» в подтверждении не меняет состояние', async () => {
    const user = userEvent.setup();
    const api = createDemoAdminUsersApi({ now: NOW });
    const setBanned = vi.spyOn(api, 'setBanned');
    renderScreen(api);
    await waitForRows();

    await user.click(within(card()).getByRole('button', { name: 'Заблокировать' }));
    await user.click(within(card()).getByRole('button', { name: 'Отмена' }));
    expect(setBanned).not.toHaveBeenCalled();
    expect(rowOf('Иван Иванов')).toHaveTextContent('На проверке');
    expect(within(card()).getByRole('button', { name: 'Заблокировать' })).toBeInTheDocument();
  });

  it('«Разблокировать» снимает блокировку в таблице', async () => {
    const user = userEvent.setup();
    renderScreen();
    await waitForRows();
    await user.click(screen.getByRole('button', { name: /Олег Носов/ }));

    await user.click(within(card()).getByRole('button', { name: 'Разблокировать' }));
    expect(within(card()).getByText('Разблокировать пользователя? Действие попадёт в журнал.')).toBeInTheDocument();
    await user.click(within(card()).getByRole('button', { name: 'Подтвердить' }));
    expect(rowOf('Олег Носов')).toHaveTextContent('На проверке');
    expect(rowOf('Олег Носов')).not.toHaveTextContent('Заблокирован');
  });

  it('разблокировка пишется в журнал как «Разблокирован» с датой; «Заблокирован» пропадает', async () => {
    const user = userEvent.setup();
    renderScreen();
    await waitForRows();
    await user.click(screen.getByRole('button', { name: /Олег Носов/ }));
    const journal = () => within(card()).getByText('Журнал действий').parentElement as HTMLElement;
    expect(journal()).toHaveTextContent('Заблокирован');
    expect(journal()).not.toHaveTextContent('Разблокирован');

    await user.click(within(card()).getByRole('button', { name: 'Разблокировать' }));
    await user.click(within(card()).getByRole('button', { name: 'Подтвердить' }));

    const items = within(journal()).getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual(['Разблокирован12.11.2026 14:05', 'Регистрация28.10.2026 18:02']);
    expect(journal()).not.toHaveTextContent('Заблокирован');
  });

  it('все записи журнала показывают дату и время ДД.ММ.ГГГГ ЧЧ:ММ, без «сегодня»', async () => {
    const user = userEvent.setup();
    renderScreen();
    await waitForRows();
    await user.click(screen.getByRole('button', { name: /Олег Носов/ }));
    await user.click(within(card()).getByRole('button', { name: 'Разблокировать' }));
    await user.click(within(card()).getByRole('button', { name: 'Подтвердить' }));
    await user.click(within(card()).getByRole('button', { name: 'Заблокировать' }));
    await user.click(within(card()).getByRole('button', { name: 'Подтвердить' }));

    const journal = within(card()).getByText('Журнал действий').parentElement as HTMLElement;
    const items = within(journal).getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual(['Заблокирован12.11.2026 14:05', 'Регистрация28.10.2026 18:02']);
    expect(journal).not.toHaveTextContent('сегодня');
  });

  it('время записей журнала берётся из данных событий, а не из момента рендера', async () => {
    const users = DEMO_ADMIN_USERS.map((u) => (u.id === 'u5' ? { ...u, banEventAt: '2026-11-01T08:15' } : u));
    renderScreen(createDemoAdminUsersApi({ now: NOW, users }));
    await waitForRows();
    await userEvent.setup().click(screen.getByRole('button', { name: /Олег Носов/ }));
    const journal = within(card()).getByText('Журнал действий').parentElement as HTMLElement;
    expect(within(journal).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Заблокирован01.11.2026 08:15',
      'Регистрация28.10.2026 18:02',
    ]);
  });

  it('выдача подписки пишет в журнал «Выдана подписка» с датой и временем события', async () => {
    const user = userEvent.setup();
    renderScreen(createDemoAdminUsersApi({ now: NOW }));
    await waitForRows();
    await user.click(screen.getByRole('button', { name: /Анна Смирнова/ }));
    await user.click(within(card()).getByRole('button', { name: 'Выдать' }));
    await user.click(within(card()).getByRole('button', { name: 'Подтвердить' }));

    const journal = within(card()).getByText('Журнал действий').parentElement as HTMLElement;
    expect(within(journal).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Выдана подписка12.11.2026 14:05',
      'Регистрация07.11.2026 15:48',
    ]);
  });

  it('повторная блокировка после разблокировки снова пишет «Заблокирован», «Разблокирован» убирается', async () => {
    const user = userEvent.setup();
    renderScreen();
    await waitForRows();
    await user.click(screen.getByRole('button', { name: /Олег Носов/ }));
    await user.click(within(card()).getByRole('button', { name: 'Разблокировать' }));
    await user.click(within(card()).getByRole('button', { name: 'Подтвердить' }));
    await user.click(within(card()).getByRole('button', { name: 'Заблокировать' }));
    await user.click(within(card()).getByRole('button', { name: 'Подтвердить' }));

    const journal = within(card()).getByText('Журнал действий').parentElement as HTMLElement;
    expect(journal).toHaveTextContent('Заблокирован');
    expect(journal).not.toHaveTextContent('Разблокирован');
  });
});

describe('AdminUsers: выдача подписки вручную', () => {
  it('выдача просит подтверждение, затем меняет тариф в таблице и пишет сообщение и журнал', async () => {
    const user = userEvent.setup();
    const api = createDemoAdminUsersApi({ now: NOW });
    const grant = vi.spyOn(api, 'grantSubscription');
    renderScreen(api);
    await waitForRows();

    await user.click(screen.getByRole('button', { name: /Анна Смирнова/ }));
    await user.selectOptions(within(card()).getByRole('combobox'), 'Премиум');
    await user.click(within(card()).getByRole('button', { name: 'Выдать' }));

    const confirm = within(card()).getByRole('group', { name: 'Подтверждение выдачи' });
    expect(confirm).toHaveTextContent('Выдать «Премиум» на 30 дней вручную?');
    expect(grant).not.toHaveBeenCalled();
    expect(rowOf('Анна Смирнова')).toHaveTextContent('Базовый');

    await user.click(within(confirm).getByRole('button', { name: 'Подтвердить' }));
    expect(grant).toHaveBeenCalledWith('u2', { planId: 'premium', days: 30 });

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Выдано. Платёж записан как «вручную», событие — в журнале.',
    );
    expect(rowOf('Анна Смирнова').querySelectorAll('td')[3]).toHaveTextContent('Премиум до 12.12');
    expect(within(card()).getByText('Выдана подписка')).toBeInTheDocument();
  });

  it('«Выдать» по умолчанию предлагает «Профессиональный» на 30 дней', async () => {
    const user = userEvent.setup();
    renderScreen();
    await waitForRows();
    expect(within(card()).getByRole('combobox')).toHaveValue('pro');
    expect(within(card()).getByRole('spinbutton')).toHaveValue(30);
    expect(within(card()).getByRole('option', { name: 'Профессиональный' })).toBeInTheDocument();
    expect(within(card()).getByRole('option', { name: 'Премиум' })).toBeInTheDocument();

    await user.click(within(card()).getByRole('button', { name: 'Выдать' }));
    expect(within(card()).getByRole('group', { name: 'Подтверждение выдачи' })).toHaveTextContent(
      'Выдать «Профессиональный» на 30 дней вручную?',
    );
  });

  it('срок меньше одного дня блокирует «Выдать»', async () => {
    const user = userEvent.setup();
    renderScreen();
    await waitForRows();
    const days = within(card()).getByRole('spinbutton');
    await user.clear(days);
    await user.type(days, '0');
    expect(within(card()).getByRole('button', { name: 'Выдать' })).toBeDisabled();
    await user.clear(days);
    await user.type(days, '7');
    expect(within(card()).getByRole('button', { name: 'Выдать' })).toBeEnabled();
  });

  it('смена выбранного пользователя сбрасывает сообщение о выдаче', async () => {
    const user = userEvent.setup();
    renderScreen();
    await waitForRows();
    await user.click(screen.getByRole('button', { name: /Анна Смирнова/ }));
    await user.click(within(card()).getByRole('button', { name: 'Выдать' }));
    await user.click(within(card()).getByRole('button', { name: 'Подтвердить' }));
    expect(await screen.findByRole('status')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Мария Ли/ }));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
