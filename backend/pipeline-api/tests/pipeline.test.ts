// Сквозные сценарии пайплайна: файлы, LLM (fake), состояние проекта, ошибки.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import type { PipelineRequest } from '@passport/contracts';
import { handlePipeline } from '../src/pipeline/handler';
import { FakeLlm } from '../src/llm/fake';
import { PASSPORT_SECTIONS } from '@passport/contracts';
import { createTestDb, createUser, FakeParser, makeDeps, type TestDb } from './helpers';

const BRIEF =
  'Сервис помощи студентам с поиском попутчиков по маршруту и расписанию занятий. ' +
  'Студенты тратят много времени на поиск попутчиков в чатах.';

const STUDENT_BASE = 'Студенческий стартап';

let db: TestDb;

// Для тестов порог блокировки ниже: fake-эмбеддинги — по словам, и ответ по теме делит с брифом лишь часть слов
beforeAll(async () => {
  db = await createTestDb();
  await db.sql.query('UPDATE app_settings SET guard_threshold_block = 0.05, guard_threshold_warn = 0.1 WHERE id = 1');
});

/** Ответ «по теме проекта»: содержит слова брифа, как реальный ответ по тому же проекту. */
const onTopic = (s: string) => `${BRIEF} ${s}`;

const req = (userId: string, extra: Partial<PipelineRequest> = {}): PipelineRequest => ({
  user_id: userId,
  action: 'init_or_upload',
  program: STUDENT_BASE,
  ...extra,
});

/** Ответ LLM: заполняет все поля паспорта, одно claim-«факт» без источника (даст предупреждение). */
const fullExtraction = (input: any) => ({
  fields: PASSPORT_SECTIONS.flatMap((s) =>
    s.fields.map((f) => {
      const value = `Значение поля ${f} для проекта: сервис помощи студентам с поиском попутчиков.`;
      return {
        section_id: s.id,
        field_key: f,
        value,
        claims: [
          {
            claim_text: value,
            claim_type: s.id === 7 && f === 'traction_and_pilots' ? 'fact' : 'hypothesis',
            claim_kind: 'sentence',
            source_id: null,
            source_locator: null,
            confidence: 0.7,
          },
        ],
      };
    }),
  ),
});

describe('пайплайн v1.0', () => {
  it('пользователь без текста и файлов получает стартовую анкету (холодный старт)', async () => {
    const userId = await createUser(db.sql);
    const res = await handlePipeline(makeDeps(db), req(userId));
    expect(res).toMatchObject({ status: 'WAITING_FOR_INITIAL_BRIEF', step: 'INITIAL_BRIEF' });

    const { rows } = await db.sql.query(
      `SELECT anchor_status, brief_text FROM app_projects WHERE user_id = $1::uuid`,
      [userId],
    );
    expect(rows[0]).toMatchObject({ anchor_status: 'pending', brief_text: '' });
  });

  it('бриф создаёт якорь и возвращает первый пробел для дозаполнения', async () => {
    const userId = await createUser(db.sql);
    const res = await handlePipeline(makeDeps(db), req(userId, { text_input: BRIEF }));

    expect(res).toMatchObject({
      status: 'NEED_USER_INPUT',
      step: 'GAP_FILLING',
      target_field: { section_id: 2, field_key: 'team_members' },
    });

    const { rows } = await db.sql.query(
      `SELECT anchor_status, anchor_embedding IS NOT NULL AS has_emb, status FROM app_projects WHERE user_id = $1::uuid`,
      [userId],
    );
    expect(rows[0]).toMatchObject({ anchor_status: 'ready', has_emb: true, status: 'generating' });
  });

  it('ответ на пробел сохраняется с claims и переводит к следующему пробелу', async () => {
    const userId = await createUser(db.sql);
    const deps = makeDeps(db);
    await handlePipeline(deps, req(userId, { text_input: BRIEF }));

    const answer = onTopic(
      'В команде три человека: Иван разрабатывает backend, Мария отвечает за продукт и интервью с пользователями.',
    );
    const res = await handlePipeline(
      deps,
      req(userId, {
        action: 'submit_answer',
        target_field: { section_id: 2, field_key: 'team_members' },
        previous_question: 'Кто входит в команду?',
        text_input: answer,
      }),
    );
    expect(res).toMatchObject({ status: 'NEED_USER_INPUT', target_field: { section_id: 2, field_key: 'competencies_and_experience' } });

    const rec = await db.sql.query(
      `SELECT r.value, r.review_status FROM project_passport_records r
         JOIN app_projects p ON p.id = r.project_id
        WHERE p.user_id = $1::uuid AND r.section_id = 2 AND r.field_key = 'team_members'`,
      [userId],
    );
    expect(rec.rows[0].value).toBe(answer);
    expect(rec.rows[0].review_status).toBe('ai_generated');
  });

  it('отказной ответ возвращает ANSWER_REJECTED с тем же полем', async () => {
    const userId = await createUser(db.sql);
    const rejecting = new FakeLlm({
      validate_answer: () => ({ is_valid: false, rejection_reason: 'Это отписка', formatted_value: null, claims: [] }),
    });
    const deps = makeDeps(db, rejecting);
    await handlePipeline(deps, req(userId, { text_input: BRIEF }));
    const res = await handlePipeline(
      deps,
      req(userId, {
        action: 'submit_answer',
        target_field: { section_id: 2, field_key: 'team_members' },
        previous_question: 'Сервис помощи студентам: кто в команде?',
        text_input: 'не знаю, пока неизвестно',
      }),
    );
    expect(res).toMatchObject({ status: 'ANSWER_REJECTED', target_field: { section_id: 2, field_key: 'team_members' } });
  });

  it('материалы другого проекта блокируются (PROJECT_SWAP)', async () => {
    const userId = await createUser(db.sql);
    const deps = makeDeps(db);
    await handlePipeline(deps, req(userId, { text_input: BRIEF }));
    const res = await handlePipeline(deps, req(userId, { text_input: 'Кулинарный рецепт пирога с яблоками и корицей' }));
    expect(res).toMatchObject({ status: 'BLOCKED_PROJECT_SWAP' });
  });

  it('заблокированный пользователь получает USER_BANNED', async () => {
    const userId = await createUser(db.sql);
    await db.sql.query('UPDATE app_profiles SET is_banned = true WHERE id = $1::uuid', [userId]);
    const res = await handlePipeline(makeDeps(db), req(userId, { text_input: BRIEF }));
    expect(res).toMatchObject({ status: 'ERROR', code: 'USER_BANNED' });
  });

  it('без ФИО проект не создаётся: FOUNDER_REQUIRED', async () => {
    const userId = await createUser(db.sql, { name: '' });
    const res = await handlePipeline(makeDeps(db), req(userId, { text_input: BRIEF }));
    expect(res).toMatchObject({ status: 'ERROR', code: 'FOUNDER_REQUIRED' });
  });

  it('файлы на базовом тарифе: PLAN_UPGRADE_REQUIRED', async () => {
    const userId = await createUser(db.sql, { plan: 'free' });
    const res = await handlePipeline(
      makeDeps(db),
      req(userId, { files: [{ file_name: 'a.pdf', file_url: 'file:///a.pdf', sha256_hash: 'a'.repeat(64) }] }),
    );
    expect(res).toMatchObject({ status: 'ERROR', code: 'PLAN_UPGRADE_REQUIRED' });
  });

  it('файл: парсинг, проверка sha256, источник и дедуп повторной загрузки', async () => {
    const userId = await createUser(db.sql, { plan: 'pro' });
    const text = 'Проблема: студенты тратят время на поиск попутчиков в чатах каждую неделю.';
    const sha = createHash('sha256').update('doc').digest('hex');
    const parser = new FakeParser({
      'file:///deck.pdf': {
        sha256_hash: sha,
        extracted_text: text,
        metadata: { total_pages: 1, pages: [{ page: 1, text, char_start: 0, char_end: text.length }] },
      },
    });
    const deps = makeDeps(db, new FakeLlm(), parser);
    const file = { file_name: 'deck.pdf', file_url: 'file:///deck.pdf', sha256_hash: sha };

    const first = await handlePipeline(deps, req(userId, { files: [file] }));
    expect(first.status).toBe('NEED_USER_INPUT');
    const second = await handlePipeline(deps, req(userId, { files: [file] }));
    expect(second.status).toBe('NEED_USER_INPUT');

    const { rows } = await db.sql.query(
      `SELECT COUNT(*)::int AS n FROM project_sources ps JOIN app_projects p ON p.id = ps.project_id WHERE p.user_id = $1::uuid`,
      [userId],
    );
    expect(rows[0].n).toBe(1);
  });

  it('файл с неверным хешем отклоняется: FILE_HASH_MISMATCH', async () => {
    const userId = await createUser(db.sql, { plan: 'pro' });
    const parser = new FakeParser({
      'file:///x.pdf': {
        sha256_hash: 'b'.repeat(64),
        extracted_text: 'Текст документа про проект и его цели.',
        metadata: { total_pages: 1, pages: [] },
      },
    });
    const res = await handlePipeline(
      makeDeps(db, new FakeLlm(), parser),
      req(userId, { files: [{ file_name: 'x.pdf', file_url: 'file:///x.pdf', sha256_hash: 'a'.repeat(64) }] }),
    );
    expect(res).toMatchObject({ status: 'ERROR', code: 'FILE_HASH_MISMATCH' });
  });

  it('полный паспорт: без пробелов и с новизной → COMPLETED, статус review, навигатор сохранён', async () => {
    const userId = await createUser(db.sql, { plan: 'premium' });
    const llm = new FakeLlm({
      extract: fullExtraction,
      novelty: () => ({
        analogues_count: 2,
        analogues_list: ['Аналог А', 'Аналог Б'],
        has_measurable_comparison: true,
        missing_details_question: null,
      }),
    });
    const deps = makeDeps(db, llm);
    const res = await handlePipeline(deps, req(userId, { text_input: BRIEF }));

    expect(res.status).toBe('COMPLETED');
    if (res.status !== 'COMPLETED') return;
    expect(res.eligibility_status).toBe('NEEDS_CLARIFICATION'); // факт без документа
    expect(res.passport.length).toBe(PASSPORT_SECTIONS.reduce((n, s) => n + s.fields.length, 0));

    const proj = await db.sql.query(`SELECT status FROM app_projects WHERE user_id = $1::uuid`, [userId]);
    expect(proj.rows[0].status).toBe('review');
    const nav = await db.sql.query(
      `SELECT r.value FROM project_passport_records r JOIN app_projects p ON p.id = r.project_id
        WHERE p.user_id = $1::uuid AND r.section_id = 0 AND r.field_key = 'navigator_summary_and_checklist'`,
      [userId],
    );
    expect(JSON.parse(nav.rows[0].value).eligibility_status).toBe('NEEDS_CLARIFICATION');
  });

  it('новизна: 1 аналог → STOP_NOV, после 2 попыток пайплайн пропускает проверку с предупреждением', async () => {
    const userId = await createUser(db.sql, { plan: 'premium' });
    const llm = new FakeLlm({
      extract: fullExtraction,
      novelty: () => ({
        analogues_count: 1,
        analogues_list: ['Госуслуги'],
        has_measurable_comparison: false,
        missing_details_question: 'Укажите ещё один аналог.',
      }),
    });
    const deps = makeDeps(db, llm);
    const answer = onTopic(
      'Аналог Госуслуги: поиск без расписания. Аналог Blablacar: без проверки вуза, сравнение по времени поиска.',
    );

    const first = await handlePipeline(deps, req(userId, { text_input: BRIEF }));
    expect(first).toMatchObject({ status: 'STOP_NOV', target_field: { section_id: 6, field_key: 'analogues_comparison' } });

    const second = await handlePipeline(
      deps,
      req(userId, { action: 'submit_answer', target_field: { section_id: 6, field_key: 'analogues_comparison' }, previous_question: 'Аналоги?', text_input: answer }),
    );
    expect(second).toMatchObject({ status: 'STOP_NOV' });

    const third = await handlePipeline(
      deps,
      req(userId, { action: 'submit_answer', target_field: { section_id: 6, field_key: 'analogues_comparison' }, previous_question: 'Аналоги?', text_input: answer }),
    );
    expect(third.status).toBe('COMPLETED');
    if (third.status === 'COMPLETED') {
      expect(third.warnings.join(' ')).toContain('Проверка новизны пропущена');
    }
  });

  it('базовый тариф: новизна не проверяется, в чек-листе есть пометка', async () => {
    const userId = await createUser(db.sql, { plan: 'free' });
    const llm = new FakeLlm({ extract: fullExtraction });
    const deps = makeDeps(db, llm);
    const res = await handlePipeline(deps, req(userId, { text_input: BRIEF }));
    expect(res.status).toBe('COMPLETED');
    if (res.status === 'COMPLETED') {
      expect(res.checklist.join(' ')).toContain('недоступна на базовом тарифе');
    }
    expect(llm.calls.some((c) => c.task === 'novelty')).toBe(false);
  });

  it('ошибка LLM не падает наружу: INTERNAL', async () => {
    const userId = await createUser(db.sql);
    const llm = new FakeLlm({ anchor: () => ({ wrong: true }) });
    const res = await handlePipeline(makeDeps(db, llm), req(userId, { text_input: BRIEF }));
    expect(res).toMatchObject({ status: 'ERROR', code: 'INTERNAL' });
  });
});
