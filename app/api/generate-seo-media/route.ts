import { NextRequest, NextResponse } from 'next/server'
import pLimit from 'p-limit'
import crypto from 'node:crypto'
import { getServerSupabase } from '@/lib/supabaseClient'
import { GenerateSeoMediaRequestSchema } from '@/packages/shared/types'

// Lightweight logger to avoid external dependency on 'pino'
const baseLog = {
  info: (...args: any[]) => console.log(...args),
  warn: (...args: any[]) => console.warn(...args),
  child: (extra: Record<string, unknown>) => ({
    info: (obj: any) => console.log({ ...obj, ...extra }),
    warn: (obj: any) => console.warn({ ...obj, ...extra }),
  }),
}

const MEDIA_PROVIDER_URL = process.env.MEDIA_PROVIDER_URL || ''
const MEDIA_MOCK = (process.env.MEDIA_MOCK || '').toLowerCase() === 'true'

export async function POST(req: NextRequest) {
  const correlationId = crypto.randomUUID()
  const log = baseLog.child({ correlationId, slice: 'seo-media' })
  const supabase = getServerSupabase()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = GenerateSeoMediaRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { csvId, limit = 5, overwrite = false } = parsed.data

  // Select candidate articles via previews join by csvId
  // Prefer articles missing SEO or hero media first
  const rpcRes = await supabase
    .rpc('select_seo_media_candidates', { p_csv_id: csvId, p_limit: Math.min(20, Math.max(1, limit)) })
  const candidates = rpcRes.data as any
  const selErr = rpcRes.error as any

  let rows: { article_id: string }[] = []
  if (candidates && Array.isArray(candidates)) {
    rows = candidates
  } else {
    // Fallback: simple select (less optimal ordering)
    const { data } = await supabase
      .from('website_articles')
      .select('id, preview_id')
      .in('preview_id', (
        (await supabase.from('website_previews').select('id').eq('source_csv_id', csvId).limit(1000)).data?.map((r: any) => r.id) || []
      ))
      .limit(Math.min(20, Math.max(1, limit)))
    rows = (data || []).map((r: any) => ({ article_id: r.id }))
  }

  const pool = pLimit(3)
  let updatedSeo = 0, createdMedia = 0, skipped = 0, failed = 0

  await Promise.all(rows.map(({ article_id }) => pool(async () => {
    try {
      // Load article + existing hero
      const { data: article } = await supabase.from('website_articles').select('*').eq('id', article_id).maybeSingle()
      const { data: hero } = await supabase.from('website_media').select('id').eq('article_id', article_id).eq('kind', 'hero').maybeSingle()

      const hasSeo = Boolean(article?.seo_title && article?.seo_slug && article?.seo_description)
      const hasHero = Boolean(hero?.id)

      if (!overwrite && hasSeo && hasHero) {
        skipped++
        await writeOp('skip', article_id)
        return
      }

      // Generate SEO fields deterministically from draft_html
  let seo_title: string = article?.seo_title ? String(article.seo_title) : ''
      let seo_description: string = article?.seo_description ? String(article.seo_description) : ''
      let seo_slug: string = article?.seo_slug ? String(article.seo_slug) : ''
      if (overwrite || !hasSeo) {
        const derived = deriveSeoFromDraft(String(article?.draft_html || ''))
        seo_title = derived.title
        seo_description = derived.description
        seo_slug = await uniqueSlug(supabase, derived.slug, article_id)
        const { error: upErr } = await supabase
          .from('website_articles')
          .update({ seo_title, seo_description, seo_slug })
          .eq('id', article_id)
        if (upErr) throw new Error(upErr.message)
        updatedSeo++
      }

      // Create/replace hero media deterministically
      if (overwrite || !hasHero) {
        const { url, alt, width, height } = selectHeroImage(article_id, String(seo_title))
        if (hasHero && overwrite && hero?.id) {
          await supabase.from('website_media').delete().eq('id', hero.id)
        }
        const { error: insErr } = await supabase.from('website_media').insert({
          article_id, kind: 'hero', url, alt, width, height
        })
        if (insErr) throw new Error(insErr.message)
        createdMedia++
      }

      await writeOp('ok', article_id, { slug: seo_slug })
      log.info({ event: 'seo_media_ok', article_id, slug: seo_slug })

    } catch (err: any) {
      failed++
      await writeOp('error', article_id, { err: err?.name || 'Error' })
      log.warn({ event: 'seo_media_fail', article_id, errClass: err?.name || 'Error' })
    }
  })))

  return NextResponse.json({ counts: { updatedSeo, createdMedia, skipped, failed }, correlationId })

  // Helpers (deterministic generation)
  function deriveSeoFromDraft(html: string) {
    const plain = String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const baseTitle = (plain.slice(0, 60) || 'Generated Article').trim()
    const title = truncate(toTitleCase(baseTitle), 60)
    const description = truncate(plain.slice(0, 160) || 'Read our latest article.', 160)
    const slug = kebabCase(title)
    return { title, description, slug }
  }

  async function uniqueSlug(supabase: ReturnType<typeof getServerSupabase>, base: string, articleId: string) {
    let slug = base || crypto.randomUUID().slice(0, 8)
    let suffix = 0
    for (let i = 0; i < 10; i++) {
      const { data } = await supabase.from('website_articles').select('id').eq('seo_slug', slug).maybeSingle()
      if (!data || data.id === articleId) return slug
      suffix++
      slug = `${base}-${suffix}`
    }
    return `${base}-${crypto.randomUUID().slice(0, 6)}`
  }

  function selectHeroImage(id: string, title: string) {
    const alt = title || 'Hero image'
    if (MEDIA_PROVIDER_URL && !MEDIA_MOCK) {
      const url = `${MEDIA_PROVIDER_URL.replace(/\/$/, '')}/1200/630?seed=${encodeURIComponent(id)}`
      return { url, alt, width: 1200, height: 630 }
    }
    const url = `https://picsum.photos/1200/630?random=${encodeURIComponent(id)}`
    return { url, alt, width: 1200, height: 630 }
  }

  async function writeOp(status: 'ok' | 'error' | 'skip', article_id: string, extra: Record<string, unknown> = {}) {
    try {
      await supabase.from('operations_log').insert({
        scope: 'seo_media', operation: 'generate', status, correlation_id: correlationId,
        details: { article_id, ...extra }
      } as any)
    } catch {
      // ignore log errors
    }
  }

  function kebabCase(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
  }
  function toTitleCase(s: string) {
    return s.replace(/\w\S*/g, (t) => (t[0]?.toUpperCase() || '') + t.slice(1).toLowerCase())
  }
  function truncate(s: string, n: number) {
    return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…'
  }
}
