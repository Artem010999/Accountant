import type { PipelineResponse } from '@passport/contracts';
import type { FounderInput } from '../api/profile';

/**
 * Состояние прохождения между экранами живого режима: данные основателя и последний ответ пайплайна.
 * Хранится в sessionStorage текущей вкладки (удобство между экранами). Источник правды — бэкенд.
 */
export interface FlowState {
  founder?: FounderInput;
  last?: PipelineResponse;
}

const KEY = 'buha.flow';

export function loadFlow(): FlowState {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FlowState) : {};
  } catch {
    return {};
  }
}

export function saveFlow(patch: Partial<FlowState>): FlowState {
  const next = { ...loadFlow(), ...patch };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Приватный режим или заблокированное хранилище: состояние живёт только в памяти экрана.
  }
  return next;
}

/** Паспорт готов к выгрузке: пайплайн ответил COMPLETED с export_ready = true. */
export function exportReadyFromFlow(): boolean {
  const last = loadFlow().last;
  return last?.status === 'COMPLETED' && last.export_ready === true;
}

/** Что мешает выгрузке (строки из ответа COMPLETED.not_approved). Пусто, пока паспорт не дошёл до COMPLETED. */
export function notApprovedFromFlow(): string[] {
  const last = loadFlow().last;
  return last?.status === 'COMPLETED' ? last.not_approved : [];
}

/** Подсказка на кнопке выгрузки: называет блоки, которые мешают скачать (первые три и сколько осталось). */
export function exportHintFromItems(items: string[], fallback: string): string {
  if (items.length === 0) return fallback;
  const shown = items.slice(0, 3).join('; ');
  const rest = items.length > 3 ? ` и ещё ${items.length - 3}` : '';
  return `Скачать можно, когда одобрено: ${shown}${rest}`;
}
