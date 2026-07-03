
-- 1) Add WITH CHECK to secretary UPDATE policies
ALTER POLICY "daily_reports update by secretary" ON public.daily_reports
  WITH CHECK (public.is_secretary(auth.uid()));

ALTER POLICY "documents update by secretary" ON public.documents
  WITH CHECK (public.is_secretary(auth.uid()) AND created_by = auth.uid());

ALTER POLICY "legal_texts update by secretary" ON public.legal_texts
  WITH CHECK (public.is_secretary(auth.uid()));

ALTER POLICY "other_tasks update by secretary" ON public.other_tasks
  WITH CHECK (public.is_secretary(auth.uid()));

ALTER POLICY "report_documents update by secretary" ON public.report_documents
  WITH CHECK (public.is_secretary(auth.uid()));

-- 2) Restrict broad SELECT policies
-- activity_log: director sees all, users see their own
DROP POLICY IF EXISTS "activity_log select authenticated" ON public.activity_log;
CREATE POLICY "activity_log select director or own" ON public.activity_log
  FOR SELECT TO authenticated
  USING (public.is_director(auth.uid()) OR user_id = auth.uid());

-- profiles: own record + directors see all
DROP POLICY IF EXISTS "profiles select all authenticated" ON public.profiles;
CREATE POLICY "profiles select own or director" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_director(auth.uid()));

-- user_roles: own record + directors see all
DROP POLICY IF EXISTS "user_roles select all authenticated" ON public.user_roles;
CREATE POLICY "user_roles select own or director" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_director(auth.uid()));

-- 3) Fix set_updated_at search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- 4) Revoke EXECUTE on SECURITY DEFINER functions that shouldn't be callable directly.
--    Keep has_role/is_secretary/is_director callable (used inside RLS policies).
REVOKE EXECUTE ON FUNCTION public.snapshot_daily_report(date) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_reference_code(public.doc_type, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_daily_report_on_status_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_document_activity() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated;
