// Задачи 1.4, 1.5, 3.2, 3.5: приём формы целиком или точечных правок открытых блоков (шаги 3В, 5 и 7).
// Текстовые поля упаковываются через DeepSeek Flash (extractPassport) с подключением RAG, смета сохраняется напрямую.
import type { PipelineRequest, PipelineResponse } from '@passport/contracts';
import { isValidPassportField } from '@passport/contracts';
import type { DependencyNode } from '@passport/passport-core';
import { PipelineFailure } from '../errors';
import type { UserContext } from '../db/store';
import type { PipelineDeps } from './deps';
import { createAnchor, GUARD_QUERY_MAX_CHARS } from './anchor';
import { checkFieldValue } from './fieldValidation';
import { invalidateDependents } from './invalidation';
import { extractPassport } from './passport';
import { nextStep } from './next';

/** Поля с кодами (направление, номер вызова) не участвуют в guard: это не текст о проекте. */
const CODE_FIELDS = new Set(['direction', 'tech_challenge']);

export async function handleSubmitForm(deps: PipelineDeps, req: PipelineRequest, ctx: UserContext): Promise<PipelineResponse> {
  const { store, llm, kb } = deps;
  const form = req.form ?? [];
  if (form.length === 0 && req.budget_items === undefined) {
    throw new PipelineFailure('INVALID_FIELD_VALUE', 'Форма пуста: передайте поля или смету');
  }

  // 1. Проверка значений до любой записи: одно неверное поле — ничего не сохраняется.
  const values: { section_id: number; field_key: string; value: string }[] = [];
  const problems: string[] = [];
  for (const f of form) {
    if (!isValidPassportField(f.section_id, f.field_key)) {
      problems.push(`Неизвестное поле ${f.section_id}/${f.field_key}.`);
      continue;
    }
    const check = checkFieldValue(f.section_id, f.field_key, f.value, kb.tech_challenges);
    if (!check.ok) {
      problems.push(`${f.field_key}: ${check.reason}`);
      continue;
    }
    if (check.value) values.push({ section_id: f.section_id, field_key: f.field_key, value: check.value });
  }
  if (problems.length > 0) {
    throw new PipelineFailure('INVALID_FIELD_VALUE', problems.join(' '));
  }

  // Пустое значение = «не менять» (поле не очищается).
  const projectId = ctx.project?.id ?? (await store.ensureProject(req.user_id));
  const textValues = values.filter((v) => !CODE_FIELDS.has(v.field_key));

  // 2. Guard против чужих материалов — только когда якорь уже есть.
  if (ctx.project?.anchorReady && textValues.length > 0) {
    const joined = textValues.map((v) => v.value).join('\n\n');
    const embedding = await llm.embed(joined.slice(0, GUARD_QUERY_MAX_CHARS));
    const guard = await store.guardCheck(projectId, embedding, joined.slice(0, 500), ctx.thresholds);
    if (guard.action === 'blocked') {
      return {
        status: 'BLOCKED_PROJECT_SWAP',
        similarity_score: Math.round(guard.score * 100) / 100,
        message: 'Загруженные материалы относятся к другому проекту. По правилам платформы 1 аккаунт = 1 проект.',
      };
    }
  }

  // 3. Якорь нового проекта создаётся из текста формы. Без текста якоря ещё нет: поля и смета всё равно сохраняются.
  let anchored = ctx.project?.anchorReady ?? false;
  if (!anchored) {
    const brief = textValues.map((v) => v.value).join('\n\n');
    if (brief) {
      await createAnchor(deps, projectId, brief);
      anchored = true;
    }
  }

  // 4. Упаковка и запись полей через DeepSeek (extractPassport).
  const changed = new Set<DependencyNode>();
  if (values.length > 0) {
    const sources = await store.listSources(projectId);
    await extractPassport(deps, projectId, req.program, '', sources, values, changed);
  }

  // 5. Смета целиком (если передана).
  if (req.budget_items !== undefined) {
    await store.replaceBudgetItems(
      projectId,
      req.budget_items.map((b) => ({ ...b, justification: b.justification ?? '' })),
    );
  }

  await invalidateDependents(store, projectId, changed);

  // Без якоря дальше не идём: нужен текст о проекте (стартовая анкета из КБ).
  if (!anchored) {
    return {
      status: 'WAITING_FOR_INITIAL_BRIEF',
      step: 'INITIAL_BRIEF',
      question: kb.initial_brief.question,
      example: kb.initial_brief.example,
    };
  }
  return nextStep(deps, ctx, projectId, req.program);
}
