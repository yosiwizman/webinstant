import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  const rawBody = await req.text()

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const businessId = (session.metadata?.businessId as string) || null
        const domainName = (session.metadata?.domainName as string) || null
        const amount = (session.amount_total ?? 15000) / 100
        const email = session.customer_details?.email || null

        // Insert payment record (best-effort)
        try {
          await supabase.from('payments').insert({
            business_id: businessId,
            stripe_payment_id: session.id,
            amount,
            currency: session.currency || 'usd',
            status: 'succeeded',
            email,
            created_at: new Date().toISOString(),
          })
        } catch {}

        // Update legacy intent row if present
        try {
          await supabase
            .from('payment_intents')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('stripe_session_id', session.id)
        } catch {}

        // Find latest preview for the business
        let previewId: string | null = null
        if (businessId) {
          try {
            const { data: pv } = await supabase
              .from('website_previews')
              .select('id')
              .eq('business_id', businessId)
              .order('created_at', { ascending: false })
              .limit(1)
            if (pv && pv.length > 0) previewId = pv[0].id
          } catch {}
        }

        // Queue generated_website for deployment
        try {
          await supabase.from('generated_websites').insert({
            business_id: businessId,
            preview_id: previewId,
            target_domain: domainName,
            status: 'pending_deploy',
            created_at: new Date().toISOString(),
          })
        } catch {}

        // Log operation
        try {
          await supabase.from('operations_log').insert({
            operation_type: 'stripe_webhook',
            status: 'success',
            message: 'checkout.session.completed',
            details: {
              business_id: businessId,
              domain: domainName,
              amount,
              session_id: session.id
            },
            created_at: new Date().toISOString(),
          })
        } catch {}

        break
      }
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        // Best-effort log; full handling is via checkout.session.completed
        try {
          await supabase.from('operations_log').insert({
            operation_type: 'stripe_webhook',
            status: 'info',
            message: 'payment_intent.succeeded',
            details: { id: pi.id, amount: (pi.amount_received || pi.amount) / 100 },
            created_at: new Date().toISOString(),
          })
        } catch {}
        break
      }
      default: {
        // Ignore other event types
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

