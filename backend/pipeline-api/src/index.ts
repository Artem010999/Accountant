export { handlePipeline } from './pipeline/handler';
export type { PipelineDeps } from './pipeline/deps';
export { PassportStore } from './db/store';
export { fromPgPool, fromPglite, type SqlClient } from './db/sql';
export { applyMigrations } from './db/migrate';
export { loadKbManifest, fieldKb, type KbManifest } from './kb/manifest';
export { OpenAiClient } from './llm/openai';
export { FakeLlm, hashEmbedding } from './llm/fake';
export type { LlmClient, LlmTask } from './llm/types';
export { HttpDocumentParser, type DocumentParser, type ParsedDocument } from './parser/client';
export { createPipelineServer } from './server';
export {
  loadConfig,
  config,
  SUPABASE_DIR,
  deepseekBaseUrl,
  deepseekApiKey,
  deepseekModel,
  kimiBaseUrl,
  kimiApiKey,
  kimiModel,
  embeddingBaseUrl,
  embeddingApiKey,
  embeddingModel,
  embeddingDimensions,
} from './config';

export {
  callDeepSeek,
  callKimi,
  cleanLLMJsonOutput,
  deepseekClient,
  kimiClient,
  chatJson,
  callLLM,
  callLlm,
  type LLMCallOptions,
} from './llm';

export { getEmbedding, createEmbedding, getEmbeddingsBatch, embeddingClient } from './embeddings';
export { wrapUntrustedData, withSecurityGuardrail, SECURITY_GUARDRAIL } from './promptGuard';

export {
  retrieveRagContext,
  getPinnedCards,
  searchHybridCards,
  formatRagCardsForPrompt,
  extractExactCardId,
  extractImportantTokens,
} from './rag/retriever';
export { getRagDb } from './rag/db';
export { STATIC_KNOWLEDGE_CARDS, staticKnowledgeCards } from './rag/staticCards';
export { parseTechLeadExcel } from './rag/techLeadParser';
export type {
  RagPipelineStep,
  AuthorityStatus,
  RetrievalMode,
  DirectionCode,
  RawKnowledgeCard,
  RagCard,
  RetrieveRagOptions,
  RetrieveRagResult,
} from './rag/types';

export {
  CHAT_PATH,
  handleChatRequest,
  sendJson as sendChatJson,
  type ChatOptions,
} from './chat/http';
export {
  chatPostRequestSchema,
  chatGetQuerySchema,
} from './chat/schema';
export {
  getConsultantHistory,
  handleConsultantChat,
  toChatMessageOut,
} from './chat/service';
export {
  consultantSchema,
  type ConsultantOutput,
} from './llm/schemas';

