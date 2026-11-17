-- Назначение администратора. Выполняется ВРУЧНУЮ в БД (psql / панель БД), через API это сделать нельзя.
--
-- Шаги:
--   1. Человек регистрируется обычным способом (email → код из письма). Аккаунт появится в app_profiles.
--   2. Выполните ниже, подставив его email. Роль меняется только здесь.
--   3. Админ входит на /admin-panel: сначала basic-auth на сервере, затем email-код (только для role = 'admin').
--
-- Понизить роль обратно: UPDATE app_profiles SET role = 'user' WHERE email = '...';
-- Каждое изменение роли пишется в журнал admin_audit_log триггером trg_log_role_changes.

UPDATE app_profiles
   SET role = 'admin'
 WHERE email = 'admin@example.com'   -- ← подставьте email администратора (в нижнем регистре)
   AND is_banned = false;

-- Проверка: должна вернуться одна строка с role = 'admin'.
SELECT id, email, role FROM app_profiles WHERE role = 'admin';
