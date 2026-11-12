import { getRagDb } from '../src/rag/db';
import { retrieveRagContext, searchHybridCards } from '../src/rag/retriever';

async function verify() {
  console.log('=== ЗАПУСК ВЕРИФИКАЦИИ БАЗЫ ЗНАНИЙ RAG (5 ПРОВЕРОК) ===\n');
  const db = await getRagDb();

  try {
    // -------------------------------------------------------------------------
    // Проверка 1: Целостность и чистота БД
    // -------------------------------------------------------------------------
    console.log('--- Проверка 1 (Целостность и чистота БД) ---');
    const { rows: countRows } = await db.sql.query(`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE source_doc = 'TechLead8')::int as count_techlead,
        COUNT(*) FILTER (WHERE source_doc = 'StudStartup_Knowledge_Base_v2')::int as count_kb,
        COUNT(*) FILTER (WHERE source_doc = 'Студ_стартап_сравнение_7_и_8')::int as count_cmp,
        COUNT(*) FILTER (WHERE source_doc = 'Примеры_КП_нов_Стс_7')::int as count_kp,
        COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int as embedded_count
      FROM rag_knowledge_cards
    `);
    const c = countRows[0];
    console.log(`Всего карточек: ${c.total} (ожидается 419)`);
    console.log(`- TechLead8: ${c.count_techlead} (ожидается 357)`);
    console.log(`- StudStartup_Knowledge_Base_v2: ${c.count_kb} (ожидается 32)`);
    console.log(`- Студ_стартап_сравнение_7_и_8: ${c.count_cmp} (ожидается 16)`);
    console.log(`- Примеры_КП_нов_Стс_7: ${c.count_kp} (ожидается 14)`);
    console.log(`С непустым вектором embedding: ${c.embedded_count}`);

    if (c.total !== 419 || c.count_techlead !== 357 || c.count_kb !== 32 || c.count_cmp !== 16 || c.count_kp !== 14 || c.embedded_count !== 419) {
      throw new Error(`Проверка 1 ПРОВАЛЕНА: несоответствие количества карточек!`);
    }

    const { rows: forbiddenRows } = await db.sql.query(`
      SELECT card_id, title FROM rag_knowledge_cards
      WHERE content ILIKE '%@dab1703%'
         OR content ILIKE '%40 тыс%'
         OR title ILIKE '%@dab1703%'
         OR title ILIKE '%40 тыс%'
    `);
    console.log(`Найдено запрещенных упоминаний (@dab1703, 40 тыс): ${forbiddenRows.length} (ожидается 0)`);
    if (forbiddenRows.length > 0) {
      throw new Error(`Проверка 1 ПРОВАЛЕНА: обнаружены запрещенные упоминания в карточках: ${JSON.stringify(forbiddenRows)}`);
    }
    console.log('✓ Проверка 1 УСПЕШНО ПРОЙДЕНА!\n');

    // -------------------------------------------------------------------------
    // Проверка 2: Поиск по точному номеру и цифрам
    // -------------------------------------------------------------------------
    console.log('--- Проверка 2 (Поиск по точному номеру и цифрам) ---');
    
    // 2.1: "вызов № 54 корпоративный ассистент" -> 1-е место techlead_8_054
    const res54 = await searchHybridCards(db.sql, {
      step: 'assembly',
      queryText: 'вызов № 54 корпоративный ассистент',
      topKSearch: 5,
    });
    console.log(`Запрос "вызов № 54": Топ-1 результат: ${res54[0]?.card_id} ("${res54[0]?.title}")`);
    if (res54[0]?.card_id !== 'techlead_8_054') {
      throw new Error(`Проверка 2.1 ПРОВАЛЕНА: Топ-1 должен быть techlead_8_054, получен ${res54[0]?.card_id}`);
    }

    // 2.2: "взнос на травматизм 2959 рублей на АУСН" -> kb_16_taxes_ausn_dir
    const res2959 = await searchHybridCards(db.sql, {
      step: 'chat',
      queryText: 'взнос на травматизм 2959 рублей на АУСН',
      topKSearch: 5,
    });
    console.log(`Запрос "травматизм 2959 АУСН": найдено карточек: ${res2959.length}, Топ-1: ${res2959[0]?.card_id}`);
    const found16 = res2959.some((card) => card.card_id === 'kb_16_taxes_ausn_dir');
    if (!found16) {
      throw new Error(`Проверка 2.2 ПРОВАЛЕНА: карточка kb_16_taxes_ausn_dir не найдена в результатах!`);
    }

    // 2.3: "лимит 250 000 рублей на подрядчиков и 150 000 на технику" -> cmp_10_finance_stage2_limits
    const resLimits = await searchHybridCards(db.sql, {
      step: 'chat',
      queryText: 'лимит 250 000 рублей на подрядчиков и 150 000 на технику',
      topKSearch: 5,
    });
    console.log(`Запрос "лимиты 250 000 и 150 000": Топ-1: ${resLimits[0]?.card_id}`);
    const foundLimits = resLimits.some((card) => card.card_id === 'cmp_10_finance_stage2_limits');
    if (!foundLimits) {
      throw new Error(`Проверка 2.3 ПРОВАЛЕНА: карточка cmp_10_finance_stage2_limits не найдена в результатах!`);
    }
    console.log('✓ Проверка 2 УСПЕШНО ПРОЙДЕНА!\n');

    // -------------------------------------------------------------------------
    // Проверка 3: Поиск по смыслу / семантике
    // -------------------------------------------------------------------------
    console.log('--- Проверка 3 (Поиск по смыслу / семантике) ---');
    
    // 3.1: "распознавание дефектов вагонов поезда с помощью камер и нейросети" -> РЖД (techlead_8_031 / techlead_8_208)
    const resTrain = await searchHybridCards(db.sql, {
      step: 'novelty',
      queryText: 'распознавание дефектов вагонов поезда с помощью камер и нейросети',
      topKSearch: 5,
    });
    console.log(`Запрос "дефекты вагонов": найдено: ${resTrain.map(c => c.card_id).join(', ')}`);
    const foundTrain = resTrain.some((c) => c.card_id === 'techlead_8_031' || c.card_id === 'techlead_8_208');
    if (!foundTrain) {
      throw new Error(`Проверка 3.1 ПРОВАЛЕНА: не найдены карточки РЖД techlead_8_031 или techlead_8_208!`);
    }

    // 3.2: "биоразлагаемые капсулы для лекарств из растительного крахмала" -> techlead_8_114
    const resBio = await searchHybridCards(db.sql, {
      step: 'novelty',
      queryText: 'биоразлагаемые капсулы для лекарств из растительного крахмала',
      topKSearch: 5,
    });
    console.log(`Запрос "капсулы из крахмала": найдено: ${resBio.map(c => c.card_id).join(', ')}`);
    const foundBio = resBio.some((c) => c.card_id === 'techlead_8_114');
    if (!foundBio) {
      throw new Error(`Проверка 3.2 ПРОВАЛЕНА: карточка techlead_8_114 не найдена!`);
    }
    console.log('✓ Проверка 3 УСПЕШНО ПРОЙДЕНА!\n');

    // -------------------------------------------------------------------------
    // Проверка 4: Фильтрация примеров КП по направлению
    // -------------------------------------------------------------------------
    console.log('--- Проверка 4 (Фильтрация примеров КП по направлению Н2) ---');
    const resKp = await retrieveRagContext(db.sql, {
      step: 'assembly',
      targetBlocks: [5],
      direction: 'Н2',
      queryText: 'остановка кровотечения или бактерицидные имплантаты',
      topKSearch: 5,
    });
    console.log(`Результаты поиска КП для Н2: ${resKp.searchCards.map(c => `${c.card_id} (${c.direction})`).join(', ')}`);
    const foundMedicalKp = resKp.searchCards.some((c) => c.card_id === 'kp_n2_01' || c.card_id === 'kp_n2_02');
    const hasWrongDir = resKp.searchCards.some((c) => c.direction !== 'Н2' && c.direction !== 'all');
    if (!foundMedicalKp || hasWrongDir) {
      throw new Error(`Проверка 4 ПРОВАЛЕНА: ожидались медицинские примеры kp_n2_01/kp_n2_02 без сторонних направлений!`);
    }
    console.log('✓ Проверка 4 УСПЕШНО ПРОЙДЕНА!\n');

    // -------------------------------------------------------------------------
    // Проверка 5: Работа Кучки 1 (pinned)
    // -------------------------------------------------------------------------
    console.log('--- Проверка 5 (Работа Кучки 1 pinned) ---');
    const resAudit = await retrieveRagContext(db.sql, {
      step: 'audit',
      targetBlocks: [6],
      queryText: 'Аналогов нет',
    });
    const pinnedIds = resAudit.pinnedCards.map((c) => c.card_id);
    console.log(`Приколотые карточки для шага 'audit' и блока 6: ${pinnedIds.join(', ')}`);

    const expectedCards = [
      'kb_06_problem_prod_tech',
      'kb_07_market_analogs_team',
      'kb_ex03_tech_novelty',
      'kb_ex04_competitors',
      'kb_prompt_3',
    ];
    for (const exp of expectedCards) {
      if (!pinnedIds.includes(exp)) {
        throw new Error(`Проверка 5 ПРОВАЛЕНА: обязательная карточка ${exp} отсутствует в pinned выдаче!`);
      }
    }
    console.log('✓ Проверка 5 УСПЕШНО ПРОЙДЕНА!\n');

    console.log('=====================================================');
    console.log(' ВСЕ 5 ПРОВЕРОК RAG УСПЕШНО ПРОЙДЕНЫ НА 100%! ');
    console.log('=====================================================');
  } finally {
    await db.close();
  }
}

verify().catch((err) => {
  console.error('Ошибка верификации RAG:', err);
  process.exit(1);
});
