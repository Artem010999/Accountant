import { useState, type FormEvent } from 'react';
import type { ConsultantResponse } from '@passport/contracts';
import { askConsultant } from '../../shared/api/consultant';
import './Consultant.css';

/**
 * ИИ-консультант (задача 4.1). Простой экран: макета в дизайне нет, поэтому оформлен только токенами.
 * Консультант советует и не меняет поля паспорта. Вопрос уходит на бэкенд, ответ показываем с предупреждениями.
 */
export interface ConsultantProps {
  ask?: (message: string) => Promise<ConsultantResponse>;
}

interface Turn {
  role: 'user' | 'assistant';
  text: string;
  warnings?: string[];
  sources?: string[];
}

const ERROR_TEXT = 'Не удалось получить ответ. Попробуйте ещё раз.';

export function Consultant({ ask = askConsultant }: ConsultantProps = {}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = !sending && input.trim().length > 0;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSend) return;
    const message = input.trim();
    setInput('');
    setError(null);
    setSending(true);
    setTurns((prev) => [...prev, { role: 'user', text: message }]);
    try {
      const res = await ask(message);
      if (res.status === 'BLOCKED') {
        setTurns((prev) => [...prev, { role: 'assistant', text: res.message }]);
      } else {
        setTurns((prev) => [
          ...prev,
          { role: 'assistant', text: res.answer, warnings: res.warnings, sources: res.sources.map((s) => s.title) },
        ]);
      }
    } catch {
      setError(ERROR_TEXT);
      setInput((current) => (current === '' ? message : current)); // вопрос не теряется: вернём его в поле
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="consultant">
      <header className="consultant__head">
        <h1 className="consultant__h1">ИИ-консультант</h1>
        <p className="consultant__lead">Подскажет по правилам конкурса и заявке. Поля паспорта не меняет.</p>
      </header>

      <div className="consultant__log" role="log" aria-live="polite" aria-label="Диалог">
        {turns.map((t, i) => (
          <div key={i} className={`consultant__msg consultant__msg--${t.role}`}>
            <p className="consultant__text">{t.text}</p>
            {t.warnings && t.warnings.length > 0 && (
              <ul className="consultant__warnings" aria-label="Предупреждения">
                {t.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            {t.sources && t.sources.length > 0 && <p className="consultant__sources">Источники: {t.sources.join('; ')}</p>}
          </div>
        ))}
        {sending && <p className="consultant__typing">Консультант отвечает…</p>}
      </div>

      {error && (
        <p role="alert" className="consultant__error">
          {error}
        </p>
      )}

      <form className="consultant__form" onSubmit={submit}>
        <label htmlFor="consultant-input" className="consultant__label">
          Вопрос
        </label>
        <textarea
          id="consultant-input"
          className="consultant__input"
          rows={2}
          placeholder="Задайте вопрос о заявке"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" className="consultant__send" disabled={!canSend}>
          Отправить
        </button>
      </form>
    </main>
  );
}
