// Якорь проекта (ШАГ S1_NEW): выжимка брифа через LLM + эмбеддинг для guard. Общий для брифа и приёма формы.
import { callLlm, anchorSchema } from '../llm/schemas';
import { wrapUntrustedData } from '../promptGuard';
import type { PipelineDeps } from './deps';

export const GUARD_QUERY_MAX_CHARS = 5_000;

export async function createAnchor(deps: PipelineDeps, projectId: string, brief: string): Promise<void> {
  const { store, llm } = deps;
  const wrappedBrief = wrapUntrustedData('brief', brief.slice(0, 20_000));
  const { anchor_summary } = await callLlm(llm, 'anchor', { brief: wrappedBrief }, anchorSchema);
  const embedding = await llm.embed(brief.slice(0, GUARD_QUERY_MAX_CHARS));
  await store.setAnchor(projectId, { briefText: brief, summary: anchor_summary, embedding, model: llm.model });
}
