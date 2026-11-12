import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PillLink, SegmentedControl } from '../../shared/ui';
import { SiteBrand } from '../../shared/layout/SiteLayout';
import { Mascot } from './SiteArt';
import './Auth.css';

// Вход и регистрация: design/project/Auth.dc.html. Тексты дословно из эталона.
// Экран без шапки и подвала: слева форма, справа оранжевая панель с шагами.

type Mode = 'signup' | 'login';

const MODE_OPTIONS = [
  { id: 'signup', label: 'Регистрация' },
  { id: 'login', label: 'Вход' },
];

const STEPS = [
  'Заполните профиль основателя',
  'Расскажите об идее или загрузите презентацию',
  'Ответьте на вопросы по пробелам',
];

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  /** Элемент справа от подписи (например, «Забыли пароль?»). */
  aside?: ReactNode;
}

function Field({ id, label, aside, ...input }: FieldProps) {
  const labelEl = (
    <label htmlFor={id} className="auth__label">
      {label}
    </label>
  );
  return (
    <div className="auth__field">
      {aside ? (
        <div className="auth__label-row">
          {labelEl}
          {aside}
        </div>
      ) : (
        labelEl
      )}
      <input id={id} className="auth__input" {...input} />
    </div>
  );
}

function SignupForm() {
  return (
    <div className="auth__stack">
      <div className="auth__heading">
        <h1 className="t-screen-title">Создайте аккаунт</h1>
        <p className="auth__lead">Один аккаунт — один проект. Начать можно бесплатно.</p>
      </div>
      <Field id="su-email" label="Электронная почта" type="email" placeholder="name@university.ru" />
      <Field id="su-pass" label="Пароль" type="password" placeholder="Не меньше 8 символов" />
      <label className="auth__consent">
        <input type="checkbox" defaultChecked className="auth__checkbox" />
        <span>
          Согласен с <a href="#">условиями сервиса</a> и <a href="#">обработкой персональных данных</a>, в том числе с передачей текстов проекта языковой модели для разбора
        </span>
      </label>
      <PillLink to="/onboarding" variant="brand" size="md">Зарегистрироваться</PillLink>
      <p className="auth__hint">Пришлём письмо для подтверждения почты.</p>
    </div>
  );
}

function LoginForm() {
  return (
    <div className="auth__stack">
      <h1 className="t-screen-title">С возвращением</h1>
      <Field id="li-email" label="Электронная почта" type="email" defaultValue="ivan@university.ru" />
      <Field
        id="li-pass"
        label="Пароль"
        type="password"
        defaultValue="password123"
        aside={<a href="#" className="auth__aside-link">Забыли пароль?</a>}
      />
      <PillLink to="/passport" variant="brand" size="md">Войти</PillLink>
      <div className="auth__proto">
        <span className="auth__proto-title">Для прототипа</span>
        <Link to="/admin/users" className="auth__proto-link">Войти как администратор</Link>
        <Link to="/states" className="auth__proto-link">Аккаунт заблокирован (экран 403)</Link>
      </div>
    </div>
  );
}

export function Auth() {
  const [mode, setMode] = useState<Mode>('signup');

  return (
    <div className="auth">
      <div className="auth__form-side">
        <SiteBrand className="auth__brand" />

        <div className="auth__form">
          <SegmentedControl
            mode="tabs"
            block
            ariaLabel="Вход или регистрация"
            options={MODE_OPTIONS}
            value={mode}
            onChange={(id) => setMode(id as Mode)}
          />
          {mode === 'signup' ? <SignupForm /> : <LoginForm />}
        </div>
      </div>

      <div className="auth__panel">
        <Mascot size={148} variant="tile" />
        <h2 className="auth__panel-title">Через 10 минут у вас будет черновик паспорта</h2>
        <ul className="auth__steps">
          {STEPS.map((step, index) => (
            <li key={step} className="auth__step">
              <span className="auth__step-num">{index + 1}</span>
              {step}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
