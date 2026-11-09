// Контракт единого Webhook / HTTP-входа пайплайна: POST /pipeline (ТЗ, раздел 3.5).
// Вопрос 3 (вариант А): фронтенд передаёт target_field и previous_question — бэкенд stateless.

import type { ClaimKind, ClaimType, ClaimVerificationStatus } from './enums';

export type PipelineAction = 'init_or_upload' | 'submit_answer';

export interface TargetField {
  section_id: number;
  field_key: string;
}

export interface PipelineFileInput {
  file_name: string;
  file_url: string;     // путь в приватный S3-бакет (s3://bucket/key) или file:// для локальной разработки
  sha256_hash: string;
}

export interface PipelineRequest {
  user_id: string;
  action: PipelineAction;
  program: string;                 // например «Студенческий стартап»
  text_input?: string;
  target_field?: TargetField;      // обязателен для submit_answer в режиме дозаполнения
  previous_question?: string;      // текст вопроса, на который отвечает пользователь
  files?: PipelineFileInput[];
}

export type PipelineErrorCode =
  | 'USER_BANNED'
  | 'PLAN_UPGRADE_REQUIRED'
  | 'FILE_QUOTA_EXCEEDED'
  | 'FILE_HASH_MISMATCH'
  | 'FOUNDER_REQUIRED'
  | 'INVALID_TARGET'
  | 'INTERNAL';

export interface PipelineError {
  status: 'ERROR';
  code: PipelineErrorCode;
  message: string;
}

export interface PipelineQuestion {
  status: 'NEED_USER_INPUT' | 'WAITING_FOR_INITIAL_BRIEF' | 'STOP_NOV' | 'ANSWER_REJECTED';
  step?: 'INITIAL_BRIEF' | 'GAP_FILLING' | 'NOVELTY' | 'ANSWER_VALIDATION';
  target_field?: TargetField;
  question?: string;
  example?: string;
  rejection_reason?: string | null;
}

export interface PipelineSwapBlocked {
  status: 'BLOCKED_PROJECT_SWAP';
  similarity_score: number;
  message: string;
}

export interface PipelineClaimOut {
  claim_text: string;
  claim_type: ClaimType;
  claim_kind: ClaimKind | null;
  source_id: string | null;
  source_locator: { page: number; quote: string } | null;
  span_start: number | null;
  span_end: number | null;
  order_index: number;
  verification_status: ClaimVerificationStatus;
}

export interface PipelinePassportField {
  section_id: number;
  field_key: string;
  value: string | null;
  review_status: string;
  claims: PipelineClaimOut[];
}

export interface PipelineCompleted {
  status: 'COMPLETED';
  eligibility_status: 'ELIGIBLE' | 'NEEDS_CLARIFICATION' | 'NOT_ELIGIBLE';
  summary: string;
  checklist: string[];
  warnings: string[];
  passport: PipelinePassportField[];
}

export type PipelineResponse =
  | PipelineQuestion
  | PipelineSwapBlocked
  | PipelineCompleted
  | PipelineError;
