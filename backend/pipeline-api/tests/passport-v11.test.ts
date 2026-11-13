// v1.1, блок 1: анкета допуска (1.1), поля КП и направления (1.2), смета (1.3), приём формы (1.4), связи блоков (1.5).
import { beforeAll, describe, expect, it } from 'vitest';
import type { PipelineRequest } from '@passport/contracts';
import { handlePipeline } from '../src/pipeline/handler';
import { FakeLlm } from '../src/llm/fake';
import { PASSPORT_SECTIONS } from '@passport/contracts';
import { createTestDb, createUser, makeDeps, type TestDb } from './helpers';

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
  { stage: 1 as const, category: 'other' as const, title: 'Консультации', quantity: 1, unit_price: 20000, amount: 20000, justification: 'Консультации' },
  { stage: 2 as const, category: 'contractor' as const, title: 'Разработка интерфейса', quantity: 1, unit_price: 250000, amount: 250000, justification: 'Подрядчик' },
  { stage: 2 as const, category: 'equipment' as const, title: 'Ноутбук', quantity: 2, unit_price: 100000, amount: 200000, justification: 'Техника' },
  { stage: 2 as const, category: 'salary' as const, title: 'Зарплата разработчика', quantity: 10, unit_price: 50000, amount: 500000, justification: 'Разработка' },
  { stage: 2 as const, category: 'other' as const, title: 'Хостинг и сервисы', quantity: 1, unit_price: 30000, amount: 30000, justification: 'Инфраструктура' },
];

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

const recordOf = async (userId: string, sectionId: number, fieldKey: string) => {
  const { rows } = await db.sql.query(
    `SELECT r.value, r.review_status::text AS review_status FROM project_passport_records r
       JOIN app_projects p ON p.id = r.project_id
      WHERE p.user_id = $1::uuid AND r.section_id = $2 AND r.field_key = $3`,
    [userId, sectionId, fieldKey],
  );
  return rows[0] as { value: string; review_status: string } | undefined;
};

/** Полный проход: бриф с извлечением всех полей, смета уже сохранена. */
async function completeProject(userId: string) {
  const llm = new FakeLlm({ extract: fullExtraction, novelty: () => ({ analogues_count: 2, analogues_list: ['А', 'Б'], has_measurable_comparison: true, missing_details_question: null }) });
  const deps = makeDeps(db, llm);
  const seeded = await handlePipeline(deps, req(userId, { action: 'submit_form', budget_items: VALID_BUDGET }));
  expect(seeded).toMatchObject({ status: 'WAITING_FOR_INITIAL_BRIEF' });
  const res = await handlePipeline(deps, req(userId, { text_input: BRIEF }));
  expect(res.status).toBe('COMPLETED');
  return deps;
}

describe('1.1 анкета допуска', () => {
  it('без ответов — ELIGIBILITY_REQUIRED со всеми вопросами, проект не создаётся', async () => {
    const userId = await createUser(db.sql);
    const res = await handlePipeline(makeDeps(db), { user_id: userId, action: 'init_or_upload', program: 'Студенческий стартап', text_input: BRIEF });
    expect(res).toMatchObject({ status: 'ELIGIBILITY_REQUIRED' });
    if (res.status === 'ELIGIBILITY_REQUIRED') expect(res.questions.map((q) => q.key)).toContain('has_prior_student_startup_grant');
    const { rows } = await db.sql.query('SELECT 1 FROM app_projects WHERE user_id = $1::uuid', [userId]);
    expect(rows.length).toBe(0);
  });

  it('нарушенный пункт — REJECTED с причиной и способом исправления, статус проекта rejected', async () => {
    const userId = await createUser(db.sql);
    const deps = makeDeps(db);
    const res = await handlePipeline(
      deps,
      req(userId, { text_input: BRIEF, eligibility: { ...PASSING, has_prior_student_startup_grant: true } }),
    );
    expect(res.status).toBe('REJECTED');
    if (res.status !== 'REJECTED') return;
    expect(res.reasons).toHaveLength(1);
    expect(res.reasons[0]).toMatchObject({ key: 'has_prior_student_startup_grant' });
    expect(res.reasons[0]!.how_to_fix.length).toBeGreaterThan(0);

    const { rows } = await db.sql.query('SELECT status FROM app_projects WHERE user_id = $1::uuid', [userId]);
    expect(rows[0].status).toBe('rejected');
  });

  it('отказ финальный: повторный запрос с «правильной» анкетой получает тот же REJECTED', async () => {
    const userId = await createUser(db.sql);
    const deps = makeDeps(db);
    await handlePipeline(deps, req(userId, { text_input: BRIEF, eligibility: { ...PASSING, ready_to_open_llc_after_win: false } }));
    const again = await handlePipeline(deps, req(userId, { text_input: BRIEF }));
    expect(again.status).toBe('REJECTED');
    const { rows } = await db.sql.query('SELECT COUNT(*)::int AS n FROM project_passport_records r JOIN app_projects p ON p.id = r.project_id WHERE p.user_id = $1::uuid', [userId]);
    expect(rows[0].n).toBe(0);
  });
});

describe('ФИО в ключе full_name (исправление name / full_name)', () => {
  it('профиль с ключом full_name проходит проверку ФИО', async () => {
    const userId = await createUser(db.sql, { name: '' });
    await db.sql.query(`UPDATE app_profiles SET founder_data = '{"full_name": "Петрова Мария"}'::jsonb WHERE id = $1::uuid`, [userId]);
    const res = await handlePipeline(makeDeps(db), req(userId, { text_input: BRIEF }));
    expect(res.status).not.toBe('ERROR'); // ФИО найдено: пайплайн пошёл дальше
    const founder = await db.sql.query('SELECT founder_data->>\'full_name\' AS n FROM app_profiles WHERE id = $1::uuid', [userId]);
    expect(founder.rows[0].n).toBe('Петрова Мария');
  });

  it('пустое ФИО (ни full_name, ни name) — FOUNDER_REQUIRED', async () => {
    const userId = await createUser(db.sql, { name: '' });
    const res = await handlePipeline(makeDeps(db), req(userId, { text_input: BRIEF }));
    expect(res).toMatchObject({ status: 'ERROR', code: 'FOUNDER_REQUIRED' });
  });
});

describe('1.2 / 1.4 приём формы', () => {
  it('полная форма без файлов: поля сохраняются как утверждения клиента и ведут к следующему пробелу', async () => {
    const userId = await createUser(db.sql);
    const deps = makeDeps(db, new FakeLlm());
    const res = await handlePipeline(
      deps,
      req(userId, {
        action: 'submit_form',
        form: [
          { section_id: 3, field_key: 'problem_description', value: 'Студенты тратят до двух часов в неделю на поиск попутчиков в чатах.' },
          { section_id: 4, field_key: 'direction', value: 'Н1' },
          { section_id: 4, field_key: 'tech_challenge', value: '001' },
        ],
      }),
    );
    expect(res.status).toBe('NEED_USER_INPUT');
    const field = await recordOf(userId, 3, 'problem_description');
    expect(field?.review_status).toBe('ai_generated');
    expect((await recordOf(userId, 4, 'tech_challenge'))?.value).toBe('1'); // «001» нормализуется в «1»
  });

  it('неверное направление — INVALID_FIELD_VALUE, ни одно поле не сохраняется', async () => {
    const userId = await createUser(db.sql);
    const deps = makeDeps(db);
    const res = await handlePipeline(
      deps,
      req(userId, {
        action: 'submit_form',
        form: [
          { section_id: 3, field_key: 'problem_description', value: 'Проблема студентов с поиском попутчиков в чатах каждую неделю.' },
          { section_id: 4, field_key: 'direction', value: 'Н9' },
        ],
      }),
    );
    expect(res).toMatchObject({ status: 'ERROR', code: 'INVALID_FIELD_VALUE' });
    expect(await recordOf(userId, 3, 'problem_description')).toBeUndefined();
  });

  it('номер вызова вне перечня 1–357 отклоняется', async () => {
    const userId = await createUser(db.sql);
    const res = await handlePipeline(
      makeDeps(db),
      req(userId, { action: 'submit_form', form: [{ section_id: 4, field_key: 'tech_challenge', value: '358' }] }),
    );
    expect(res).toMatchObject({ status: 'ERROR', code: 'INVALID_FIELD_VALUE' });
  });

  it('неизвестное поле отклоняется', async () => {
    const userId = await createUser(db.sql);
    const res = await handlePipeline(
      makeDeps(db),
      req(userId, { action: 'submit_form', form: [{ section_id: 3, field_key: 'не_поле', value: 'что-то' }] }),
    );
    expect(res).toMatchObject({ status: 'ERROR', code: 'INVALID_FIELD_VALUE' });
  });

  it('пустое значение в форме не очищает поле (точечная правка)', async () => {
    const userId = await createUser(db.sql);
    const deps = makeDeps(db);
    await handlePipeline(deps, req(userId, { action: 'submit_form', form: [{ section_id: 3, field_key: 'target_audience', value: 'Студенты очных программ вузов Самары, живущие в общежитиях.' }] }));
    await handlePipeline(deps, req(userId, { action: 'submit_form', form: [{ section_id: 3, field_key: 'target_audience', value: '   ' }] }));
    expect((await recordOf(userId, 3, 'target_audience'))?.value).toContain('Студенты очных программ');
  });

  it('неверное направление из извлечения LLM пропускается, поле остаётся пробелом', async () => {
    const userId = await createUser(db.sql);
    const llm = new FakeLlm({
      extract: (input: any) => {
        const out = fullExtraction(input);
        return { fields: out.fields.map((f) => (f.field_key === 'direction' ? { ...f, value: 'Н42' } : f)) };
      },
    });
    const res = await handlePipeline(makeDeps(db, llm), req(userId, { text_input: BRIEF }));
    expect(res).toMatchObject({ status: 'NEED_USER_INPUT', target_field: { section_id: 4, field_key: 'direction' } });
  });
});

describe('технологический вызов необязателен (решение владельца)', () => {
  it('без вызова пробелом он не становится, паспорт доходит до финализации', async () => {
    const userId = await createUser(db.sql);
    const llm = new FakeLlm({
      extract: (input: any) => {
        const out = fullExtraction(input);
        return { fields: out.fields.filter((f) => f.field_key !== 'tech_challenge') };
      },
    });
    const res = await handlePipeline(makeDeps(db, llm), req(userId, { text_input: BRIEF }));
    expect(res.status).toBe('COMPLETED');
    if (res.status === 'COMPLETED') {
      expect(res.checklist.join(' ')).not.toContain('технологического вызова');
    }
  });
});

describe('1.3 смета в финализации', () => {
  it('арифметика сметы не сходится — паспорт получает стоп-фактор «Смета»', async () => {
    const userId = await createUser(db.sql);
    const deps = await completeProject(userId);
    const broken = VALID_BUDGET.map((b, i) => (i === 2 ? { ...b, amount: 150000 } : b));
    const res = await handlePipeline(deps, req(userId, { action: 'submit_form', budget_items: broken }));
    expect(res.status).toBe('COMPLETED');
    if (res.status !== 'COMPLETED') return;
    expect(res.eligibility_status).toBe('NOT_ELIGIBLE');
    expect(res.checklist.join(' ')).toMatch(/Устранить: Смета: Статья «Ноутбук»: количество × цена/);
  });

  it('превышен лимит подрядчиков — стоп-фактор', async () => {
    const userId = await createUser(db.sql);
    const deps = await completeProject(userId);
    const over = VALID_BUDGET.map((b) =>
      b.category === 'contractor' ? { ...b, unit_price: 300000, amount: 300000 } : b,
    );
    // сумма изменилась → не сходится 1 000 000 и лимит подрядчиков; проверяем лимит
    const res = await handlePipeline(deps, req(userId, { action: 'submit_form', budget_items: over }));
    if (res.status !== 'COMPLETED') throw new Error('expected COMPLETED');
    expect(res.checklist.join(' ')).toContain('Работы подрядчиков составляют');
  });

  it('смета не заполнена — стоп-фактор «Смета не заполнена»', async () => {
    const userId = await createUser(db.sql);
    const deps = await completeProject(userId);
    const res = await handlePipeline(deps, req(userId, { action: 'submit_form', budget_items: [] }));
    if (res.status !== 'COMPLETED') throw new Error('expected COMPLETED');
    expect(res.checklist.join(' ')).toContain('Смета не заполнена');
  });

  it('лимиты динамические: новая активная редакция в БД меняет проверку без изменения кода', async () => {
    const userId = await createUser(db.sql);
    const deps = await completeProject(userId);
    // ужесточаем лимит подрядчиков до 100 000 ₽ (активная редакция)
    await db.sql.query('UPDATE budget_limit_sets SET contractor_total_max = 100000 WHERE is_active');
    try {
      const res = await handlePipeline(deps, req(userId, { action: 'submit_form', budget_items: VALID_BUDGET }));
      if (res.status !== 'COMPLETED') throw new Error('expected COMPLETED');
      expect(res.checklist.join(' ')).toContain('Работы подрядчиков составляют 250 000 ₽, лимит — 100 000 ₽');
    } finally {
      await db.sql.query('UPDATE budget_limit_sets SET contractor_total_max = 250000 WHERE is_active');
    }
  });

  it('категория «ИС и помещения» принимается и сохраняется', async () => {
    const userId = await createUser(db.sql);
    const deps = await completeProject(userId);
    const items = [...VALID_BUDGET.slice(0, 4), { stage: 2 as const, category: 'ip_and_premises' as const, title: 'Лицензия на РИД', quantity: 1, unit_price: 30000, amount: 30000, justification: 'Лицензия по теме проекта' }];
    const res = await handlePipeline(deps, req(userId, { action: 'submit_form', budget_items: items }));
    expect(res.status).toBe('COMPLETED');
    const { rows } = await db.sql.query(
      `SELECT COUNT(*)::int AS n FROM project_budget_items b JOIN app_projects p ON p.id = b.project_id
        WHERE p.user_id = $1::uuid AND b.category = 'ip_and_premises'`,
      [userId],
    );
    expect(rows[0].n).toBe(1);
  });

  it('корректная смета и согласованные направление и вызов — стоп-факторов по ним нет', async () => {
    const userId = await createUser(db.sql);
    const deps = await completeProject(userId);
    const res = await handlePipeline(deps, req(userId, { action: 'submit_form', budget_items: VALID_BUDGET }));
    if (res.status !== 'COMPLETED') throw new Error('expected COMPLETED');
    expect(res.eligibility_status).not.toBe('NOT_ELIGIBLE');
  });

  it('направление не совпадает с направлением вызова — стоп-фактор', async () => {
    const userId = await createUser(db.sql);
    const deps = await completeProject(userId);
    // вызов № 1 относится к Н1; меняем направление на Н2 вручную
    await handlePipeline(deps, req(userId, { action: 'submit_form', form: [{ section_id: 4, field_key: 'direction', value: 'Н2' }] }));
    const res = await handlePipeline(deps, req(userId, { action: 'submit_form', budget_items: VALID_BUDGET }));
    if (res.status !== 'COMPLETED') throw new Error('expected COMPLETED');
    expect(res.checklist.join(' ')).toContain('относится к направлению Н1, а выбрано Н2');
  });
});

describe('1.5 связанные блоки: «разморозка»', () => {
  it('изменение блока 2 снимает одобрение с блоков 5 и 9, но не трогает блок 3', async () => {
    const userId = await createUser(db.sql);
    const deps = await completeProject(userId);
    // одобряем нужные поля
    await db.sql.query(
      `UPDATE project_passport_records r SET review_status = 'approved' FROM app_projects p
        WHERE p.id = r.project_id AND p.user_id = $1::uuid AND r.section_id IN (3, 5, 9)`,
      [userId],
    );

    const res = await handlePipeline(deps, req(userId, { action: 'submit_form', form: [{ section_id: 2, field_key: 'team_members', value: 'Иван, Мария и новый разработчик Олег: backend, продукт и дизайн сервиса помощи студентам с поиском попутчиков.' }] }));
    expect(res).toMatchObject({ status: 'NEED_USER_INPUT', target_field: { section_id: 5 } });

    expect((await recordOf(userId, 5, 'current_stage'))?.review_status).toBe('needs_review');
    expect((await recordOf(userId, 9, 'rid_certificates'))?.review_status).toBe('needs_review');
    expect((await recordOf(userId, 3, 'problem_description'))?.review_status).toBe('approved');
  });

  it('замена сметы: новые строки получают статус draft, пометка «связанные блоки изменились» не ставится', async () => {
    const userId = await createUser(db.sql);
    const deps = await completeProject(userId);
    await db.sql.query(
      `UPDATE project_budget_items b SET review_status = 'approved' FROM app_projects p
        WHERE p.id = b.project_id AND p.user_id = $1::uuid`,
      [userId],
    );
    const changed = VALID_BUDGET.map((b) => (b.category === 'other' && b.stage === 2 ? { ...b, title: 'Хостинг и сервисы (уточнено)' } : b));
    const res = await handlePipeline(deps, req(userId, { action: 'submit_form', budget_items: changed }));
    expect(res.status).toBe('COMPLETED');
    if (res.status !== 'COMPLETED') return;
    // смета заменена заново: строки свежие (draft) — пометка «связанные блоки изменились» не нужна
    expect(res.checklist.join(' ')).not.toContain('связанные блоки изменились');
  });

  it('смена блока 5 при одобренной смете: смета помечается, на финализации — стоп-фактор', async () => {
    const userId = await createUser(db.sql);
    const deps = await completeProject(userId);
    await db.sql.query(
      `UPDATE project_budget_items b SET review_status = 'approved' FROM app_projects p
        WHERE p.id = b.project_id AND p.user_id = $1::uuid`,
      [userId],
    );
    const res = await handlePipeline(deps, req(userId, { action: 'submit_form', form: [{ section_id: 5, field_key: 'calendar_plan_stage_1', value: 'Месяц 1: интервью со студентами о поиске попутчиков и правка прототипа сервиса помощи студентам.' }] }));
    // Блок 5 изменён сам (не помечается). Его зависимые: смета (одобрена → на проверку) и блок 2 (не одобрен — без пометки).
    // Пробелов нет, значит проходим до финализации.
    expect(res.status).toBe('COMPLETED');
    if (res.status !== 'COMPLETED') return;
    expect(res.checklist.join(' ')).toContain('связанные блоки изменились');
    expect(res.eligibility_status).toBe('NOT_ELIGIBLE');
  });
});

describe('карта зависимостей и калькулятор — проверка связей в данных', () => {
  it('блок 2 из пайплайна передаёт пометку на смету в БД (budget_items → needs_review)', async () => {
    const userId = await createUser(db.sql);
    const deps = await completeProject(userId);
    await db.sql.query(
      `UPDATE project_budget_items b SET review_status = 'approved' FROM app_projects p
        WHERE p.id = b.project_id AND p.user_id = $1::uuid`,
      [userId],
    );
    await handlePipeline(deps, req(userId, { action: 'submit_form', form: [{ section_id: 2, field_key: 'competencies_and_experience', value: 'Опыт: два года разработки сервиса помощи студентам с поиском попутчиков на React и Node.js.' }] }));
    const { rows } = await db.sql.query(
      `SELECT DISTINCT b.review_status::text AS s FROM project_budget_items b JOIN app_projects p ON p.id = b.project_id WHERE p.user_id = $1::uuid`,
      [userId],
    );
    expect(rows.map((r) => r.s)).toEqual(['needs_review']);
  });
});
