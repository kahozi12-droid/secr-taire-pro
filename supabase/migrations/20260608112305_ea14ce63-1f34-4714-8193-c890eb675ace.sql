
-- 1. Add columns to legal_texts
ALTER TABLE public.legal_texts
  ADD COLUMN IF NOT EXISTS text_type TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT;

CREATE INDEX IF NOT EXISTS idx_legal_texts_text_type ON public.legal_texts(text_type);

-- 2. Cross-references between legal texts
CREATE TABLE IF NOT EXISTS public.legal_text_references (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES public.legal_texts(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES public.legal_texts(id) ON DELETE CASCADE,
  relation TEXT NOT NULL DEFAULT 'related',
  note TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_id, target_id, relation),
  CHECK (source_id <> target_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_text_references TO authenticated;
GRANT ALL ON public.legal_text_references TO service_role;
ALTER TABLE public.legal_text_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "legal_refs select authenticated" ON public.legal_text_references
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "legal_refs insert by secretary" ON public.legal_text_references
  FOR INSERT TO authenticated WITH CHECK (public.is_secretary(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "legal_refs delete by secretary" ON public.legal_text_references
  FOR DELETE TO authenticated USING (public.is_secretary(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_legal_refs_source ON public.legal_text_references(source_id);
CREATE INDEX IF NOT EXISTS idx_legal_refs_target ON public.legal_text_references(target_id);

-- 3. Favorites (per user)
CREATE TABLE IF NOT EXISTS public.legal_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  legal_text_id UUID NOT NULL REFERENCES public.legal_texts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, legal_text_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_favorites TO authenticated;
GRANT ALL ON public.legal_favorites TO service_role;
ALTER TABLE public.legal_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "legal_favorites own" ON public.legal_favorites
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_legal_favorites_user ON public.legal_favorites(user_id);

-- 4. Annotations (per user, per text)
CREATE TABLE IF NOT EXISTS public.legal_annotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  legal_text_id UUID NOT NULL REFERENCES public.legal_texts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_annotations TO authenticated;
GRANT ALL ON public.legal_annotations TO service_role;
ALTER TABLE public.legal_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "legal_annotations own" ON public.legal_annotations
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_legal_annotations_user_text ON public.legal_annotations(user_id, legal_text_id);

CREATE TRIGGER trg_legal_annotations_updated_at
  BEFORE UPDATE ON public.legal_annotations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
