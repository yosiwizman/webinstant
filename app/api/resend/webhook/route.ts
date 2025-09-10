import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

// Minimal handler for Resend webhooks to track delivery/open/click/failure
export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  try {
    const body = await req.json()
    const event = body?.type as string | undefined
    const data = body?.data || {}

    // Log to operations_log (best-effort)
    try {
      await supabase.from('operations_log').insert({
        operation_type: 'resend_webhook',
        status: 'info',
        message: event,
        details: {
          message_id: data?.id || data?.message_id,
          to: data?.to,
          subject: data?.subject,
          campaign_id: data?.metadata?.campaignId,
        },
        created_at: new Date().toISOString(),
      })
    } catch {}

    // Update basic metrics on campaigns if campaignId present
    const campaignId = data?.metadata?.campaignId
    if (campaignId) {
      try {
        const patch: { updated_at: string; delivered?: number; opens?: number; clicks?: number; failures?: number } = { updated_at: new Date().toISOString() }
        if (event === 'email.delivered') patch.delivered = (data?.delivered || 1)
        if (event === 'email.opened') patch.opens = (data?.opens || 1)
        if (event === 'email.clicked') patch.clicks = (data?.clicks || 1)
        if (event === 'email.failed') patch.failures = (data?.failures || 1)
        await supabase.from('campaigns').update(patch).eq('id', campaignId)
      } catch {}
    }

    return NextResponse.json({ received: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

