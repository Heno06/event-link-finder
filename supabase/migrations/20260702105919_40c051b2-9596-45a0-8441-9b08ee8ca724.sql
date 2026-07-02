
CREATE TABLE public.sheet_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  event_spreadsheet_url TEXT NOT NULL,
  event_tab TEXT NOT NULL,
  org_spreadsheet_url TEXT NOT NULL,
  org_tab TEXT NOT NULL,
  contacts_spreadsheet_url TEXT NOT NULL,
  contacts_tab TEXT NOT NULL,
  row_limit INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sheet_configs TO authenticated;
GRANT ALL ON public.sheet_configs TO service_role;
ALTER TABLE public.sheet_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users manage sheet_configs" ON public.sheet_configs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.org_aliases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alias TEXT NOT NULL,
  canonical_name TEXT,
  record_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX org_aliases_alias_idx ON public.org_aliases (lower(alias));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_aliases TO authenticated;
GRANT ALL ON public.org_aliases TO service_role;
ALTER TABLE public.org_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users manage org_aliases" ON public.org_aliases FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.org_match_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  input_normalized TEXT NOT NULL UNIQUE,
  input_original TEXT NOT NULL,
  record_id TEXT NOT NULL,
  canonical_name TEXT,
  confidence NUMERIC,
  method TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_match_cache TO authenticated;
GRANT ALL ON public.org_match_cache TO service_role;
ALTER TABLE public.org_match_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users manage org_match_cache" ON public.org_match_cache FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.match_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID REFERENCES public.sheet_configs(id) ON DELETE SET NULL,
  run_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  processed INTEGER NOT NULL DEFAULT 0,
  matched INTEGER NOT NULL DEFAULT 0,
  total INTEGER,
  unmatched JSONB,
  message TEXT,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_runs TO authenticated;
GRANT ALL ON public.match_runs TO service_role;
ALTER TABLE public.match_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users manage match_runs" ON public.match_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);
