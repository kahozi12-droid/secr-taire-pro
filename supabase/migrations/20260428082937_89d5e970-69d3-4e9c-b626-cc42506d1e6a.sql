
-- Roles enum + user_roles table (security: separate from profiles)
CREATE TYPE public.app_role AS ENUM ('secretary', 'director');
CREATE TYPE public.doc_type AS ENUM ('incoming', 'outgoing');
CREATE TYPE public.doc_status AS ENUM ('pending', 'processed', 'archived');
CREATE TYPE public.outgoing_folder AS ENUM ('technical', 'administration');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'fr' CHECK (language IN ('fr','en')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_secretary(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(_user_id, 'secretary'::app_role) $$;

CREATE OR REPLACE FUNCTION public.is_director(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(_user_id, 'director'::app_role) $$;

-- Documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT NOT NULL UNIQUE,
  type doc_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category_main TEXT NOT NULL,         -- SAE | ETA | CSP | JRG
  category_sub TEXT NOT NULL,          -- e.g. SAE/DG, ETA/MIN, etc.
  color TEXT NOT NULL,                 -- blue | green | yellow | red
  sender TEXT,                          -- for incoming
  recipient TEXT,                       -- for outgoing
  outgoing_folder outgoing_folder,     -- for outgoing only
  status doc_status NOT NULL DEFAULT 'pending',
  file_path TEXT,                       -- storage path
  file_name TEXT,
  mime_type TEXT,
  document_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_documents_type ON public.documents(type);
CREATE INDEX idx_documents_status ON public.documents(status);
CREATE INDEX idx_documents_date ON public.documents(document_date DESC);
CREATE INDEX idx_documents_category ON public.documents(category_main, category_sub);

-- Legal texts
CREATE TABLE public.legal_texts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,              -- e.g. Law, Decree, Regulation
  description TEXT,
  publication_date DATE,
  file_path TEXT,
  file_name TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.legal_texts ENABLE ROW LEVEL SECURITY;

-- Activity log
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,                -- e.g. 'document.created'
  entity_type TEXT,                    -- 'document' | 'legal_text'
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_activity_log_created_at ON public.activity_log(created_at DESC);

-- Yearly counter for unique codes
CREATE TABLE public.document_counter (
  year INT NOT NULL,
  type doc_type NOT NULL,
  last_value INT NOT NULL DEFAULT 0,
  PRIMARY KEY (year, type)
);
ALTER TABLE public.document_counter ENABLE ROW LEVEL SECURITY;

-- Function: generate next reference code
CREATE OR REPLACE FUNCTION public.generate_reference_code(_type doc_type, _category_sub TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _year INT := EXTRACT(YEAR FROM CURRENT_DATE);
  _next INT;
  _prefix TEXT := CASE WHEN _type = 'incoming' THEN 'IN' ELSE 'OUT' END;
BEGIN
  INSERT INTO public.document_counter(year, type, last_value)
  VALUES (_year, _type, 1)
  ON CONFLICT (year, type) DO UPDATE
    SET last_value = public.document_counter.last_value + 1
  RETURNING last_value INTO _next;
  RETURN _prefix || '-' || _year || '-' || LPAD(_next::TEXT, 5, '0') || '/' || _category_sub;
END;
$$;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  -- Default new users to secretary; first user could be promoted manually
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'secretary');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Activity log trigger for documents
CREATE OR REPLACE FUNCTION public.log_document_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_log(user_id, action, entity_type, entity_id, details)
    VALUES (NEW.created_by, 'document.created', 'document', NEW.id,
            jsonb_build_object('reference_code', NEW.reference_code, 'type', NEW.type, 'title', NEW.title));
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activity_log(user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'document.status_changed', 'document', NEW.id,
            jsonb_build_object('from', OLD.status, 'to', NEW.status, 'reference_code', NEW.reference_code));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_log_document
  AFTER INSERT OR UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.log_document_activity();

-- ===== RLS POLICIES =====

-- profiles
CREATE POLICY "profiles select all authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles update own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- user_roles: read all, only system inserts (via trigger / admin via SQL)
CREATE POLICY "user_roles select all authenticated" ON public.user_roles
  FOR SELECT TO authenticated USING (true);

-- documents
CREATE POLICY "documents select authenticated" ON public.documents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "documents insert by secretary" ON public.documents
  FOR INSERT TO authenticated WITH CHECK (public.is_secretary(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "documents update by secretary" ON public.documents
  FOR UPDATE TO authenticated USING (public.is_secretary(auth.uid()));
CREATE POLICY "documents delete by secretary" ON public.documents
  FOR DELETE TO authenticated USING (public.is_secretary(auth.uid()));

-- legal_texts
CREATE POLICY "legal_texts select authenticated" ON public.legal_texts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "legal_texts insert by secretary" ON public.legal_texts
  FOR INSERT TO authenticated WITH CHECK (public.is_secretary(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "legal_texts update by secretary" ON public.legal_texts
  FOR UPDATE TO authenticated USING (public.is_secretary(auth.uid()));
CREATE POLICY "legal_texts delete by secretary" ON public.legal_texts
  FOR DELETE TO authenticated USING (public.is_secretary(auth.uid()));

-- activity_log
CREATE POLICY "activity_log select authenticated" ON public.activity_log
  FOR SELECT TO authenticated USING (true);

-- document_counter: no direct access needed (function uses SECURITY DEFINER)
-- (no policies => no access for normal users; SECURITY DEFINER function bypasses)

-- ===== STORAGE =====
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "documents storage read authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'documents');
CREATE POLICY "documents storage insert by secretary" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents' AND public.is_secretary(auth.uid()));
CREATE POLICY "documents storage update by secretary" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'documents' AND public.is_secretary(auth.uid()));
CREATE POLICY "documents storage delete by secretary" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'documents' AND public.is_secretary(auth.uid()));
