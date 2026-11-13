// Задача 4.1: ИИ-Консультант в чате. Советник, а не редактор: поля паспорта он только читает.
// Порядок: анти-фрод сообщения → RAG по базе знаний → поля паспорта + последние сообщения → DeepSeek Flash (задача consultant).
import type { ConsultantRequest, ConsultantResponse } from '@passport/contracts';
import { PipelineFailure } from '../errors';
import type { PipelineDeps } from '../pipeline/deps';
import { callLlm, chatGuardSchema, consultantSchema } from '../llm/schemas';
import { wrapUntrustedData } from '../promptGuard';

const HISTORY_MESSAGES = 8;
const BLOCKED_TEXT =
  'Я помогаю подготовить вашу заявку, но не решаю учебные задачи и не пишу тексты за вас. ' +
  'Спросите о правилах конкурса, о своём проекте или о том, что нужно доработать в паспорте.';

export async function handleConsultant(deps: PipelineDeps, req: ConsultantRequest): Promise<ConsultantResponse> {
  const { store, llm } = deps;
  const ctx = await store.loadContext(req.user_id);
  if (!ctx || ctx.isBanned) {
    throw new PipelineFailure('USER_BANNED', 'Профиль не найден или заблокирован');
  }
  // Функция «Консультант» — по тарифу (seed: premium = true, остальные — false).
  if (!ctx.features.consultant) {
    throw new PipelineFailure('PLAN_UPGRADE_REQUIRED', 'ИИ-консультант доступен на тарифе «Премиум»');
  }
  const message = req.message.trim();

  // 1. Анти-фрод: не пытаются ли решить в чате чужую задачу.
  const guard = await callLlm(llm, 'chat_guard', { message: wrapUntrustedData('user_message', message) }, chatGuardSchema);
  if (guard.verdict === 'solve_task') {
    await store.insertConsultantMessage(req.user_id, 'user', message);
    await store.insertConsultantMessage(req.user_id, 'assistant', BLOCKED_TEXT);
    return { status: 'BLOCKED', message: BLOCKED_TEXT };
  }

  // 2. RAG: карточки базы знаний под вопрос.
  const rag = deps.rag ? await deps.rag(message) : await store.ragSearch(message);

  // 3. Текущие поля паспорта (только заполненные) и последние сообщения диалога.
  const records = ctx.project ? await store.getRecords(ctx.project.id) : [];
  const passportFields = records
    .filter((r) => (r.value ?? '').trim().length > 0)
    .map((r) => ({ section_id: r.section_id, field_key: r.field_key, value: r.value }));
  const history = (await store.recentConsultantMessages(req.user_id, HISTORY_MESSAGES)).map((h) => ({
    role: h.role,
    content: wrapUntrustedData('chat_history', h.content),
  }));

  // 4. Ответ. Правило КБ (стр. 22): точный лимит без подтверждения положением — предупреждать, а не выдумывать.
  const out = await callLlm(
    llm,
    'consultant',
    {
      message: wrapUntrustedData('user_message', message),
      passport_context: passportFields,
      rag_context: rag.context,
      history,
    },
    consultantSchema,
  );

  await store.insertConsultantMessage(req.user_id, 'user', message);
  await store.insertConsultantMessage(req.user_id, 'assistant', out.reply);

  return {
    status: 'ANSWER',
    answer: out.reply,
    warnings: out.warnings,
    sources: rag.cards.slice(0, 10),
  };
}
