-- ТЗ v1.8, раздел 3.4. Задача 1.4.

-- 1) Закрыть прямой доступ к служебным таблицам
REVOKE ALL ON public.billing_payments, public.admin_audit_log, public.project_guard_events, public.kb_documents
FROM anon, authenticated;

-- 2) RLS на клиентских таблицах. Бэкенд (pipeline-api) ходит под service_role / postgres и RLS обходит.
ALTER TABLE public.app_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_passport_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_profiles_owner ON public.app_profiles
FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY app_projects_owner ON public.app_projects
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY project_sources_owner ON public.project_sources
FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.app_projects p WHERE p.id = project_sources.project_id AND p.user_id = auth.uid())
);

CREATE POLICY passport_records_owner ON public.project_passport_records
FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.app_projects p WHERE p.id = project_passport_records.project_id AND p.user_id = auth.uid())
);

CREATE POLICY project_claims_owner ON public.project_claims
FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.project_passport_records r
        JOIN public.app_projects p ON p.id = r.project_id
        WHERE r.id = project_claims.record_id AND p.user_id = auth.uid()
    )
);

-- 3) Справочники читаемы для авторизованных (лендинг тарифов)
GRANT SELECT ON public.billing_plans TO anon, authenticated;
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_plans_read ON public.billing_plans FOR SELECT TO anon, authenticated USING (true);
