import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PipelineResponse } from '@passport/contracts';
import { callPassportPipeline } from '../../shared/api/pipeline';
import { Eligibility } from './Eligibility';

vi.mock('../../shared/api/pipeline', () => ({ callPassportPipeline: vi.fn() }));
const mockPipeline = vi.mocked(callPassportPipeline);

const QUESTIONS = [
  { key: 'is_student_or_postgraduate', question: 'Вы студент или аспирант?' },
  { key: 'has_open_fsi_contracts_or_applications', question: 'Есть открытые заявки в ФСИ?' },
  { key: 'has_prior_student_startup_grant', question: 'Получали грант ранее?' },
  { key: 'ready_to_open_llc_after_win', question: 'Готовы открыть ООО?' },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/eligibility']}>
      <Routes>
        <Route path="/eligibility" element={<Eligibility />} />
        <Route path="/brief" element={<p>Экран брифа</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Eligibility (проверка допуска)', () => {
  beforeEach(() => {
    mockPipeline.mockReset();
  });

  it('показывает вопросы, которые пришли с бэкенда', async () => {
    mockPipeline.mockResolvedValue({ status: 'ELIGIBILITY_REQUIRED', questions: QUESTIONS } satisfies PipelineResponse);
    renderPage();
    expect(await screen.findByText('Вы студент или аспирант?')).toBeInTheDocument();
    // У каждого вопроса есть пара кнопок «Да» / «Нет».
    expect(screen.getAllByRole('button', { name: 'Да' })).toHaveLength(QUESTIONS.length);
    expect(screen.getAllByRole('button', { name: 'Нет' })).toHaveLength(QUESTIONS.length);
  });

  it('без ответа на все вопросы не отправляет', async () => {
    mockPipeline.mockResolvedValue({ status: 'ELIGIBILITY_REQUIRED', questions: QUESTIONS } satisfies PipelineResponse);
    renderPage();
    await screen.findByText('Вы студент или аспирант?');
    await userEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Ответьте на все вопросы.');
    expect(mockPipeline).toHaveBeenCalledTimes(1);
  });

  it('все ответы отправляются на бэкенд и при допуске идём к брифу', async () => {
    mockPipeline
      .mockResolvedValueOnce({ status: 'ELIGIBILITY_REQUIRED', questions: QUESTIONS } satisfies PipelineResponse)
      .mockResolvedValueOnce({ status: 'WAITING_FOR_INITIAL_BRIEF', step: 'INITIAL_BRIEF', question: 'Опишите проект' } satisfies PipelineResponse);
    renderPage();
    await screen.findByText('Вы студент или аспирант?');
    const yes = screen.getAllByRole('button', { name: 'Да' });
    const no = screen.getAllByRole('button', { name: 'Нет' });
    await userEvent.click(yes[0]!); // студент: да
    await userEvent.click(no[1]!); // открытых заявок нет
    await userEvent.click(no[2]!); // гранта не было
    await userEvent.click(yes[3]!); // ООО готовы открыть
    await userEvent.click(screen.getByRole('button', { name: 'Продолжить' }));

    expect(await screen.findByText('Экран брифа')).toBeInTheDocument();
    expect(mockPipeline).toHaveBeenLastCalledWith({
      action: 'init_or_upload',
      eligibility: {
        is_student_or_postgraduate: true,
        has_open_fsi_contracts_or_applications: false,
        has_prior_student_startup_grant: false,
        ready_to_open_llc_after_win: true,
      },
    });
  });

  it('нарушенный пункт показывает причину и способ исправления', async () => {
    mockPipeline
      .mockResolvedValueOnce({ status: 'ELIGIBILITY_REQUIRED', questions: QUESTIONS } satisfies PipelineResponse)
      .mockResolvedValueOnce({
        status: 'REJECTED',
        reasons: [{ key: 'has_prior_student_startup_grant', reason: 'Вы получали грант ранее.', how_to_fix: 'Повторно получить грант нельзя.' }],
      } satisfies PipelineResponse);
    renderPage();
    await screen.findByText('Вы студент или аспирант?');
    const yes = screen.getAllByRole('button', { name: 'Да' });
    const no = screen.getAllByRole('button', { name: 'Нет' });
    await userEvent.click(yes[0]!);
    await userEvent.click(no[1]!);
    await userEvent.click(yes[2]!); // грант получен → нарушение
    await userEvent.click(yes[3]!);
    await userEvent.click(screen.getByRole('button', { name: 'Продолжить' }));

    expect(await screen.findByText('Проект не проходит проверку допуска')).toBeInTheDocument();
    // Причина и способ исправления выводятся в одном блоке замечания.
    expect(screen.getByText(/Вы получали грант ранее\./)).toBeInTheDocument();
    expect(screen.getByText(/Повторно получить грант нельзя/)).toBeInTheDocument();
  });

  it('ошибка сети при загрузке вопросов показывает сообщение', async () => {
    mockPipeline.mockRejectedValue(new Error('network'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить вопросы');
  });
});
