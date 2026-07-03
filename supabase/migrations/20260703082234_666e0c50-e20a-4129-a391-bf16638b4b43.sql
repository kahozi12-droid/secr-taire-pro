
-- 1. Tighten SECURITY DEFINER exposure: revoke EXECUTE from PUBLIC/anon on all
-- SECURITY DEFINER functions in public. Trigger-only functions are revoked from
-- authenticated too (they're never called directly). RPC-callable functions add
-- an in-function role guard so a signed-in user cannot misuse them.

-- Trigger-only functions: revoke from everyone; triggers run as table owner regardless.
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_daily_report_on_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_single_director() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_director_row_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_document_activity() FROM PUBLIC, anon, authenticated;

-- has_role: needed by RLS policies; keep authenticated EXECUTE, block anon/PUBLIC.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- RPC functions the app calls: add explicit role guard inside, restrict grants.
CREATE OR REPLACE FUNCTION public.generate_reference_code(_type public.doc_type, _category_sub text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _year INT := EXTRACT(YEAR FROM CURRENT_DATE);
  _next INT;
  _prefix TEXT := CASE WHEN _type = 'incoming' THEN 'IN' ELSE 'OUT' END;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_secretary(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.document_counter(year, type, last_value)
  VALUES (_year, _type, 1)
  ON CONFLICT (year, type) DO UPDATE
    SET last_value = public.document_counter.last_value + 1
  RETURNING last_value INTO _next;
  RETURN _prefix || '-' || _year || '-' || LPAD(_next::TEXT, 5, '0') || '/' || _category_sub;
END;
$function$;

REVOKE ALL ON FUNCTION public.generate_reference_code(public.doc_type, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_reference_code(public.doc_type, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.snapshot_daily_report(_date date DEFAULT CURRENT_DATE)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _payload JSONB;
  _id UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_secretary(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT jsonb_build_object(
    'date', _date,
    'incoming', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'order_number', order_number,
        'reference_code', reference_code,
        'sender', sender,
        'title', title,
        'description', description
      ) ORDER BY created_at)
      FROM public.documents
      WHERE type = 'incoming' AND document_date = _date
    ), '[]'::jsonb),
    'outgoing', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'order_number', order_number,
        'reference_code', reference_code,
        'recipient', recipient,
        'title', title,
        'description', description
      ) ORDER BY created_at)
      FROM public.documents
      WHERE type = 'outgoing' AND document_date = _date
    ), '[]'::jsonb),
    'other_tasks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'detail', detail,
        'observation', observation
      ) ORDER BY position, created_at)
      FROM public.other_tasks
      WHERE task_date = _date
    ), '[]'::jsonb)
  ) INTO _payload;

  INSERT INTO public.daily_reports (report_date, payload, generated_at)
  VALUES (_date, _payload, now())
  ON CONFLICT (report_date) DO UPDATE
    SET payload = EXCLUDED.payload, generated_at = now()
  RETURNING id INTO _id;

  RETURN _id;
END;
$function$;

REVOKE ALL ON FUNCTION public.snapshot_daily_report(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.snapshot_daily_report(date) TO authenticated;

-- 2. Storage ownership check: require object path to start with the uploader's
-- user id (e.g. "<auth.uid()>/..."). This ties every write to the caller and
-- prevents secretaries from touching each other's paths.
DROP POLICY IF EXISTS "documents storage insert by secretary" ON storage.objects;
CREATE POLICY "documents storage insert by owner secretary" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND public.is_secretary(auth.uid())
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "documents storage update by secretary" ON storage.objects;
CREATE POLICY "documents storage update by owner secretary" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.is_secretary(auth.uid())
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND public.is_secretary(auth.uid())
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "documents storage delete by secretary" ON storage.objects;
CREATE POLICY "documents storage delete by owner secretary" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.is_secretary(auth.uid())
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
