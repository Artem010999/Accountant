import { createTestDb, createUser, makeDeps } from '../tests/helpers';
import { OpenAiClient } from '../src/llm/openai';
import { handleConsultantChat } from '../src/chat/service';
import { config } from '../src/config';

async function main() {
  console.log('========================================================================');
  console.log(' ЖИВАЯ ВЕРИФИКАЦИЯ ИИ-КОНСУЛЬТАНТА (DEEPSEEK FLASH + ЛОКАЛЬНЫЙ RAG)');
  console.log('========================================================================\n');

  if (!config.deepseekApiKey) {
    console.warn('⚠️ Внимание: DEEPSEEK_API_KEY не задан в переменных окружения.');
    console.warn('  Для выполнения запроса к реальному каналу DeepSeek задайте DEEPSEEK_API_KEY в .env.');
  }

  // 1. Инициализация тестовой базы данных и реального LLM-клиента (DeepSeek Flash)
  console.log('1. Инициализация тестовой БД и клиента DeepSeek Flash...');
  const db = await createTestDb();
  const llm = new OpenAiClient({
    apiKey: config.deepseekApiKey || config.openaiApiKey,
    baseUrl: config.deepseekBaseUrl,
    chatModel: config.deepseekModel,
  });
  const deps = makeDeps(db, llm);

  const userId = await createUser(db.sql, { name: 'Никита Консультантов' });
  const projectId = await db.store.ensureProject(userId);
  console.log(`✓ Проект инициализирован: projectId=${projectId}, userId=${userId}\n`);

  // 2. Наполнение проекта данными:
  // Блок 3, Блок 4 (Н1), Блок 6 (замечание аудитора: «Указано "аналогов нет"»)
  console.log('2. Наполнение проекта данными (Блок 3, 4 и проблемный Блок 6)...');
  await db.store.upsertField(
    projectId,
    3,
    'problem_description',
    'Студенты и молодые ученые тратят до 40% рабочего времени на поиск и обработку разрозненных научных публикаций при подготовке грантовых заявок.',
  );
  await db.store.upsertField(projectId, 4, 'direction', 'Н1');
  await db.store.upsertField(
    projectId,
    4,
    'product_summary',
    'Разработка интеллектуальной рекомендательной системы поиска научных публикаций.',
  );

  const initialBlock6Value = 'Аналогов нет, наш сервис уникален и превосходит любые существующие решения в мире.';
  const rec6Id = await db.store.upsertField(projectId, 6, 'analogues_comparison', initialBlock6Value);
  await db.sql.query(`UPDATE project_passport_records SET review_status = 'needs_review' WHERE id = $1::uuid`, [rec6Id]);

  // Записываем замечание эксперта аудита по Блоку 6 в секцию 0
  const auditReport = {
    block_audits: [
      {
        section_id: 6,
        status: 'needs_revision',
        remark: '[Критерий: Научно-техническая новизна] Утверждение об отсутствии аналогов недопустимо для ФСИ. [Ошибка] Любая разработка имеет прямые или косвенные аналоги. [Как исправить] Приведите минимум 2 конкретных аналога и опишите измеримые отличия по алгоритму или метрикам.',
        how_to_fix: 'Приведите минимум 2 конкретных аналога и опишите измеримые отличия по алгоритму или метрикам.',
        failed_fields: ['analogues_comparison'],
      },
    ],
    budget_audit: {
      status: 'approved',
      remark: null,
      how_to_fix: null,
      violations: [],
    },
    fatal_stop_factors: [],
  };
  await db.store.upsertField(projectId, 0, 'latest_audit_report', JSON.stringify(auditReport));
  console.log('✓ Данные проекта и замечание аудитора по Блоку 6 сохранены.\n');

  // 3. Вопрос 1: Проверка RAG-знаний о лимитах сметы и предупреждения о статусе «Рабочий ориентир»
  const question1 = 'Какие сейчас лимиты по смете на 1 и 2 этапе и сколько можно заложить на подрядчиков?';
  console.log('------------------------------------------------------------------------');
  console.log(`ВОПРОС 1 СТУДЕНТА: "${question1}"`);
  console.log('------------------------------------------------------------------------');

  const resp1 = await handleConsultantChat(deps, {
    user_id: userId,
    message: question1,
  });

  console.log('\nОТВЕТ ИИ-КОНСУЛЬТАНТА:');
  console.log(resp1.assistant_message.content);
  console.log(`\nИсточники карточек RAG: ${resp1.assistant_message.referenced_cards.join(', ') || 'нет'}\n`);

  // Проверка требований Вопроса 1
  const reply1 = resp1.assistant_message.content.toLowerCase();
  const mentions20k = /20\s*000|20\s*тыс/i.test(reply1);
  const mentions980k = /980\s*000|980\s*тыс/i.test(reply1);
  const mentions250k = /250\s*000|250\s*тыс/i.test(reply1);
  const hasWarning = /рабоч[а-я]*\s*ориентир|сверк[а-я]*|8-?[йя]?\s*очеред|положени[а-я]*/i.test(reply1);

  console.log('Проверка критериев ответа 1:');
  console.log(`  - Упоминание 20 000 ₽ (1 этап): ${mentions20k ? '✓' : '⚠️'}`);
  console.log(`  - Упоминание 980 000 ₽ (2 этап): ${mentions980k ? '✓' : '⚠️'}`);
  console.log(`  - Упоминание 250 000 ₽ (подрядчики): ${mentions250k ? '✓' : '⚠️'}`);
  console.log(`  - Предупреждение о рабочем ориентире / сверке с Положением 8-й очереди: ${hasWarning ? '✓' : '✗'}`);

  if (!hasWarning) {
    throw new Error('Консультант не выдал обязательное предупреждение о сверке лимитов с Положением 8-й очереди!');
  }

  // 4. Вопрос 2: Проверка роли «советчика» (готовый черновик по замечанию эксперта без изменения БД)
  const question2 = 'Помоги переписать мой Блок 6 по замечанию эксперта, чтобы я скопировал текст в заявку';
  console.log('\n------------------------------------------------------------------------');
  console.log(`ВОПРОС 2 СТУДЕНТА В ТОМ ЖЕ ДИАЛОГЕ: "${question2}"`);
  console.log('------------------------------------------------------------------------');

  const resp2 = await handleConsultantChat(deps, {
    user_id: userId,
    message: question2,
    active_section_id: 6,
  });

  console.log('\nОТВЕТ ИИ-КОНСУЛЬТАНТА:');
  console.log(resp2.assistant_message.content);
  console.log(`\nВсего сообщений в истории диалога: ${resp2.history.length}\n`);

  // Проверка требований Вопроса 2:
  // 1) Модель видит контекст и замечание эксперта (предлагает черновик с аналогами/отличиями)
  const reply2 = resp2.assistant_message.content;
  const providesDraft =
    /аналог|сравнени|отличи|черновик|вариант|метрик/i.test(reply2);
  console.log('Проверка критериев ответа 2:');
  console.log(`  - Предложен готовый черновик с аналогами и метриками: ${providesDraft ? '✓' : '✗'}`);
  console.log(`  - Диалог сохраняет связность (сообщений в истории >= 4): ${resp2.history.length >= 4 ? '✓' : '✗'}`);

  // 2) Неприкосновенность БД: консультант НЕ изменил поле Блока 6 в БД
  const currentRecords = await db.store.getRecords(projectId);
  const block6Rec = currentRecords.find((r) => r.section_id === 6 && r.field_key === 'analogues_comparison');

  console.log(`  - Значение в БД после ответа консультанта: "${block6Rec?.value}"`);
  console.log(`  - review_status в БД остался: "${block6Rec?.review_status}"`);

  if (block6Rec?.value !== initialBlock6Value) {
    throw new Error('КРИТИЧЕСКАЯ ОШИБКА: Консультант изменил значение поля в базе данных!');
  }
  if (block6Rec?.review_status !== 'needs_review') {
    throw new Error('КРИТИЧЕСКАЯ ОШИБКА: Консультант изменил статус согласования поля!');
  }
  console.log('  - Роль советчика соблюдена: БД осталась в исходном состоянии ✓');

  console.log('\n========================================================================');
  console.log(' ЖИВАЯ ВЕРИФИКАЦИЯ ЭТАПА 5 ПРОЙДЕНА УСПЕШНО (Код выхода 0)');
  console.log('========================================================================\n');
}

main().catch((err) => {
  console.error('\n❌ Ошибка верификации ИИ-Консультанта:', err);
  process.exit(1);
});
