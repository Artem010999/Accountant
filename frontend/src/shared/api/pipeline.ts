import type { PipelineRequest, PipelineResponse, PipelineExportReady } from '@passport/contracts';
import { env } from '../config/env';

/** Программа по умолчанию: единственная поддерживаемая сейчас (ТЗ, «Студенческий стартап»). */
export const DEFAULT_PROGRAM = 'Студенческий стартап';

/** Единственная точка вызова пайплайна. Бэкенд stateless: контекст вопроса передаём в каждом запросе. */
export async function callPassportPipeline(body: Omit<PipelineRequest, 'user_id' | 'program'> & { user_id?: string; program?: string }): Promise<PipelineResponse> {
  const res = await fetch(env.pipelineUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: env.defaultUserId, program: DEFAULT_PROGRAM, ...body }),
  });
  // Ошибки пайплайна приходят с 422 и телом { status: 'ERROR', code, message }: отдаём как есть.
  if (!res.ok && res.status !== 422) throw new Error(`Pipeline HTTP ${res.status}`);
  return (await res.json()) as PipelineResponse;
}

export type { PipelineExportReady };
