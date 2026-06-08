
-- Full-text search support for documents and legal_texts
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('french', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(reference_code, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(sender, '')), 'B') ||
    setweight(to_tsvector('french', coalesce(recipient, '')), 'B') ||
    setweight(to_tsvector('french', coalesce(description, '')), 'C') ||
    setweight(to_tsvector('french', coalesce(category_main, '') || ' ' || coalesce(category_sub, '')), 'C') ||
    setweight(to_tsvector('french', coalesce(file_name, '')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_documents_search ON public.documents USING GIN (search_vector);

ALTER TABLE public.legal_texts
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('french', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(description, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_legal_texts_search ON public.legal_texts USING GIN (search_vector);
