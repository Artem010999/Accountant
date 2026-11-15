// Якорь проекта (ШАГ S1_NEW): выжимка через LLM + эмбеддинг для guard.
// Создаётся, когда в паспорте заполнены ключевые смысловые блоки (3 «Проблема и ЦА» и 4 «Продукт и технология»),
// а не на первом вводе: иначе короткий стартовый текст станет эталоном и даст ложные блокировки позже.
import { PASSPORT_SECTIONS } from '@passport/contracts';
import { callLlm, anchorSchema } from '../llm/schemas';
import { wrapUntrustedData } from '../promptGuard';
import type { RecordRow } from '../db/store';
import type { PipelineDeps } from './deps';
import { OPTIONAL_FIELDS } from './fieldValidation';

export const GUARD_QUERY_MAX_CHARS = 5_000;
const ANCHOR_SECTION_IDS = [3, 4];
/** Поля-коды (направление, номер вызова) короче текста — в тексте якоря не нужны. */
const ANCHOR_SKIP_FIELDS = new Set(['4/direction', '4/tech_challenge']);
const MIN_ANCHOR_FIELD_LENGTH = 10;

/**
 * Текст для якоря из блоков 3 и 4. null, пока хотя бы одно обязательное поле этих блоков не заполнено.
 */
export function anchorBriefFromRecords(records: readonly RecordRow[]): string | null {
  const parts: string[] = [];
  for (const section of PASSPORT_SECTIONS.filter((s) => ANCHOR_SECTION_IDS.includes(s.id))) {
    for (const fieldKey of section.fields) {
      const key = `${section.id}/${fieldKey}`;
      if (OPTIONAL_FIELDS.has(key) || ANCHOR_SKIP_FIELDS.has(key)) continue;
      const value = records.find((r) => r.section_id === section.id && r.field_key === fieldKey)?.value?.trim() ?? '';
      if (value.length <= MIN_ANCHOR_FIELD_LENGTH) return null;
      parts.push(value);
    }
  }
  return parts.join('\n\n');
}

export async function createAnchor(deps: PipelineDeps, projectId: string, brief: string): Promise<void> {
  const { store, llm } = deps;
  const wrappedBrief = wrapUntrustedData('brief', brief.slice(0, 20_000));
  const { anchor_summary } = await callLlm(llm, 'anchor', { brief: wrappedBrief }, anchorSchema);
  const embedding = await llm.embed(brief.slice(0, GUARD_QUERY_MAX_CHARS));
  await store.setAnchor(projectId, { briefText: brief, summary: anchor_summary, embedding, model: llm.model });
}
