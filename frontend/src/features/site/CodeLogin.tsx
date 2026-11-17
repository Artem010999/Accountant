import { useState, type FormEvent } from 'react';
import { requestCode, verifyCode, type AuthPurpose, type CurrentUser } from '../../shared/api/auth';
import { Button } from '../../shared/ui';

// Вход и регистрация одним шагом: почта → 6-значный код из письма. Аккаунт создаётся при первом подтверждении.
// Для админки используется тот же компонент с purpose = 'admin': сервер пускает только role = 'admin'.

export interface CodeLoginProps {
  purpose: AuthPurpose;
  onSuccess: (user: CurrentUser) => void;
  /** Показать согласие с условиями (регистрация). Без согласия код не запрашивается. */
  consent?: boolean;
  submitLabel?: string;
}

export function CodeLogin({ purpose, onSuccess, consent = false, submitLabel = 'Войти' }: CodeLoginProps) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [agreed, setAgreed] = useState(!consent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agreed) return;
    setBusy(true);
    setError(null);
    const result = await requestCode(email.trim(), purpose);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setStep('code');
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('Введите 6 цифр из письма');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await verifyCode(email.trim(), code, purpose);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSuccess(result.value);
  }

  if (step === 'email') {
    return (
      <form className="auth__stack" onSubmit={sendCode} noValidate>
        <div className="auth__field">
          <label htmlFor={`${purpose}-email`} className="auth__label">
            Электронная почта
          </label>
          <input
            id={`${purpose}-email`}
            className="auth__input"
            type="email"
            autoComplete="email"
            placeholder="name@university.ru"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        {consent && (
          <label className="auth__consent">
            <input type="checkbox" className="auth__checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              Согласен с <a href="#">условиями сервиса</a> и <a href="#">обработкой персональных данных</a>, в том числе с передачей текстов проекта языковой модели для разбора
            </span>
          </label>
        )}
        {error && <p role="alert" className="auth__hint">{error}</p>}
        <Button type="submit" variant="primary" disabled={busy || !agreed}>
          Получить код
        </Button>
      </form>
    );
  }

  return (
    <form className="auth__stack" onSubmit={confirm} noValidate>
      <div className="auth__field">
        <label htmlFor={`${purpose}-code`} className="auth__label">
          Код из письма
        </label>
        <input
          id={`${purpose}-code`}
          className="auth__input"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="6 цифр"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          required
        />
      </div>
      <p className="auth__hint">Код отправлен на {email.trim()}. Он действует 10 минут.</p>
      {error && <p role="alert" className="auth__hint">{error}</p>}
      <Button type="submit" variant="primary" disabled={busy}>
        {submitLabel}
      </Button>
      <button type="button" className="auth__proto-link" onClick={() => { setStep('email'); setCode(''); setError(null); }}>
        Другой адрес или новый код
      </button>
    </form>
  );
}
