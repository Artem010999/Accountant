import { useId, useState, type ChangeEvent, type FormEvent } from 'react';
import { Button, TextField } from '../../shared/ui';
import { SiteBrand } from '../../shared/layout/SiteLayout';
import { submitSupport } from './submitSupport';
import './Support.css';

// Страница «Написать в поддержку» (/support). Эталона в design/project нет: поля и кнопка — из брендбука
// (токены tokens.css, поля TextField, кнопка primary), оболочка — одиночная карточка по центру под логотипом,
// как левая колонка Auth.dc.html. Заголовок и подписи полей — по решению G3, см. отчёт.

export const NAME_MAX = 200;
export const MESSAGE_MAX = 2000;
const EMAIL_MAX = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface SupportValues {
  email: string;
  name: string;
  message: string;
}

export type SupportErrors = Partial<Record<keyof SupportValues, string>>;

const EMPTY: SupportValues = { email: '', name: '', message: '' };

/** Проверка полей на клиенте. Тексты ошибок — на «вы», по-русски. */
export function validateSupport(values: SupportValues): SupportErrors {
  const errors: SupportErrors = {};

  const email = values.email.trim();
  if (!email) {
    errors.email = 'Укажите e-mail.';
  } else if (email.length > EMAIL_MAX || !EMAIL_PATTERN.test(email)) {
    errors.email = 'Введите e-mail в формате name@university.ru.';
  }

  const name = values.name.trim();
  if (!name) {
    errors.name = 'Укажите имя.';
  } else if (name.length > NAME_MAX) {
    errors.name = 'Сократите имя: не больше 200 символов.';
  }

  const message = values.message.trim();
  if (!message) {
    errors.message = 'Опишите проблему.';
  } else if (message.length > MESSAGE_MAX) {
    errors.message = 'Сократите текст: не больше 2000 символов.';
  }

  return errors;
}

type Status = 'idle' | 'sending' | 'sent' | 'error';

export function Support() {
  const id = useId();
  const [values, setValues] = useState<SupportValues>(EMPTY);
  const [errors, setErrors] = useState<SupportErrors>({});
  const [status, setStatus] = useState<Status>('idle');

  const update = (key: keyof SupportValues) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === 'sending') return;

    const nextErrors = validateSupport(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setStatus('sending');
    try {
      await submitSupport({
        email: values.email.trim(),
        name: values.name.trim(),
        message: values.message.trim(),
      });
      setValues(EMPTY);
      setErrors({});
      setStatus('sent');
    } catch {
      // При ошибке форма не очищается: пользователь может отправить ещё раз.
      setStatus('error');
    }
  };

  const emailId = `${id}-email`;
  const nameId = `${id}-name`;
  const messageId = `${id}-message`;

  return (
    <main className="support">
      <SiteBrand className="support__brand" />

      <div className="support__card">
        <h1 className="t-screen-title support__title">Написать в поддержку</h1>

        <form className="support__form" noValidate onSubmit={onSubmit}>
          <div className="support__field">
            <TextField
              id={emailId}
              label="Электронная почта"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={values.email}
              onChange={update('email')}
              className={errors.email ? 'support__input--invalid' : undefined}
              aria-invalid={errors.email ? 'true' : undefined}
              aria-describedby={errors.email ? `${emailId}-error` : undefined}
            />
            {errors.email && (
              <span id={`${emailId}-error`} className="support__error">
                {errors.email}
              </span>
            )}
          </div>

          <div className="support__field">
            <TextField
              id={nameId}
              label="Имя"
              name="name"
              autoComplete="name"
              required
              value={values.name}
              onChange={update('name')}
              className={errors.name ? 'support__input--invalid' : undefined}
              aria-invalid={errors.name ? 'true' : undefined}
              aria-describedby={errors.name ? `${nameId}-error` : undefined}
            />
            {errors.name && (
              <span id={`${nameId}-error`} className="support__error">
                {errors.name}
              </span>
            )}
          </div>

          <div className="support__field">
            <label htmlFor={messageId} className="support__label">
              Проблема
            </label>
            <textarea
              id={messageId}
              name="message"
              required
              rows={6}
              className={`support__textarea${errors.message ? ' support__input--invalid' : ''}`}
              value={values.message}
              onChange={update('message')}
              aria-invalid={errors.message ? 'true' : undefined}
              aria-describedby={errors.message ? `${messageId}-error` : undefined}
            />
            {errors.message && (
              <span id={`${messageId}-error`} className="support__error">
                {errors.message}
              </span>
            )}
          </div>

          {status === 'sent' && (
            <p role="status" className="support__notice support__notice--ok">
              Обращение отправлено. Мы ответим на указанную почту.
            </p>
          )}
          {status === 'error' && (
            <p role="alert" className="support__notice support__notice--error">
              Не получилось отправить. Попробуйте ещё раз.
            </p>
          )}

          <Button type="submit" variant="primary" className="support__submit" disabled={status === 'sending'}>
            Отправить
          </Button>
        </form>
      </div>
    </main>
  );
}
