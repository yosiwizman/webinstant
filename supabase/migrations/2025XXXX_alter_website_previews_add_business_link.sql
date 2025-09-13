-- 2025XXXX_alter_website_previews_add_business_link.sql
-- Align website_previews with app usage (business link + preview fields)

ALTER TABLE public.website_previews
  ADD COLUMN IF NOT EXISTS business_id UUID,
  ADD COLUMN IF NOT EXISTS preview_url TEXT,
  ADD COLUMN IF NOT EXISTS template_used TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- FK to businesses (nullable to preserve existing CSV-only rows)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_website_previews_business'
  ) THEN
    ALTER TABLE public.website_previews
      ADD CONSTRAINT fk_website_previews_business
      FOREIGN KEY (business_id)
      REFERENCES public.businesses(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes for lookups and uniqueness
CREATE INDEX IF NOT EXISTS ix_previews_business ON public.website_previews(business_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_previews_slug ON public.website_previews(slug);