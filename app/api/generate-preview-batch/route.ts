/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseClient'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = getServerSupabase()
  try {
    const { limit = 10, overwrite = false } = await req.json()
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    // Find candidate businesses
    let candidateIds: string[] = []

    if (overwrite) {
      const { data, error } = await supabase
        .from('businesses')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      const rows = (data as Array<{ id: string }>) || []
      candidateIds = rows.map(d => String(d.id))
    } else {
      // pick newest businesses missing preview_url
      const { data: previewed } = await supabase
        .from('website_previews')
        .select('business_id, preview_url')
        .not('preview_url', 'is', null)
      const havePreview = new Set((previewed || []).map(p => p.business_id))
      const { data: latest } = await supabase
        .from('businesses')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(200)
      const latestRows = (latest as Array<{ id: string }>) || []
      const queue = latestRows.map(b => String(b.id)).filter(id => !havePreview.has(id))
      candidateIds = queue.slice(0, limit)
    }

    const processed: string[] = []
    const successes: string[] = []
    const failures: Array<{ id: string; error: string }> = []

    for (const id of candidateIds) {
      processed.push(id)
      try {
        const resp = await fetch(`${baseUrl}/api/generate-preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessId: id, overwrite })
        })
        if (!resp.ok) {
          const txt = await resp.text()
          failures.push({ id, error: txt || 'generate failed' })
        } else {
          successes.push(id)
        }
      } catch (e: any) {
        failures.push({ id, error: e.message })
      }
      await new Promise(r => setTimeout(r, 150))
    }

    // Get IDs with preview_url for email stage
    const { data: withPrev } = await supabase
      .from('website_previews')
      .select('business_id, preview_url')
      .in('business_id', processed)
      .not('preview_url', 'is', null)

    const business_ids_with_previews = (withPrev || []).map(r => r.business_id)

    return NextResponse.json({
      processed: processed.length,
      successes: successes.length,
      failures,
      business_ids_with_previews,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

