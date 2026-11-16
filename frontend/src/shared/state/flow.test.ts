import type { PipelineResponse } from '@passport/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { exportHintFromItems, notApprovedFromFlow, saveFlow } from './flow';

const FALLBACK = 'Скачать можно, когда все 10 блоков одобрены';

describe('exportHintFromItems (подсказка на кнопке выгрузки)', () => {
  it('без неодобренных блоков отдаёт общую фразу', () => {
    expect(exportHintFromItems([], FALLBACK)).toBe(FALLBACK);
  });

  it('называет блоки, которые мешают скачать', () => {
    expect(exportHintFromItems(['Блок 2: Команда', 'Смета: Оплата труда'], FALLBACK)).toBe(
      'Скачать можно, когда одобрено: Блок 2: Команда; Смета: Оплата труда',
    );
  });

  it('показывает первые три и сколько осталось', () => {
    const items = ['А', 'Б', 'В', 'Г', 'Д'];
    expect(exportHintFromItems(items, FALLBACK)).toBe('Скачать можно, когда одобрено: А; Б; В и ещё 2');
  });
});

describe('notApprovedFromFlow (что мешает выгрузке)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('пусто, пока паспорт не дошёл до COMPLETED', () => {
    expect(notApprovedFromFlow()).toEqual([]);
    saveFlow({ last: { status: 'NEED_USER_INPUT', step: 'GAP_FILLING', question: 'Вопрос' } as unknown as PipelineResponse });
    expect(notApprovedFromFlow()).toEqual([]);
  });

  it('отдаёт список из ответа COMPLETED', () => {
    saveFlow({ last: { status: 'COMPLETED', export_ready: false, not_approved: ['Блок 2: Команда'] } as unknown as PipelineResponse });
    expect(notApprovedFromFlow()).toEqual(['Блок 2: Команда']);
  });
});
