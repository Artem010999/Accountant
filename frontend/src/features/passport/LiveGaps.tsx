import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { BudgetItemInput, PipelineQuestion, PipelineResponse, TargetField } from '@passport/contracts';
import { callPassportPipeline } from '../../shared/api/pipeline';
import { saveFlow } from '../../shared/state/flow';
import { Button } from '../../shared/ui';
import { BudgetTable } from '../budget/BudgetTable';
import { AuditRemark } from './AuditRemark';
import { DirectionChallenge, type DirectionChallengeValue } from './DirectionChallenge';
import { ConsultantWidget } from '../consultant/ConsultantWidget';
import '../onboarding/common.css';
import './LiveGaps.css';

// Живой экран пробелов: показывает ответ пайплайна (NEED_USER_INPUT / STOP_NOV / ANSWER_REJECTED),
// отправляет ответ обратно и идёт по шагам до COMPLETED. Направление и вызов — выбором, смета — таблицей.

export interface LiveGapsProps {
  /** Последний ответ пайплайна (из брифа или предыдущего шага). */
  initial?: PipelineResponse;
  /** Вызывается, когда паспорт дошёл до COMPLETED. */
  onDone: () => void;
}

function isQuestion(res: PipelineResponse): res is PipelineQuestion {
  return res.status === 'NEED_USER_INPUT' || res.status === 'STOP_NOV' || res.status === 'ANSWER_REJECTED';
}

function isDirectionField(tf: TargetField): boolean {
  return tf.section_id === 4 && (tf.field_key === 'direction' || tf.field_key === 'tech_challenge');
}

function LiveGapsScreen({ initial, onDone }: LiveGapsProps) {
  const [res, setRes] = useState<PipelineResponse | undefined>(initial);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Пробелы, которые студент пропустил «вернуться позже»: пайплайн не предлагает их, пока студент не вернётся.
  const [skipped, setSkipped] = useState<TargetField[]>([]);
  const [showHelp, setShowHelp] = useState(false);

  async function send(body: Parameters<typeof callPassportPipeline>[0]) {
    setBusy(true);
    setError(null);
    try {
      // Список пропущенных уходит только когда он не пустой: пустой запрос остаётся таким же, как раньше.
      const next = await callPassportPipeline(skipped.length > 0 ? { skipped_fields: skipped, ...body } : body);
      if (next.status === 'ERROR') {
        setError(next.message);
        return;
      }
      saveFlow({ last: next });
      if (next.status === 'COMPLETED') {
        onDone();
        return;
      }
      setRes(next);
      setAnswer('');
    } catch {
      setError('Не удалось отправить ответ. Попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  }

  function skipGap(tf: TargetField) {
    const next = [...skipped, tf];
    setSkipped(next);
    setShowHelp(false);
    void send({ action: 'skip_gap', target_field: tf, skipped_fields: next });
  }

  if (!res || res.status === 'WAITING_FOR_INITIAL_BRIEF') {
    return (
      <main className="ob-page lg">
        <h1 className="ob-title">Закроем пробелы</h1>
        <p className="ob-lead">Сначала опишите проект.</p>
        <Link to="/brief">К брифу</Link>
      </main>
    );
  }

  if (res.status === 'ERROR') {
    return (
      <main className="ob-page lg">
        <p role="alert" className="lg__error">{res.message}</p>
      </main>
    );
  }

  // Все оставшиеся пробелы пропущены: пайплайн ждёт возврата, вопроса нет.
  if (isQuestion(res) && res.step === 'GAP_FILLING' && !res.target_field) {
    return (
      <main className="ob-page lg">
        <h1 className="ob-title">Закроем пробелы позже</h1>
        {res.question && <p className="ob-lead lg__question">{res.question}</p>}
        <Link to="/passport">Перейти к паспорту</Link>
      </main>
    );
  }

  if (isQuestion(res) && res.step === 'BUDGET_REVIEW') {
    return (
      <main className="ob-page lg">
        <h1 className="ob-title">Смета</h1>
        <BudgetTable
          busy={busy}
          violations={res.rejection_reason ? [res.rejection_reason] : []}
          onSubmit={(items: BudgetItemInput[]) => send({ action: 'submit_form', budget_items: items })}
        />
        {error && <p role="alert" className="lg__error">{error}</p>}
      </main>
    );
  }

  if (isQuestion(res) && res.target_field) {
    const tf = res.target_field;

    if (isDirectionField(tf)) {
      return (
        <main className="ob-page lg">
          <h1 className="ob-title">Направление проекта</h1>
          {res.rejection_reason && <AuditRemark remark={res.rejection_reason} />}
          <DirectionChallenge
            busy={busy}
            onSubmit={(v: DirectionChallengeValue) =>
              send({
                action: 'submit_form',
                form: [
                  { section_id: 4, field_key: 'direction', value: v.direction },
                  ...(v.challenge ? [{ section_id: 4, field_key: 'tech_challenge', value: v.challenge }] : []),
                ],
              })
            }
          />
          {error && <p role="alert" className="lg__error">{error}</p>}
        </main>
      );
    }

    return (
      <main className="ob-page lg">
        <h1 className="ob-title">Закроем пробелы</h1>
        {res.question && <p className="ob-lead lg__question">{res.question}</p>}
        {res.criteria && <p className="lg__example">{`Что проверяет фонд: ${res.criteria}`}</p>}
        {res.example && <p className="lg__example">{`Как обычно пишут: ${res.example}`}</p>}
        {res.rejection_reason && <AuditRemark remark={res.rejection_reason} />}
        <form
          className="lg__form"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            if (!answer.trim()) {
              setError('Ответ пустой. Опишите подробнее.');
              return;
            }
            void send({ action: 'submit_answer', target_field: tf, previous_question: res.question ?? '', text_input: answer.trim() });
          }}
          noValidate
        >
          <label htmlFor="lg-answer" className="ob-label ob-label--strong">
            Ваш ответ
          </label>
          <textarea id="lg-answer" className="ob-textarea" rows={4} value={answer} onChange={(e) => setAnswer(e.target.value)} />
          {error && <p role="alert" className="lg__error">{error}</p>}
          <Button type="submit" variant="primary" disabled={busy}>
            Отправить ответ
          </Button>
        </form>
        <Button variant="outline" disabled={busy} onClick={() => setShowHelp(true)}>
          Не знаю — помогите
        </Button>
        {showHelp && <p className="lg__example">{`Спросите ИИ-Консультанта: «${res.question ?? ''}»`}</p>}
        <Button variant="outline" disabled={busy} onClick={() => skipGap(tf)}>
          Пропустить и вернуться позже
        </Button>
      </main>
    );
  }

  return (
    <main className="ob-page lg">
      <p className="ob-lead">Паспорт обрабатывается. Обновите страницу через минуту.</p>
    </main>
  );
}

/** Живой экран пробелов с ИИ-Консультантом: виджет доступен и на смете, и на направлении (они внутри этого экрана). */
export function LiveGaps(props: LiveGapsProps) {
  return (
    <>
      <LiveGapsScreen {...props} />
      <ConsultantWidget />
    </>
  );
}
