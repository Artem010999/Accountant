import type { KbManifest } from '../kb/manifest';
import type { LlmClient } from '../llm/types';
import type { DocumentParser } from '../parser/client';
import type { PassportStore } from '../db/store';

/** Все внешние зависимости пайплайна. В тестах подменяются fake-реализациями. */
export interface PipelineDeps {
  store: PassportStore;
  llm: LlmClient;
  parser: DocumentParser;
  kb: KbManifest;
  logger: Pick<Console, 'error' | 'warn' | 'info'>;
}
