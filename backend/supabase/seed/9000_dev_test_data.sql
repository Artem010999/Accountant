-- ТЕСТОВЫЕ ДАННЫЕ ДЛЯ ЛОКАЛЬНОЙ РАЗРАБОТКИ. Не выполнять в production.
-- Источник: пример из запроса разработчика. Обновить под схему v1.8 (anchor_*, project_claims, review_status).

INSERT INTO app_profiles (id, founder_data, role, is_banned) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', '{"name": "Иван Иванов", "status": "student"}', 'user',  false),
  ('550e8400-e29b-41d4-a716-446655440001', '{"name": "Админ"}',                           'admin', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO app_projects (id, user_id, title, brief_text, anchor_status, status) VALUES
  ('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'Молодежь рядом',
   'Хочу сервис помощи...', 'ready', 'review')
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_sources (id, project_id, file_name, file_url, sha256_hash) VALUES
  ('770e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440002',
   'presentation.pdf', 'https://s3.example.com/...', 'def456hash')
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_passport_records (id, project_id, section_id, field_key, value) VALUES
  ('880e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440002', 3,
   'problem_description', 'Сведения о мерах...')
ON CONFLICT (id) DO NOTHING;

INSERT INTO billing_subscriptions (id, user_id, plan_id, expires_at) VALUES
  ('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', '550e8400-e29b-41d4-a716-446655440000', 'pro', '2026-12-01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO kb_documents (id, program, doc_type, s3_key, sha256_hash, version, valid_from) VALUES
  ('990e8400-e29b-41d4-a716-446655440005', 'Студенческий стартап', 'regulation',
   'kb/fasie/studstartup/reg_v1.pdf', 'xyz789hash', '1.0', '2026-01-01')
ON CONFLICT (id) DO NOTHING;
