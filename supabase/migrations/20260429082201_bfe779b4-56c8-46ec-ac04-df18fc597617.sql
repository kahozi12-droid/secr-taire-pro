
-- 1. Add order_number to documents
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS order_number TEXT;

-- 2. Other tasks table (Autres traitements)
CREATE TABLE IF NOT EXISTS public.other_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_date DATE NOT NULL DEFAULT CURRENT_DATE,
  detail TEXT NOT NULL,
  observation TEXT,
  position INT NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_other_tasks_date ON public.other_tasks(task_date);

ALTER TABLE public.other_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "other_tasks select authenticated" ON public.other_tasks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "other_tasks insert by secretary" ON public.other_tasks
  FOR INSERT TO authenticated WITH CHECK (is_secretary(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "other_tasks update by secretary" ON public.other_tasks
  FOR UPDATE TO authenticated USING (is_secretary(auth.uid()));
CREATE POLICY "other_tasks delete by secretary" ON public.other_tasks
  FOR DELETE TO authenticated USING (is_secretary(auth.uid()));

CREATE TRIGGER trg_other_tasks_updated
  BEFORE UPDATE ON public.other_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Daily reports archive
CREATE TABLE IF NOT EXISTS public.daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by UUID
);

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_reports select authenticated" ON public.daily_reports
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "daily_reports insert by secretary" ON public.daily_reports
  FOR INSERT TO authenticated WITH CHECK (is_secretary(auth.uid()));
CREATE POLICY "daily_reports update by secretary" ON public.daily_reports
  FOR UPDATE TO authenticated USING (is_secretary(auth.uid()));

-- 4. Snapshot function (security definer, callable by service role / cron)
CREATE OR REPLACE FUNCTION public.snapshot_daily_report(_date DATE DEFAULT CURRENT_DATE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _payload JSONB;
  _id UUID;
BEGIN
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
$$;

-- 5. Schedule the snapshot every day at 18:00
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('daily-report-snapshot');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'daily-report-snapshot',
  '0 18 * * *',
  $$ SELECT public.snapshot_daily_report(CURRENT_DATE); $$
);
