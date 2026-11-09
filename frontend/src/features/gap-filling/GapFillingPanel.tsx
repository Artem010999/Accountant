// Цикл дозаполнения (U_LOOP / U_INIT). Показывает вопрос и эталонный пример из n8n.
// Контекст вопроса (target_field, previous_question) хранится в состоянии компонента и уходит в каждом запросе.
import type { PipelineQuestion } from '@passport/contracts';

interface Props {
  question: PipelineQuestion;
  onSubmit: (answer: string) => void;
}

export function GapFillingPanel({ question, onSubmit }: Props) {
  return (
    <section>
      <p>{question.question}</p>
      {question.example && <blockquote>{question.example}</blockquote>}
      {question.rejection_reason && <p role="alert">{question.rejection_reason}</p>}
      <textarea aria-label="Ответ" />
      <button type="button" onClick={() => onSubmit('')}>Отправить</button>
    </section>
  );
}
