-- ТЗ v1.8, раздел 3.3. Задача 1.3. Исправления багов ТЗ отмечены «Баг №N».

-- 1. COSINE SIMILARITY
CREATE OR REPLACE FUNCTION cosine_similarity(a vector, b vector)
RETURNS float AS $$
    SELECT 1 - (a <=> b);
$$ LANGUAGE SQL IMMUTABLE STRICT;

-- 2. СОЗДАНИЕ ПРОФИЛЯ ПРИ РЕГИСТРАЦИИ (роль всегда 'user')
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.app_profiles (id, founder_data, role, is_banned)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data, '{}'::jsonb), 'user', false)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_handle_new_user
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. АУДИТ РОЛЕЙ И БАНОВ
CREATE OR REPLACE FUNCTION public.log_role_changes()
RETURNS trigger AS $$
BEGIN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        INSERT INTO public.admin_audit_log (actor_id, target_user_id, action)
        VALUES (auth.uid(), NEW.id,
            CASE WHEN NEW.role = 'admin' THEN 'role_promoted'::admin_action ELSE 'role_demoted'::admin_action END);
    END IF;

    IF OLD.is_banned IS DISTINCT FROM NEW.is_banned THEN
        INSERT INTO public.admin_audit_log (actor_id, target_user_id, action)
        VALUES (auth.uid(), NEW.id,
            CASE WHEN NEW.is_banned THEN 'user_banned'::admin_action ELSE 'user_unbanned'::admin_action END);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_log_role_changes
AFTER UPDATE ON public.app_profiles
FOR EACH ROW EXECUTE FUNCTION public.log_role_changes();

-- 4. СИНГЛТОН app_settings
CREATE OR REPLACE FUNCTION public.enforce_app_settings_singleton()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Удаление единственной записи app_settings запрещено';
    END IF;
    IF NEW.id <> 1 THEN
        RAISE EXCEPTION 'В таблице app_settings разрешена только запись с id = 1';
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_app_settings_singleton
BEFORE INSERT OR UPDATE OR DELETE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.enforce_app_settings_singleton();

-- 5. ИНВАЛИДАЦИЯ СПАНОВ ПРИ РУЧНОЙ ПРАВКЕ value (Баг №2: strpos 1-based → pos - 1, 0-based)
CREATE OR REPLACE FUNCTION public.claim_span_invalidation()
RETURNS trigger AS $$
DECLARE
    rec RECORD;
    pos int;
BEGIN
    IF OLD.value IS NOT DISTINCT FROM NEW.value THEN
        RETURN NEW;
    END IF;

    FOR rec IN SELECT id, claim_text FROM public.project_claims WHERE record_id = NEW.id LOOP
        pos := CASE WHEN NEW.value IS NULL OR NEW.value = '' THEN 0 ELSE strpos(NEW.value, rec.claim_text) END;

        IF pos > 0 THEN
            UPDATE public.project_claims
            SET span_start = pos - 1,
                span_end = (pos - 1) + char_length(rec.claim_text),
                updated_at = now()
            WHERE id = rec.id;
        ELSE
            UPDATE public.project_claims
            SET span_start = NULL,
                span_end = NULL,
                verification_status = 'orphaned',
                updated_at = now()
            WHERE id = rec.id;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_claim_span_invalidation
AFTER UPDATE OF value ON public.project_passport_records
FOR EACH ROW EXECUTE FUNCTION public.claim_span_invalidation();

-- 6. СБРОС СОГЛАСОВАНИЯ ПРИ ПРАВКЕ ТЕКСТА (Баг №3: «approved» снимается при изменении value)
CREATE OR REPLACE FUNCTION public.reset_approval_on_value_change()
RETURNS trigger AS $$
BEGIN
    IF OLD.value IS DISTINCT FROM NEW.value AND NEW.review_status = 'approved' THEN
        NEW.review_status := 'ai_generated';
        NEW.reviewed_by := NULL;
        NEW.reviewed_at := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reset_approval_on_value_change
BEFORE UPDATE OF value ON public.project_passport_records
FOR EACH ROW EXECUTE FUNCTION public.reset_approval_on_value_change();

-- 7. ПЕРЕСЧЁТ review_status ЗАПИСИ ПО CLAIMS (Баг №3: добавлен ai_generated)
--    Примечание v1.0: пересчёт построчный (FOR EACH ROW). Батчевый вариант — в backlog.
CREATE OR REPLACE FUNCTION public.recompute_record_review_status()
RETURNS trigger AS $$
DECLARE
    target_record_id uuid;
    total_cnt int;
    bad_cnt int;
    verified_cnt int;
    new_status record_review_status;
BEGIN
    target_record_id := COALESCE(NEW.record_id, OLD.record_id);

    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE verification_status IN ('orphaned', 'rejected')),
        COUNT(*) FILTER (WHERE verification_status IN ('confirmed_by_source', 'confirmed_by_expert'))
    INTO total_cnt, bad_cnt, verified_cnt
    FROM public.project_claims
    WHERE record_id = target_record_id;

    IF total_cnt = 0 THEN
        new_status := 'draft';
    ELSIF bad_cnt > 0 THEN
        new_status := 'needs_review';
    ELSIF verified_cnt = total_cnt THEN
        new_status := 'reviewed';
    ELSE
        new_status := 'ai_generated';
    END IF;

    UPDATE public.project_passport_records
    SET review_status = new_status,
        updated_at = now()
    WHERE id = target_record_id
      AND review_status IS DISTINCT FROM new_status;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recompute_record_review_status
AFTER INSERT OR UPDATE OF verification_status OR DELETE ON public.project_claims
FOR EACH ROW EXECUTE FUNCTION public.recompute_record_review_status();
