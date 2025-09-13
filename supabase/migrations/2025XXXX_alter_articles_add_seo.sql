-- 2025XXXX_alter_articles_add_seo.sql
ALTER TABLE public.website_articles
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_slug TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='ux_articles_slug'
  ) THEN
    CREATE UNIQUE INDEX ux_articles_slug ON public.website_articles(seo_slug);
  END IF;
END $$;
