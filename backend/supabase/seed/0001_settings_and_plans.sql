-- ТЗ v1.8, раздел 3.4 (п. 3). Идемпотентные seed-данные для любой среды.

INSERT INTO app_settings (id, guard_threshold_block, guard_threshold_warn)
VALUES (1, 0.5, 0.75)
ON CONFLICT (id) DO NOTHING;

INSERT INTO billing_plans (id, name, price_rub, duration_days, file_uploads_limit, renewal_discount_percent, features)
VALUES
  ('free',    'Базовый',           0,    30,  0,  0,  '{"ai_parsing": false, "novelty_check": false, "consultant": false}'::jsonb),
  ('pro',     'Профессиональный',  990,  30,  10, 15, '{"ai_parsing": true,  "novelty_check": true,  "consultant": false}'::jsonb),
  ('premium', 'Премиум',           4990, 30,  50, 10, '{"ai_parsing": true,  "novelty_check": true,  "consultant": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;
