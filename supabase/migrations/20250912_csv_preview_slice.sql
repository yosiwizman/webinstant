-- CSV → Preview Slice migration (idempotent)
-- 20250912_csv_preview_slice.sql

-- website_previews: ensure updated_at
ALTER TABLE public.website_previews
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- website_previews: unique slug (nullable; only enforce when present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='uq_website_previews_slug_nonnull'
  ) THEN
    CREATE UNIQUE INDEX uq_website_previews_slug_nonnull
      ON public.website_previews (slug)
      WHERE slug IS NOT NULL;
  END IF;
END $$;

-- updated_at trigger helper
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='set_updated_at') THEN
    CREATE OR REPLACE FUNCTION public.set_updated_at()
    RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN
      NEW.updated_at := now();
      RETURN NEW;
    END;
    $fn$;
  END IF;
END $$;

-- updated_at trigger on website_previews
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname='trg_website_previews_updated_at'
  ) THEN
    CREATE TRIGGER trg_website_previews_updated_at
      BEFORE UPDATE ON public.website_previews
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- operations_log: add correlation_id + index
ALTER TABLE public.operations_log
ADD COLUMN IF NOT EXISTS correlation_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_operations_log_correlation_id'
  ) THEN
    CREATE INDEX idx_operations_log_correlation_id
      ON public.operations_log (correlation_id);
  END IF;
END $$;
