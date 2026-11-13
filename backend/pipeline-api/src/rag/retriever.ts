import type { SqlClient } from '../db/sql';
import { toVectorLiteral } from '../db/sql';
import { getEmbedding } from '../embeddings';
import type { RagCard, RagPipelineStep, RetrieveRagOptions, RetrieveRagResult, DirectionCode } from './types';

/**
 * Извлечение точного ID технологического вызова из текста запроса.
 * Например: "вызов № 54", "вызов 54", "techlead_8_054".
 */
export function extractExactCardId(queryText: string): string | null {
  const match = queryText.match(/(?:вызов[а-я]*\s*№?\s*|techlead_8_)(\d{1,3})\b/i);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  if (num >= 1 && num <= 357) {
    return `techlead_8_${String(num).padStart(3, '0')}`;
  }
  return null;
}

/**
 * Извлечение ключевых числовых значений, сокращений и названий партнеров.
 */
export function extractImportantTokens(queryText: string): string[] {
  const tokens = new Set<string>();

  // Числовые маркеры (с пробелами и без)
  const numberPatterns = [
    /250\s*000/gi,
    /150\s*000/gi,
    /2\s*959/gi,
    /980\s*000/gi,
    /20\s*000/gi,
    /100\s*000/gi,
    /1\s*000\s*000/gi,
    /27\s*093/gi,
    /8\s*127/gi,
  ];

  for (const pat of numberPatterns) {
    const matches = queryText.match(pat);
    if (matches) {
      for (const m of matches) {
        tokens.add(m.trim());
        tokens.add(m.replace(/\s+/g, ''));
      }
    }
  }

  // Ключевые термины и сокращения (без использования \b, так как \b в JS не поддерживает кириллицу)
  const termPatterns = [
    /(?<![а-яёА-ЯЁa-zA-Z0-9])АУСН(?![а-яёА-ЯЁa-zA-Z0-9])/giu,
    /(?<![а-яёА-ЯЁa-zA-Z0-9])ЕФС-1(?![а-яёА-ЯЁa-zA-Z0-9])/giu,
    /(?<![а-яёА-ЯЁa-zA-Z0-9])Сколково(?![а-яёА-ЯЁa-zA-Z0-9])/giu,
    /(?<![а-яёА-ЯЁa-zA-Z0-9])УМНИК(?![а-яёА-ЯЁa-zA-Z0-9])/giu,
    /(?<![а-яёА-ЯЁa-zA-Z0-9])МРОТ(?![а-яёА-ЯЁa-zA-Z0-9])/giu,
    /(?<![а-яёА-ЯЁa-zA-Z0-9])НПТЛ(?![а-яёА-ЯЁa-zA-Z0-9])/giu,
    /(?<![а-яёА-ЯЁa-zA-Z0-9])РИД(?![а-яёА-ЯЁa-zA-Z0-9])/giu,
    /(?<![а-яёА-ЯЁa-zA-Z0-9])БВС(?![а-яёА-ЯЁa-zA-Z0-9])/giu,
    /(?<![а-яёА-ЯЁa-zA-Z0-9])БПЛА(?![а-яёА-ЯЁa-zA-Z0-9])/giu,
    /(?<![а-яёА-ЯЁa-zA-Z0-9])травматизм[а-я]*|травматизм(?![а-яёА-ЯЁa-zA-Z0-9])/giu,
    /(?<![а-яёА-ЯЁa-zA-Z0-9])подрядчик[а-я]*(?![а-яёА-ЯЁa-zA-Z0-9])/giu,
    /(?<![а-яёА-ЯЁa-zA-Z0-9])вычислительн[а-я]*\s*техник[а-я]*(?![а-яёА-ЯЁa-zA-Z0-9])/giu,
    /(?<![а-яёА-ЯЁa-zA-Z0-9])РЖД(?![а-яёА-ЯЁa-zA-Z0-9])/giu,
    /(?<![а-яёА-ЯЁa-zA-Z0-9])Татнефть(?![а-яёА-ЯЁa-zA-Z0-9])/giu,
    /(?<![а-яёА-ЯЁa-zA-Z0-9])Газпром(?![а-яёА-ЯЁa-zA-Z0-9])/giu,
    /(?<![а-яёА-ЯЁa-zA-Z0-9])Вебпрактик(?![а-яёА-ЯЁa-zA-Z0-9])/giu,
    /(?<![а-яёА-ЯЁa-zA-Z0-9])Гарпикс(?![а-яёА-ЯЁa-zA-Z0-9])/giu,
    /(?<![а-яёА-ЯЁa-zA-Z0-9])Геоскан(?![а-яёА-ЯЁa-zA-Z0-9])/giu,
    /(?<![а-яёА-ЯЁa-zA-Z0-9])Моторика(?![а-яёА-ЯЁa-zA-Z0-9])/giu,
    /(?<![а-яёА-ЯЁa-zA-Z0-9])РОББО(?![а-яёА-ЯЁa-zA-Z0-9])/giu,
    /(?<![а-яёА-ЯЁa-zA-Z0-9])Башкирэнерго(?![а-яёА-ЯЁa-zA-Z0-9])/giu,
    /(?<![а-яёА-ЯЁa-zA-Z0-9])Органик-парк(?![а-яёА-ЯЁa-zA-Z0-9])/giu,
    /(?<![а-яёА-ЯЁa-zA-Z0-9])Агроплазма(?![а-яёА-ЯЁa-zA-Z0-9])/giu,
  ];

  for (const pat of termPatterns) {
    const matches = queryText.match(pat);
    if (matches) {
      for (const m of matches) {
        tokens.add(m.trim());
      }
    }
  }

  return Array.from(tokens);
}

/**
 * Выборка Кучки 1: «Обязательное ядро» (retrieval_mode = 'pinned').
 */
export async function getPinnedCards(
  sql: SqlClient,
  opts: {
    step: RagPipelineStep;
    targetBlocks?: (number | string)[];
    direction?: DirectionCode;
  }
): Promise<RagCard[]> {
  const params: unknown[] = [opts.step];
  let blocksFilter = '';
  let directionFilter = '';

  if (opts.targetBlocks && opts.targetBlocks.length > 0) {
    const stringBlocks = opts.targetBlocks.map(String);
    if (!stringBlocks.includes('all')) {
      params.push(stringBlocks);
      blocksFilter = ` AND ('all' = ANY(target_blocks) OR target_blocks && $${params.length}::text[])`;
    }
  }

  if (opts.direction && opts.direction !== 'all') {
    params.push(opts.direction);
    directionFilter = ` AND direction IN ('all', $${params.length})`;
  }

  const query = `
    SELECT card_id, source_doc, source_page, title, authority_status, retrieval_mode,
           pipeline_steps, target_blocks, direction, content, content_hash, metadata
    FROM rag_knowledge_cards
    WHERE retrieval_mode = 'pinned'
      AND $1 = ANY(pipeline_steps)
      ${blocksFilter}
      ${directionFilter}
    ORDER BY card_id ASC
  `;

  const { rows } = await sql.query(query, params);
  return rows.map((r: any) => ({
    ...r,
    pipeline_steps: Array.isArray(r.pipeline_steps) ? r.pipeline_steps : [],
    target_blocks: Array.isArray(r.target_blocks) ? r.target_blocks : [],
    metadata: typeof r.metadata === 'object' && r.metadata !== null ? r.metadata : {},
  }));
}

/**
 * Выборка Кучки 2: Двойной (гибридный) поиск.
 */
export async function searchHybridCards(
  sql: SqlClient,
  opts: {
    step: RagPipelineStep;
    queryText: string;
    direction?: DirectionCode;
    targetBlocks?: (number | string)[];
    topKSearch?: number;
  }
): Promise<RagCard[]> {
  const queryText = opts.queryText.trim();
  if (!queryText) return [];

  const exactCardId = extractExactCardId(queryText);
  const importantTokens = extractImportantTokens(queryText);

  // Векторизация запроса (с отказоустойчивым FTS-фоллбэком при сетевом сбое внешнего сервиса эмбеддингов)
  let queryVectorLiteral: string | null = null;
  try {
    const queryEmbedding = await getEmbedding(queryText);
    queryVectorLiteral = toVectorLiteral(queryEmbedding);
  } catch (embErr) {
    // Внешний сервис эмбеддингов недоступен или вернул ошибку — переключаемся на FTS
  }

  // Определение режимов выборки:
  // Для chat — по обеим кучкам ('pinned', 'search')
  // Для assembly, audit, novelty — только 'search'
  const allowedModes = opts.step === 'chat' ? ['pinned', 'search'] : ['search'];

  if (!queryVectorLiteral) {
    const params: unknown[] = [
      opts.step, // $1
      queryText, // $2
      allowedModes, // $3
      exactCardId, // $4
      importantTokens.length > 0 ? importantTokens : null, // $5
    ];

    let directionFilter = '';
    if (opts.direction && opts.direction !== 'all') {
      params.push(opts.direction);
      directionFilter = ` AND direction IN ('all', $${params.length})`;
    }

    let blocksFilter = '';
    if (opts.targetBlocks && opts.targetBlocks.length > 0) {
      const stringBlocks = opts.targetBlocks.map(String);
      if (!stringBlocks.includes('all')) {
        params.push(stringBlocks);
        blocksFilter = ` AND ('all' = ANY(target_blocks) OR target_blocks && $${params.length}::text[])`;
      }
    }

    params.push(opts.topKSearch ?? 5);
    const limitParam = `$${params.length}`;

    const query = `
      SELECT
        card_id, source_doc, source_page, title, authority_status, retrieval_mode,
        pipeline_steps, target_blocks, direction, content, content_hash, metadata,
        0.0 AS semantic_score,
        LEAST(COALESCE(ts_rank_cd(search_tsv, websearch_to_tsquery('russian', $2)), 0), 1.0) AS fts_score,
        (
          CASE WHEN $4::text IS NOT NULL AND card_id = $4 THEN 1.0 ELSE 0.0 END
          +
          CASE
            WHEN $5::text[] IS NOT NULL AND cardinality($5::text[]) > 0 THEN
              CASE WHEN EXISTS (
                SELECT 1 FROM unnest($5::text[]) tok
                WHERE content ILIKE ('%' || tok || '%') OR title ILIKE ('%' || tok || '%')
              ) THEN 0.15 ELSE 0.0 END
            ELSE 0.0
          END
        ) AS exact_bonus,
        (
          (0.85 * LEAST(COALESCE(ts_rank_cd(search_tsv, websearch_to_tsquery('russian', $2)), 0), 1.0))
          +
          (
            CASE WHEN $4::text IS NOT NULL AND card_id = $4 THEN 1.0 ELSE 0.0 END
            +
            CASE
              WHEN $5::text[] IS NOT NULL AND cardinality($5::text[]) > 0 THEN
                CASE WHEN EXISTS (
                  SELECT 1 FROM unnest($5::text[]) tok
                  WHERE content ILIKE ('%' || tok || '%') OR title ILIKE ('%' || tok || '%')
                ) THEN 0.15 ELSE 0.0 END
              ELSE 0.0
            END
          )
        ) AS hybrid_score
      FROM rag_knowledge_cards
      WHERE $1 = ANY(pipeline_steps)
        AND retrieval_mode = ANY($3::text[])
        ${directionFilter}
        ${blocksFilter}
      ORDER BY hybrid_score DESC
      LIMIT ${limitParam}
    `;

    const { rows } = await sql.query(query, params);
    return rows.map((r: any) => ({
      ...r,
      pipeline_steps: Array.isArray(r.pipeline_steps) ? r.pipeline_steps : [],
      target_blocks: Array.isArray(r.target_blocks) ? r.target_blocks : [],
      metadata: typeof r.metadata === 'object' && r.metadata !== null ? r.metadata : {},
      semantic_score: Number(r.semantic_score ?? 0),
      fts_score: Number(r.fts_score ?? 0),
      exact_bonus: Number(r.exact_bonus ?? 0),
      hybrid_score: Number(r.hybrid_score ?? 0),
    }));
  }

  const params: unknown[] = [
    opts.step, // $1
    queryVectorLiteral, // $2
    queryText, // $3
    allowedModes, // $4
    exactCardId, // $5
    importantTokens.length > 0 ? importantTokens : null, // $6
  ];

  let directionFilter = '';
  if (opts.direction && opts.direction !== 'all') {
    params.push(opts.direction);
    directionFilter = ` AND direction IN ('all', $${params.length})`;
  }

  let blocksFilter = '';
  if (opts.targetBlocks && opts.targetBlocks.length > 0) {
    const stringBlocks = opts.targetBlocks.map(String);
    if (!stringBlocks.includes('all')) {
      params.push(stringBlocks);
      blocksFilter = ` AND ('all' = ANY(target_blocks) OR target_blocks && $${params.length}::text[])`;
    }
  }

  params.push(opts.topKSearch ?? 5);
  const limitParam = `$${params.length}`;

  const query = `
    SELECT
      card_id, source_doc, source_page, title, authority_status, retrieval_mode,
      pipeline_steps, target_blocks, direction, content, content_hash, metadata,
      (1 - (embedding <=> $2::vector(4096))) AS semantic_score,
      LEAST(COALESCE(ts_rank_cd(search_tsv, websearch_to_tsquery('russian', $3)), 0), 1.0) AS fts_score,
      (
        CASE WHEN $5::text IS NOT NULL AND card_id = $5 THEN 1.0 ELSE 0.0 END
        +
        CASE
          WHEN $6::text[] IS NOT NULL AND cardinality($6::text[]) > 0 THEN
            CASE WHEN EXISTS (
              SELECT 1 FROM unnest($6::text[]) tok
              WHERE content ILIKE ('%' || tok || '%') OR title ILIKE ('%' || tok || '%')
            ) THEN 0.15 ELSE 0.0 END
          ELSE 0.0
        END
      ) AS exact_bonus,
      (
        (0.65 * (1 - (embedding <=> $2::vector(4096))))
        +
        (0.25 * LEAST(COALESCE(ts_rank_cd(search_tsv, websearch_to_tsquery('russian', $3)), 0), 1.0))
        +
        (
          CASE WHEN $5::text IS NOT NULL AND card_id = $5 THEN 1.0 ELSE 0.0 END
          +
          CASE
            WHEN $6::text[] IS NOT NULL AND cardinality($6::text[]) > 0 THEN
              CASE WHEN EXISTS (
                SELECT 1 FROM unnest($6::text[]) tok
                WHERE content ILIKE ('%' || tok || '%') OR title ILIKE ('%' || tok || '%')
              ) THEN 0.15 ELSE 0.0 END
            ELSE 0.0
          END
        )
      ) AS hybrid_score
    FROM rag_knowledge_cards
    WHERE embedding IS NOT NULL
      AND $1 = ANY(pipeline_steps)
      AND retrieval_mode = ANY($4::text[])
      ${directionFilter}
      ${blocksFilter}
    ORDER BY hybrid_score DESC
    LIMIT ${limitParam}
  `;

  const { rows } = await sql.query(query, params);
  return rows.map((r: any) => ({
    ...r,
    pipeline_steps: Array.isArray(r.pipeline_steps) ? r.pipeline_steps : [],
    target_blocks: Array.isArray(r.target_blocks) ? r.target_blocks : [],
    metadata: typeof r.metadata === 'object' && r.metadata !== null ? r.metadata : {},
    semantic_score: Number(r.semantic_score ?? 0),
    fts_score: Number(r.fts_score ?? 0),
    exact_bonus: Number(r.exact_bonus ?? 0),
    hybrid_score: Number(r.hybrid_score ?? 0),
  }));
}

/**
 * Превращает найденные карточки в понятный для LLM текстовый блок с жёсткой маркировкой статуса.
 */
export function formatRagCardsForPrompt(cards: RagCard[]): string {
  if (cards.length === 0) return '';

  const statusLabels: Record<string, string> = {
    verified_8: '[СТАТУС: ОФИЦИАЛЬНО ПОДТВЕРЖДЕНО ДЛЯ 8-Й ОЧЕРЕДИ]',
    needs_verification_8: '[СТАТУС: РАБОЧИЙ ОРИЕНТИР (ПЕРЕСКАЗ / 7-Я ОЧЕРЕДЬ) — ТРЕБУЕТ СВЕРКИ С ПОЛОЖЕНИЕМ 8-Й ОЧЕРЕДИ]',
    methodology: '[СТАТУС: МЕТОДИКА ПОДГОТОВКИ И ПРОВЕРКИ ЗАЯВКИ]',
    example: '[СТАТУС: УЧЕБНЫЙ ПРИМЕР — ИСПОЛЬЗОВАТЬ ТОЛЬКО КАК ОБРАЗЕЦ СТРУКТУРЫ, ЗАПРЕЩЕНО КОПИРОВАТЬ ФАКТЫ И ЦИФРЫ В ПРОЕКТ КЛИЕНТА]',
  };

  return cards
    .map((card, idx) => {
      const statusLabel = statusLabels[card.authority_status] || `[СТАТУС: ${card.authority_status}]`;
      const header = `### Карточка ${idx + 1} (${card.card_id}): ${card.title}\nИсточник: ${card.source_doc}, ${card.source_page}\n${statusLabel}`;
      return `${header}\n\n${card.content}`;
    })
    .join('\n\n---\n\n');
}

/**
 * Единый модуль извлечения контекста базы знаний по «Двум кучкам».
 */
export async function retrieveRagContext(sql: SqlClient, opts: RetrieveRagOptions): Promise<RetrieveRagResult> {
  const includePinned = opts.includePinned ?? (opts.step !== 'chat');

  const pinnedCards = includePinned
    ? await getPinnedCards(sql, {
        step: opts.step,
        targetBlocks: opts.targetBlocks,
        direction: opts.direction,
      })
    : [];

  let searchCards: RagCard[] = [];
  if (opts.queryText && opts.queryText.trim()) {
    try {
      searchCards = await searchHybridCards(sql, {
        step: opts.step,
        queryText: opts.queryText,
        direction: opts.direction,
        targetBlocks: opts.targetBlocks,
        topKSearch: opts.topKSearch ?? 5,
      });
    } catch (err) {
      console.warn('[retriever] searchHybridCards failed, proceeding with pinned cards:', err);
    }
  }

  // Объединяем дедуплицируя карточки
  const cardMap = new Map<string, RagCard>();
  for (const card of pinnedCards) {
    cardMap.set(card.card_id, card);
  }
  for (const card of searchCards) {
    if (!cardMap.has(card.card_id)) {
      cardMap.set(card.card_id, card);
    }
  }

  const cards = Array.from(cardMap.values());
  const formattedContext = formatRagCardsForPrompt(cards);

  return {
    pinnedCards,
    searchCards,
    cards,
    formattedContext,
  };
}
