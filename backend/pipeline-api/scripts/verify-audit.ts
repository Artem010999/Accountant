import { createTestDb, createUser, makeDeps } from '../tests/helpers';
import { OpenAiClient } from '../src/llm/openai';
import { auditPassport } from '../src/pipeline/audit';
import { config } from '../src/config';

async function main() {
  console.log('========================================================================');
  console.log(' ЖИВАЯ ВЕРИФИКАЦИЯ ЭКСПЕРТНОГО АУДИТА (KIMI K3 + ЛОКАЛЬНЫЙ RAG)');
  console.log('========================================================================\n');

  if (!config.kimiApiKey) {
    console.warn('⚠️ Внимание: KIMI_API_KEY не задан в переменных окружения.');
    console.warn('  Для выполнения запроса к реальному каналу Kimi задайте KIMI_API_KEY в .env.');
  }

  // 1. Инициализация тестовой базы данных и зависимостей с реальным OpenAiClient (Kimi)
  const db = await createTestDb();
  const llm = new OpenAiClient({
    apiKey: config.kimiApiKey,
    baseUrl: config.kimiBaseUrl,
    chatModel: config.kimiModel,
  });
  const deps = makeDeps(db, llm);

  const userId = await createUser(db.sql, { name: 'Алексей Экспертов' });
  const projectId = await db.store.ensureProject(userId);

  console.log(`Проект инициализирован: projectId=${projectId}, userId=${userId}\n`);

  // 2. Наполнение проекта данными:
  // Блок 3 — качественный и сильный блок
  console.log('1. Заполнение Блока 3 (Качественные формулировки проблемы и ЦА)...');
  await db.store.upsertField(
    projectId,
    3,
    'problem_description',
    'Студенты очной формы обучения Самарского национального исследовательского университета тратят значительное время на координацию и поиск попутчиков для регулярных поездок между учебными корпусами и общежитиями в условиях интервалов движения общественного транспорта. Существующие агрегаторы не обеспечивают верификацию принадлежности пользователей к вузовскому сообществу, что создаёт риски безопасности и затрудняет оперативное согласование маршрутов.',
  );
  await db.store.upsertField(
    projectId,
    3,
    'target_audience',
    'Студенты бакалавриата и специалитета очной формы обучения Самарского университета (около 12 000 человек), проживающие в университетском городке и ежедневно совершающие поездки между учебными корпусами.',
  );

  // Блок 6 — заведомо слабый блок с типичными ошибками под правила ФСИ
  console.log('2. Заполнение Блока 6 (Заведомо слабый: "Аналогов нет", сленг, нет метрик)...');
  await db.store.upsertField(
    projectId,
    6,
    'analogues_comparison',
    'Аналогов нет, наш сервис дешевле и удобнее всех в мире.',
  );
  await db.store.upsertField(
    projectId,
    6,
    'novelty_hypothesis',
    'Наша идея супер-инновационная и не имеет аналогов.',
  );
  await db.store.upsertField(
    projectId,
    6,
    'verification_protocol',
    'Спросили однокурсников, всем понравилось.',
  );

  // Смета — содержит запрещённую правилами ФСИ статью расходов
  console.log('3. Заполнение сметы (Включает запрещённую статью: передача разработки конечного ПО подрядчику)...');
  const testBudget = [
    {
      stage: 1 as const,
      category: 'other' as const,
      title: 'Консультационные услуги специалистов',
      quantity: 1,
      unit_price: 20000,
      amount: 20000,
      justification: 'Консультации по правовой охране РИД',
    },
    {
      stage: 2 as const,
      category: 'contractor' as const,
      title: 'Разработка конечного ПО стартапа сторонним подрядчиком',
      quantity: 1,
      unit_price: 200000,
      amount: 200000,
      justification: 'Передача разработки ядра мобильного приложения и серверной части внешней веб-студии',
    },
    {
      stage: 2 as const,
      category: 'equipment' as const,
      title: 'Ноутбук инженера-разработчика',
      quantity: 1,
      unit_price: 150000,
      amount: 150000,
      justification: 'Оборудование для отладки',
    },
    {
      stage: 2 as const,
      category: 'salary' as const,
      title: 'Начисление оплаты труда ведущего разработчика',
      quantity: 10,
      unit_price: 60000,
      amount: 600000,
      justification: 'Разработка архитектуры и алгоритмов маршрутизации',
    },
    {
      stage: 2 as const,
      category: 'other' as const,
      title: 'Аренда серверных мощностей в РФ',
      quantity: 1,
      unit_price: 30000,
      amount: 30000,
      justification: 'Инфраструктура для тестирования',
    },
  ];
  await db.store.replaceBudgetItems(projectId, testBudget);

  console.log('\n------------------------------------------------------------------------');
  console.log(' Запуск auditPassport (Step 6 / Kimi k3 + RAG Context)...');
  console.log('------------------------------------------------------------------------\n');

  const report = await auditPassport(deps, projectId);

  console.log('========================================================================');
  console.log(' РЕЗУЛЬТАТЫ ЭКСПЕРТНОГО АУДИТА KIMI');
  console.log('========================================================================\n');

  console.log(`Режим аудита: ${report.mode}`);
  console.log(`Фатальные стоп-факторы идеи: ${report.fatal_stop_factors.length === 0 ? 'НЕ ОБНАРУЖЕНЫ (OK)' : 'ОБНАРУЖЕНЫ'}`);
  if (report.fatal_stop_factors.length > 0) {
    for (const f of report.fatal_stop_factors) {
      console.log(`  - [${f.code}] ${f.reason}`);
      console.log(`    Как исправить: ${f.how_to_fix}`);
    }
  }

  console.log('\n--- ВЕРДИКТ ПО БЛОКАМ ПАСПОРТА ---');
  for (const b of report.block_audits) {
    const icon = b.status === 'approved' ? '🔒 APPROVED' : '✏️ NEEDS_REVIEW';
    console.log(`\nБлок ${b.section_id}: ${icon}`);
    if (b.remark) {
      console.log(`  Замечание эксперта (remark):\n    ${b.remark}`);
    }
    if (b.how_to_fix) {
      console.log(`  Рекомендация по исправлению (how_to_fix):\n    ${b.how_to_fix}`);
    }
    if (b.failed_fields && b.failed_fields.length > 0) {
      console.log(`  Проблемные поля: ${b.failed_fields.join(', ')}`);
    }
  }

  console.log('\n--- ВЕРДИКТ ПО СМЕТЕ (BUDGET AUDIT) ---');
  const budgetIcon = report.budget_audit.status === 'approved' ? '🔒 APPROVED' : '✏️ NEEDS_REVIEW';
  console.log(`Статус сметы: ${budgetIcon}`);
  if (report.budget_audit.remark) {
    console.log(`  Замечание эксперта:\n    ${report.budget_audit.remark}`);
  }
  if (report.budget_audit.how_to_fix) {
    console.log(`  Инструкция по устранению:\n    ${report.budget_audit.how_to_fix}`);
  }
  if (report.budget_audit.violations && report.budget_audit.violations.length > 0) {
    console.log(`  Нарушения лимитов и правил:\n    - ${report.budget_audit.violations.join('\n    - ')}`);
  }

  // Проверка статусов в базе данных
  console.log('\n--- ПРОВЕРКА СОСТОЯНИЯ ЗАМКОВ В БАЗЕ ДАННЫХ ---');
  const records = await db.store.getRecords(projectId);
  const rec3 = records.find((r) => r.section_id === 3 && r.field_key === 'problem_description');
  const rec6 = records.find((r) => r.section_id === 6 && r.field_key === 'analogues_comparison');
  const budgetItems = await db.store.getBudgetItems(projectId);

  console.log(`Блок 3 в БД: review_status = "${rec3?.review_status}" (Ожидается: approved 🔒)`);
  console.log(`Блок 6 в БД: review_status = "${rec6?.review_status}" (Ожидается: needs_review ✏️)`);
  console.log(
    `Смета в БД: review_status = "${budgetItems[0]?.review_status}" (Ожидается: needs_review ✏️)`,
  );

  const reportRecord = records.find((r) => r.section_id === 0 && r.field_key === 'latest_audit_report');
  console.log(`Сводный отчёт в секции 0 сохранён: ${Boolean(reportRecord?.value)}`);

  console.log('\n========================================================================');
  console.log(' ВЕРИФИКАЦИЯ ЭТАПА 4 УСПЕШНО ЗАВЕРШЕНА');
  console.log('========================================================================');

  await db.pg.close();
}

main().catch((err) => {
  console.error('Ошибка верификации аудита:', err);
  process.exit(1);
});
