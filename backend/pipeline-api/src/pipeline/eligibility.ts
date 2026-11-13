// Задача 1.1: анкета первичного допуска — стоит на входе, до брифа и файлов.
// Нарушенный пункт = финальный отказ (статус rejected) с причиной и способом исправления.
import { checkEligibility, type EligibilityFailure } from '@passport/passport-core';
import type { PipelineRequest, PipelineResponse } from '@passport/contracts';
import type { UserContext } from '../db/store';
import type { PipelineDeps } from './deps';

const toReason = (f: EligibilityFailure) => ({ key: f.key, reason: f.reason, how_to_fix: f.how_to_fix });

/** null — допуск пройден, пайплайн продолжает работу. Иначе — ответ, который нужно вернуть клиенту. */
export async function gateEligibility(
  deps: PipelineDeps,
  req: PipelineRequest,
  ctx: UserContext,
): Promise<PipelineResponse | null> {
  const { store } = deps;
  const questions = deps.kb.eligibility.questions;

  // Отказ окончательный: повторные запросы получают тот же ответ, даже с новыми ответами.
  if (ctx.project?.status === 'rejected') {
    const stored = checkEligibility(questions, ctx.project.eligibilityAnswers);
    return { status: 'REJECTED', reasons: stored.failures.map(toReason) };
  }

  const answers = req.eligibility ?? ctx.project?.eligibilityAnswers ?? null;
  const result = checkEligibility(questions, answers);

  if (result.failures.length > 0) {
    const projectId = ctx.project?.id ?? (await store.ensureProject(req.user_id));
    await store.saveEligibility(projectId, answers ?? {});
    await store.setProjectStatus(projectId, 'rejected');
    return { status: 'REJECTED', reasons: result.failures.map(toReason) };
  }

  if (result.missing.length > 0) {
    return {
      status: 'ELIGIBILITY_REQUIRED',
      questions: questions.map((q) => ({ key: q.key, question: q.question })),
    };
  }

  if (req.eligibility) {
    const projectId = ctx.project?.id ?? (await store.ensureProject(req.user_id));
    await store.saveEligibility(projectId, req.eligibility);
  }
  return null;
}
