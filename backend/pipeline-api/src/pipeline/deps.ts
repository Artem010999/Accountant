import type { KbManifest } from '../kb/manifest';
import type { LlmClient } from '../llm/types';
import type { DocumentParser } from '../parser/client';
import type { PassportStore } from '../db/store';

/** Поиск карточек базы знаний для консультанта. По умолчанию — RAG из БД (store.ragSearch). */
export type RagSearch = (query: string) => Promise<{ cards: { card_id: string; title: string }[]; context: string }>;

/** Все внешние зависимости пайплайна. В тестах подменяются fake-реализациями. */
export interface PipelineDeps {
  store: PassportStore;
  llm: LlmClient;
  parser: DocumentParser;
  kb: KbManifest;
  logger: Pick<Console, 'error' | 'warn' | 'info'>;
  rag?: RagSearch;
}
