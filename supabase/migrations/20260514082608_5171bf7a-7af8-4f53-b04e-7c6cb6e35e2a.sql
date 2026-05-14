-- Enum for report categories
DO $$ BEGIN
  CREATE TYPE public.report_category AS ENUM ('mission','technical','financial','administrative');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.report_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category public.report_category NOT NULL,
  title text NOT NULL,
  description text,
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  file_path text,
  file_name text,
  mime_type text,
  read_by_director boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  read_by uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_documents_cat_date
  ON public.report_documents (category, report_date DESC);

ALTER TABLE public.report_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_documents select authenticated"
  ON public.report_documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "report_documents insert by secretary"
  ON public.report_documents FOR INSERT TO authenticated
  WITH CHECK (public.is_secretary(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "report_documents update by secretary"
  ON public.report_documents FOR UPDATE TO authenticated
  USING (public.is_secretary(auth.uid()));

CREATE POLICY "report_documents update read by director"
  ON public.report_documents FOR UPDATE TO authenticated
  USING (public.is_director(auth.uid()))
  WITH CHECK (public.is_director(auth.uid()));

CREATE POLICY "report_documents delete by secretary"
  ON public.report_documents FOR DELETE TO authenticated
  USING (public.is_secretary(auth.uid()));

CREATE TRIGGER trg_report_documents_updated
  BEFORE UPDATE ON public.report_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();