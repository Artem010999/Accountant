import { useEffect, useState, type FormEvent } from 'react';
import { fetchChallenges, type TechChallengeOption } from '../../shared/api/challenges';
import { Button, SegmentedControl } from '../../shared/ui';
import '../onboarding/common.css';
import './DirectionChallenge.css';

// Выбор направления (Н1–Н7) и технологического вызова (1–357), блок 4. Вызов необязателен (решение владельца).
// Новый элемент: макета в дизайне нет, оформлен классами онбординга и токенами.

export const DIRECTIONS = [
  { id: 'Н1', label: 'Н1' },
  { id: 'Н2', label: 'Н2' },
  { id: 'Н3', label: 'Н3' },
  { id: 'Н4', label: 'Н4' },
  { id: 'Н5', label: 'Н5' },
  { id: 'Н6', label: 'Н6' },
  { id: 'Н7', label: 'Н7' },
];

export interface DirectionChallengeValue {
  direction: string;
  challenge?: string;
}

export interface DirectionChallengeProps {
  onSubmit: (value: DirectionChallengeValue) => void;
  busy?: boolean;
  /** Для тестов: справочник вызовов без сети. */
  loadChallenges?: () => Promise<TechChallengeOption[]>;
}

export function DirectionChallenge({ onSubmit, busy = false, loadChallenges = fetchChallenges }: DirectionChallengeProps) {
  const [direction, setDirection] = useState('');
  const [challenge, setChallenge] = useState('');
  const [all, setAll] = useState<TechChallengeOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadChallenges()
      .then((list) => {
        if (!cancelled) setAll(list);
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось загрузить список вызовов. Направление можно выбрать и без вызова.');
      });
    return () => {
      cancelled = true;
    };
  }, [loadChallenges]);

  const options = direction ? all.filter((c) => c.direction === direction) : [];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!direction) {
      setError('Выберите направление.');
      return;
    }
    setError(null);
    onSubmit({ direction, challenge: challenge || undefined });
  }

  return (
    <form className="dc-form" onSubmit={submit} noValidate>
      <fieldset className="dc-field">
        <legend className="ob-label ob-label--strong">Направление проекта</legend>
        <SegmentedControl
          options={DIRECTIONS}
          value={direction}
          onChange={(id) => {
            setDirection(id);
            setChallenge('');
          }}
          ariaLabel="Направление проекта"
        />
      </fieldset>
      <div className="dc-field">
        <label htmlFor="dc-challenge" className="ob-label ob-label--strong">
          Технологический вызов (необязательно)
        </label>
        <select id="dc-challenge" className="ob-select" value={challenge} onChange={(e) => setChallenge(e.target.value)} disabled={!direction}>
          <option value="">Без вызова</option>
          {options.map((c) => (
            <option key={c.number} value={String(c.number)}>
              {`№ ${c.number}. ${c.topic}`}
            </option>
          ))}
        </select>
        {direction && options.length === 0 && <p className="dc-hint">В перечне нет вызовов для направления {direction}.</p>}
      </div>
      {error && (
        <p role="alert" className="dc-error">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={busy}>
        Сохранить направление
      </Button>
    </form>
  );
}
