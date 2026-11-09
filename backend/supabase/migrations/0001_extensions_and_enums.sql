-- ТЗ v1.8, раздел 3.2 (п. 0–1). Задача 1.1.
-- Порядок миграций важен: 0001 → 0002 → 0003 → 0004 → seed.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE claim_type AS ENUM ('fact', 'plan', 'hypothesis', 'client_statement');
CREATE TYPE claim_verification_status AS ENUM ('unverified', 'confirmed_by_source', 'confirmed_by_expert', 'rejected', 'orphaned');
CREATE TYPE anchor_status AS ENUM ('pending', 'generating', 'ready', 'failed', 'stale');
CREATE TYPE record_review_status AS ENUM ('draft', 'ai_generated', 'needs_review', 'reviewed', 'approved');
CREATE TYPE project_status AS ENUM ('draft', 'generating', 'review', 'completed', 'archived');
CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded');
CREATE TYPE payment_provider AS ENUM ('manual', 'yookassa');
CREATE TYPE guard_action AS ENUM ('allowed', 'allowed_with_warning', 'blocked');
CREATE TYPE admin_action AS ENUM ('role_promoted', 'role_demoted', 'user_banned', 'user_unbanned', 'subscription_granted');
