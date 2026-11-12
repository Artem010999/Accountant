import { getPlan, type PlanId } from './plans';

// Пользователи для админки (F14). Данные — демо-значения из design/project/AdminUsers.dc.html.
// Подключение к API — этап G5: экран получает реализацию AdminUsersApi через props, в тестах подменяется.

export type AdminUserStatus = 'review' | 'generating' | 'draft' | 'none';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  /** Название проекта или «—», если проекта нет. */
  project: string;
  status: AdminUserStatus;
  /** Тариф как в таблице: «Профессиональный до 01.12» или «Базовый». */
  plan: string;
  /** Дата регистрации, ДД.ММ.ГГГГ (колонка таблицы). */
  created: string;
  /** Время регистрации из данных события, YYYY-MM-DDTHH:mm. Записи журнала показывают его как ДД.ММ.ГГГГ ЧЧ:ММ. */
  createdAt: string;
  /** Время последнего события блокировки или разблокировки (YYYY-MM-DDTHH:mm) или null, если событий не было. */
  banEventAt: string | null;
  /** Время последней ручной выдачи подписки (YYYY-MM-DDTHH:mm) или null. */
  grantEventAt: string | null;
  /** Якорь (состояние анкеты/модели), как в карточке эталона. */
  anchor: string;
  files: string;
  /** Текст события Стража, как в карточке эталона. */
  guard: string;
  /** Блокировки Стража за 7 дней — число для блока статистики. */
  guardBlocks7d: number;
  /** Есть платный тариф: фильтр «Платные» и счётчик «С платным тарифом». */
  paid: boolean;
  /** Роль только отображается; меняется через SQL / service_role (user-flows F14). */
  role: 'user' | 'admin';
  banned: boolean;
}

/** Тарифы, которые админ может выдать вручную: все платные из plans.ts. */
export const GRANTABLE_PLAN_IDS: readonly Exclude<PlanId, 'free'>[] = ['pro', 'premium'];

export interface ManualGrant {
  planId: Exclude<PlanId, 'free'>;
  /** Целое число дней, не меньше 1. */
  days: number;
}

export interface AdminUsersApi {
  list(): Promise<AdminUser[]>;
  /** Заблокировать (banned = true) или разблокировать (false). Возвращает обновлённого пользователя. */
  setBanned(userId: string, banned: boolean): Promise<AdminUser>;
  /** Выдать подписку вручную (provider = manual, subscription_granted). Возвращает обновлённого пользователя. */
  grantSubscription(userId: string, grant: ManualGrant): Promise<AdminUser>;
}

export const DEMO_ADMIN_USERS: readonly AdminUser[] = [
  {
    id: 'u1',
    name: 'Иван Иванов',
    email: 'ivan@university.ru',
    project: 'Monetrix',
    status: 'review',
    plan: 'Профессиональный до 01.12',
    created: '06.11.2026',
    createdAt: '2026-11-06T10:21',
    banEventAt: null,
    grantEventAt: null,
    anchor: 'готов · gpt-4o-mini',
    files: '3 из 10',
    guard: '1 предупреждение',
    guardBlocks7d: 0,
    paid: true,
    role: 'user',
    banned: false,
  },
  {
    id: 'u2',
    name: 'Анна Смирнова',
    email: 'anna@example.ru',
    project: 'Молодёжь рядом',
    status: 'generating',
    plan: 'Базовый',
    created: '07.11.2026',
    createdAt: '2026-11-07T15:48',
    banEventAt: null,
    grantEventAt: null,
    anchor: 'готов · gpt-4o-mini',
    files: '0 из 0',
    guard: 'нет событий',
    guardBlocks7d: 0,
    paid: false,
    role: 'user',
    banned: false,
  },
  {
    id: 'u3',
    name: 'Мария Ли',
    email: 'maria@example.ru',
    project: '[Название проекта]',
    status: 'draft',
    plan: 'Премиум до 05.12',
    created: '05.11.2026',
    createdAt: '2026-11-05T12:09',
    banEventAt: null,
    grantEventAt: null,
    anchor: 'ожидает брифа',
    files: '0 из 50',
    guard: 'нет событий',
    guardBlocks7d: 0,
    paid: true,
    role: 'user',
    banned: false,
  },
  {
    id: 'u4',
    name: 'Пётр Котов',
    email: 'petr@example.ru',
    project: '—',
    status: 'none',
    plan: 'Базовый',
    created: '08.11.2026',
    createdAt: '2026-11-08T09:37',
    banEventAt: null,
    grantEventAt: null,
    anchor: '—',
    files: '—',
    guard: 'нет событий',
    guardBlocks7d: 0,
    paid: false,
    role: 'user',
    banned: false,
  },
  {
    id: 'u5',
    name: 'Олег Носов',
    email: 'oleg@example.ru',
    project: '[Название проекта]',
    status: 'review',
    plan: 'Профессиональный до 20.11',
    created: '28.10.2026',
    createdAt: '2026-10-28T18:02',
    banEventAt: '2026-11-12T14:05',
    grantEventAt: null,
    anchor: 'готов · gpt-4o-mini',
    files: '10 из 10',
    guard: '2 блокировки',
    guardBlocks7d: 2,
    paid: true,
    role: 'user',
    banned: true,
  },
];

export interface AdminUsersStats {
  total: number;
  paid: number;
  review: number;
  guardBlocks7d: number;
}

/**
 * Статистика блока: «Всего» — число пользователей; «С платным тарифом» и «Паспорт на проверке» — сумма
 * вкладов каждого пользователя (1 или 0); блокировки Стража — сумма по полю guardBlocks7d.
 */
export function countAdminUsersStats(users: readonly AdminUser[]): AdminUsersStats {
  return {
    total: users.length,
    paid: users.reduce((sum, u) => sum + (u.paid ? 1 : 0), 0),
    review: users.reduce((sum, u) => sum + (u.status === 'review' ? 1 : 0), 0),
    guardBlocks7d: users.reduce((sum, u) => sum + u.guardBlocks7d, 0),
  };
}

/** Инициалы как в карточке эталона: первая буква каждого слова имени. */
export function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((s) => s[0])
    .join('');
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** ДД.ММ — так записан срок тарифа в таблице эталона («до 01.12»). */
export function formatDayMonth(date: Date): string {
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}`;
}

/** Дата и время события → YYYY-MM-DDTHH:mm (локальное время, как в данных пользователей). */
export function toIsoMinute(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** YYYY-MM-DDTHH:mm → ДД.ММ.ГГГГ ЧЧ:ММ (формат записей журнала, например «12.11.2026 14:05»). */
export function formatDateTimeRu(iso: string): string {
  const [date, time] = iso.split('T');
  const [y, m, d] = date.split('-');
  return `${d}.${m}.${y} ${time}`;
}

export interface DemoAdminUsersOptions {
  /** Текущее время: срок выданной подписки и время событий журнала (блокировка, выдача). По умолчанию — new Date(). */
  now?: () => Date;
  users?: readonly AdminUser[];
}

/** Демо-реализация AdminUsersApi в памяти. Каждый вызов создаёт независимое хранилище. */
export function createDemoAdminUsersApi(options: DemoAdminUsersOptions = {}): AdminUsersApi {
  const now = options.now ?? (() => new Date());
  let store: AdminUser[] = (options.users ?? DEMO_ADMIN_USERS).map((u) => ({ ...u }));

  function find(userId: string): AdminUser {
    const user = store.find((u) => u.id === userId);
    if (!user) throw new Error(`Пользователь не найден: ${userId}`);
    return user;
  }

  return {
    async list() {
      return store.map((u) => ({ ...u }));
    },
    async setBanned(userId, banned) {
      const user = find(userId);
      user.banned = banned;
      user.banEventAt = toIsoMinute(now());
      return { ...user };
    },
    async grantSubscription(userId, grant) {
      if (!Number.isInteger(grant.days) || grant.days < 1) {
        throw new Error(`Срок подписки должен быть целым числом дней не меньше 1: ${grant.days}`);
      }
      const user = find(userId);
      const current = now();
      const until = new Date(current.getTime() + grant.days * 24 * 60 * 60 * 1000);
      user.plan = `${getPlan(grant.planId).name} до ${formatDayMonth(until)}`;
      user.paid = true;
      user.grantEventAt = toIsoMinute(current);
      return { ...user };
    },
  };
}

/** Реализация по умолчанию для маршрута /admin/users, пока нет API (G5). */
export const demoAdminUsersApi: AdminUsersApi = createDemoAdminUsersApi();
