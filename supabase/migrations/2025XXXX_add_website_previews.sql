-- 2025XXXX_add_website_previews.sql
CREATE TABLE IF NOT EXISTS public.website_previews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_csv_id TEXT NOT NULL,
  row_idx INTEGER NOT NULL,
  url TEXT NOT NULL,
  html_content TEXT,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='ux_previews_source_row'
  ) THEN
    CREATE UNIQUE INDEX ux_previews_source_row
      ON public.website_previews (source_csv_id, row_idx);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS ix_previews_source
  ON public.website_previews(source_csv_id);
