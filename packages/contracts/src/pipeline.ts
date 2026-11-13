// Контракт единого Webhook / HTTP-входа пайплайна: POST /pipeline (ТЗ, раздел 3.5).
// Вопрос 3 (вариант А): фронтенд передаёт target_field и previous_question — бэкенд stateless.

import type { BudgetCategory, ClaimKind, ClaimType, ClaimVerificationStatus } from './enums';

/**
 * init_or_upload — бриф/файлы (шаги 1–5);
 * submit_answer — ответ на один пробел (U_LOOP);
 * submit_form — вся форма разом или точечные правки открытых блоков (шаги 3В и 7), без LLM-извлечения.
 */
export type PipelineAction = 'init_or_upload' | 'submit_answer' | 'submit_form';

/** Ответы на анкету допуска: ключ вопроса → ответ «да/нет». Пункты и правила — в kb/programs/…/manifest.json. */
export type EligibilityAnswers = Record<string, boolean>;

/** Одно поле формы. Пустое значение пропускается (поле не очищается). */
export interface FormFieldInput {
  section_id: number;
  field_key: string;
  value: string;
}

/** Строка сметы (Блок «Смета»). Если передан массив budget_items — смета заменяется целиком. */
export interface BudgetItemInput {
  stage: 1 | 2;
  category: BudgetCategory;
  title: string;
  quantity: number;
  unit_price: number;
  amount: number;
  justification?: string;
}

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
  eligibility?: EligibilityAnswers; // анкета допуска; нужна, пока проект не прошёл проверку
  form?: FormFieldInput[];          // для submit_form
  budget_items?: BudgetItemInput[]; // для submit_form: смета целиком
}

export type PipelineErrorCode =
  | 'USER_BANNED'
  | 'PLAN_UPGRADE_REQUIRED'
  | 'FILE_QUOTA_EXCEEDED'
  | 'FILE_HASH_MISMATCH'
  | 'FOUNDER_REQUIRED'
  | 'INVALID_TARGET'
  | 'INVALID_FIELD_VALUE'
  | 'ALREADY_PROCESSING'
  | 'NOT_APPROVED'
  | 'STALE_EXPORT'
  | 'INTERNAL';

export interface PipelineError {
  status: 'ERROR';
  code: PipelineErrorCode;
  message: string;
}

export interface BlockAuditOut {
  section_id: number;
  status: 'approved' | 'needs_review';
  remark: string | null;
  how_to_fix: string | null;
  failed_fields: string[];
}

export interface BudgetAuditOut {
  status: 'approved' | 'needs_review' | 'not_provided';
  remark: string | null;
  how_to_fix: string | null;
  violations: string[];
}

export interface FatalStopFactorOut {
  code: 'MILITARY_OR_DUAL_USE' | 'NO_TECH_BASIS';
  reason: string;
  how_to_fix: string;
  affected_sections: number[];
}

export interface PipelineQuestion {
  status: 'NEED_USER_INPUT' | 'WAITING_FOR_INITIAL_BRIEF' | 'STOP_NOV' | 'ANSWER_REJECTED';
  step?: 'INITIAL_BRIEF' | 'GAP_FILLING' | 'NOVELTY' | 'ANSWER_VALIDATION';
  target_field?: TargetField;
  question?: string;
  example?: string;
  rejection_reason?: string | null;
  block_audits?: BlockAuditOut[];
  budget_audit?: BudgetAuditOut;
  fatal_stop_factors?: FatalStopFactorOut[];
  passport?: PipelinePassportField[];
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
  /** Все блоки и смета одобрены: кнопка «Скачать» активна. */
  export_ready: boolean;
  /** Что ещё не одобрено (пусто, если export_ready = true). */
  not_approved: string[];
  eligibility_status: 'ELIGIBLE' | 'NEEDS_CLARIFICATION' | 'NOT_ELIGIBLE';
  summary: string;
  checklist: string[];
  warnings: string[];
  passport: PipelinePassportField[];
  block_audits?: BlockAuditOut[];
  budget_audit?: BudgetAuditOut;
  fatal_stop_factors?: FatalStopFactorOut[];
}

/** Анкета допуска ещё не пройдена (или заполнена не полностью). */
export interface PipelineEligibilityRequired {
  status: 'ELIGIBILITY_REQUIRED';
  questions: { key: string; question: string }[];
}

/** Финальный отказ на входе: проект переведён в статус rejected. Причины и способы исправления — для показа человеку. */
export interface PipelineRejected {
  status: 'REJECTED';
  reasons: { key: string; reason: string; how_to_fix: string }[];
}

/** Выгрузка готова: файл DOCX хранится в БД, скачивается по download_path (заголовок x-user-id). */
export interface PipelineExportReady {
  status: 'EXPORT_READY';
  export_id: string;
  file_name: string;
  download_path: string;
}

export type PipelineResponse =
  | PipelineQuestion
  | PipelineSwapBlocked
  | PipelineCompleted
  | PipelineEligibilityRequired
  | PipelineRejected
  | PipelineExportReady
  | PipelineError;
