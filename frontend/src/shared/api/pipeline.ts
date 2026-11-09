import type { PipelineRequest, PipelineResponse } from '@passport/contracts';
import { env } from '../config/env';

// Единственная точка вызова пайплайна n8n. Бэкенд stateless: контекст вопроса передаём в каждом запросе.
export async function callPassportPipeline(body: PipelineRequest): Promise<PipelineResponse> {
  const res = await fetch(env.pipelineUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Pipeline HTTP ${res.status}`);
  return (await res.json()) as PipelineResponse;
}
