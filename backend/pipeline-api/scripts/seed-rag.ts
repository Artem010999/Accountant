import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { getRagDb } from '../src/rag/db';
import { STATIC_KNOWLEDGE_CARDS } from '../src/rag/staticCards';
import { parseTechLeadExcel } from '../src/rag/techLeadParser';
import { getEmbeddingsBatch } from '../src/embeddings';
import { toVectorLiteral } from '../src/db/sql';
import { PIPELINE_API_DIR } from '../src/config';
import type { RawKnowledgeCard } from '../src/rag/types';

async function main() {
  console.log('=== СИДИРОВАНИЕ БАЗЫ ЗНАНИЙ RAG (419 КАРТОЧЕК) ===');

  // 1. Поиск TechLead8.xlsx
  const xlsxPath = resolve(PIPELINE_API_DIR, 'data', 'rag', 'TechLead8.xlsx');
  if (!existsSync(xlsxPath)) {
    throw new Error(`Файл не найден: ${xlsxPath}. Убедитесь, что TechLead8.xlsx скопирован в data/rag/`);
  }

  // 2. Сбор карточек
  console.log('Парсинг TechLead8.xlsx...');
  const techLeadCards = parseTechLeadExcel(xlsxPath);
  console.log(`Загружено технологических вызовов: ${techLeadCards.length}`);

  console.log(`Загружено статических карточек: ${STATIC_KNOWLEDGE_CARDS.length}`);
  const allRawCards: RawKnowledgeCard[] = [...STATIC_KNOWLEDGE_CARDS, ...techLeadCards];
  console.log(`Всего карточек для сидирования: ${allRawCards.length}`);

  if (allRawCards.length !== 419) {
    throw new Error(`Ожидалось ровно 419 карточек, получено ${allRawCards.length}!`);
  }

  // 3. Вычисление content_hash для каждой карточки
  const cardsWithHash = allRawCards.map((card) => {
    const hash = createHash('sha256').update(card.title + '\n' + card.content).digest('hex');
    return {
      ...card,
      content_hash: hash,
    };
  });

  // 4. Подключение к БД
  const db = await getRagDb();
  console.log(`Подключение к БД успешно (движок: ${db.isPglite ? 'PGlite' : 'Postgres Pool'})`);

  try {
    // 5. Читаем существующие пары (card_id, content_hash) там, где embedding IS NOT NULL
    const { rows: existingRows } = await db.sql.query(
      `SELECT card_id, content_hash FROM rag_knowledge_cards WHERE embedding IS NOT NULL`
    );

    const existingHashMap = new Map<string, string>();
    for (const r of existingRows) {
      existingHashMap.set(r.card_id, r.content_hash);
    }

    console.log(`В БД найдено уже векторизованных карточек: ${existingHashMap.size}`);

    // 6. Определяем, какие карточки нуждаются в векторизации
    const cardsToEmbed: { card: typeof cardsWithHash[0]; text: string }[] = [];
    const unchangedCards: typeof cardsWithHash[0][] = [];

    for (const card of cardsWithHash) {
      const existingHash = existingHashMap.get(card.card_id);
      if (existingHash === card.content_hash) {
        unchangedCards.push(card);
      } else {
        cardsToEmbed.push({
          card,
          text: `${card.title}\n\n${card.content}`,
        });
      }
    }

    console.log(`Карточек без изменений (пропуск векторизации): ${unchangedCards.length}`);
    console.log(`Новых или изменённых карточек для векторизации: ${cardsToEmbed.length}`);

    // 7. Пакетная векторизация через getEmbeddingsBatch (если есть новые/изменившиеся)
    const newVectorsMap = new Map<string, number[]>();
    if (cardsToEmbed.length > 0) {
      console.log(`Генерация эмбеддингов для ${cardsToEmbed.length} карточек пачками по 20...`);
      const texts = cardsToEmbed.map((item) => item.text);
      const startTime = Date.now();
      const vectors = await getEmbeddingsBatch(texts, 20);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`Векторизация завершена за ${elapsed}с, получено векторов: ${vectors.length}`);

      for (let i = 0; i < cardsToEmbed.length; i++) {
        newVectorsMap.set(cardsToEmbed[i].card.card_id, vectors[i]);
      }
    }

    // 8. Сохранение карточек в БД
    console.log('Сохранение карточек в таблицу rag_knowledge_cards...');
    await db.sql.exec('BEGIN');
    try {
      for (const card of cardsWithHash) {
        const newVector = newVectorsMap.get(card.card_id);
        const vectorLiteral = newVector ? toVectorLiteral(newVector) : null;

        if (vectorLiteral) {
          await db.sql.query(
            `INSERT INTO rag_knowledge_cards (
              card_id, source_doc, source_page, title, authority_status, retrieval_mode,
              pipeline_steps, target_blocks, direction, content, content_hash, metadata, embedding
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::vector
            )
            ON CONFLICT (card_id) DO UPDATE SET
              source_doc = EXCLUDED.source_doc,
              source_page = EXCLUDED.source_page,
              title = EXCLUDED.title,
              authority_status = EXCLUDED.authority_status,
              retrieval_mode = EXCLUDED.retrieval_mode,
              pipeline_steps = EXCLUDED.pipeline_steps,
              target_blocks = EXCLUDED.target_blocks,
              direction = EXCLUDED.direction,
              content = EXCLUDED.content,
              content_hash = EXCLUDED.content_hash,
              metadata = EXCLUDED.metadata,
              embedding = EXCLUDED.embedding,
              updated_at = now()`,
            [
              card.card_id,
              card.source_doc,
              card.source_page,
              card.title,
              card.authority_status,
              card.retrieval_mode,
              card.pipeline_steps,
              card.target_blocks,
              card.direction,
              card.content,
              card.content_hash,
              JSON.stringify(card.metadata || {}),
              vectorLiteral,
            ]
          );
        } else {
          // Карточка не менялась, обновляем поля, сохраняя существующий embedding
          await db.sql.query(
            `INSERT INTO rag_knowledge_cards (
              card_id, source_doc, source_page, title, authority_status, retrieval_mode,
              pipeline_steps, target_blocks, direction, content, content_hash, metadata, embedding
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NULL
            )
            ON CONFLICT (card_id) DO UPDATE SET
              source_doc = EXCLUDED.source_doc,
              source_page = EXCLUDED.source_page,
              title = EXCLUDED.title,
              authority_status = EXCLUDED.authority_status,
              retrieval_mode = EXCLUDED.retrieval_mode,
              pipeline_steps = EXCLUDED.pipeline_steps,
              target_blocks = EXCLUDED.target_blocks,
              direction = EXCLUDED.direction,
              content = EXCLUDED.content,
              content_hash = EXCLUDED.content_hash,
              metadata = EXCLUDED.metadata,
              updated_at = now()`,
            [
              card.card_id,
              card.source_doc,
              card.source_page,
              card.title,
              card.authority_status,
              card.retrieval_mode,
              card.pipeline_steps,
              card.target_blocks,
              card.direction,
              card.content,
              card.content_hash,
              JSON.stringify(card.metadata || {}),
            ]
          );
        }
      }
      await db.sql.exec('COMMIT');
    } catch (saveErr) {
      await db.sql.exec('ROLLBACK');
      throw saveErr;
    }

    // 9. Итоговая сводка
    const { rows: stats } = await db.sql.query(`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE retrieval_mode = 'pinned')::int as pinned_count,
        COUNT(*) FILTER (WHERE retrieval_mode = 'search')::int as search_count,
        COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int as embedded_count
      FROM rag_knowledge_cards
    `);

    const summary = stats[0];
    console.log('\n=== СВОДКА ПО БАЗЕ ЗНАНИЙ RAG ===');
    console.log(`Всего карточек в БД:     ${summary.total}`);
    console.log(`Кучка 1 (pinned):        ${summary.pinned_count}`);
    console.log(`Кучка 2 (search):        ${summary.search_count}`);
    console.log(`С эмбеддингом != NULL:   ${summary.embedded_count}`);

    if (summary.total !== 419 || summary.embedded_count !== 419) {
      throw new Error(
        `ОШИБКА: Ожидалось 419 карточек с эмбеддингами, получено всего ${summary.total}, с вектором ${summary.embedded_count}`
      );
    }

    console.log('\n СИДИРОВАНИЕ RAG УСПЕШНО ЗАВЕРШЕНО!');
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error('Ошибка сидирования RAG:', err);
  process.exit(1);
});
