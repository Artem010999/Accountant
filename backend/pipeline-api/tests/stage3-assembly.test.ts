import { beforeAll, describe, expect, it } from 'vitest';
import type { PipelineRequest } from '@passport/contracts';
import { PASSPORT_SECTIONS } from '@passport/contracts';
import { handlePipeline } from '../src/pipeline/handler';
import { extractPassport } from '../src/pipeline/passport';
import { FakeLlm } from '../src/llm/fake';
import { createTestDb, createUser, makeDeps, type TestDb } from './helpers';

const PASSING_ELIGIBILITY = {
  is_student_or_postgraduate: true,
  has_open_fsi_contracts_or_applications: false,
  has_prior_student_startup_grant: false,
  ready_to_open_llc_after_win: true,
};

const SAMPLE_BUDGET = [
  { stage: 1 as const, category: 'other' as const, title: 'Консультации', quantity: 1, unit_price: 20000, amount: 20000, justification: 'Консультации' },
  { stage: 2 as const, category: 'contractor' as const, title: 'Разработка ПО', quantity: 1, unit_price: 250000, amount: 250000, justification: 'Подрядчик' },
  { stage: 2 as const, category: 'equipment' as const, title: 'Ноутбук', quantity: 2, unit_price: 100000, amount: 200000, justification: 'Техника' },
  { stage: 2 as const, category: 'salary' as const, title: 'Зарплата', quantity: 10, unit_price: 50000, amount: 500000, justification: 'Разработка' },
  { stage: 2 as const, category: 'other' as const, title: 'Хостинг', quantity: 1, unit_price: 30000, amount: 30000, justification: 'Инфраструктура' },
];

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  await db.sql.query('UPDATE app_settings SET guard_threshold_block = 0.05, guard_threshold_warn = 0.1 WHERE id = 1');
});

describe('Этап 3: Сборка и упаковка открытых блоков (Тесты Задачи 3.2 + 3.5)', { timeout: 30000 }, () => {
  // ---------------------------------------------------------------------------
  // Тест 1 (Неприкосновенность approved блоков)
  // ---------------------------------------------------------------------------
  it('Тест 1: approved блок попадает в locked_fields, исключается из open_fields и защищён от перезаписи', async () => {
    const userId = await createUser(db.sql, { name: 'Алексей Смирнов' });
    const projectId = await db.store.ensureProject(userId);

    // Записываем утверждённое (approved) поле 3/problem_description
    const originalProblem = 'Исходное утверждённое описание проблемы студентов с поиском попутчиков.';
    const recordId = await db.store.upsertField(projectId, 3, 'problem_description', originalProblem);
    await db.sql.query(`UPDATE project_passport_records SET review_status = 'approved' WHERE id = $1::uuid`, [recordId]);

    // И записываем draft поле 3/target_audience
    await db.store.upsertField(projectId, 3, 'target_audience', 'Студенты вузов');

    let capturedExtractInput: any = null;
    const llm = new FakeLlm({
      extract: (input: any) => {
        capturedExtractInput = input;
        // Модель пытается перезаписать утверждённый блок и заполнить открытый блок
        return {
          fields: [
            {
              section_id: 3,
              field_key: 'problem_description',
              value: 'ЗЛОНАМЕРЕННАЯ ПОПЫТКА ПЕРЕЗАПИСАТЬ APPROVED БЛОК',
              claims: [],
            },
            {
              section_id: 3,
              field_key: 'target_audience',
              value: 'Студенты очной формы обучения технических вузов',
              claims: [
                {
                  claim_text: 'Студенты очной формы обучения технических вузов',
                  claim_type: 'client_statement',
                  claim_kind: 'paragraph',
                  source_id: null,
                  source_locator: null,
                  confidence: 0.9,
                },
              ],
            },
          ],
        };
      },
    });

    const deps = makeDeps(db, llm);
    await extractPassport(deps, projectId, 'Студенческий стартап', 'Новый бриф пользователя', []);

    // 1. Проверяем входной payload LLM:
    expect(capturedExtractInput).not.toBeNull();
    // locked_fields содержит problem_description
    const lockedProblem = capturedExtractInput.locked_fields.find(
      (f: any) => f.section_id === 3 && f.field_key === 'problem_description',
    );
    expect(lockedProblem).toBeDefined();
    expect(lockedProblem.value).toBe(originalProblem);

    // open_fields (fields) НЕ содержит problem_description
    const openProblem = capturedExtractInput.fields.find(
      (f: any) => f.section_id === 3 && f.field_key === 'problem_description',
    );
    expect(openProblem).toBeUndefined();

    // 2. Проверяем состояние БД:
    const { rows: problemRows } = await db.sql.query(
      `SELECT value, review_status::text AS status FROM project_passport_records WHERE id = $1::uuid`,
      [recordId],
    );
    expect(problemRows[0].value).toBe(originalProblem);
    expect(problemRows[0].status).toBe('approved');

    // Открытый блок обновился
    const { rows: audienceRows } = await db.sql.query(
      `SELECT value FROM project_passport_records WHERE project_id = $1::uuid AND section_id = 3 AND field_key = 'target_audience'`,
      [projectId],
    );
    expect(audienceRows[0].value).toBe('Студенты очной формы обучения технических вузов');

    // 3. Проверяем случай, когда ВСЕ блоки approved — мгновенный выход без вызова LLM
    const callsBefore = llm.calls.length;
    // Одобряем абсолютно все поля секций 2-10
    for (const s of PASSPORT_SECTIONS) {
      for (const f of s.fields) {
        await db.store.upsertField(projectId, s.id, f, `Approved val for ${f}`);
      }
    }
    await db.sql.query(`UPDATE project_passport_records SET review_status = 'approved' WHERE project_id = $1::uuid`, [projectId]);

    await extractPassport(deps, projectId, 'Студенческий стартап', 'Ещё один текст', []);
    expect(llm.calls.length).toBe(callsBefore); // LLM не вызывалась!
  });

  // ---------------------------------------------------------------------------
  // Тест 2 (Подключение RAG к extractPassport)
  // ---------------------------------------------------------------------------
  it('Тест 2: при вызове extractPassport формируется и передаётся непустой rag_context', async () => {
    const userId = await createUser(db.sql, { name: 'Елена Васильева' });
    const projectId = await db.store.ensureProject(userId);

    let capturedRagContext: string | undefined;
    const llm = new FakeLlm({
      extract: (input: any) => {
        capturedRagContext = input.rag_context;
        return { fields: [] };
      },
    });

    const deps = makeDeps(db, llm);
    await extractPassport(
      deps,
      projectId,
      'Студенческий стартап',
      'Разработка ИИ-ассистента корпоративных знаний. Технологический вызов № 54',
      [],
    );

    expect(capturedRagContext).toBeDefined();
    expect(typeof capturedRagContext).toBe('string');
    // В базе RAG есть 419 карточек, поэтому контекст для assembly не пустой
    expect(capturedRagContext!.length).toBeGreaterThan(0);
    expect(capturedRagContext).toContain('### Карточка');
  }, 30000);

  // ---------------------------------------------------------------------------
  // Тест 3 (Упаковка submit_form через LLM + Fallback)
  // ---------------------------------------------------------------------------
  it('Тест 3: submit_form упаковывает текстовые поля через LLM с claims и спанами, а смету сохраняет напрямую', async () => {
    const userId = await createUser(db.sql, { name: 'Дмитрий Николаев' });
    let extractCalled = false;

    const packagedText = 'Разработка интеллектуального ассистента для корпоративных баз знаний';
    const planText = 'В 2027 году запланировано проведение пилотных испытаний в двух IT-компаниях';
    const combinedValue = `${packagedText}. ${planText}.`;

    const llm = new FakeLlm({
      extract: (input: any) => {
        extractCalled = true;
        // Проверяем, что form_inputs переданы в input
        expect(input.form_inputs).toBeDefined();
        expect(input.form_inputs.length).toBeGreaterThan(0);

        return {
          fields: [
            {
              section_id: 4,
              field_key: 'product_summary',
              value: combinedValue,
              claims: [
                {
                  claim_text: packagedText,
                  claim_type: 'client_statement',
                  claim_kind: 'sentence',
                  source_id: null,
                  source_locator: null,
                  confidence: 0.9,
                },
                {
                  claim_text: planText,
                  claim_type: 'plan',
                  claim_kind: 'sentence',
                  source_id: null,
                  source_locator: null,
                  confidence: 0.95,
                },
              ],
            },
          ],
        };
      },
    });

    const deps = makeDeps(db, llm);

    const formReq: PipelineRequest = {
      user_id: userId,
      action: 'submit_form',
      program: 'Студенческий стартап',
      eligibility: PASSING_ELIGIBILITY,
      form: [
        {
          section_id: 4,
          field_key: 'product_summary',
          value: 'Делаем ИИ бота. В 2027 году проведем пилот.',
        },
      ],
      budget_items: SAMPLE_BUDGET,
    };

    const res = await handlePipeline(deps, formReq);
    expect(extractCalled).toBe(true);
    expect(res.status).not.toBe('ERROR');

    // Проверяем сохранённое поле и claims
    const { rows: recRows } = await db.sql.query(
      `SELECT r.id, r.value, json_agg(c.*) AS claims
         FROM project_passport_records r
         JOIN app_projects p ON p.id = r.project_id
         LEFT JOIN project_claims c ON c.record_id = r.id
        WHERE p.user_id = $1::uuid AND r.section_id = 4 AND r.field_key = 'product_summary'
        GROUP BY r.id, r.value`,
      [userId],
    );
    expect(recRows.length).toBe(1);
    expect(recRows[0].value).toBe(combinedValue);

    const claims = recRows[0].claims;
    expect(claims.length).toBe(2);

    const planClaim = claims.find((c: any) => c.claim_type === 'plan');
    expect(planClaim).toBeDefined();
    expect(planClaim.claim_text).toBe(planText);
    expect(typeof planClaim.span_start).toBe('number');
    expect(typeof planClaim.span_end).toBe('number');
    expect(combinedValue.slice(planClaim.span_start, planClaim.span_end)).toBe(planText);

    // Проверяем, что смета сохранилась напрямую
    const { rows: budgetRows } = await db.sql.query(
      `SELECT COUNT(*)::int AS cnt FROM project_budget_items b
         JOIN app_projects p ON p.id = b.project_id
        WHERE p.user_id = $1::uuid`,
      [userId],
    );
    expect(budgetRows[0].cnt).toBe(SAMPLE_BUDGET.length);

    // Проверяем Fallback: если LLM вернула пустой список полей, сохраняется исходное значение
    const fallbackUserId = await createUser(db.sql, { name: 'Ольга Федорова' });
    const llmEmpty = new FakeLlm({
      extract: () => ({ fields: [] }),
    });
    const depsEmpty = makeDeps(db, llmEmpty);

    const fallbackReq: PipelineRequest = {
      user_id: fallbackUserId,
      action: 'submit_form',
      program: 'Студенческий стартап',
      eligibility: PASSING_ELIGIBILITY,
      form: [
        {
          section_id: 3,
          field_key: 'problem_description',
          value: 'Студенты тратят до 3 часов на подготовку документов вручную.',
        },
      ],
    };

    const fbRes = await handlePipeline(depsEmpty, fallbackReq);
    expect(fbRes.status).not.toBe('ERROR');
    const { rows: fbRows } = await db.sql.query(
      `SELECT r.value FROM project_passport_records r
         JOIN app_projects p ON p.id = r.project_id
        WHERE p.user_id = $1::uuid AND r.section_id = 3 AND r.field_key = 'problem_description'`,
      [fallbackUserId],
    );
    expect(fbRows[0].value).toBe('Студенты тратят до 3 часов на подготовку документов вручную.');
  }, 30000);

  // ---------------------------------------------------------------------------
  // Тест 4 (Автоподбор tech_challenge и защита направления)
  // ---------------------------------------------------------------------------
  it('Тест 4: вызов сохраняется только при совпадении с направлением, а для чужого направления и Н7 отсекается', async () => {
    const userId = await createUser(db.sql, { name: 'Сергей Кузнецов' });
    const projectId = await db.store.ensureProject(userId);

    // 4a. Направление Н1 + вызов № 54 (ООО «Вебпрактик» — направление Н1) -> сохраняется
    const llmValid = new FakeLlm({
      extract: () => ({
        fields: [
          { section_id: 4, field_key: 'direction', value: 'Н1', claims: [] },
          { section_id: 4, field_key: 'tech_challenge', value: '54', claims: [] },
        ],
      }),
    });
    await extractPassport(makeDeps(db, llmValid), projectId, 'Студенческий стартап', 'Бриф Н1', []);

    const { rows: validRows } = await db.sql.query(
      `SELECT field_key, value FROM project_passport_records WHERE project_id = $1::uuid AND section_id = 4 AND field_key IN ('direction', 'tech_challenge')`,
      [projectId],
    );
    const validMap = Object.fromEntries(validRows.map((r: any) => [r.field_key, r.value]));
    expect(validMap['direction']).toBe('Н1');
    expect(validMap['tech_challenge']).toBe('54');

    // 4b. Направление Н2, но модель вернула вызов № 54 (который относится к Н1) -> отсекается
    const user2 = await createUser(db.sql, { name: 'Игорь Орлов' });
    const proj2 = await db.store.ensureProject(user2);

    const llmMismatch = new FakeLlm({
      extract: () => ({
        fields: [
          { section_id: 4, field_key: 'direction', value: 'Н2', claims: [] },
          { section_id: 4, field_key: 'tech_challenge', value: '54', claims: [] }, // Вызов от Н1!
        ],
      }),
    });
    await extractPassport(makeDeps(db, llmMismatch), proj2, 'Студенческий стартап', 'Бриф Н2', []);

    const { rows: mismatchRows } = await db.sql.query(
      `SELECT field_key, value FROM project_passport_records WHERE project_id = $1::uuid AND section_id = 4 AND field_key IN ('direction', 'tech_challenge')`,
      [proj2],
    );
    const mismatchMap = Object.fromEntries(mismatchRows.map((r: any) => [r.field_key, r.value]));
    expect(mismatchMap['direction']).toBe('Н2');
    expect(mismatchMap['tech_challenge']).toBeUndefined(); // Не сохранён!

    // 4c. Направление Н7 (биотех / креативные индустрии, в TechLead8 нет вызовов для Н7) -> отсекается
    const user3 = await createUser(db.sql, { name: 'Мария Павлова' });
    const proj3 = await db.store.ensureProject(user3);

    const llmN7 = new FakeLlm({
      extract: () => ({
        fields: [
          { section_id: 4, field_key: 'direction', value: 'Н7', claims: [] },
          { section_id: 4, field_key: 'tech_challenge', value: '1', claims: [] },
        ],
      }),
    });
    await extractPassport(makeDeps(db, llmN7), proj3, 'Студенческий стартап', 'Бриф Н7', []);

    const { rows: n7Rows } = await db.sql.query(
      `SELECT field_key, value FROM project_passport_records WHERE project_id = $1::uuid AND section_id = 4 AND field_key IN ('direction', 'tech_challenge')`,
      [proj3],
    );
    const n7Map = Object.fromEntries(n7Rows.map((r: any) => [r.field_key, r.value]));
    expect(n7Map['direction']).toBe('Н7');
    expect(n7Map['tech_challenge']).toBeUndefined(); // Не сохранён для Н7!
  }, 30000);
});
