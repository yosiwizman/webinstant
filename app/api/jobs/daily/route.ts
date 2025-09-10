import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { templates, TemplateKey } from '@/lib/emailTemplates'
import { canProceed, recordCost, recordError } from '@/lib/limits'
import { log } from '@/lib/log'

export const runtime = 'nodejs'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

function requireCron(req: NextRequest) {
  const secret = process.env.CRON_SHARED_SECRET
  const hdr = req.headers.get('x-cron-secret')
  if (!secret || hdr !== secret) {
    return false
  }
  return true
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase()

  if (!requireCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Array<{ business_id: string; preview?: boolean; emailed?: boolean; variant?: TemplateKey; error?: string }> = []

  try {
    // Fetch businesses without previews (best-effort)
    const { data: allBusinesses } = await supabase.from('businesses').select('id, business_name, email').limit(50)
    const { data: previews } = await supabase.from('website_previews').select('business_id')

    const withPreview = new Set((previews || []).map((p: { business_id: string }) => p.business_id))
    const targets = (allBusinesses || []).filter((b) => !withPreview.has(b.id)).slice(0, 10)

    for (const biz of targets) {
      const res: { business_id: string; preview?: boolean; emailed?: boolean; variant?: TemplateKey; error?: string } = { business_id: biz.id }

      // Circuit breaker: Together AI / Replicate usage; stop if limits hit
      if (!canProceed('together_ai') || !canProceed('replicate')) {
        res.error = 'circuit_breaker'
        results.push(res)
        continue
      }

      try {
        // Generate preview
        const gp = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/generate-preview`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessId: biz.id })
        })
        if (gp.ok) {
          res.preview = true
          recordCost('together_ai', 0.5) // rough accounting
        } else {
          recordError('together_ai')
        }
      } catch {
        recordError('together_ai')
      }

      // Email if we have an address
      if (biz.email) {
        const variant: TemplateKey = Math.random() > 0.5 ? 'variantA' : 'default'
        res.variant = variant

        // Pull preview URL for personalized content
        let previewUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
        try {
          const { data: pv } = await supabase
            .from('website_previews')
            .select('preview_url')
            .eq('business_id', biz.id)
            .order('created_at', { ascending: false })
            .limit(1)
          if (pv && pv.length > 0 && pv[0].preview_url) previewUrl = pv[0].preview_url
        } catch {}

        const tpl = templates[variant]
        const subject = tpl.subject.replace(/{{business_name}}/g, biz.business_name)
        const content = tpl.content
          .replace(/{{business_name}}/g, biz.business_name)
          .replace(/{{preview_url}}/g, previewUrl)

        try {
          const se = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/send-email`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
              to: biz.email,
              businessName: biz.business_name,
              businessId: biz.id,
              subject,
              content,
              template_key: variant,
            })
          })
          if (se.ok) {
            res.emailed = true
            recordCost('resend', 0.01)
          } else {
            recordError('resend')
          }
        } catch {
          recordError('resend')
        }
      }

      results.push(res)
    }

    // Record job summary (best-effort)
    try {
      await supabase.from('operations_log').insert({
        operation_type: 'daily_job',
        status: 'success',
        details: { processed: results.length, results },
        created_at: new Date().toISOString(),
      })
    } catch {}

    log({ level: 'info', msg: 'daily job complete', context: { processed: results.length } })

    return NextResponse.json({ success: true, results })
  } catch (e) {
    log({ level: 'error', msg: 'daily job failure', context: { err: (e as Error).message } })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

