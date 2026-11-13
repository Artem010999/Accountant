import { beforeAll, describe, expect, it } from 'vitest';
import type { PipelineRequest } from '@passport/contracts';
import { PASSPORT_SECTIONS } from '@passport/contracts';
import { handlePipeline } from '../src/pipeline/handler';
import { auditPassport } from '../src/pipeline/audit';
import { FakeLlm } from '../src/llm/fake';
import { createTestDb, createUser, makeDeps, type TestDb } from './helpers';

const PASSING_ELIGIBILITY = {
  is_student_or_postgraduate: true,
  has_open_fsi_contracts_or_applications: false,
  has_prior_student_startup_grant: false,
  ready_to_open_llc_after_win: true,
};

const VALID_BUDGET = [
  { stage: 1 as const, category: 'other' as const, title: 'Консультации', quantity: 1, unit_price: 20000, amount: 20000, justification: 'Консультационные услуги' },
  { stage: 2 as const, category: 'contractor' as const, title: 'Лабораторные испытания', quantity: 1, unit_price: 250000, amount: 250000, justification: 'Испытания' },
  { stage: 2 as const, category: 'equipment' as const, title: 'Осциллограф', quantity: 1, unit_price: 150000, amount: 150000, justification: 'Оборудование' },
  { stage: 2 as const, category: 'salary' as const, title: 'Разработчик', quantity: 10, unit_price: 55000, amount: 550000, justification: 'Оплата труда' },
  { stage: 2 as const, category: 'other' as const, title: 'Хостинг и домен', quantity: 1, unit_price: 30000, amount: 30000, justification: 'Серверы' },
];

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  await db.sql.query('UPDATE app_settings SET guard_threshold_block = 0.05, guard_threshold_warn = 0.1 WHERE id = 1');
});

describe('Этап 4: Комплексный аудит на Kimi, дельта-реаудит и детерминированная финализация', { timeout: 30000 }, () => {
  // ---------------------------------------------------------------------------
  // Тест 1: Первичный Аудит (Шаг 6) и замки
  // ---------------------------------------------------------------------------
  it('Тест 1: Первичный Аудит (Шаг 6) и замки (чистый блок получает approved 🔒, проблемный — needs_review ✏️ с remark и how_to_fix)', async () => {
    const userId = await createUser(db.sql, { name: 'Елена Кузнецова' });
    const projectId = await db.store.ensureProject(userId);

    // Заполняем Блок 3 (чистый) и Блок 6 (проблемный)
    await db.store.upsertField(projectId, 3, 'problem_description', 'Студенты очных отделений тратят до 3 часов на поиск попутчиков.');
    await db.store.upsertField(projectId, 3, 'target_audience', 'Студенты вузов РФ очной формы обучения.');
    await db.store.upsertField(projectId, 6, 'analogues_comparison', 'Аналогов нет, наш сервис уникален и дешевле всех.');
    await db.store.upsertField(projectId, 6, 'novelty_hypothesis', 'Гипотеза новизны заключается в оригинальном подходе.');
    await db.store.upsertField(projectId, 6, 'verification_protocol', 'Протокол тестирования с пользователями.');

    const expertRemark =
      '[Критерий: Научно-техническая новизна] Утверждение об отсутствии аналогов недопустимо для ФСИ. [Ошибка] Любая разработка имеет прямые или функциональные аналоги. [Как исправить] Приведите минимум 2 конкретных аналога и опишите измеримые отличия по алгоритму или метрикам.';
    const expertHowToFix = 'Укажите минимум 2 прямых аналога и заполните сравнительную таблицу с измеримыми характеристиками.';

    const llm = new FakeLlm({
      audit: (input: any) => ({
        fatal_stop_factors: [],
        block_audits: [
          {
            section_id: 3,
            status: 'approved',
            remark: null,
            how_to_fix: null,
            failed_fields: [],
          },
          {
            section_id: 6,
            status: 'needs_revision',
            remark: expertRemark,
            how_to_fix: expertHowToFix,
            failed_fields: ['analogues_comparison'],
          },
        ],
        budget_audit: {
          status: 'not_provided',
          remark: null,
          how_to_fix: null,
        },
      }),
    });

    const deps = makeDeps(db, llm);
    const report = await auditPassport(deps, projectId);

    expect(report.mode).toBe('primary_audit');

    const audit3 = report.block_audits.find((b) => b.section_id === 3);
    const audit6 = report.block_audits.find((b) => b.section_id === 6);

    expect(audit3?.status).toBe('approved');
    expect(audit6?.status).toBe('needs_review');
    expect(audit6?.remark).toBe(expertRemark);
    expect(audit6?.how_to_fix).toBe(expertHowToFix);

    // Проверяем замки в БД
    const records = await db.store.getRecords(projectId);
    const rec3 = records.find((r) => r.section_id === 3 && r.field_key === 'problem_description');
    const rec6 = records.find((r) => r.section_id === 6 && r.field_key === 'analogues_comparison');

    expect(rec3?.review_status).toBe('approved');
    expect(rec6?.review_status).toBe('needs_review');

    // Проверяем сохранение сводного отчёта в секцию 0
    const rec0 = records.find((r) => r.section_id === 0 && r.field_key === 'latest_audit_report');
    expect(rec0?.value).toBeTruthy();
    const parsedReport = JSON.parse(rec0!.value!);
    expect(parsedReport.mode).toBe('primary_audit');
    expect(parsedReport.block_audits.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // Тест 2: Фатальный стоп-фактор идеи (MILITARY_OR_DUAL_USE или NO_TECH_BASIS)
  // ---------------------------------------------------------------------------
  it('Тест 2: Фатальный стоп-фактор идеи (MILITARY_OR_DUAL_USE → NEED_USER_INPUT с fatal_stop_factors, разморозка 3 и 4, без перманентной блокировки)', async () => {
    const userId = await createUser(db.sql, { name: 'Виктор Борисов' });
    const projectId = await db.store.ensureProject(userId);

    // Записываем блок 2 как утверждённый, чтобы первым пробелом стал размороженный блок 3
    await db.store.upsertField(projectId, 2, 'team_members', 'Иванов Иван — руководитель проекта.');
    await db.store.upsertField(projectId, 2, 'competencies_and_experience', 'Опыт разработки алгоритмов 3 года.');
    await db.store.approveSectionFields(projectId, [2]);

    // Записываем блоки 3 и 4 как approved
    await db.store.upsertField(projectId, 3, 'problem_description', 'Необходимость поражения воздушных целей.');
    await db.store.upsertField(projectId, 4, 'product_summary', 'Разработка боевой системы наведения для БПЛА.');
    await db.sql.query(
      `UPDATE project_passport_records SET review_status = 'approved' WHERE project_id = $1::uuid AND section_id IN (3, 4)`,
      [projectId],
    );

    const fatalReason = 'Проект имеет явное военное назначение (система наведения для БПЛА-камикадзе). Конкурс «Студенческий стартап» финансирует исключительно гражданские технологии.';
    const fatalFix = 'Переформулируйте тематику проекта в сугубо гражданскую область, например, разработку оптической системы ориентации БПЛА для мониторинга лесных пожаров или ЛЭП.';

    const llm = new FakeLlm({
      audit: () => ({
        fatal_stop_factors: [
          {
            code: 'MILITARY_OR_DUAL_USE',
            reason: fatalReason,
            how_to_fix: fatalFix,
            affected_sections: [3, 4],
          },
        ],
        block_audits: [
          {
            section_id: 3,
            status: 'needs_revision',
            remark: `[Фатальный стоп-фактор: MILITARY_OR_DUAL_USE] ${fatalReason}`,
            how_to_fix: fatalFix,
            failed_fields: ['problem_description'],
          },
          {
            section_id: 4,
            status: 'needs_revision',
            remark: `[Фатальный стоп-фактор: MILITARY_OR_DUAL_USE] ${fatalReason}`,
            how_to_fix: fatalFix,
            failed_fields: ['product_summary'],
          },
        ],
        budget_audit: {
          status: 'not_provided',
          remark: null,
          how_to_fix: null,
        },
      }),
    });

    const deps = makeDeps(db, llm);
    const report = await auditPassport(deps, projectId);

    expect(report.fatal_stop_factors.length).toBe(1);
    expect(report.fatal_stop_factors[0].code).toBe('MILITARY_OR_DUAL_USE');
    expect(report.fatal_stop_factors[0].reason).toBe(fatalReason);

    // Проверяем, что блоки 3 и 4 принудительно разморожены в БД
    const records = await db.store.getRecords(projectId);
    const rec3 = records.find((r) => r.section_id === 3 && r.field_key === 'problem_description');
    const rec4 = records.find((r) => r.section_id === 4 && r.field_key === 'product_summary');

    expect(rec3?.review_status).toBe('needs_review');
    expect(rec4?.review_status).toBe('needs_review');

    // Проверяем, что через пайплайн проект не блокируется (не BLOCKED_PROJECT_SWAP), а возвращает статус с вопросом доработки
    const res = await handlePipeline(deps, {
      user_id: userId,
      action: 'init_or_upload',
      program: 'Студенческий стартап',
      eligibility: PASSING_ELIGIBILITY,
      text_input: 'Уточнение гражданского назначения проекта',
    });

    expect(res.status).toBe('NEED_USER_INPUT');
    if (res.status === 'NEED_USER_INPUT' && res.target_field) {
      expect(res.fatal_stop_factors?.length).toBe(1);
      expect(res.fatal_stop_factors?.[0].code).toBe('MILITARY_OR_DUAL_USE');
      expect([3, 4]).toContain(res.target_field.section_id);
    }
  });

  // ---------------------------------------------------------------------------
  // Тест 3: Шаг 6.1 (Точечный Ре-аудит) и разморозка
  // ---------------------------------------------------------------------------
  it('Тест 3: Шаг 6.1 (Точечный Ре-аудит) и разморозка (изменение Блока 4 размораживает 5, 6, 9; в open_blocks передаются 4, 5, 6, 9 с delta_reaudit, locked остаются locked)', async () => {
    const userId = await createUser(db.sql, { name: 'Сергей Николаев' });
    const projectId = await db.store.ensureProject(userId);

    // Одобряем все блоки 2–10
    for (const s of PASSPORT_SECTIONS) {
      for (const f of s.fields) {
        const value =
          f === 'direction' ? 'Н1' : f === 'tech_challenge' ? '1' : `Утверждённое значение поля ${f} проекта аналитики.`;
        await db.store.upsertField(projectId, s.id, f, value);
      }
      await db.store.approveSectionFields(projectId, [s.id]);
    }

    let capturedAuditInput: any = null;
    const llm = new FakeLlm({
      audit: (input: any) => {
        capturedAuditInput = input;
        return {
          fatal_stop_factors: [],
          block_audits: (input.open_blocks ?? []).map((b: any) => ({
            section_id: b.section_id,
            status: 'approved',
            remark: null,
            how_to_fix: null,
            failed_fields: [],
          })),
          budget_audit: {
            status: 'approved',
            remark: null,
            how_to_fix: null,
          },
        };
      },
    });

    const deps = makeDeps(db, llm);

    // Пользователь точечно меняет Блок 4 (product_summary) через submit_form
    const res = await handlePipeline(deps, {
      user_id: userId,
      action: 'submit_form',
      program: 'Студенческий стартап',
      eligibility: PASSING_ELIGIBILITY,
      form: [
        {
          section_id: 4,
          field_key: 'product_summary',
          value: 'Создание облачной платформы интеллектуальной аналитики медицинских изображений.',
        },
      ],
    });

    expect(capturedAuditInput).toBeTruthy();
    expect(capturedAuditInput.mode).toBe('delta_reaudit');

    // Блок 4 размораживает зависимые: 5, 6, 9. В open_blocks должны быть 4, 5, 6, 9
    const openSectionIds = capturedAuditInput.open_blocks.map((b: any) => b.section_id);
    expect(openSectionIds).toContain(4);
    expect(openSectionIds).toContain(5);
    expect(openSectionIds).toContain(6);
    expect(openSectionIds).toContain(9);

    // Утверждённые блоки (2, 3, 7, 8, 10) должны быть в locked_blocks
    const lockedSectionIds = capturedAuditInput.locked_blocks.map((b: any) => b.section_id);
    expect(lockedSectionIds).toContain(2);
    expect(lockedSectionIds).toContain(3);
    expect(lockedSectionIds).toContain(7);
    expect(lockedSectionIds).toContain(8);
    expect(lockedSectionIds).toContain(10);

    // Поскольку модель одобрила открытые блоки, они возвращаются в approved
    const records = await db.store.getRecords(projectId);
    const rec4 = records.find((r) => r.section_id === 4 && r.field_key === 'product_summary');
    expect(rec4?.review_status).toBe('approved');
  });

  // ---------------------------------------------------------------------------
  // Тест 4: Смысловая проверка сметы (запрещённая статья расходов)
  // ---------------------------------------------------------------------------
  it('Тест 4: Смысловая проверка сметы (запрещённая статья расходов → needs_revision, помечает строки сметы needs_review)', async () => {
    const userId = await createUser(db.sql, { name: 'Мария Васильева' });
    const projectId = await db.store.ensureProject(userId);

    // Смета с запрещённой статьёй: передача разработки конечного продукта стороннему подрядчику
    const budgetWithForbiddenItem = [
      {
        stage: 1 as const,
        category: 'other' as const,
        title: 'Консультационные услуги',
        quantity: 1,
        unit_price: 20000,
        amount: 20000,
        justification: 'Консультации',
      },
      {
        stage: 2 as const,
        category: 'contractor' as const,
        title: 'Разработка конечного ПО стартапа сторонним подрядчиком',
        quantity: 1,
        unit_price: 250000,
        amount: 250000,
        justification: 'Полная передача разработки мобильного приложения на аутсорс',
      },
      {
        stage: 2 as const,
        category: 'equipment' as const,
        title: 'Рабочая станция',
        quantity: 1,
        unit_price: 150000,
        amount: 150000,
        justification: 'Оборудование',
      },
      {
        stage: 2 as const,
        category: 'salary' as const,
        title: 'Руководитель проекта',
        quantity: 10,
        unit_price: 55000,
        amount: 550000,
        justification: 'Оплата труда',
      },
      {
        stage: 2 as const,
        category: 'other' as const,
        title: 'Серверные мощности',
        quantity: 1,
        unit_price: 30000,
        amount: 30000,
        justification: 'Инфраструктура',
      },
    ];

    await db.store.replaceBudgetItems(projectId, budgetWithForbiddenItem);

    const forbiddenRemark =
      '[Критерий: Смета и обоснованность затрат] Статья «Разработка конечного ПО стартапа сторонним подрядчиком» нарушает правила конкурса. [Ошибка] Передача разработки ключевого конечного продукта подрядчикам прямо запрещена ФСИ. [Как исправить] Перенесите затраты в фонд оплаты труда штатных разработчиков стартапа.';
    const forbiddenFix = 'Исключите передачу разработки ядра системы сторонним организациям, включив разработчиков в состав команды.';

    const llm = new FakeLlm({
      audit: () => ({
        fatal_stop_factors: [],
        block_audits: [],
        budget_audit: {
          status: 'needs_revision',
          remark: forbiddenRemark,
          how_to_fix: forbiddenFix,
        },
      }),
    });

    const deps = makeDeps(db, llm);
    const report = await auditPassport(deps, projectId);

    expect(report.budget_audit.status).toBe('needs_review');
    expect(report.budget_audit.remark).toBe(forbiddenRemark);
    expect(report.budget_audit.how_to_fix).toBe(forbiddenFix);

    // В БД строки сметы должны получить needs_review
    const items = await db.store.getBudgetItems(projectId);
    expect(items.length).toBe(5);
    expect(items.every((it) => it.review_status === 'needs_review')).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Тест 5: Детерминированный Шаг 8 (0 вызовов navigator в LLM)
  // ---------------------------------------------------------------------------
  it('Тест 5: Детерминированный Шаг 8 (0 вызовов navigator в LLM, summary и чек-лист формируются кодом с правилами 8-й очереди и откреплёнными ЭП)', async () => {
    const userId = await createUser(db.sql, { name: 'Дмитрий Соколов' });
    const projectId = await db.store.ensureProject(userId);

    // Заполняем и одобряем все блоки 2–10
    for (const s of PASSPORT_SECTIONS) {
      for (const f of s.fields) {
        const val = f === 'direction' ? 'Н1' : f === 'tech_challenge' ? '1' : `Корректное значение ${f} для системы контроля качества.`;
        await db.store.upsertField(projectId, s.id, f, val);
      }
      await db.store.approveSectionFields(projectId, [s.id]);
    }

    await db.store.replaceBudgetItems(projectId, VALID_BUDGET);
    await db.store.approveBudgetItems(projectId);

    const llm = new FakeLlm({
      novelty: () => ({
        analogues_count: 2,
        analogues_list: ['Аналог А', 'Аналог Б'],
        has_measurable_comparison: true,
        missing_details_question: null,
      }),
    });

    const deps = makeDeps(db, llm);

    const res = await handlePipeline(deps, {
      user_id: userId,
      action: 'init_or_upload',
      program: 'Студенческий стартап',
      eligibility: PASSING_ELIGIBILITY,
      text_input: 'Завершение проекта и выход на финализацию',
    });

    expect(res.status).toBe('COMPLETED');
    if (res.status !== 'COMPLETED') return;

    // Проверяем полное отсутствие вызовов navigator в LLM
    const navigatorCalls = llm.calls.filter((c) => c.task === 'navigator');
    expect(navigatorCalls.length).toBe(0);

    // Проверяем резюме и чек-лист подачи в АС Фонд-М по правилам 8-й очереди
    expect(res.summary).toContain('Согласовано разделов: 9 из 9');
    expect(res.summary).toContain('Тематическое направление: Н1');
    expect(res.summary).toContain('Смета: утверждена (approved 🔒)');

    const checklistText = res.checklist.join('\n');
    expect(checklistText).toContain('29.10.2026');
    expect(checklistText).toContain('.sig, .sgn или .p7s');
    expect(checklistText).toContain('скан паспорта РФ');
    expect(checklistText).toContain('согласие на обработку персональных данных');

    // Проверяем сохранение навигатора в секцию 0
    const records = await db.store.getRecords(projectId);
    const navRecord = records.find((r) => r.section_id === 0 && r.field_key === 'navigator_summary_and_checklist');
    expect(navRecord?.value).toBeTruthy();
    const parsedNav = JSON.parse(navRecord!.value!);
    expect(parsedNav.eligibility_status).toBe('ELIGIBLE');
    expect(parsedNav.checklist.length).toBeGreaterThanOrEqual(5);
  });
});
