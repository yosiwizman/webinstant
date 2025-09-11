import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'

export const runtime = 'nodejs'

function startOfDay(d = new Date()) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
function daysAgo(n: number) { const x = new Date(); x.setDate(x.getDate() - n); return x }
function startOfWeek(d = new Date()) { const x = new Date(d); const day = x.getDay(); const diff = x.getDate() - day + (day === 0 ? -6 : 1); x.setDate(diff); x.setHours(0,0,0,0); return x }
function startOfMonth(d = new Date()) { const x = new Date(d.getFullYear(), d.getMonth(), 1, 0,0,0,0); return x }

function fmtUTCDateYYYYMMDD(d: Date) {
  // YYYY-MM-DD in UTC
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function last30DaySpineUTC() {
  // Oldest -> newest, 30 items inclusive of today
  const arr: string[] = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
    d.setUTCDate(d.getUTCDate() - i)
    arr.push(fmtUTCDateYYYYMMDD(d))
  }
  return arr
}

async function sumPaymentsDollarsSince(supabase: ReturnType<typeof getServerSupabase>, sinceISO: string) {
  // Prefer payments table; sum amount_cents for succeeded
  let cents = 0
  const { data: payRows, error: payErr } = await supabase
    .from('payments')
    .select('amount_cents, created_at, status')
    .gte('created_at', sinceISO)
    .eq('status', 'succeeded')
    .order('created_at', { ascending: false })
    .limit(50000)
  if (!payErr && Array.isArray(payRows) && payRows.length > 0) {
    cents = payRows.reduce((acc, r: any) => acc + Number(r.amount_cents || 0), 0)
    return cents / 100
  }

  // Fallback: payment_intents.amount is dollars with status completed
  const { data: piRows } = await supabase
    .from('payment_intents')
    .select('amount, status, completed_at, created_at')
    .or(`completed_at.gte.${sinceISO},created_at.gte.${sinceISO}`)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(50000)
  if (Array.isArray(piRows) && piRows.length > 0) {
    const dollars = piRows.reduce((acc, r: any) => acc + Number(r.amount || 0), 0)
    return dollars
  }
  return 0
}

async function last30DayRevenueSeries(supabase: ReturnType<typeof getServerSupabase>) {
  const spine = last30DaySpineUTC()
  const totalsCents: Record<string, number> = Object.fromEntries(spine.map(d => [d, 0]))
  // Prefer payments
  const sinceISO = new Date(new Date().toISOString().slice(0,10) + 'T00:00:00.000Z')
  sinceISO.setUTCDate(sinceISO.getUTCDate() - 29)
  const { data: payRows } = await supabase
    .from('payments')
    .select('created_at, amount_cents, status')
    .gte('created_at', sinceISO.toISOString())
    .eq('status', 'succeeded')
  if (Array.isArray(payRows) && payRows.length > 0) {
    for (const r of payRows as Array<{ created_at: string, amount_cents?: number }>) {
      const d = new Date(String(r.created_at))
      const key = fmtUTCDateYYYYMMDD(d)
      if (key in totalsCents) totalsCents[key] += Number(r.amount_cents || 0)
    }
  } else {
    // Fallback to payment_intents
    const { data: piRows } = await supabase
      .from('payment_intents')
      .select('amount, status, completed_at, created_at')
      .or(`completed_at.gte.${sinceISO.toISOString()},created_at.gte.${sinceISO.toISOString()}`)
      .eq('status', 'completed')
    for (const r of (piRows as Array<{ amount?: number, created_at?: string, completed_at?: string }> ) || []) {
      const ts = r.completed_at || r.created_at || ''
      if (!ts) continue
      const d = new Date(String(ts))
      const key = fmtUTCDateYYYYMMDD(d)
      if (key in totalsCents) totalsCents[key] += Math.round(Number(r.amount || 0) * 100)
    }
  }
  // Map oldest -> newest
  const series = spine.map(date => ({ date, amount: (totalsCents[date] || 0) / 100 }))
  const total = series.reduce((acc, x) => acc + x.amount, 0)
  return { series, total }
}

async function recentPayments(supabase: ReturnType<typeof getServerSupabase>, limit = 10) {
  // Prefer payments; fallback to payment_intents
  const { data: payRows } = await supabase
    .from('payments')
    .select('id, email, amount_cents, currency, status, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (Array.isArray(payRows) && payRows.length > 0) {
    return payRows.map((p: any) => ({
      id: String(p.id),
      email: p.email || null,
      amount_cents: Number(p.amount_cents || 0),
      currency: String((p.currency || 'usd')).toLowerCase(),
      status: String(p.status || 'succeeded'),
      created_at: String(p.created_at),
    }))
  }
  const { data: piRows } = await supabase
    .from('payment_intents')
    .select('stripe_session_id, amount, status, completed_at, created_at, customer_email')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(limit)
  return (piRows || []).map((r: any) => ({
    id: String(r.stripe_session_id || ''),
    email: r.customer_email || null,
    amount_cents: Math.round(Number(r.amount || 0) * 100),
    currency: 'usd',
    status: String(r.status || 'completed'),
    created_at: String(r.completed_at || r.created_at),
  }))
}

export async function GET(_req: NextRequest) {
  const supabase = getServerSupabase()

  try {
    const todayISO = startOfDay().toISOString()

    // Emails and activity
    const [sentToday, totalEmails, openedEmails, clickedEmails, activeSites, newCustomers] = await Promise.all([
      supabase.from('email_logs').select('id', { count: 'exact', head: true }).gte('created_at', todayISO),
      supabase.from('email_logs').select('id', { count: 'exact', head: true }),
      supabase.from('email_logs').select('id', { count: 'exact', head: true }).not('opened_at', 'is', null),
      supabase.from('email_logs').select('id', { count: 'exact', head: true }).not('clicked_at', 'is', null),
      supabase.from('website_previews').select('id', { count: 'exact', head: true }).not('html_content', 'is', null),
      supabase.from('businesses').select('id', { count: 'exact', head: true }).gte('created_at', todayISO).not('claimed_at', 'is', null),
    ])

    const emails_sent_today = sentToday.count || 0
    const total_count = totalEmails.count || 0
    const open_count = openedEmails.count || 0
    const click_count = clickedEmails.count || 0
    const active_websites = activeSites.count || 0
    const new_customers_today = newCustomers.count || 0

    const open_rate = total_count > 0 ? Math.round((open_count / total_count) * 100) : 0
    const click_rate = total_count > 0 ? Math.round((click_count / total_count) * 100) : 0

    // Revenue from DB (payments/payment_intents)
    const revenue_today = await sumPaymentsDollarsSince(supabase, startOfDay().toISOString())
    const revenue_this_week = await sumPaymentsDollarsSince(supabase, startOfWeek().toISOString())
    const revenue_this_month = await sumPaymentsDollarsSince(supabase, startOfMonth().toISOString())
    const { series, total: revenue_last_30_days_total } = await last30DayRevenueSeries(supabase)

    const recent_transactions = await recentPayments(supabase, 10)

    return NextResponse.json({
      emails_sent_today,
      open_rate,
      click_rate,
      active_websites,
      new_customers_today,
      revenue: {
        today: revenue_today,
        this_week: revenue_this_week,
        this_month: revenue_this_month,
        last_30_days_total: revenue_last_30_days_total,
        series_30d: series,
      },
      recent_transactions,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
