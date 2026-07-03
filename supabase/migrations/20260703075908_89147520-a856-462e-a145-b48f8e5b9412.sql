
-- 1. Align documents UPDATE USING clause with WITH CHECK (restrict to owner)
DROP POLICY IF EXISTS "documents update by secretary" ON public.documents;
CREATE POLICY "documents update by secretary" ON public.documents
  FOR UPDATE TO authenticated
  USING (is_secretary(auth.uid()) AND created_by = auth.uid())
  WITH CHECK (is_secretary(auth.uid()) AND created_by = auth.uid());

-- 2. Restrict storage read to users who can see the corresponding document row
DROP POLICY IF EXISTS "documents storage read authenticated" ON storage.objects;
CREATE POLICY "documents storage read by document access" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.file_path = storage.objects.name
    )
  );

-- 3. document_counter: explicitly document intentional lockdown; only accessible via
-- SECURITY DEFINER generate_reference_code(). Add deny-all policies to make intent explicit
-- so the scanner sees policies exist.
CREATE POLICY "document_counter no direct access" ON public.document_counter
  FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);
COMMENT ON TABLE public.document_counter IS
  'Internal counter. No direct API access. Mutated only by SECURITY DEFINER function public.generate_reference_code().';

-- 4. Reduce SECURITY DEFINER API surface: convert wrapper helpers to SECURITY INVOKER
-- (they only call has_role, which itself remains SECURITY DEFINER because it needs to
-- bypass RLS on user_roles). Revoke EXECUTE from anon on wrappers where possible.
CREATE OR REPLACE FUNCTION public.is_secretary(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$ SELECT public.has_role(_user_id, 'secretary'::app_role) $function$;

CREATE OR REPLACE FUNCTION public.is_director(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$ SELECT public.has_role(_user_id, 'director'::app_role) $function$;

-- Revoke anon access on RLS helpers (anon has no session so never legitimately calls these)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_secretary(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_director(uuid) FROM anon;
-- authenticated must retain EXECUTE on has_role: RLS policies invoke it as the caller.
