// Зеркало ENUM-типов из схемы БД v1.8 (backend/supabase/migrations/0001_extensions_and_enums.sql).
// Менять только вместе с миграцией.

export type ClaimType = 'fact' | 'plan' | 'hypothesis' | 'client_statement';

export type ClaimVerificationStatus =
  | 'unverified'
  | 'confirmed_by_source'
  | 'confirmed_by_expert'
  | 'rejected'
  | 'orphaned';

export type AnchorStatus = 'pending' | 'generating' | 'ready' | 'failed' | 'stale';

export type RecordReviewStatus = 'draft' | 'ai_generated' | 'needs_review' | 'reviewed' | 'approved';

export type ProjectStatus = 'draft' | 'generating' | 'review' | 'completed' | 'archived';

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export type PaymentProvider = 'manual' | 'yookassa';

export type GuardAction = 'allowed' | 'allowed_with_warning' | 'blocked';

export type AdminAction =
  | 'role_promoted'
  | 'role_demoted'
  | 'user_banned'
  | 'user_unbanned'
  | 'subscription_granted';

export type ClaimKind = 'number' | 'money' | 'date' | 'sentence' | 'list_item' | 'paragraph';
