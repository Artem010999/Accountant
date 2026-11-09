import type { PipelineErrorCode } from '@passport/contracts';

/** Ожидаемая ошибка пайплайна: попадает в ответ клиенту с кодом. Остальное — INTERNAL. */
export class PipelineFailure extends Error {
  constructor(
    public readonly code: PipelineErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PipelineFailure';
  }
}
