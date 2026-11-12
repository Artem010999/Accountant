// Оркестратор пайплайна (аналог n8n-графа ТЗ, блоки 1–5). Stateless: контекст вопроса приходит в запросе.
import type { PipelineRequest, PipelineResponse, TargetField } from '@passport/contracts';
import { isValidPassportField } from '@passport/contracts';
import { PipelineFailure } from '../errors';
import { fieldKb } from '../kb/manifest';
import { callLlm, anchorSchema } from '../llm/schemas';
import type { RecordRow, UserContext } from '../db/store';
import { ingestFiles } from './intake';
import type { PipelineDeps } from './deps';
import { answerField, extractPassport, findGaps } from './passport';
import { noveltyAndFinalize } from './finalize';

const GUARD_QUERY_MAX_CHARS = 5_000;
const SHORT_ANSWER_CHARS = 150;

/** Единая точка входа. Ожидаемые ошибки → ERROR с кодом; прочее логируется и отдаётся как INTERNAL. */
export async function handlePipeline(deps: PipelineDeps, req: PipelineRequest): Promise<PipelineResponse> {
  try {
    return await run(deps, req);
  } catch (err) {
    if (err instanceof PipelineFailure) {
      return { status: 'ERROR', code: err.code, message: err.message };
    }
    deps.logger.error('[pipeline] unexpected error', err);
    return { status: 'ERROR', code: 'INTERNAL', message: 'Внутренняя ошибка пайплайна' };
  }
}

async function run(deps: PipelineDeps, req: PipelineRequest): Promise<PipelineResponse> {
  const { store, kb } = deps;

  // ШАГ 1: бан, квота, заморозка ФИО
  const ctx = await store.loadContext(req.user_id);
  if (!ctx || ctx.isBanned) {
    throw new PipelineFailure('USER_BANNED', 'Профиль не найден или заблокирован');
  }
  if (req.program !== kb.program) {
    throw new PipelineFailure('INTERNAL', `Программа «${req.program}» пока не поддерживается`);
  }

  const files = req.files ?? [];
  if (files.length > 0) {
    if (!ctx.features.ai_parsing) {
      throw new PipelineFailure('PLAN_UPGRADE_REQUIRED', 'На вашем тарифе загрузка документов недоступна');
    }
    if (ctx.uploadedFilesCount + files.length > ctx.fileUploadsLimit) {
      throw new PipelineFailure('FILE_QUOTA_EXCEEDED', 'Превышен лимит загрузки файлов по тарифу');
    }
  }
  // TODO(разработчик, S2): правило допуска ФСИ (узлы 4–5 схемы): «нет субъекта / есть ФЛП / открыто ООО» → отказ.
  // Правила, поля анкеты допуска и источники этих полей пока не определены (docs/PLAN-v1.1.md Q3).
  // TODO: в реестре секции 1 ключ ФИО называется full_name, а здесь проверяется founderData.name. Привести к одному ключу.
  if (!ctx.founderData?.name) {
    throw new PipelineFailure('FOUNDER_REQUIRED', 'Укажите ФИО в профиле основателя');
  }

  if (ctx.project?.anchorReady) {
    return handleExistingProject(deps, req, ctx);
  }
  return handleNewProject(deps, req, ctx);
}

/** Ветка «Новый» (G1): якорь ещё не создан (холодный старт, Баг №1). */
async function handleNewProject(deps: PipelineDeps, req: PipelineRequest, ctx: UserContext): Promise<PipelineResponse> {
  const { store, llm, kb } = deps;
  const projectId = ctx.project?.id ?? (await store.ensureProject(req.user_id));

  await ingestFiles(deps, projectId, req.files ?? []);
  const sources = await store.listSources(projectId);

  const brief = [req.text_input ?? '', ...sources.map((s) => s.extracted_text ?? '')]
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n\n');

  // S3B: нет ни текста, ни файлов — отдаём стартовую анкету из КБ за 0 токенов (U_INIT)
  if (!brief) {
    return {
      status: 'WAITING_FOR_INITIAL_BRIEF',
      step: 'INITIAL_BRIEF',
      question: kb.initial_brief.question,
      example: kb.initial_brief.example,
    };
  }

  // S1_NEW: якорь = выжимка + эмбеддинг
  const { anchor_summary } = await callLlm(llm, 'anchor', { brief: brief.slice(0, 20_000) }, anchorSchema);
  const embedding = await llm.embed(brief.slice(0, GUARD_QUERY_MAX_CHARS));
  await store.setAnchor(projectId, { briefText: brief, summary: anchor_summary, embedding, model: llm.model });

  // ШАГ 4–5: извлечение и аудит
  await extractPassport(deps, projectId, req.program, req.text_input ?? '', sources);
  return nextStep(deps, ctx, projectId, req.program);
}

/** Ветка «Есть» (G1 → S2): проект с якорем — guard, затем ответ или новые данные. */
async function handleExistingProject(deps: PipelineDeps, req: PipelineRequest, ctx: UserContext): Promise<PipelineResponse> {
  const { store, llm } = deps;
  const project = ctx.project!;
  const projectId = project.id;

  const target: TargetField | undefined = req.target_field;
  if (target && !isValidPassportField(target.section_id, target.field_key)) {
    throw new PipelineFailure('INVALID_TARGET', `Неизвестное поле ${target.section_id}/${target.field_key}`);
  }

  // ШАГ 3А: новые файлы (только новые по sha256)
  const added = await ingestFiles(deps, projectId, req.files ?? []);
  const text = (req.text_input ?? '').trim();
  const newText = [text, ...added.map((s) => s.extracted_text ?? '')].filter(Boolean).join('\n\n');

  // ШАГ 2 [AI Guard]: сверка нового ввода с якорем
  if (newText) {
    const isShortAnswer = text.length > 0 && text.length < SHORT_ANSWER_CHARS && !!req.previous_question;
    const query = isShortAnswer ? `Вопрос по проекту: ${req.previous_question} Ответ: ${text}` : newText;
    const embedding = await llm.embed(query.slice(0, GUARD_QUERY_MAX_CHARS));
    const guard = await store.guardCheck(projectId, embedding, newText.slice(0, 500), ctx.thresholds);
    if (guard.action === 'blocked') {
      return {
        status: 'BLOCKED_PROJECT_SWAP',
        similarity_score: Math.round(guard.score * 100) / 100,
        message: 'Загруженные материалы относятся к другому проекту. По правилам платформы 1 аккаунт = 1 проект.',
      };
    }
  }

  if (req.action === 'submit_answer' && target) {
    // U_LOOP: ответ на конкретное поле
    const kb = fieldKb(deps.kb, target.section_id, target.field_key);
    const question = req.previous_question ?? kb.question;
    if (!text) {
      return { status: 'ANSWER_REJECTED', step: 'ANSWER_VALIDATION', target_field: target, question, example: kb.example, rejection_reason: 'Ответ пустой' };
    }
    const result = await answerField(deps, projectId, target, question, text);
    if (!result.ok) {
      return {
        status: 'ANSWER_REJECTED',
        step: 'ANSWER_VALIDATION',
        target_field: target,
        question,
        example: kb.example,
        rejection_reason: result.reason,
      };
    }
  } else if (newText) {
    // Новые данные (текст или файлы) — переизвлечение паспорта
    const sources = await store.listSources(projectId);
    await extractPassport(deps, projectId, req.program, text, sources);
  }

  return nextStep(deps, ctx, projectId, req.program);
}

/** После изменения паспорта: пробелы (ШАГ 6) → новизна (ШАГ 7) → выход (ШАГ 8). */
async function nextStep(deps: PipelineDeps, ctx: UserContext, projectId: string, program: string): Promise<PipelineResponse> {
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
