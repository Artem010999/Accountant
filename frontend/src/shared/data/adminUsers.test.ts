import { describe, expect, it } from 'vitest';
import {
  countAdminUsersStats,
  createDemoAdminUsersApi,
  DEMO_ADMIN_USERS,
  formatDateTimeRu,
  formatDayMonth,
  initialsOf,
  toIsoMinute,
} from './adminUsers';

describe('демо-данные админки', () => {
  it('пять пользователей из эталона, у Олега Носова блокировка', () => {
    expect(DEMO_ADMIN_USERS.map((u) => u.name)).toEqual([
      'Иван Иванов', 'Анна Смирнова', 'Мария Ли', 'Пётр Котов', 'Олег Носов',
    ]);
    expect(DEMO_ADMIN_USERS.filter((u) => u.banned).map((u) => u.id)).toEqual(['u5']);
  });

  it('статистика считается по списку: всего, платные, на проверке, блокировки Стража за 7 дней', () => {
    expect(countAdminUsersStats(DEMO_ADMIN_USERS)).toEqual({ total: 5, paid: 3, review: 2, guardBlocks7d: 2 });
  });

  it('«С платным тарифом» и «Паспорт на проверке» — суммы вкладов пользователей (1 или 0), а не длина списка', () => {
    const paidSum = DEMO_ADMIN_USERS.reduce((sum, u) => sum + (u.paid ? 1 : 0), 0);
    const reviewSum = DEMO_ADMIN_USERS.reduce((sum, u) => sum + (u.status === 'review' ? 1 : 0), 0);
    const stats = countAdminUsersStats(DEMO_ADMIN_USERS);
    expect(stats.paid).toBe(paidSum);
    expect(stats.review).toBe(reviewSum);
    // Пользователь без платного тарифа не добавляет единицу.
    const onlyFree = countAdminUsersStats([{ ...DEMO_ADMIN_USERS[1]!, paid: false, status: 'draft' }]);
    expect(onlyFree).toMatchObject({ total: 1, paid: 0, review: 0 });
  });

  it('у каждого пользователя время регистрации согласовано с датой в колонке «Регистрация»', () => {
    for (const u of DEMO_ADMIN_USERS) {
      expect(formatDateTimeRu(u.createdAt).slice(0, 10)).toBe(u.created);
    }
  });

  it('инициалы — первая буква каждого слова имени', () => {
    expect(initialsOf('Иван Иванов')).toBe('ИИ');
    expect(initialsOf('Мария Ли')).toBe('МЛ');
  });
});

describe('createDemoAdminUsersApi', () => {
  it('блокировка и разблокировка меняют только флаг у пользователя', async () => {
    const api = createDemoAdminUsersApi();
    const banned = await api.setBanned('u1', true);
    expect(banned.banned).toBe(true);
    expect((await api.list()).find((u) => u.id === 'u1')?.banned).toBe(true);

    const unbanned = await api.setBanned('u5', false);
    expect(unbanned.banned).toBe(false);
    expect((await api.list()).filter((u) => u.banned).map((u) => u.id)).toEqual(['u1']);
  });

  it('выдача подписки ставит тариф со сроком ДД.ММ от текущей даты и помечает платным', async () => {
    const api = createDemoAdminUsersApi({ now: () => new Date(2026, 10, 12) });
    const updated = await api.grantSubscription('u2', { planId: 'premium', days: 30 });
    expect(updated.plan).toBe('Премиум до 12.12');
    expect(updated.paid).toBe(true);
    expect((await api.list()).find((u) => u.id === 'u2')?.plan).toBe('Премиум до 12.12');
  });

  it('срок меньше одного дня или дробный отклоняется', async () => {
    const api = createDemoAdminUsersApi();
    await expect(api.grantSubscription('u2', { planId: 'pro', days: 0 })).rejects.toThrow();
    await expect(api.grantSubscription('u2', { planId: 'pro', days: 1.5 })).rejects.toThrow();
  });

  it('неизвестный пользователь — ошибка', async () => {
    const api = createDemoAdminUsersApi();
    await expect(api.setBanned('нет', true)).rejects.toThrow('Пользователь не найден');
  });

  it('каждый экземпляр хранит свои данные: изменения не протекают между тестами', async () => {
    await createDemoAdminUsersApi().setBanned('u1', true);
    const fresh = createDemoAdminUsersApi();
    expect((await fresh.list()).find((u) => u.id === 'u1')?.banned).toBe(false);
  });

  it('formatDayMonth дополняет нулями', () => {
    expect(formatDayMonth(new Date(2026, 0, 5))).toBe('05.01');
  });

  it('событие блокировки получает время из часов сервиса (YYYY-MM-DDTHH:mm), а не из данных по умолчанию', async () => {
    const api = createDemoAdminUsersApi({ now: () => new Date(2026, 10, 12, 14, 5) });
    const banned = await api.setBanned('u1', true);
    expect(banned.banEventAt).toBe('2026-11-12T14:05');
    const unbanned = await api.setBanned('u1', false);
    expect(unbanned.banEventAt).toBe('2026-11-12T14:05');
  });

  it('выдача подписки получает время события из часов сервиса', async () => {
    const api = createDemoAdminUsersApi({ now: () => new Date(2026, 10, 12, 9, 7) });
    const updated = await api.grantSubscription('u2', { planId: 'pro', days: 30 });
    expect(updated.grantEventAt).toBe('2026-11-12T09:07');
  });

  it('формат записей журнала: ДД.ММ.ГГГГ ЧЧ:ММ с ведущими нулями', () => {
    expect(formatDateTimeRu('2026-11-12T14:05')).toBe('12.11.2026 14:05');
    expect(formatDateTimeRu('2026-01-05T08:00')).toBe('05.01.2026 08:00');
    expect(toIsoMinute(new Date(2026, 0, 5, 8, 0))).toBe('2026-01-05T08:00');
  });
});
