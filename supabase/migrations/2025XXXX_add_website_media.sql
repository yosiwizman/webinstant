-- 2025XXXX_add_website_media.sql
CREATE TABLE IF NOT EXISTS public.website_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL,
  kind TEXT NOT NULL DEFAULT 'hero',
  url TEXT NOT NULL,
  alt TEXT,
  width INT,
  height INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_article FOREIGN KEY (article_id)
    REFERENCES public.website_articles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_media_article ON public.website_media(article_id);
