// Общий переход после изменения паспорта: аудит (ШАГ 6 / 6.1) → пробелы → новизна (ШАГ 7) → выход (ШАГ 8).
import type { PipelineResponse } from '@passport/contracts';
import { fieldKb } from '../kb/manifest';
import type { RecordRow, UserContext } from '../db/store';
import type { PipelineDeps } from './deps';
import { findGaps, buildPassportFields } from './passport';
import { noveltyAndFinalize } from './finalize';
import { auditPassport } from './audit';

export async function nextStep(
  deps: PipelineDeps,
  ctx: UserContext,
  projectId: string,
  program: string,
): Promise<PipelineResponse> {
  const auditReport = await auditPassport(deps, projectId);
  const records: RecordRow[] = await deps.store.getRecords(projectId);
  const gap = findGaps(records)[0];
  if (gap) {
    const kb = fieldKb(deps.kb, gap.section_id, gap.field_key);
    const blockAudit = auditReport.block_audits.find((b) => b.section_id === gap.section_id);
    const rejectionReason = blockAudit?.remark ?? null;
    return {
      status: 'NEED_USER_INPUT',
      step: 'GAP_FILLING',
      target_field: gap,
      question: kb.question,
      example: kb.example,
      rejection_reason: rejectionReason,
      block_audits: auditReport.block_audits,
      budget_audit: auditReport.budget_audit,
      fatal_stop_factors: auditReport.fatal_stop_factors,
      passport: buildPassportFields(records),
    };
  }
  return noveltyAndFinalize(deps, ctx, projectId, records, program, auditReport);
}
