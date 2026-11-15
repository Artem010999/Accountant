import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PipelineResponse } from '@passport/contracts';
import { callPassportPipeline } from '../../shared/api/pipeline';
import { LiveGaps } from './LiveGaps';

vi.mock('../../shared/api/pipeline', () => ({ callPassportPipeline: vi.fn() }));
const mockPipeline = vi.mocked(callPassportPipeline);

const GAP: PipelineResponse = {
  status: 'NEED_USER_INPUT',
  step: 'GAP_FILLING',
  target_field: { section_id: 3, field_key: 'target_audience' },
  question: 'Кто целевые пользователи?',
  example: 'Студенты очных программ вузов Самары.',
  rejection_reason: null,
} satisfies PipelineResponse;

function renderGaps(initial: PipelineResponse | undefined, onDone = vi.fn()) {
  render(
    <MemoryRouter>
      <LiveGaps initial={initial} onDone={onDone} />
    </MemoryRouter>,
  );
  return onDone;
}

describe('LiveGaps (живые пробелы)', () => {
  beforeEach(() => {
    mockPipeline.mockReset();
  });

  it('без ответа пайплайна просит начать с брифа', () => {
    renderGaps(undefined);
    expect(screen.getByText('Сначала опишите проект.')).toBeInTheDocument();
  });

  it('показывает вопрос пайплайна и пример', () => {
    renderGaps(GAP);
    expect(screen.getByText('Кто целевые пользователи?')).toBeInTheDocument();
    expect(screen.getByText(/Студенты очных программ вузов Самары/)).toBeInTheDocument();
  });

  it('ответ уходит как submit_answer с целевым полем и вопросом', async () => {
    mockPipeline.mockResolvedValue({ ...GAP, question: 'Следующий вопрос' } as PipelineResponse);
    renderGaps(GAP);
    await userEvent.type(screen.getByLabelText('Ваш ответ'), 'Студенты очных программ вузов Самары.');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить ответ' }));
    expect(mockPipeline).toHaveBeenCalledWith({
      action: 'submit_answer',
      target_field: { section_id: 3, field_key: 'target_audience' },
      previous_question: 'Кто целевые пользователи?',
      text_input: 'Студенты очных программ вузов Самары.',
    });
    expect(await screen.findByText('Следующий вопрос')).toBeInTheDocument();
  });

  it('пустой ответ не отправляется', async () => {
    renderGaps(GAP);
    await userEvent.click(screen.getByRole('button', { name: 'Отправить ответ' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Ответ пустой');
    expect(mockPipeline).not.toHaveBeenCalled();
  });

  it('замечание аудита (rejection_reason) показывается под вопросом', () => {
    renderGaps({ ...GAP, rejection_reason: 'Проблема описана без измеримых последствий.' });
    expect(screen.getByText('Проблема описана без измеримых последствий.')).toBeInTheDocument();
  });

  it('направление и вызов выбираются выбором, а не текстом', () => {
    renderGaps({ ...GAP, target_field: { section_id: 4, field_key: 'direction' }, question: 'Направление?' });
    // Направление выбирается кнопками (группа с именем «Направление проекта», может быть и fieldset, и SegmentedControl).
    expect(screen.getAllByRole('group', { name: 'Направление проекта' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Сохранить направление' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Ваш ответ')).not.toBeInTheDocument();
  });

  it('шаг сметы показывает таблицу сметы', () => {
    renderGaps({
      status: 'NEED_USER_INPUT',
      step: 'BUDGET_REVIEW',
      question: 'Смета не одобрена',
      rejection_reason: 'Смета: не заполнена.',
    } satisfies PipelineResponse);
    expect(screen.getByRole('button', { name: 'Сохранить смету' })).toBeInTheDocument();
    expect(screen.getByText(/Смета: не заполнена/)).toBeInTheDocument();
  });

  it('когда паспорт COMPLETED — вызывается onDone', async () => {
    mockPipeline.mockResolvedValue({
      status: 'COMPLETED',
      export_ready: true,
      not_approved: [],
      eligibility_status: 'ELIGIBLE',
      summary: 'Готово',
      checklist: [],
      warnings: [],
      passport: [],
    } satisfies PipelineResponse);
    const onDone = renderGaps(GAP);
    await userEvent.type(screen.getByLabelText('Ваш ответ'), 'Текст ответа.');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить ответ' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
