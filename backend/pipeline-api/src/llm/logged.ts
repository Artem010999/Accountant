// Журнал обращений к нейросети (задача 4.4): каждый вызов → строка в llm_call_log.
// Ошибка записи в журнал не должна ломать пайплайн: её глотаем.
import type { LlmClient, LlmTask } from './types';

export interface LlmLogEntry {
  user_id: string | null;
  task: string;
  model: string;
  status: 'ok' | 'error';
  duration_ms: number;
  error_message?: string;
  response_preview?: string;
}

export type LlmLogSink = (entry: LlmLogEntry) => Promise<void>;

const PREVIEW_CHARS = 500;
const ERROR_CHARS = 500;

export class LoggedLlm implements LlmClient {
  constructor(
    private readonly inner: LlmClient,
    private readonly sink: LlmLogSink,
    private readonly userId: string | null,
  ) {
    // Пробрасываем hasOverride только если он есть у внутреннего клиента (тестовый FakeLlm):
    // аудит по нему решает, обновлять ли блокировки в БД. У боевого клиента метода нет.
    const probe = inner as LlmClient & { hasOverride?: (task: LlmTask) => boolean };
    if (typeof probe.hasOverride === 'function') {
      (this as { hasOverride?: (task: LlmTask) => boolean }).hasOverride = (task) => probe.hasOverride!(task);
    }
  }

  get model(): string {
    return this.inner.model;
  }

  async complete(task: LlmTask, input: unknown): Promise<unknown> {
    const started = Date.now();
    try {
      const out = await this.inner.complete(task, input);
      await this.write({ task, status: 'ok', duration_ms: Date.now() - started, response_preview: preview(out) });
      return out;
    } catch (err) {
      await this.write({ task, status: 'error', duration_ms: Date.now() - started, error_message: errorText(err) });
      throw err;
    }
  }

  async embed(text: string): Promise<number[]> {
    const started = Date.now();
    try {
      const vector = await this.inner.embed(text);
      await this.write({ task: 'embed', status: 'ok', duration_ms: Date.now() - started, response_preview: `вектор: ${vector.length}` });
      return vector;
    } catch (err) {
      await this.write({ task: 'embed', status: 'error', duration_ms: Date.now() - started, error_message: errorText(err) });
      throw err;
    }
  }

  private async write(entry: Omit<LlmLogEntry, 'user_id' | 'model'>): Promise<void> {
    try {
      await this.sink({ ...entry, user_id: this.userId, model: this.inner.model });
    } catch {
      // журнал — вспомогательный механизм: сбой записи не должен ломать пайплайн
    }
  }
}

function preview(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value) ?? '';
  return text.slice(0, PREVIEW_CHARS);
}

function errorText(err: unknown): string {
  return String((err as Error)?.message ?? err).slice(0, ERROR_CHARS);
}
