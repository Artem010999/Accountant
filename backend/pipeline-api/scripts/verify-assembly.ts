import { getRagDb } from '../src/rag/db';
import { retrieveRagContext } from '../src/rag/retriever';
import { callDeepSeek } from '../src/llm';
import { SYSTEM_PROMPTS } from '../src/llm/prompts';
import { extractSchema } from '../src/llm/schemas';
import { wrapUntrustedData } from '../src/promptGuard';
import { calculateClaimSpans, type RawClaim } from '@passport/passport-core';
import type { ClaimType } from '@passport/contracts';

async function main() {
  console.log('========================================================================');
  console.log(' ЖИВАЯ ВЕРИФИКАЦИЯ СБОРКИ ПАСПОРТА (DEEPSEEK FLASH + RAG TECHLEAD8) ');
  console.log('========================================================================\n');

  const studentBrief =
    'Делаем ИИ-ассистента SuperBot для сотрудников компаний, чтобы быстрее искать инфу по базе знаний. В 2027 году проведём пилот в 3 IT-компаниях';

  console.log('Студенческий бриф (со сленгом, брендом и планами):');
  console.log(`"${studentBrief}"\n`);

  // 1. Подключение локального RAG
  console.log('1. Извлечение контекста RAG (step: "assembly", direction: "Н1")...');
  const ragDb = await getRagDb();
  let ragContext = '';
  try {
    const ragResult = await retrieveRagContext(ragDb.sql, {
      step: 'assembly',
      targetBlocks: ['3', '4', '7'],
      direction: 'Н1',
      queryText: 'ИИ-ассистент корпоративные сотрудники база знаний вызов № 54 Вебпрактик',
      topKSearch: 5,
      includePinned: true,
    });
    ragContext = ragResult.formattedContext;
    console.log(`✓ RAG контекст получен: ${ragResult.cards.length} карточек (${ragContext.length} символов).`);
    const has54 = ragResult.cards.some((c) => c.card_id === 'techlead_8_054');
    console.log(`  - Карточка вызова № 54 (Вебпрактик): ${has54 ? 'ПРИСУТСТВУЕТ' : 'НЕ НАЙДЕНА'}`);
  } finally {
    await ragDb.close();
  }

  // 2. Формирование открытых полей для упаковки
  const openFields = [
    {
      section_id: 3,
      field_key: 'problem_description',
      question: 'Проблема пользователей',
      criteria: 'Конкретное описание проблемы целевой аудитории без абстрактных фраз',
      current_value: null,
    },
    {
      section_id: 4,
      field_key: 'product_summary',
      question: 'Цель проекта и наименование создаваемого продукта',
      criteria: 'Начинается с отглагольного существительного (Создание... / Разработка...), без коммерческих брендов и сленга',
      current_value: null,
    },
    {
      section_id: 4,
      field_key: 'direction',
      question: 'Направление проекта',
      criteria: 'Один код из Н1-Н7',
      current_value: null,
    },
    {
      section_id: 4,
      field_key: 'tech_challenge',
      question: 'Номер технологического вызова TechLead8 (1–357)',
      criteria: 'Подходящий вызов из rag_context строго того же направления',
      current_value: null,
    },
    {
      section_id: 4,
      field_key: 'tech_approach',
      question: 'Технологический подход',
      criteria: 'Вход -> обработка -> выход. Пояснение о вызове',
      current_value: null,
    },
    {
      section_id: 7,
      field_key: 'traction_and_pilots',
      question: 'Пилоты и договоренности',
      criteria: 'Планы будущих пилотов с claim_type plan',
      current_value: null,
    },
  ];

  // 3. Вызов реального DeepSeek Flash
  console.log('\n2. Запрос в реальный канал DeepSeek Flash...');
  const userPayload = {
    program: 'Студенческий стартап',
    fields: openFields,
    locked_fields: [],
    rag_context: ragContext,
    user_input: wrapUntrustedData('user_input', studentBrief),
    sources: [],
  };

  const startTime = Date.now();
  const rawResponse = await callDeepSeek({
    systemPrompt: SYSTEM_PROMPTS.extract,
    userPrompt: JSON.stringify(userPayload),
    temperature: 0.1,
  });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✓ Ответ получен за ${elapsed} сек.\n`);

  const parsed = extractSchema.parse(rawResponse);

  // 4. Анализ и верификация результатов
  console.log('========================================================================');
  console.log(' РЕЗУЛЬТАТЫ ГРАНТОВОЙ РЕДАКТУРЫ И УПАКОВКИ:');
  console.log('========================================================================\n');

  const fieldsMap = new Map<string, any>(parsed.fields.map((f) => [`${f.section_id}/${f.field_key}`, f]));

  // Проверка 1: product_summary (без бренда/сленга, отглагольное существительное)
  const productSummary = fieldsMap.get('4/product_summary')?.value ?? '';
  console.log('1. [4/product_summary]:');
  console.log(`   "${productSummary}"`);
  const startsWithNoun = /^(?:Создание|Разработка)(?:\s|$)/iu.test(productSummary.trim());
  const hasNoBrand = !/SuperBot/i.test(productSummary);
  const hasNoSlang = !/инфу\b/iu.test(productSummary);
  console.log(`   - Начинается с «Создание... / Разработка...»: ${startsWithNoun ? 'ДА ✓' : 'НЕТ ✗'}`);
  console.log(`   - Бренд SuperBot убран: ${hasNoBrand ? 'ДА ✓' : 'НЕТ ✗'}`);
  console.log(`   - Сленг («инфу») убран: ${hasNoSlang ? 'ДА ✓' : 'НЕТ ✗'}\n`);

  // Проверка 2: direction и tech_challenge
  const direction = fieldsMap.get('4/direction')?.value ?? '';
  const techChallenge = fieldsMap.get('4/tech_challenge')?.value ?? '';
  const techApproach = fieldsMap.get('4/tech_approach')?.value ?? '';
  console.log('2. [4/direction] и [4/tech_challenge]:');
  console.log(`   - Направление: "${direction}" (ожидается Н1): ${direction === 'Н1' ? 'ВЕРНО ✓' : 'НЕ СОВПАДАЕТ'}`);
  console.log(`   - Технологический вызов: "${techChallenge}" (ожидается 54 — ООО «Вебпрактик»): ${techChallenge === '54' ? 'ВЕРНО ✓' : techChallenge ? `Подобран вызов ${techChallenge}` : 'Не подобран'}`);
  if (techApproach) {
    console.log(`   - Пояснение в 4/tech_approach: "${techApproach.slice(0, 150)}..."\n`);
  }

  // Проверка 3: claim про 2027 год с claim_type "plan"
  console.log('3. Проверка claims и расчёта спанов:');
  let planFound = false;
  for (const f of parsed.fields) {
    for (const c of f.claims) {
      if (/2027|пилот/i.test(c.claim_text)) {
        console.log(`   - Поле ${f.section_id}/${f.field_key}: claim_type = "${c.claim_type}"`);
        console.log(`     Текст утверждения: "${c.claim_text}"`);
        if (c.claim_type === 'plan') planFound = true;
      }
    }
    // Проверяем calculateClaimSpans
    if (f.value && f.claims.length > 0) {
      const rawClaims: RawClaim[] = f.claims.map((c) => ({
        claim_text: c.claim_text,
        claim_type: c.claim_type as ClaimType,
      }));
      const withSpans = calculateClaimSpans(f.value, rawClaims);
      const allFound = withSpans.every((s) => s.span_start !== null && s.span_end !== null);
      if (!allFound) {
        console.log(`   [ВНИМАНИЕ] Не все claims поля ${f.section_id}/${f.field_key} найдены как точные подстроки в value!`);
      }
    }
  }
  console.log(`   - Утверждение о будущем (2027 год / пилот) классифицировано как "plan": ${planFound ? 'ДА ✓' : 'НЕТ ✗'}\n`);

  console.log('========================================================================');
  console.log(' ВЕРИФИКАЦИЯ ЭТАПА 3 НА ЖИВОМ КАНАЛЕ DEEPSEEK FLASH + RAG ЗАВЕРШЕНА! ');
  console.log('========================================================================');
}

main().catch((err) => {
  console.error('Ошибка верификации:', err);
  process.exit(1);
});
