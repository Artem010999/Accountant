import { useEffect, useState } from 'react';
import {
  classifySimilarity,
  demoAdminGuardService,
  validateThresholds,
  type AdminGuardService,
  type GuardDecision,
  type GuardEvent,
  type GuardThresholds,
} from '../../shared/data/adminGuard';
import './AdminGuard.css';

// Экран «Страж проекта» (user-flows F16) по design/project/AdminGuard.dc.html.
// Пороги и журнал — через сервис AdminGuardService (в приложении демо-реализация, в тестах подмена).

type DecisionFilter = 'all' | GuardDecision;

export interface AdminGuardProps {
  service?: AdminGuardService;
}

const DECISION_LABEL: Record<GuardDecision, string> = {
  blocked: 'Заблокировано',
  warn: 'С предупреждением',
  ok: 'Пропущено',
};

const FILTERS: { id: DecisionFilter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'blocked', label: DECISION_LABEL.blocked },
  { id: 'warn', label: DECISION_LABEL.warn },
  { id: 'ok', label: DECISION_LABEL.ok },
];

const SAVED_NOTE = 'Сохранено. Новые пороги действуют для следующих загрузок.';
const DEFAULT_NOTE = 'Решения в журнале ниже пересчитаны по текущим значениям для наглядности.';

/** Число 0–1 → «0,50», как в эталоне. */
function formatScore(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

/** Дата и время YYYY-MM-DDTHH:mm → «08.11 14:02», как в эталоне. */
function formatDateTime(iso: string): string {
  const [date, time] = iso.split('T');
  const [, month, day] = date.split('-');
  return `${day}.${month} ${time}`;
}

/** Владелец и проект: «Олег Носов · Проект Startup X» (вместо плейсхолдера «[проект]» эталона). */
function formatProject(event: GuardEvent): string {
  return `${event.project.owner} · Проект ${event.project.name}`;
}

function filterClass(active: boolean): string {
  return active ? 'admin-guard__filter admin-guard__filter--active' : 'admin-guard__filter';
}

export function AdminGuard({ service = demoAdminGuardService }: AdminGuardProps = {}) {
  const [thresholds, setThresholds] = useState<GuardThresholds | null>(null);
  const [events, setEvents] = useState<GuardEvent[]>([]);
  const [filter, setFilter] = useState<DecisionFilter>('all');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([service.getThresholds(), service.listEvents()]).then(([nextThresholds, nextEvents]) => {
      if (!alive) return;
      setThresholds(nextThresholds);
      setEvents(nextEvents);
    });
    return () => {
      alive = false;
    };
  }, [service]);

  function changeThreshold(next: GuardThresholds) {
    setThresholds(next);
    setSaved(false);
    setError(null);
  }

  // Как в эталоне: ползунок блокировки не выходит за предупреждение, и наоборот.
  // Равные пороги допустимы; ошибку при сохранении даёт только block > warn (validateThresholds).
  function onBlock(value: number) {
    if (thresholds) changeThreshold({ ...thresholds, block: Math.min(value, thresholds.warn) });
  }

  function onWarn(value: number) {
    if (thresholds) changeThreshold({ ...thresholds, warn: Math.max(value, thresholds.block) });
  }

  async function save() {
    if (!thresholds) return;
    const message = validateThresholds(thresholds);
    if (message) {
      setError(message);
      setSaved(false);
      return;
    }
    await service.saveThresholds(thresholds);
    setSaved(true);
  }

  const visibleEvents = thresholds
    ? events
        .map((event) => ({ event, decision: classifySimilarity(event.similarity, thresholds) }))
        .filter(({ decision }) => filter === 'all' || decision === filter)
    : [];

  // Отступ между блоками экрана в эталоне Стража — 24 px (у «Платежей» — 22 px, это общий отступ оболочки).
  return (
    <div className="admin-guard">
      <div className="admin-guard__intro">
        <h1 className="admin-guard__title">Страж проекта</h1>
        <p className="admin-guard__lead">
          Сравнивает каждую новую загрузку с якорем проекта. Низкая близость — значит, материалы, скорее всего, про
          другой проект.
        </p>
      </div>

      {thresholds && (
        <section className="admin-guard__panel">
          <h2 className="admin-guard__h2">Пороги</h2>
          <div aria-hidden="true" className="admin-guard__scale">
            <div className="admin-guard__track">
              <span className="admin-guard__zone admin-guard__zone--blocked" style={{ width: `${thresholds.block * 100}%` }} />
              <span
                className="admin-guard__zone admin-guard__zone--warn"
                style={{ width: `${(thresholds.warn - thresholds.block) * 100}%` }}
              />
              <span className="admin-guard__zone admin-guard__zone--ok" />
            </div>
            <div className="admin-guard__axis">
              <span>0</span>
              <span>близость</span>
              <span>1</span>
            </div>
          </div>

          <div className="admin-guard__sliders">
            <label className="admin-guard__slider">
              <span className="admin-guard__slider-head">
                <span>Блокировать ниже</span>
                <span>{formatScore(thresholds.block)}</span>
              </span>
              <input
                type="range"
                className="admin-guard__range"
                min="0"
                max="1"
                step="0.01"
                value={thresholds.block}
                onChange={(e) => onBlock(parseFloat(e.target.value))}
              />
              <span className="admin-guard__help">Загрузка отклоняется, пользователь видит «Материалы другого проекта».</span>
            </label>
            <label className="admin-guard__slider">
              <span className="admin-guard__slider-head">
                <span>Предупреждать ниже</span>
                <span>{formatScore(thresholds.warn)}</span>
              </span>
              <input
                type="range"
                className="admin-guard__range"
                min="0"
                max="1"
                step="0.01"
                value={thresholds.warn}
                onChange={(e) => onWarn(parseFloat(e.target.value))}
              />
              <span className="admin-guard__help">Загрузка проходит, событие попадает в журнал для проверки.</span>
            </label>
          </div>

          <div className="admin-guard__save">
            <button type="button" className="admin-guard__save-btn" onClick={() => void save()}>
              Сохранить пороги
            </button>
            {error ? (
              <span role="alert" className="admin-guard__error">
                {error}
              </span>
            ) : (
              <span role="status" className="admin-guard__save-note">
                {saved ? SAVED_NOTE : DEFAULT_NOTE}
              </span>
            )}
          </div>
        </section>
      )}

      <section className="admin-guard__journal">
        <div className="admin-guard__journal-head">
          <h2 className="admin-guard__h2">Журнал событий</h2>
          <div role="group" aria-label="Фильтр по действию" className="admin-guard__filters">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                className={filterClass(filter === f.id)}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="admin-guard__table-wrap">
          <table className="admin-guard__table">
            <thead>
              <tr>
                <th scope="col">Когда</th>
                <th scope="col">Проект</th>
                <th scope="col">Решение</th>
                <th scope="col">Близость</th>
                <th scope="col">Модель</th>
                <th scope="col">Начало текста</th>
              </tr>
            </thead>
            <tbody>
              {visibleEvents.map(({ event, decision }) => (
                <tr key={event.id}>
                  <td className="admin-guard__cell admin-guard__cell--date">{formatDateTime(event.createdAt)}</td>
                  <td className="admin-guard__cell">{formatProject(event)}</td>
                  <td className="admin-guard__cell">
                    <span className={`admin-guard__chip admin-guard__chip--${decision}`}>{DECISION_LABEL[decision]}</span>
                  </td>
                  <td className="admin-guard__cell">
                    <span className="admin-guard__score">
                      <span className="admin-guard__meter">
                        <span
                          className={`admin-guard__fill admin-guard__fill--${decision}`}
                          style={{ width: `${Math.round(event.similarity * 100)}%` }}
                        />
                      </span>
                      <b className="admin-guard__score-value">{formatScore(event.similarity)}</b>
                    </span>
                  </td>
                  <td className="admin-guard__cell admin-guard__cell--model">{event.model}</td>
                  <td className="admin-guard__cell admin-guard__cell--preview">{event.previewText}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
