import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PipelineResponse } from '@passport/contracts';
import { callPassportPipeline } from '../../shared/api/pipeline';
import { saveFlow } from '../../shared/state/flow';
import { SegmentedControl, Button } from '../../shared/ui';
import { AuditRemark } from '../passport/AuditRemark';
import '../onboarding/common.css';
import './Eligibility.css';

// Анкета первичного допуска (блок 1, задача 1.1). Вопросы приходят с бэкенда (ELIGIBILITY_REQUIRED),
// поэтому тексты не дублируются во фронтенде. Экран новый: макета в дизайне нет, оформлен на классах онбординга.

interface Question {
  key: string;
  question: string;
}

interface Reason {
  key: string;
  reason: string;
  how_to_fix: string;
}

const YES_NO = [
  { id: 'yes', label: 'Да' },
  { id: 'no', label: 'Нет' },
];

export function Eligibility() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Reason[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Первый запрос без ответов: бэкенд отдаёт список вопросов (или сразу пропускает дальше, если допуск уже пройден).
  useEffect(() => {
    let cancelled = false;
    callPassportPipeline({ action: 'init_or_upload' })
      .then((res) => {
        if (cancelled) return;
        if (res.status === 'ELIGIBILITY_REQUIRED') setQuestions(res.questions);
        else if (res.status === 'REJECTED') setReasons(res.reasons);
        else if (res.status === 'ERROR') setError(res.message);
        else navigate('/brief');
      })
      .catch(() => !cancelled && setError('Не удалось загрузить вопросы. Попробуйте ещё раз.'));
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!questions) return;
    if (questions.some((q) => answers[q.key] === undefined)) {
      setError('Ответьте на все вопросы.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const eligibility = Object.fromEntries(questions.map((q) => [q.key, answers[q.key] === 'yes']));
      const res: PipelineResponse = await callPassportPipeline({ action: 'init_or_upload', eligibility });
      if (res.status === 'REJECTED') {
        setReasons(res.reasons);
        return;
      }
      if (res.status === 'ERROR') {
        setError(res.message);
        return;
      }
      saveFlow({ last: res });
      navigate('/brief');
    } catch {
      setError('Не удалось отправить ответы. Попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  }

  if (reasons) {
    return (
      <main className="ob-page elig">
        <h1 className="ob-title">Проект не проходит проверку допуска</h1>
        <ul className="elig__reasons">
          {reasons.map((r) => (
            <li key={r.key}>
              <AuditRemark remark={r.reason} howToFix={r.how_to_fix} />
            </li>
          ))}
        </ul>
      </main>
    );
  }

  if (!questions) {
    return (
      <main className="ob-page elig">
        <h1 className="ob-title">Проверка допуска</h1>
        {error ? <p role="alert" className="elig__error">{error}</p> : <p className="ob-lead">Загружаем вопросы…</p>}
      </main>
    );
  }

  return (
    <main className="ob-page elig">
      <h1 className="ob-title">Проверка допуска</h1>
      <p className="ob-lead">Ответьте на четыре вопроса. Если хотя бы на один ответ нет, участие невозможно.</p>
      <form className="elig__form" onSubmit={submit} noValidate>
        {questions.map((q) => (
          <fieldset key={q.key} className="elig__item">
            <legend className="ob-label ob-label--strong">{q.question}</legend>
            <SegmentedControl
              options={YES_NO}
              value={answers[q.key] ?? ''}
              onChange={(id) => setAnswers((prev) => ({ ...prev, [q.key]: id }))}
              ariaLabel={q.question}
            />
          </fieldset>
        ))}
        {error && <p role="alert" className="elig__error">{error}</p>}
        <Button type="submit" variant="primary" disabled={busy}>
          Продолжить
        </Button>
      </form>
    </main>
  );
}
