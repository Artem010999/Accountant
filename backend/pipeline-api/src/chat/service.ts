import type { z } from 'zod';
import type {
  ChatMessageOut,
  ConsultantChatResponse,
  ConsultantHistoryResponse,
} from '@passport/contracts';
import { PipelineFailure } from '../errors';
import type { PipelineDeps } from '../pipeline/deps';
import type { ChatMessageRow } from '../db/store';
import { wrapUntrustedData } from '../promptGuard';
import { getRagDb } from '../rag/db';
import { retrieveRagContext } from '../rag/retriever';
import { callLlm, consultantSchema } from '../llm/schemas';
import type { chatPostRequestSchema } from './schema';

export function toChatMessageOut(row: ChatMessageRow): ChatMessageOut {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    referenced_cards: row.referenced_cards,
    created_at: row.created_at,
  };
}

/**
 * Загружает последние сообщения диалога пользователя с ИИ-Консультантом.
 */
export async function getConsultantHistory(
  deps: PipelineDeps,
  userId: string,
  limit = 8,
): Promise<ConsultantHistoryResponse> {
  const ctx = await deps.store.loadContext(userId);
  if (!ctx || ctx.isBanned) {
    throw new PipelineFailure('USER_BANNED', 'Профиль не найден или заблокирован');
  }

  if (!ctx.project) {
    return { status: 'OK', project_id: null, messages: [] };
  }

  const rows = await deps.store.getChatMessages(ctx.project.id, limit);
  return {
    status: 'OK',
    project_id: ctx.project.id,
    messages: rows.map(toChatMessageOut),
  };
}

/**
 * Обрабатывает отправку нового сообщения студента ИИ-Консультанту:
 * 1. Сохраняет вопрос в БД
 * 2. Собирает контекст (паспорт 2-10, смету, audit_context, rag_context)
 * 3. Вызывает DeepSeek Flash в режиме 'consultant'
 * 4. Сохраняет ответ ассистента в БД и возвращает историю
 */
export async function handleConsultantChat(
  deps: PipelineDeps,
  req: z.output<typeof chatPostRequestSchema>,
): Promise<ConsultantChatResponse> {
  const ctx = await deps.store.loadContext(req.user_id);
  if (!ctx || ctx.isBanned) {
    throw new PipelineFailure('USER_BANNED', 'Профиль не найден или заблокирован');
  }

  // ВАЖНО: Анти-фрод сверка (guardCheck) и проверка тарифа (features.consultant) в чате НЕ вызываются
  const projectId = ctx.project?.id ?? (await deps.store.ensureProject(req.user_id));

  // Предыдущая история диалога до 8 сообщений
  const priorHistory = await deps.store.getChatMessages(projectId, 8);

  // Сохраняем новое сообщение пользователя в БД
  const userMsgRow = await deps.store.insertChatMessage({
    projectId,
    userId: req.user_id,
    role: 'user',
    content: req.message,
  });

  // Загружаем состояние паспорта и сметы
  const records = await deps.store.getRecords(projectId);
  const budgetItems = await deps.store.getBudgetItems(projectId);

  // Извлекаем latest_audit_report из секции 0 (если есть)
  let parsedAuditReport: any = null;
  const auditRec = records.find((r) => r.section_id === 0 && r.field_key === 'latest_audit_report');
  if (auditRec?.value) {
    try {
      parsedAuditReport = JSON.parse(auditRec.value);
    } catch {}
  }

  // Извлекаем направление проекта из 4/direction
  const dirRec = records.find((r) => r.section_id === 4 && r.field_key === 'direction');
  const dirVal = dirRec?.value?.trim();
  const knownDirection = dirVal && ['Н1', 'Н2', 'Н3', 'Н4', 'Н5', 'Н6', 'Н7'].includes(dirVal)
    ? dirVal
    : 'all';

  // Определяем целевые блоки targetBlocks для RAG
  const targetBlocksSet = new Set<string>();
  if (req.active_section_id !== undefined && req.active_section_id !== null) {
    targetBlocksSet.add(String(req.active_section_id));
  }

  const blockRegex = /блок[а-я]*\s*№?\s*([2-9]|10)|([2-9]|10)\s*-?[йм]?\s*блок/i;
  const blockMatch = req.message.match(blockRegex);
  if (blockMatch) {
    const matchedNum = blockMatch[1] || blockMatch[2];
    if (matchedNum) {
      targetBlocksSet.add(matchedNum);
    }
  }

  const lowerMsg = req.message.toLowerCase();
  if (/смет|бюджет|подрядчик|зарплат/.test(lowerMsg)) {
    targetBlocksSet.add('7');
    targetBlocksSet.add('5');
  }
  if (/аналог|конкурент|новизн/.test(lowerMsg)) {
    targetBlocksSet.add('6');
  }
  if (/кп|календарн|этап/.test(lowerMsg)) {
    targetBlocksSet.add('5');
  }

  const targetBlocks = targetBlocksSet.size > 0 ? Array.from(targetBlocksSet) : ['all'];

  // Извлечение RAG контекста (step: 'chat')
  let ragContextText = '';
  try {
    const ragDb = await getRagDb();
    try {
      const ragRes = await retrieveRagContext(ragDb.sql, {
        step: 'chat',
        targetBlocks,
        direction: knownDirection as any,
        queryText: req.message,
        topKSearch: 6,
        includePinned: true,
      });
      ragContextText = ragRes.formattedContext;
    } finally {
      await ragDb.close();
    }
  } catch (err) {
    deps.logger?.warn?.('[consultant] RAG retrieve failed', err);
  }

  // Формирование входного payload для задачи 'consultant'
  const payload = {
    question: wrapUntrustedData('chat_user_question', req.message),
    active_section_id: req.active_section_id ?? null,
    chat_history: priorHistory.map((m) => ({
      role: m.role,
      content: m.role === 'user' ? wrapUntrustedData('chat_history_user', m.content) : m.content,
    })),
    passport_context: records
      .filter((r) => r.section_id >= 2 && r.section_id <= 10 && r.value)
      .map((r) => ({
        section_id: r.section_id,
        field_key: r.field_key,
        value: r.value,
        review_status: r.review_status,
      })),
    budget_context: budgetItems.map((b) => ({
      stage: b.stage,
      category: b.category,
      title: b.title,
      amount: b.amount,
      review_status: b.review_status,
    })),
    audit_context: parsedAuditReport
      ? {
          block_audits: parsedAuditReport.block_audits,
          budget_audit: parsedAuditReport.budget_audit,
          fatal_stop_factors: parsedAuditReport.fatal_stop_factors,
        }
      : null,
    rag_context: ragContextText,
  };

  // Вызов LLM (DeepSeek Flash)
  const out = await callLlm(deps.llm, 'consultant', payload, consultantSchema);

  // Сохраняем ответ ассистента в БД
  const assistantMsgRow = await deps.store.insertChatMessage({
    projectId,
    userId: req.user_id,
    role: 'assistant',
    content: out.reply,
    referencedCards: out.referenced_cards,
  });

  // Загружаем обновлённую историю до 8 сообщений
  const updatedHistory = await deps.store.getChatMessages(projectId, 8);

  return {
    status: 'OK',
    project_id: projectId,
    user_message: toChatMessageOut(userMsgRow),
    assistant_message: toChatMessageOut(assistantMsgRow),
    history: updatedHistory.map(toChatMessageOut),
  };
}
