export type RagPipelineStep = 'assembly' | 'audit' | 'novelty' | 'chat';

export type AuthorityStatus = 'verified_8' | 'needs_verification_8' | 'methodology' | 'example';

export type RetrievalMode = 'pinned' | 'search';

export type DirectionCode = 'all' | 'Н1' | 'Н2' | 'Н3' | 'Н4' | 'Н5' | 'Н6' | 'Н7';

export interface RawKnowledgeCard {
  card_id: string;
  source_doc: 'StudStartup_Knowledge_Base_v2' | 'Студ_стартап_сравнение_7_и_8' | 'Примеры_КП_нов_Стс_7' | 'TechLead8';
  source_page: string;
  title: string;
  authority_status: AuthorityStatus;
  retrieval_mode: RetrievalMode;
  pipeline_steps: RagPipelineStep[];
  target_blocks: string[];
  direction: DirectionCode;
  content: string;
  metadata?: Record<string, any>;
}

export interface RagCard extends RawKnowledgeCard {
  content_hash: string;
  metadata: Record<string, any>;
  embedding?: number[] | null;
  created_at?: string;
  updated_at?: string;
  hybrid_score?: number;
  semantic_score?: number;
  fts_score?: number;
  exact_bonus?: number;
}

export interface RetrieveRagOptions {
  step: RagPipelineStep;
  targetBlocks?: (number | string)[]; // Например, [4, 6] или ['all']
  direction?: DirectionCode;
  queryText?: string;                 // Текст проекта / блока / вопроса студента для гибридного поиска
  topKSearch?: number;                // Сколько карточек добирать из поисковой кучки (по умолчанию 5)
  includePinned?: boolean;            // Включать ли обязательное ядро (по умолчанию true для assembly/audit/novelty, для chat можно false или по блокам)
}

export interface RetrieveRagResult {
  pinnedCards: RagCard[];
  searchCards: RagCard[];
  cards: RagCard[];
  formattedContext: string;
}
