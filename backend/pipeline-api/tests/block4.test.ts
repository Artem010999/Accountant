// Блок 4: ИИ-Консультант (4.1), выгрузка DOCX (4.2), блокировка от двойного запуска (4.3), журнал LLM (4.4).
import { beforeAll, describe, expect, it } from 'vitest';
import PizZip from 'pizzip';
import { PASSPORT_SECTIONS, type PipelineRequest, type PipelineCompleted } from '@passport/contracts';
import { handlePipeline } from '../src/pipeline/handler';
import { handleConsultant } from '../src/consultant/consultant';
import { handleExport, type ExportSectionInput } from '../src/pipeline/export';
import { FakeLlm } from '../src/llm/fake';
import { createPipelineServer } from '../src/server';
import { createTestDb, createUser, makeDeps, type TestDb } from './helpers';
import type { PipelineDeps } from '../src/pipeline/deps';

const BRIEF =
  'Сервис помощи студентам с поиском попутчиков по маршруту и расписанию занятий. ' +
  'Студенты тратят много времени на поиск попутчиков в чатах.';

const PASSING = {
  is_student_or_postgraduate: true,
  has_open_fsi_contracts_or_applications: false,
  has_prior_student_startup_grant: false,
  ready_to_open_llc_after_win: true,
};

const VALID_BUDGET = [
  { stage: 1 as const, category: 'other' as const, title: 'Консультации по проекту', quantity: 1, unit_price: 20000, amount: 20000, justification: 'Консультации' },
  { stage: 2 as const, category: 'contractor' as const, title: 'Разработка интерфейса', quantity: 1, unit_price: 250000, amount: 250000, justification: 'Подрядчик' },
  { stage: 2 as const, category: 'equipment' as const, title: 'Ноутбук', quantity: 2, unit_price: 100000, amount: 200000, justification: 'Техника' },
  { stage: 2 as const, category: 'salary' as const, title: 'Зарплата разработчика', quantity: 10, unit_price: 50000, amount: 500000, justification: 'Разработка' },
  { stage: 2 as const, category: 'other' as const, title: 'Хостинг и сервисы', quantity: 1, unit_price: 30000, amount: 30000, justification: 'Инфраструктура' },
];

const SECRET = 'test-secret';
const FOUNDER_KEYS = ['full_name', 'contacts', 'education_status', 'university', 'region'];
let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  await db.sql.query('UPDATE app_settings SET guard_threshold_block = 0.05, guard_threshold_warn = 0.1 WHERE id = 1');
});

const req = (userId: string, extra: Partial<PipelineRequest> = {}): PipelineRequest => ({
  user_id: userId,
  action: 'init_or_upload',
  program: 'Студенческий стартап',
  eligibility: PASSING,
  ...extra,
});

const fullExtraction = (_input: any) => ({
  fields: PASSPORT_SECTIONS.flatMap((s) =>
    s.fields.map((f) => {
      const value =
        f === 'direction' ? 'Н1' : f === 'tech_challenge' ? '1' : `Значение поля ${f} для проекта: сервис помощи студентам с поиском попутчиков.`;
      return {
        section_id: s.id,
        field_key: f,
        value,
        claims: [{ claim_text: value, claim_type: 'hypothesis', claim_kind: 'sentence', source_id: null, source_locator: null, confidence: 0.7 }],
      };
    }),
  ),
});

const novelty = () => ({ analogues_count: 2, analogues_list: ['А', 'Б'], has_measurable_comparison: true, missing_details_question: null });

/** Ответ аудитора Kimi (колега: блоки и смета): всё согласовано. Нужен, чтобы approvals реально записались в БД. */
const approveAudit = (_input: any) => ({
  fatal_stop_factors: [],
  block_audits: PASSPORT_SECTIONS.map((s) => ({ section_id: s.id, status: 'approved', remark: null, how_to_fix: null, failed_fields: [] })),
  budget_audit: { status: 'approved', remark: null, how_to_fix: null, violations: [] },
});

/** Полный паспорт: смета сохранена, бриф пройден. По умолчанию аудитор Kimi согласовывает все поля. */
async function completeProject(userId: string, extra: Record<string, any> = {}): Promise<{ deps: PipelineDeps; res: PipelineCompleted | any }> {
  const llm = new FakeLlm({ extract: fullExtraction, novelty, audit: approveAudit, ...extra });
  const deps = makeDeps(db, llm);
  await handlePipeline(deps, req(userId, { action: 'submit_form', budget_items: VALID_BUDGET }));
  const res = await handlePipeline(deps, req(userId, { text_input: BRIEF }));
  return { deps, res };
}

/** Поля экрана: 10 секций в том виде, в каком их отдаёт фронтенд (значения из базы). */
async function sectionsFromDb(userId: string): Promise<ExportSectionInput[]> {
  const ctx = await db.store.loadContext(userId);
  const records = await db.store.getRecords(ctx!.project!.id);
  const founder: ExportSectionInput = {
    section_id: 1,
    fields: FOUNDER_KEYS.map((k) => ({ field_key: k, value: String(ctx!.founderData[k] ?? '') })),
  };
  const passport = PASSPORT_SECTIONS.map((s) => ({
    section_id: s.id,
    fields: s.fields.map((f) => ({ field_key: f, value: records.find((r) => r.section_id === s.id && r.field_key === f)?.value ?? '' })),
  }));
  return [founder, ...passport];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- 4.3 блокировка от двойного запуска ----------

describe('4.3 блокировка от двойного запуска', () => {
  it('второй запуск, пока первый идёт, получает ALREADY_PROCESSING; после завершения блокировка снята', async () => {
    const userId = await createUser(db.sql);
    const slow = makeDeps(db, new FakeLlm({ anchor: async () => { await sleep(300); return { anchor_summary: 'Выжимка брифа проекта.' }; } }));
    const first = handlePipeline(slow, req(userId, { text_input: BRIEF }));
    await sleep(60);
    const second = await handlePipeline(makeDeps(db), req(userId, { text_input: BRIEF }));
    expect(second).toMatchObject({ status: 'ERROR', code: 'ALREADY_PROCESSING' });

    const firstRes = await first;
    expect(firstRes.status).not.toBe('ERROR');
    const { rows } = await db.sql.query('SELECT processing_started_at FROM app_profiles WHERE id = $1::uuid', [userId]);
    expect(rows[0].processing_started_at).toBeNull();
  });

  it('зависшая блокировка старше 10 минут не мешает', async () => {
    const userId = await createUser(db.sql);
    await db.sql.query(`UPDATE app_profiles SET processing_started_at = now() - interval '11 minutes' WHERE id = $1::uuid`, [userId]);
    const res = await handlePipeline(makeDeps(db), req(userId, { text_input: BRIEF }));
    expect(res.status).not.toBe('ERROR');
  });
});

// ---------- 4.4 журнал обращений к нейросети ----------

describe('4.4 журнал обращений к нейросети', () => {
  it('каждый вызов LLM записан: задача, длительность, статус и предпросмотр ответа', async () => {
    const userId = await createUser(db.sql);
    await handlePipeline(makeDeps(db), req(userId, { text_input: BRIEF }));
    const { rows } = await db.sql.query(
      `SELECT task, status, duration_ms, response_preview FROM llm_call_log WHERE user_id = $1::uuid ORDER BY id`,
      [userId],
    );
    const tasks = rows.map((r) => r.task);
    expect(tasks).toContain('anchor');
    expect(tasks).toContain('extract');
    expect(rows.every((r) => r.status === 'ok' && r.duration_ms >= 0)).toBe(true);
    expect(rows.find((r) => r.task === 'anchor').response_preview.length).toBeGreaterThan(0);
  });

  it('ошибка нейросети записана со статусом error и текстом ошибки; пайплайн отвечает INTERNAL', async () => {
    const userId = await createUser(db.sql);
    const broken = makeDeps(db, new FakeLlm({ anchor: () => { throw new Error('таймаут провайдера'); } }));
    const res = await handlePipeline(broken, req(userId, { text_input: BRIEF }));
    expect(res).toMatchObject({ status: 'ERROR', code: 'INTERNAL' });
    const { rows } = await db.sql.query(
      `SELECT status, error_message FROM llm_call_log WHERE user_id = $1::uuid AND task = 'anchor'`,
      [userId],
    );
    expect(rows[0]).toMatchObject({ status: 'error', error_message: 'таймаут провайдера' });
  });
});

// ---------- 4.1 ИИ-Консультант ----------

const ragStub = async () => ({
  cards: [{ card_id: 'card_limits_8', title: 'Лимиты 8-й очереди' }],
  context: 'Фрагмент базы знаний про лимиты.',
});

describe('4.1 ИИ-Консультант', () => {
  it('сообщение, решающее чужую задачу, блокируется: консультант не вызывается, диалог сохраняется', async () => {
    const userId = await createUser(db.sql, { plan: 'premium' });
    const llm = new FakeLlm({ chat_guard: () => ({ verdict: 'solve_task', reason: 'просят написать реферат' }) });
    const deps: PipelineDeps = { ...makeDeps(db, llm), rag: ragStub };
    const res = await handleConsultant(deps, { user_id: userId, message: 'Напиши мне реферат про экономику' });
    expect(res.status).toBe('BLOCKED');
    expect(llm.calls.some((c) => c.task === 'consultant')).toBe(false);
    const { rows } = await db.sql.query('SELECT COUNT(*)::int AS n FROM consultant_messages WHERE user_id = $1::uuid', [userId]);
    expect(rows[0].n).toBe(2);
  });

  it('обычный вопрос: ответ с предупреждением о лимите, источники из RAG и поля паспорта в запросе', async () => {
    const userId = await createUser(db.sql, { plan: 'premium' });
    const llm = new FakeLlm({
      consultant: () => ({
        reply: 'Лимит на подрядчиков в 8-й очереди пока не подтверждён положением. Сверьте с официальной публикацией.',
        warnings: ['точный лимит ещё не подтверждён положением 8-й очереди'],
      }),
    });
    const { deps } = await completeProject(userId);
    const consultantDeps: PipelineDeps = { ...deps, llm, rag: ragStub };
    const res = await handleConsultant(consultantDeps, { user_id: userId, message: 'Какой лимит на подрядчиков?' });
    expect(res.status).toBe('ANSWER');
    if (res.status !== 'ANSWER') return;
    expect(res.warnings.join(' ')).toContain('не подтверждён положением');
    expect(res.sources).toEqual([{ card_id: 'card_limits_8', title: 'Лимиты 8-й очереди' }]);

    const call = llm.calls.find((c) => c.task === 'consultant')!;
    expect(call.input.rag_context).toContain('лимиты');
    expect(call.input.passport_context.length).toBeGreaterThan(10);
  });

  it('консультант только читает: поля паспорта не меняются', async () => {
    const userId = await createUser(db.sql, { plan: 'premium' });
    const { deps } = await completeProject(userId);
    const sql = `SELECT r.field_key, r.value FROM project_passport_records r JOIN app_projects p ON p.id = r.project_id WHERE p.user_id = $1::uuid ORDER BY 1`;
    const before = await db.sql.query(sql, [userId]);
    await handleConsultant({ ...deps, rag: ragStub }, { user_id: userId, message: 'Что ещё нужно доработать в паспорте?' });
    const after = await db.sql.query(sql, [userId]);
    expect(after.rows).toEqual(before.rows);
  });

  it('в запрос к модели попадают не больше 8 последних сообщений диалога', async () => {
    const userId = await createUser(db.sql, { plan: 'premium' });
    for (let i = 0; i < 10; i++) {
      await db.sql.query("INSERT INTO consultant_messages (user_id, role, content) VALUES ($1::uuid, 'user', $2)", [userId, `вопрос ${i}`]);
    }
    const llm = new FakeLlm();
    await handleConsultant({ ...makeDeps(db, llm), rag: ragStub }, { user_id: userId, message: 'Ещё один вопрос' });
    const call = llm.calls.find((c) => c.task === 'consultant')!;
    expect(call.input.history).toHaveLength(8);
  });
});

// ---------- 4.2 выгрузка DOCX: кнопка и 10 секций ----------

describe('4.2 выгрузка паспорта в DOCX', () => {
  it('готовность к выгрузке: COMPLETED отдаёт export_ready=true, когда всё одобрено аудитором', async () => {
    const userId = await createUser(db.sql);
    const { res } = await completeProject(userId);
    expect(res.status).toBe('COMPLETED');
    expect(res.export_ready).toBe(true);
    expect(res.not_approved).toEqual([]);
  });

  it('аудит не согласовал блок: паспорт не завершён, пользователь видит причину, выгрузка закрыта', async () => {
    const userId = await createUser(db.sql);
    const { deps, res } = await completeProject(userId, {
      audit: (_input: any) => ({
        fatal_stop_factors: [],
        block_audits: PASSPORT_SECTIONS.map((s) => ({
          section_id: s.id,
          status: s.id === 3 ? 'needs_revision' : 'approved',
          remark: s.id === 3 ? 'Проблема описана без измеримых последствий.' : null,
          how_to_fix: s.id === 3 ? 'Укажите число студентов и потерянное время.' : null,
          failed_fields: s.id === 3 ? ['problem_description'] : [],
        })),
        budget_audit: { status: 'approved', remark: null, how_to_fix: null, violations: [] },
      }),
    });
    expect(res).toMatchObject({ status: 'NEED_USER_INPUT', target_field: { section_id: 3 }, rejection_reason: 'Проблема описана без измеримых последствий.' });

    const sections = await sectionsFromDb(userId);
    await expect(handleExport(deps, { user_id: userId, sections }, (await db.store.loadContext(userId))!)).rejects.toMatchObject({ code: 'NOT_APPROVED' });
  });

  it('всё одобрено: выгрузка создаёт DOCX из 10 секций, в нём ФИО, статьи сметы и чек-лист', async () => {
    const userId = await createUser(db.sql, { name: 'Петрова Мария' });
    const { deps } = await completeProject(userId);
    const sections = await sectionsFromDb(userId);
    const res = await handleExport(deps, { user_id: userId, sections }, (await db.store.loadContext(userId))!);
    expect(res.status).toBe('EXPORT_READY');
    expect(res.download_path).toBe(`/export/${res.export_id}`);

    const file = await db.sql.query('SELECT content FROM passport_exports WHERE id = $1::uuid', [res.export_id]);
    const xml = new PizZip(Buffer.from(file.rows[0].content)).file('word/document.xml')!.asText();
    expect(xml).toContain('Петрова Мария');
    expect(xml).toContain('Разработка интерфейса');
    expect(xml).toContain('Справка об обучении: не ранее даты объявления конкурса (29.10.2026)');
    expect(xml).toContain('Основатель');
    expect(xml).toContain('Описание проблемы');
  });

  it('переданный текст не совпадает с сохранённым (экран устарел): STALE_EXPORT, файл не создаётся', async () => {
    const userId = await createUser(db.sql);
    const { deps } = await completeProject(userId);
    const sections = await sectionsFromDb(userId);
    sections[1]!.fields[0]!.value = 'Подменённый текст, которого нет в паспорте.';
    await expect(handleExport(deps, { user_id: userId, sections }, (await db.store.loadContext(userId))!)).rejects.toMatchObject({ code: 'STALE_EXPORT' });
  });

  it('необязательный технологический вызов не блокирует выгрузку', async () => {
    const userId = await createUser(db.sql);
    const { deps } = await completeProject(userId);
    await db.sql.query(
      `UPDATE project_passport_records r SET value = '' FROM app_projects p
        WHERE p.id = r.project_id AND p.user_id = $1::uuid AND r.field_key = 'tech_challenge'`,
      [userId],
    );
    const sections = await sectionsFromDb(userId);
    const res = await handleExport(deps, { user_id: userId, sections }, (await db.store.loadContext(userId))!);
    expect(res.status).toBe('EXPORT_READY');
  });

  it('скачать выгрузку может только владелец', async () => {
    const userId = await createUser(db.sql);
    const { deps } = await completeProject(userId);
    const sections = await sectionsFromDb(userId);
    const res = await handleExport(deps, { user_id: userId, sections }, (await db.store.loadContext(userId))!);
    const mine = await db.store.getExport(res.export_id, userId);
    expect(mine?.file_name).toMatch(/\.docx$/);
    const other = await createUser(db.sql);
    expect(await db.store.getExport(res.export_id, other)).toBeNull();
  });
});

// ---------- HTTP-маршруты ----------

describe('HTTP: /consultant, /export', () => {
  it('без секрета — 401; с секретом — ответ консультанта, выгрузка и скачивание владельцем', async () => {
    const userId = await createUser(db.sql, { plan: 'premium' });
    const { deps } = await completeProject(userId);

    const server = createPipelineServer({ ...deps, rag: ragStub }, { sharedSecret: SECRET });
    await new Promise<void>((r) => server.listen(0, r));
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const auth = { 'x-pipeline-secret': SECRET, 'Content-Type': 'application/json' };
    try {
      const noSecret = await fetch(`${base}/consultant`, { method: 'POST', body: JSON.stringify({ user_id: userId, message: 'Привет' }) });
      expect(noSecret.status).toBe(401);

      const chat = await fetch(`${base}/consultant`, { method: 'POST', headers: auth, body: JSON.stringify({ user_id: userId, message: 'Что проверить в смете?' }) });
      expect(chat.status).toBe(200);
      expect(((await chat.json()) as { status: string }).status).toBe('ANSWER');

      const sections = await sectionsFromDb(userId);
      const exp = await fetch(`${base}/export`, { method: 'POST', headers: auth, body: JSON.stringify({ user_id: userId, sections }) });
      expect(exp.status).toBe(200);
      const exported = (await exp.json()) as { status: string; export_id: string };
      expect(exported.status).toBe('EXPORT_READY');

      const file = await fetch(`${base}/export/${exported.export_id}`, { headers: { 'x-pipeline-secret': SECRET, 'x-user-id': userId } });
      expect(file.status).toBe(200);
      expect(file.headers.get('content-type')).toContain('wordprocessingml');
      expect(new PizZip(Buffer.from(await file.arrayBuffer())).file('word/document.xml')).not.toBeNull();

      const stranger = await createUser(db.sql);
      const denied = await fetch(`${base}/export/${exported.export_id}`, { headers: { 'x-pipeline-secret': SECRET, 'x-user-id': stranger } });
      expect(denied.status).toBe(404);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });
});
