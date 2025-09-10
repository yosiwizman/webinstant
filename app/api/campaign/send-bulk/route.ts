import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const businessIds: string[] = body.businessIds || body.business_ids
    const template: string = body.template || 'website_ready'

    if (!Array.isArray(businessIds) || businessIds.length === 0) {
      return NextResponse.json({ success: false, error: 'businessIds[] required' }, { status: 400 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    const results: Array<{ businessId: string; success: boolean; message?: string }> = []

    for (const id of businessIds) {
      try {
        const resp = await fetch(`${baseUrl}/api/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessId: id, template })
        })
        const ok = resp.ok
        results.push({ businessId: id, success: ok, message: ok ? 'sent' : 'failed' })
      } catch (e) {
        results.push({ businessId: id, success: false, message: (e as Error).message })
      }
    }

    const sent = results.filter(r => r.success).length
    const failed = results.length - sent

    // Log campaign summary to campaigns table
    const campaignId = crypto.randomUUID()
    await supabase.from('campaigns').insert({
      id: campaignId,
      campaign_type: 'bulk_send',
      template,
      total: results.length,
      sent,
      failed,
      results,
      created_at: new Date().toISOString()
    })

    return NextResponse.json({ success: true, campaignId, sent, failed, results })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Bulk campaign endpoint',
    method: 'POST',
    body: { businessIds: ['uuid', 'uuid'], business_ids: ['uuid'], template: 'website_ready' }
  })
}

