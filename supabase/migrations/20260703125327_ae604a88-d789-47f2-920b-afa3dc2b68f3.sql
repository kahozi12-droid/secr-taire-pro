
-- cloud_trash
CREATE TABLE public.cloud_trash (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_path TEXT NOT NULL,
  trashed_path TEXT NOT NULL,
  size BIGINT NOT NULL DEFAULT 0,
  trashed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trashed_by UUID NOT NULL,
  auto_purge_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cloud_trash TO authenticated;
GRANT ALL ON public.cloud_trash TO service_role;
ALTER TABLE public.cloud_trash ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trash select auth" ON public.cloud_trash FOR SELECT TO authenticated USING (true);
CREATE POLICY "trash insert self" ON public.cloud_trash FOR INSERT TO authenticated WITH CHECK (auth.uid() = trashed_by);
CREATE POLICY "trash delete director" ON public.cloud_trash FOR DELETE TO authenticated USING (public.is_director(auth.uid()));
CREATE INDEX cloud_trash_trashed_at_idx ON public.cloud_trash (trashed_at DESC);

-- cloud_activity_log
CREATE TABLE public.cloud_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  path TEXT,
  target_path TEXT,
  bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.cloud_activity_log TO authenticated;
GRANT ALL ON public.cloud_activity_log TO service_role;
ALTER TABLE public.cloud_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cloud act select auth" ON public.cloud_activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "cloud act insert self" ON public.cloud_activity_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX cloud_activity_log_created_idx ON public.cloud_activity_log (created_at DESC);

-- cloud_sync_log
CREATE TABLE public.cloud_sync_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  direction TEXT NOT NULL,
  scope TEXT NOT NULL,
  files_synced INT NOT NULL DEFAULT 0,
  files_skipped INT NOT NULL DEFAULT 0,
  errors INT NOT NULL DEFAULT 0,
  duration_ms INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.cloud_sync_log TO authenticated;
GRANT ALL ON public.cloud_sync_log TO service_role;
ALTER TABLE public.cloud_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sync log select auth" ON public.cloud_sync_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "sync log insert self" ON public.cloud_sync_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX cloud_sync_log_created_idx ON public.cloud_sync_log (created_at DESC);
