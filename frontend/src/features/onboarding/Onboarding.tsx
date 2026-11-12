import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingHeader } from './OnboardingHeader';
import './common.css';
import './Onboarding.css';

// Экран «Профиль основателя» — design/project/Onboarding.dc.html (блок 1 паспорта).

interface CheckToggleProps {
  checked: boolean;
  onToggle: () => void;
  variant: 'lg' | 'sm';
  children: string;
}

function CheckToggle({ checked, onToggle, variant, children }: CheckToggleProps) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={onToggle} className={`ob-check ob-check--${variant}`}>
      <span className="ob-check__box">
        {checked && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#17171C" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12l5 5 9-10" />
          </svg>
        )}
      </span>
      {children}
    </button>
  );
}

export function Onboarding() {
  const navigate = useNavigate();
  const [studying, setStudying] = useState(true);
  const [noMiddle, setNoMiddle] = useState(false);
  const [middleName, setMiddleName] = useState('Иванович');
  const [understood, setUnderstood] = useState(true);

  // Валидация — нативная (атрибуты required у полей): без заполненных обязательных полей переход не происходит.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate('/brief');
  };

  return (
    <div className="ob-page">
      <OnboardingHeader current={1} trailing={<span className="obh__email">ivan@university.ru</span>} />
      <main className="onb-main">
        <form className="onb-form" onSubmit={onSubmit}>
          <div className="onb-heading">
            <p className="onb-eyebrow">Блок 1 паспорта</p>
            <h1 className="ob-title">Расскажите о себе</h1>
          </div>

          <section className="onb-fields">
            <fieldset aria-label="ФИО" className="onb-name">
              <div className="onb-name__row">
                <div className="ob-field">
                  <label htmlFor="lastName" className="ob-label">
                    Фамилия<span aria-hidden="true" className="ob-required"> *</span>
                  </label>
                  <input id="lastName" className="ob-input" required aria-required="true" type="text" defaultValue="Иванов" autoComplete="family-name" />
                </div>
                <div className="ob-field">
                  <label htmlFor="firstName" className="ob-label">
                    Имя<span aria-hidden="true" className="ob-required"> *</span>
                  </label>
                  <input id="firstName" className="ob-input" required aria-required="true" type="text" defaultValue="Иван" autoComplete="given-name" />
                </div>
                <div className="ob-field">
                  <label htmlFor="middleName" className="ob-label">
                    Отчество
                    {!noMiddle && (
                      <span aria-hidden="true" className="ob-required"> *</span>
                    )}
                  </label>
                  <input
                    id="middleName"
                    className="ob-input"
                    type="text"
                    required={!noMiddle}
                    aria-required={noMiddle ? undefined : true}
                    disabled={noMiddle}
                    value={noMiddle ? '' : middleName}
                    placeholder={noMiddle ? 'Не указывается' : undefined}
                    onChange={(event) => setMiddleName(event.target.value)}
                    autoComplete="additional-name"
                  />
                  <CheckToggle variant="sm" checked={noMiddle} onToggle={() => setNoMiddle((v) => !v)}>
                    Нет отчества
                  </CheckToggle>
                </div>
              </div>
              <span className="onb-hint">После создания проекта ФИО можно изменить только через поддержку.</span>
            </fieldset>

            <div className="ob-field">
              <label htmlFor="phone" className="ob-label ob-label--strong">
                Телефон<span aria-hidden="true" className="ob-required"> *</span>
              </label>
              <input id="phone" className="ob-input" required aria-required="true" type="tel" placeholder="+7 900 000-00-00" />
            </div>

            <div className="ob-field">
              <label htmlFor="tg" className="ob-label ob-label--strong">
                Telegram
              </label>
              <input id="tg" className="ob-input" type="text" placeholder="@username" />
            </div>

            <fieldset className="onb-study">
              <legend className="onb-study__legend">Обучение</legend>
              <CheckToggle variant="lg" checked={studying} onToggle={() => setStudying((v) => !v)}>
                Учусь в настоящее время
              </CheckToggle>

              {studying && (
                <div className="onb-study__panel">
                  <div className="ob-field onb-study__uni">
                    <label htmlFor="uni" className="ob-label">
                      Вуз<span aria-hidden="true" className="ob-required"> *</span>
                    </label>
                    <input id="uni" className="ob-input" type="text" placeholder="Полное название вуза" required aria-required="true" />
                  </div>
                  <div className="ob-field">
                    <label htmlFor="level" className="ob-label">
                      Уровень<span aria-hidden="true" className="ob-required"> *</span>
                    </label>
                    <select id="level" className="ob-select" required aria-required="true" defaultValue="">
                      <option value="">Выберите</option>
                      <option>Бакалавриат</option>
                      <option>Специалитет</option>
                      <option>Магистратура</option>
                      <option>Аспирантура</option>
                    </select>
                  </div>
                  <div className="ob-field">
                    <label htmlFor="course" className="ob-label">
                      Курс<span aria-hidden="true" className="ob-required"> *</span>
                    </label>
                    <select id="course" className="ob-select" required aria-required="true" defaultValue="">
                      <option value="">—</option>
                      <option>1</option>
                      <option>2</option>
                      <option>3</option>
                      <option>4</option>
                      <option>5</option>
                      <option>6</option>
                    </select>
                  </div>
                </div>
              )}

              {!studying && (
                <div role="status" className="onb-warning">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="onb-warning__icon">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v5M12 16h.01" />
                  </svg>
                  <span>Для «Студенческого стартапа» нужно учиться в вузе: бакалавриат, специалитет, магистратура или аспирантура. Продолжить можно, но это попадёт в предупреждения итоговой проверки.</span>
                </div>
              )}
            </fieldset>

            <div className="ob-field">
              <label htmlFor="region" className="ob-label ob-label--strong">
                Регион<span aria-hidden="true" className="ob-required"> *</span>
              </label>
              <select id="region" className="ob-select" required aria-required="true" defaultValue="">
                <option value="">Выберите регион</option>
                <option>Москва</option>
                <option>Санкт-Петербург</option>
                <option>Республика Татарстан</option>
              </select>
            </div>
          </section>

          <section className="onb-programs">
            <h2 className="onb-programs__title">Программа поддержки</h2>
            <div className="onb-programs__grid">
              <button type="button" aria-pressed="true" className="onb-program onb-program--active">
                <span className="onb-program__head">
                  <span className="onb-program__name">Студенческий стартап</span>
                  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="11" fill="#FF6B1A" />
                    <path d="M7 12l3.5 3.5L17 9" fill="none" stroke="#17171C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="onb-program__sub">ФСИ · грант для студентов и аспирантов</span>
              </button>
              <div aria-disabled="true" className="onb-program onb-program--disabled">
                <span className="onb-program__head">
                  <span className="onb-program__name">Старт-1</span>
                  <span className="onb-badge">Скоро</span>
                </span>
                <span className="onb-program__sub-plain">ФСИ · для малых инновационных компаний</span>
              </div>
              <div aria-disabled="true" className="onb-program onb-program--disabled">
                <span className="onb-program__head">
                  <span className="onb-program__name">Сколково</span>
                  <span className="onb-badge">Скоро</span>
                </span>
                <span className="onb-program__sub-plain">Статус участника и микрогранты</span>
              </div>
            </div>
          </section>

          <section className="onb-owner">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#C2410C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="onb-owner__icon">
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            <div className="onb-owner__body">
              <h2 className="onb-owner__title">Один аккаунт — один проект</h2>
              <p className="onb-owner__text">Первое описание станет «якорем» проекта. Материалы другого проекта система не примет, а ФИО закрепится за этим проектом.</p>
              <label className="onb-owner__ack">
                <input type="checkbox" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} className="onb-owner__checkbox" />
                Понятно
              </label>
            </div>
          </section>

          <div className="onb-footer">
            <p className="onb-legend">
              <span className="ob-required">*</span> — обязательные поля
            </p>
            <button type="submit" className="ob-btn-primary">
              Продолжить
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#17171C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
