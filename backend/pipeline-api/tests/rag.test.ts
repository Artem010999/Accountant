import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { PIPELINE_API_DIR } from '../src/config';
import { parseTechLeadExcel } from '../src/rag/techLeadParser';
import { STATIC_KNOWLEDGE_CARDS } from '../src/rag/staticCards';
import {
  extractExactCardId,
  extractImportantTokens,
  formatRagCardsForPrompt,
  getPinnedCards,
  searchHybridCards,
  retrieveRagContext,
} from '../src/rag/retriever';
import { fromPglite, toVectorLiteral, type SqlClient } from '../src/db/sql';
import { hashEmbedding } from '../src/llm/fake';
import type { RagCard } from '../src/rag/types';

describe('RAG Module: Разметка, парсинг и гибридный поиск', () => {
  describe('Парсер TechLead8.xlsx', () => {
    it('парсит ровно 357 карточек с правильным заполнением', () => {
      const xlsxPath = resolve(PIPELINE_API_DIR, 'data', 'rag', 'TechLead8.xlsx');
      expect(existsSync(xlsxPath)).toBe(true);

      const cards = parseTechLeadExcel(xlsxPath);
      expect(cards.length).toBe(357);

      // Проверка диапазона ID
      expect(cards[0].card_id).toBe('techlead_8_001');
      expect(cards[356].card_id).toBe('techlead_8_357');

      // Проверка forward-fill и направлений
      expect(cards[0].direction).toBe('Н1');
      expect(cards[0].metadata?.partner).toBe('АО «Медицинские технологии Лтд»');

      // Строки 317 и 322: вызов берётся из тематики при пустом поле вызова
      const card317 = cards.find((c) => c.card_id === 'techlead_8_317');
      expect(card317).toBeDefined();
      expect(card317?.title).toContain('переработки жмыха кофейных зерен');
      expect(card317?.content).toContain('переработки жмыха кофейных зерен');

      const card322 = cards.find((c) => c.card_id === 'techlead_8_322');
      expect(card322).toBeDefined();
      expect(card322?.title).toContain('Разработка синтетических геобиофабрик');

      // Проверка нормализации Н4
      const n4Cards = cards.filter((c) => c.direction === 'Н4');
      expect(n4Cards.length).toBeGreaterThan(0);
      for (const card of n4Cards) {
        expect(card.metadata?.direction_full).toMatch(/^Н4\.Новые приборы/);
      }
    });
  });

  describe('Статические карточки (staticCards.ts)', () => {
    it('содержит ровно 62 карточки с правильным распределением по группам', () => {
      expect(STATIC_KNOWLEDGE_CARDS.length).toBe(62);

      const groupA = STATIC_KNOWLEDGE_CARDS.filter((c) => c.source_doc === 'StudStartup_Knowledge_Base_v2');
      const groupB = STATIC_KNOWLEDGE_CARDS.filter((c) => c.source_doc === 'Студ_стартап_сравнение_7_и_8');
      const groupC = STATIC_KNOWLEDGE_CARDS.filter((c) => c.source_doc === 'Примеры_КП_нов_Стс_7');

      expect(groupA.length).toBe(32);
      expect(groupB.length).toBe(16);
      expect(groupC.length).toBe(14);
    });

    it('полная безопасность: отсутствуют упоминания @dab1703, stud_startup и 40 тыс', () => {
      for (const card of STATIC_KNOWLEDGE_CARDS) {
        const fullText = `${card.title} ${card.content} ${JSON.stringify(card.metadata || {})}`;
        expect(fullText).not.toContain('@dab1703');
        expect(fullText).not.toContain('40 тыс');
        expect(fullText).not.toContain('40000');
        expect(fullText).not.toContain('stud_startup');
      }
    });
  });

  describe('Форматирование карточек для промпта (formatRagCardsForPrompt)', () => {
    it('маркирует статусы источников в соответствии с ТЗ', () => {
      const mockCards: RagCard[] = [
        {
          card_id: 'test_v8',
          source_doc: 'StudStartup_Knowledge_Base_v2',
          source_page: 'стр. 1',
          title: 'Подтверждённый параметр',
          authority_status: 'verified_8',
          retrieval_mode: 'pinned',
          pipeline_steps: ['chat'],
          target_blocks: ['all'],
          direction: 'all',
          content: 'Текст карточки 1',
          content_hash: 'h1',
          metadata: {},
        },
        {
          card_id: 'test_nv8',
          source_doc: 'Студ_стартап_сравнение_7_и_8',
          source_page: 'слайд 5',
          title: 'Ориентир',
          authority_status: 'needs_verification_8',
          retrieval_mode: 'pinned',
          pipeline_steps: ['audit'],
          target_blocks: ['7'],
          direction: 'all',
          content: 'Текст карточки 2',
          content_hash: 'h2',
          metadata: {},
        },
        {
          card_id: 'test_meth',
          source_doc: 'StudStartup_Knowledge_Base_v2',
          source_page: 'стр. 8',
          title: 'Методика',
          authority_status: 'methodology',
          retrieval_mode: 'pinned',
          pipeline_steps: ['assembly'],
          target_blocks: ['3'],
          direction: 'all',
          content: 'Текст карточки 3',
          content_hash: 'h3',
          metadata: {},
        },
        {
          card_id: 'test_ex',
          source_doc: 'Примеры_КП_нов_Стс_7',
          source_page: 'стр. 2',
          title: 'Пример КП',
          authority_status: 'example',
          retrieval_mode: 'search',
          pipeline_steps: ['assembly'],
          target_blocks: ['5'],
          direction: 'Н1',
          content: 'Текст карточки 4',
          content_hash: 'h4',
          metadata: {},
        },
      ];

      const formatted = formatRagCardsForPrompt(mockCards);

      expect(formatted).toContain('[СТАТУС: ОФИЦИАЛЬНО ПОДТВЕРЖДЕНО ДЛЯ 8-Й ОЧЕРЕДИ]');
      expect(formatted).toContain(
        '[СТАТУС: РАБОЧИЙ ОРИЕНТИР (ПЕРЕСКАЗ / 7-Я ОЧЕРЕДЬ) — ТРЕБУЕТ СВЕРКИ С ПОЛОЖЕНИЕМ 8-Й ОЧЕРЕДИ]'
      );
      expect(formatted).toContain('[СТАТУС: МЕТОДИКА ПОДГОТОВКИ И ПРОВЕРКИ ЗАЯВКИ]');
      expect(formatted).toContain(
        '[СТАТУС: УЧЕБНЫЙ ПРИМЕР — ИСПОЛЬЗОВАТЬ ТОЛЬКО КАК ОБРАЗЕЦ СТРУКТУРЫ, ЗАПРЕЩЕНО КОПИРОВАТЬ ФАКТЫ И ЦИФРЫ В ПРОЕКТ КЛИЕНТА]'
      );
      expect(formatted).toContain('Карточка 1 (test_v8)');
      expect(formatted).toContain('Карточка 4 (test_ex)');
    });
  });

  describe('Детектор точных вызовов и токенов', () => {
    it('распознает номера вызовов в различных форматах', () => {
      expect(extractExactCardId('вызов № 54 корпоративный ассистент')).toBe('techlead_8_054');
      expect(extractExactCardId('вызов 317 по переработке')).toBe('techlead_8_317');
      expect(extractExactCardId('вызова №1')).toBe('techlead_8_001');
      expect(extractExactCardId('techlead_8_208')).toBe('techlead_8_208');
      expect(extractExactCardId('просто текст без вызова')).toBeNull();
      expect(extractExactCardId('вызов № 999')).toBeNull(); // больше 357
    });

    it('извлекает значимые ключевые токены и числа', () => {
      const tokens1 = extractImportantTokens('лимит 250 000 рублей на подрядчиков и 150 000 на технику');
      expect(tokens1).toContain('250 000');
      expect(tokens1).toContain('250000');
      expect(tokens1).toContain('150 000');
      expect(tokens1).toContain('150000');

      const tokens2 = extractImportantTokens('взнос на травматизм 2959 рублей на АУСН');
      expect(tokens2).toContain('2959');
      expect(tokens2).toContain('АУСН');
      expect(tokens2).toContain('травматизм');
    });
  });

  describe('SQL-выборка Кучки 1 (getPinnedCards)', () => {
    let pglite: PGlite;
    let sql: SqlClient;

    beforeAll(async () => {
      pglite = new PGlite({ extensions: { vector } });
      await pglite.exec(`
        CREATE EXTENSION IF NOT EXISTS vector;
        CREATE TABLE IF NOT EXISTS rag_knowledge_cards (
          card_id TEXT PRIMARY KEY,
          source_doc TEXT NOT NULL,
          source_page TEXT NOT NULL,
          title TEXT NOT NULL,
          authority_status TEXT NOT NULL,
          retrieval_mode TEXT NOT NULL,
          pipeline_steps TEXT[] NOT NULL,
          target_blocks TEXT[] NOT NULL,
          direction TEXT NOT NULL DEFAULT 'all',
          content TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          search_tsv tsvector GENERATED ALWAYS AS (
              setweight(to_tsvector('russian', coalesce(title, '')), 'A') ||
              setweight(to_tsvector('russian', coalesce(content, '')), 'B')
          ) STORED,
          embedding vector(4096),
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);

      sql = fromPglite(pglite);

      // Вставляем тестовый набор карточек
      for (const card of STATIC_KNOWLEDGE_CARDS) {
        const dummyVec = hashEmbedding(card.title + '\n' + card.content);
        await sql.query(
          `INSERT INTO rag_knowledge_cards (
            card_id, source_doc, source_page, title, authority_status, retrieval_mode,
            pipeline_steps, target_blocks, direction, content, content_hash, metadata, embedding
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::vector)`,
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
            'hash_' + card.card_id,
            JSON.stringify(card.metadata || {}),
            toVectorLiteral(dummyVec),
          ]
        );
      }
    });

    afterAll(async () => {
      await pglite.close();
    });

    it('гарантированно возвращает приколотые карточки для шага audit и блока 6', async () => {
      const pinned = await getPinnedCards(sql, {
        step: 'audit',
        targetBlocks: [6],
      });

      const ids = pinned.map((c) => c.card_id);
      expect(ids).toContain('kb_06_problem_prod_tech');
      expect(ids).toContain('kb_07_market_analogs_team');
      expect(ids).toContain('kb_ex03_tech_novelty');
      expect(ids).toContain('kb_ex04_competitors');
      expect(ids).toContain('kb_prompt_3');
    });

    it('retrieveRagContext включает pinned карточки даже при пустом queryText', async () => {
      const ctx = await retrieveRagContext(sql, {
        step: 'audit',
        targetBlocks: ['6'],
        queryText: '',
      });

      expect(ctx.pinnedCards.length).toBeGreaterThan(0);
      expect(ctx.formattedContext).toContain('kb_06_problem_prod_tech');
      expect(ctx.formattedContext).toContain('kb_ex04_competitors');
    });
  });
});
