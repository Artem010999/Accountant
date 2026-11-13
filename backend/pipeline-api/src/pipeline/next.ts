// Общий переход после изменения паспорта: пробелы (ШАГ 6) → новизна (ШАГ 7) → выход (ШАГ 8).
import type { PipelineResponse } from '@passport/contracts';
import { fieldKb } from '../kb/manifest';
import type { RecordRow, UserContext } from '../db/store';
import type { PipelineDeps } from './deps';
import { findGaps } from './passport';
import { noveltyAndFinalize } from './finalize';

export async function nextStep(deps: PipelineDeps, ctx: UserContext, projectId: string, program: string): Promise<PipelineResponse> {
  const records: RecordRow[] = await deps.store.getRecords(projectId);
  const gap = findGaps(records)[0];
  if (gap) {
    const kb = fieldKb(deps.kb, gap.section_id, gap.field_key);
    return {
      status: 'NEED_USER_INPUT',
      step: 'GAP_FILLING',
      target_field: gap,
      question: kb.question,
      example: kb.example,
    };
  }
  return noveltyAndFinalize(deps, ctx, projectId, records, program);
}
