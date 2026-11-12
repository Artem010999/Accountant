import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useCabinetShell } from '../../shared/layout/CabinetLayout';
import './Profile.css';

// Экран «Профиль» (F13). Эталон: design/project/Profile.dc.html, логика повторяет его renderVals().
// Данные — демо-значения из эталона; сохранение в app_profiles.founder_data — этап G5.
// ФИО и e-mail здесь только показываются: ФИО закрепляется за проектом и не редактируется (F13).

export interface ProfileData {
  phone: string;
  telegram: string;
  studying: boolean;
  university: string;
  level: string;
  course: string;
  region: string;
}

export const PROFILE_DEMO: ProfileData = {
  phone: '+7 916 123-45-67',
  telegram: '@ivan_monetrix',
  studying: true,
  university: 'НИУ «Высшая школа экономики»',
  level: 'Бакалавриат',
  course: '3',
  region: 'Москва',
};

const FOUNDER = {
  name: 'Иванов Иван Иванович',
  contact: 'ivan@university.ru · аккаунт с 02.11.2026',
  initials: 'ИИ',
};

const LEVELS = ['Бакалавриат', 'Специалитет', 'Магистратура', 'Аспирантура'];
const COURSES = ['1', '2', '3', '4', '5', '6'];
const REGIONS = ['Москва', 'Санкт-Петербург', 'Республика Татарстан'];

interface FieldErrors {
  phone?: boolean;
  university?: boolean;
}

export interface ProfileProps {
  /** Сохранённые данные на момент открытия экрана. По умолчанию — демо из эталона. */
  initial?: ProfileData;
}

function formatStudying(data: ProfileData): string {
  return data.studying
    ? `${data.university} · ${data.level.toLowerCase()}, ${data.course} курс`
    : 'Сейчас не учусь — не подходит для программы';
}

export function Profile({ initial = PROFILE_DEMO }: ProfileProps = {}) {
  useCabinetShell({ mainPadding: 'var(--space-36) var(--space-48) var(--space-64)', mainGap: 'var(--space-28)' });

  const id = useId();
  const [saved, setSaved] = useState<ProfileData>(initial);
  // draft != null — режим правки; значения правки не попадают в сохранённые, пока не нажато «Сохранить».
  const [draft, setDraft] = useState<ProfileData | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [justSaved, setJustSaved] = useState(false);

  const startEdit = () => {
    setDraft({ ...saved });
    setErrors({});
    setJustSaved(false);
  };

  const cancel = () => {
    setDraft(null);
    setErrors({});
  };

  const update = <K extends keyof ProfileData>(key: K, value: ProfileData[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
    setErrors((prev) => ({ ...prev, [key]: false }));
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    // Обязательные поля (*): телефон всегда; вуз — только при обучении.
    const nextErrors: FieldErrors = {
      phone: draft.phone.trim() === '',
      university: draft.studying && draft.university.trim() === '',
    };
    if (nextErrors.phone || nextErrors.university) {
      setErrors(nextErrors);
      return;
    }
    setSaved({
      ...draft,
      phone: draft.phone.trim(),
      telegram: draft.telegram.trim(),
      university: draft.university.trim(),
    });
    setDraft(null);
    setErrors({});
    setJustSaved(true);
  };

  const rows = [
    { label: 'Телефон', value: saved.phone || '—', color: 'var(--color-ink)' },
    { label: 'Telegram', value: saved.telegram || '—', color: 'var(--color-ink)' },
    {
      label: 'Обучение',
      value: formatStudying(saved),
      color: saved.studying ? 'var(--color-ink)' : 'var(--color-fact-nodoc-line)',
    },
    { label: 'Регион', value: saved.region, color: 'var(--color-ink)' },
  ];

  const fieldId = (name: string) => `${id}-${name}`;

  return (
    <div className="profile">
      <header className="profile__head">
        <div className="profile__head-text">
          <h1 className="profile__title">Профиль</h1>
          <p className="profile__lead">Данные основателя. Они попадают в блок 1 паспорта как есть: ИИ их не меняет.</p>
        </div>
        {!draft && (
          <button type="button" className="profile__edit" onClick={startEdit}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 20h4L19 9l-4-4L4 16z" />
              <path d="M13.5 6.5l4 4" />
            </svg>
            Редактировать
          </button>
        )}
      </header>

      {justSaved && !draft && (
        <div role="status" className="profile__saved">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="profile__saved-icon">
            <path d="M5 12l5 5 9-10" />
          </svg>
          <span className="profile__saved-text">
            <b className="profile__saved-strong">Сохранено.</b> Блок 1 паспорта обновлён.
          </span>
          <Link to="/passport" className="profile__saved-link">
            Открыть паспорт
          </Link>
        </div>
      )}

      <section className="profile__card">
        <div className="profile__founder">
          <span className="profile__avatar" aria-hidden="true">{FOUNDER.initials}</span>
          <div className="profile__founder-text">
            <span className="profile__name-row">
              <span className="profile__name">{FOUNDER.name}</span>
              <span className="profile__lock">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <rect x="4" y="10" width="16" height="11" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                закреплено за проектом
              </span>
            </span>
            <span className="profile__meta">{FOUNDER.contact}</span>
          </div>
          <Link to="/support" className="profile__support">
            Ошибка в ФИО? Напишите в поддержку
          </Link>
        </div>

        <div className="profile__divider" aria-hidden="true" />

        {!draft && (
          <dl className="profile__rows">
            {rows.map((row) => (
              <div key={row.label} className="profile__row">
                <dt className="profile__row-label">{row.label}</dt>
                <dd className="profile__row-value" style={{ color: row.color }}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {draft && (
          <form className="profile__form" noValidate onSubmit={save}>
            <div className="profile__grid">
              <div className="profile__field">
                <label htmlFor={fieldId('phone')} className="profile__label">
                  Телефон<span aria-hidden="true" className="profile__required"> *</span>
                </label>
                <input
                  id={fieldId('phone')}
                  type="tel"
                  required
                  aria-required="true"
                  aria-invalid={errors.phone ? 'true' : undefined}
                  aria-describedby={errors.phone ? fieldId('phone-error') : undefined}
                  className={`profile__input${errors.phone ? ' profile__input--invalid' : ''}`}
                  value={draft.phone}
                  onChange={(e) => update('phone', e.target.value)}
                />
                {errors.phone && (
                  <span id={fieldId('phone-error')} className="profile__error">
                    Укажите телефон.
                  </span>
                )}
              </div>
              <div className="profile__field">
                <label htmlFor={fieldId('tg')} className="profile__label">
                  Telegram
                </label>
                <input
                  id={fieldId('tg')}
                  type="text"
                  className="profile__input"
                  value={draft.telegram}
                  onChange={(e) => update('telegram', e.target.value)}
                />
              </div>

              <fieldset className="profile__study">
                <legend className="profile__legend">Обучение</legend>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={draft.studying ? 'true' : 'false'}
                  className="profile__check"
                  onClick={() => update('studying', !draft.studying)}
                >
                  <span className={`profile__box${draft.studying ? ' profile__box--on' : ''}`}>
                    {draft.studying && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12l5 5 9-10" />
                      </svg>
                    )}
                  </span>
                  Учусь в настоящее время
                </button>

                {draft.studying && (
                  <div className="profile__study-grid">
                    <div className="profile__field profile__field--tight">
                      <label htmlFor={fieldId('uni')} className="profile__label profile__label--small">
                        Вуз<span aria-hidden="true" className="profile__required"> *</span>
                      </label>
                      <input
                        id={fieldId('uni')}
                        type="text"
                        required
                        aria-required="true"
                        aria-invalid={errors.university ? 'true' : undefined}
                        aria-describedby={errors.university ? fieldId('uni-error') : undefined}
                        className={`profile__input profile__input--white${errors.university ? ' profile__input--invalid' : ''}`}
                        value={draft.university}
                        onChange={(e) => update('university', e.target.value)}
                      />
                      {errors.university && (
                        <span id={fieldId('uni-error')} className="profile__error">
                          Укажите вуз.
                        </span>
                      )}
                    </div>
                    <div className="profile__field profile__field--tight">
                      <label htmlFor={fieldId('level')} className="profile__label profile__label--small">
                        Уровень<span aria-hidden="true" className="profile__required"> *</span>
                      </label>
                      <select
                        id={fieldId('level')}
                        required
                        aria-required="true"
                        className="profile__select profile__select--white"
                        value={draft.level}
                        onChange={(e) => update('level', e.target.value)}
                      >
                        {LEVELS.map((level) => (
                          <option key={level}>{level}</option>
                        ))}
                      </select>
                    </div>
                    <div className="profile__field profile__field--tight">
                      <label htmlFor={fieldId('course')} className="profile__label profile__label--small">
                        Курс<span aria-hidden="true" className="profile__required"> *</span>
                      </label>
                      <select
                        id={fieldId('course')}
                        required
                        aria-required="true"
                        className="profile__select profile__select--white"
                        value={draft.course}
                        onChange={(e) => update('course', e.target.value)}
                      >
                        {COURSES.map((course) => (
                          <option key={course}>{course}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {!draft.studying && (
                  <div role="status" className="profile__warning">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="profile__warning-icon">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 8v5M12 16h.01" />
                    </svg>
                    <span>Для «Студенческого стартапа» нужно учиться в вузе. Сохранить можно, но итоговая проверка покажет предупреждение.</span>
                  </div>
                )}
              </fieldset>

              <div className="profile__field">
                <label htmlFor={fieldId('region')} className="profile__label">
                  Регион<span aria-hidden="true" className="profile__required"> *</span>
                </label>
                <select
                  id={fieldId('region')}
                  required
                  aria-required="true"
                  className="profile__select profile__select--white"
                  value={draft.region}
                  onChange={(e) => update('region', e.target.value)}
                >
                  {REGIONS.map((region) => (
                    <option key={region}>{region}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="profile__actions">
              <span className="profile__hint-wrap">
                <span className="profile__hint">
                  <span className="profile__required">*</span> — обязательные поля
                </span>
              </span>
              <button type="button" className="profile__btn profile__btn--outline" onClick={cancel}>
                Отмена
              </button>
              <button type="submit" className="profile__btn profile__btn--brand">
                Сохранить
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="profile__info">
        <div className="profile__info-card profile__info-card--muted">
          <span className="profile__info-caption">Программа</span>
          <span className="profile__info-title">Студенческий стартап</span>
          <span className="profile__info-text">ФСИ · грант для студентов и аспирантов. «Старт-1» и Сколково появятся позже.</span>
        </div>
        <div className="profile__info-card profile__info-card--peach">
          <span className="profile__info-caption profile__info-caption--terracotta">Проект</span>
          <span className="profile__info-title">Monetrix</span>
          <span className="profile__info-text profile__info-text--strong">Один аккаунт — один проект. ФИО и проект закреплены друг за другом.</span>
        </div>
      </section>
    </div>
  );
}
