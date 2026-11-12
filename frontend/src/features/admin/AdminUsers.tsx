import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  countAdminUsersStats,
  demoAdminUsersApi,
  formatDateTimeRu,
  GRANTABLE_PLAN_IDS,
  initialsOf,
  type AdminUser,
  type AdminUserStatus,
  type AdminUsersApi,
} from '../../shared/data/adminUsers';
import { getPlan, pluralDays, type PlanId } from '../../shared/data/plans';
import { Notice } from '../../shared/ui/Notice/Notice';
import './AdminUsers.css';

// Экран «Пользователи» (F14). Эталон: design/project/AdminUsers.dc.html, логика повторяет его renderVals().
// Данные и действия приходят через AdminUsersApi (по умолчанию — демо-реализация, см. shared/data/adminUsers.ts).
// Роль только отображается: кнопки смены роли нет (user-flows F14).
// Отличия от эталона (решения G4, см. отчёт): поиск (эталон его не связывает), подтверждение действий,
// обновление тарифа в таблице после выдачи подписки.

type FilterId = 'all' | 'paid' | 'review' | 'banned';

const FILTERS: ReadonlyArray<{ id: FilterId; label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'paid', label: 'Платные' },
  { id: 'review', label: 'На проверке' },
  { id: 'banned', label: 'Заблокированные' },
];

const STATUS_LABEL: Record<AdminUserStatus, string> = {
  review: 'На проверке',
  generating: 'Сборка',
  draft: 'Черновик',
  none: 'Нет проекта',
};

// Действие, ждущее подтверждения. Подтверждение есть не в эталоне (см. отчёт G4).
type PendingAction = 'ban' | 'grant' | null;

export interface AdminUsersProps {
  api?: AdminUsersApi;
}

function matchesFilter(user: AdminUser, filter: FilterId): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'paid':
      return user.paid;
    case 'review':
      return user.status === 'review';
    case 'banned':
      return user.banned;
  }
}

// Поиск по почте, имени или проекту без учёта регистра.
function matchesQuery(user: AdminUser, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [user.email, user.name, user.project].some((field) => field.toLowerCase().includes(q));
}

export function AdminUsers({ api = demoAdminUsersApi }: AdminUsersProps) {
  const searchId = useId();
  const planSelectId = useId();
  const daysId = useId();

  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('u1');
  const [granted, setGranted] = useState(false);
  // Разблокировка выбранного пользователя в этой сессии: пишется в журнал как «Разблокирован».
  const [unbanned, setUnbanned] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const [grantPlan, setGrantPlan] = useState<Exclude<PlanId, 'free'>>(GRANTABLE_PLAN_IDS[0]);
  const [grantDays, setGrantDays] = useState('30');

  useEffect(() => {
    let alive = true;
    api.list().then(
      (list) => {
        if (alive) setUsers(list);
      },
      () => {
        if (alive) setError('Не удалось загрузить пользователей');
      },
    );
    return () => {
      alive = false;
    };
  }, [api]);

  if (error) {
    return <Notice tone="danger" title={error} />;
  }

  const all = users ?? [];
  const stats = countAdminUsersStats(all);
  const rows = all.filter((u) => matchesFilter(u, filter) && matchesQuery(u, query));
  const selected = all.find((u) => u.id === selectedId) ?? all[0];
  const days = Number(grantDays);
  const daysValid = Number.isInteger(days) && days >= 1;

  function pick(id: string) {
    setSelectedId(id);
    setGranted(false);
    setUnbanned(false);
    setPending(null);
  }

  async function confirmBan(user: AdminUser) {
    try {
      const updated = await api.setBanned(user.id, !user.banned);
      setUsers((prev) => (prev ?? []).map((u) => (u.id === updated.id ? updated : u)));
      setUnbanned(user.banned && !updated.banned);
      setPending(null);
    } catch {
      setError('Не удалось сохранить изменения');
    }
  }

  async function confirmGrant(user: AdminUser) {
    try {
      const updated = await api.grantSubscription(user.id, { planId: grantPlan, days });
      setUsers((prev) => (prev ?? []).map((u) => (u.id === updated.id ? updated : u)));
      setGranted(true);
      setPending(null);
    } catch {
      setError('Не удалось сохранить изменения');
    }
  }

  const statsCards: Array<{ label: string; value: number }> = [
    { label: 'Всего', value: stats.total },
    { label: 'С платным тарифом', value: stats.paid },
    { label: 'Паспорт на проверке', value: stats.review },
    { label: 'Блокировки Стража за 7 дней', value: stats.guardBlocks7d },
  ];

  return (
    <>
      <div className="users__head">
        <h1 className="users__title">Пользователи</h1>
        <div className="users__tools">
          <label htmlFor={searchId} className="users__sr-only">
            Поиск
          </label>
          <input
            id={searchId}
            type="search"
            className="users__search"
            placeholder="Почта, имя или проект"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="users__stats">
        {statsCards.map((card) => (
          <div key={card.label} className="users__stat">
            <span className="users__stat-label">{card.label}</span>
            <span className="users__stat-value">{users ? card.value : '—'}</span>
          </div>
        ))}
      </div>

      <div role="group" aria-label="Фильтр" className="users__filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            className="users__filter"
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="users__body">
        <div className="users__table-wrap">
          <table className="users__table">
            <thead>
              <tr>
                <th scope="col">Пользователь</th>
                <th scope="col">Проект</th>
                <th scope="col">Статус</th>
                <th scope="col">Тариф</th>
                <th scope="col">Регистрация</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const isSelected = u.id === selected?.id;
                const chipClass = u.banned
                  ? 'users__chip users__chip--banned'
                  : `users__chip users__chip--${u.status}`;
                return (
                  <tr key={u.id} className={isSelected ? 'users__row users__row--selected' : 'users__row'}>
                    <td>
                      <button type="button" className="users__name" onClick={() => pick(u.id)}>
                        <span className="users__name-title">{u.name}</span>
                        <span className="users__name-email">{u.email}</span>
                      </button>
                    </td>
                    <td>{u.project}</td>
                    <td>
                      <span className={chipClass}>{u.banned ? 'Заблокирован' : STATUS_LABEL[u.status]}</span>
                    </td>
                    <td>{u.plan}</td>
                    <td className="users__muted-cell">{u.created}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {selected && (
          <aside aria-label="Карточка пользователя" className="users__card">
            <div className="users__who">
              <span className="users__avatar">{initialsOf(selected.name)}</span>
              <div className="users__who-text">
                <span className="users__who-name">{selected.name}</span>
                <span className="users__who-email">{selected.email}</span>
              </div>
            </div>

            {selected.banned && <span className="users__chip users__chip--banned users__chip--self">Заблокирован</span>}

            <dl className="users__facts">
              <dt>Роль</dt>
              <dd>
                {selected.role} <span className="users__muted">· меняется только через SQL</span>
              </dd>
              <dt>Проект</dt>
              <dd>{selected.project}</dd>
              <dt>Якорь</dt>
              <dd>{selected.anchor}</dd>
              <dt>Файлов</dt>
              <dd>{selected.files}</dd>
              <dt>Тариф</dt>
              <dd>{selected.plan}</dd>
              <dt>Страж</dt>
              <dd>
                <Link to="/admin/guard">{selected.guard}</Link>
              </dd>
            </dl>

            <div className="users__grant">
              <span className="users__grant-title">Выдать подписку вручную</span>
              <div className="users__grant-row">
                <label htmlFor={planSelectId} className="users__sr-only">
                  Тариф
                </label>
                <select
                  id={planSelectId}
                  className="users__select"
                  value={grantPlan}
                  onChange={(e) => setGrantPlan(e.target.value as Exclude<PlanId, 'free'>)}
                >
                  {GRANTABLE_PLAN_IDS.map((id) => (
                    <option key={id} value={id}>
                      {getPlan(id).name}
                    </option>
                  ))}
                </select>
                <label htmlFor={daysId} className="users__sr-only">
                  Дней
                </label>
                <input
                  id={daysId}
                  type="number"
                  className="users__days"
                  value={grantDays}
                  onChange={(e) => setGrantDays(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="users__dark-btn"
                disabled={!daysValid}
                onClick={() => setPending('grant')}
              >
                Выдать
              </button>
              {pending === 'grant' && (
                <div className="users__confirm" role="group" aria-label="Подтверждение выдачи">
                  <p className="users__confirm-text">
                    {`Выдать «${getPlan(grantPlan).name}» на ${days} ${pluralDays(days)} вручную? Платёж будет записан как «вручную».`}
                  </p>
                  <div className="users__confirm-actions">
                    <button type="button" className="users__dark-btn" onClick={() => confirmGrant(selected)}>
                      Подтвердить
                    </button>
                    <button type="button" className="users__outline-btn" onClick={() => setPending(null)}>
                      Отмена
                    </button>
                  </div>
                </div>
              )}
              {granted && (
                <span role="status" className="users__granted">
                  Выдано. Платёж записан как «вручную», событие — в журнале.
                </span>
              )}
            </div>

            <button
              type="button"
              className={selected.banned ? 'users__ban users__ban--unban' : 'users__ban users__ban--ban'}
              onClick={() => setPending('ban')}
            >
              {selected.banned ? 'Разблокировать' : 'Заблокировать'}
            </button>
            {pending === 'ban' && (
              <div className="users__confirm" role="group" aria-label="Подтверждение блокировки">
                <p className="users__confirm-text">
                  {selected.banned
                    ? 'Разблокировать пользователя? Действие попадёт в журнал.'
                    : 'Заблокировать пользователя? Действие попадёт в журнал.'}
                </p>
                <div className="users__confirm-actions">
                  <button type="button" className="users__dark-btn" onClick={() => confirmBan(selected)}>
                    Подтвердить
                  </button>
                  <button type="button" className="users__outline-btn" onClick={() => setPending(null)}>
                    Отмена
                  </button>
                </div>
              </div>
            )}

            <div className="users__journal">
              <span className="users__journal-title">Журнал действий</span>
              {/* Дата и время каждой записи — из данных события (ДД.ММ.ГГГГ ЧЧ:ММ), не «сейчас» в момент рендера. */}
              <ul className="users__journal-list">
                {selected.banned && selected.banEventAt && (
                  <li>
                    <span>Заблокирован</span>
                    <span className="users__muted">{formatDateTimeRu(selected.banEventAt)}</span>
                  </li>
                )}
                {unbanned && selected.banEventAt && (
                  <li>
                    <span>Разблокирован</span>
                    <span className="users__muted">{formatDateTimeRu(selected.banEventAt)}</span>
                  </li>
                )}
                {granted && selected.grantEventAt && (
                  <li>
                    <span>Выдана подписка</span>
                    <span className="users__muted">{formatDateTimeRu(selected.grantEventAt)}</span>
                  </li>
                )}
                <li>
                  <span>Регистрация</span>
                  <span className="users__muted">{formatDateTimeRu(selected.createdAt)}</span>
                </li>
              </ul>
            </div>
          </aside>
        )}
      </div>
    </>
  );
}
