import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseClient'

export const runtime = 'nodejs'

interface Check {
  id: string
  label: string
  ok: boolean
  detail?: string
  advice?: string
}

export async function GET() {
  const supabase = getServerSupabase()
  const checks: Check[] = []
  let ok = true

  // Helper to push checks and track overall ok
  function push(check: Check) {
    checks.push(check)
    if (!check.ok) ok = false
  }

  // 1) Liveness: simple select
  try {
    const { error } = await supabase.from('businesses').select('id').limit(1)
    push({ id: 'liveness', label: 'Postgres liveness (SELECT 1 via businesses)', ok: !error, detail: error?.message })
  } catch (e) {
    push({ id: 'liveness', label: 'Postgres liveness (SELECT 1 via businesses)', ok: false, detail: (e as Error).message })
  }

  // 2) Tables exist
  const tableNames = ['businesses', 'website_previews', 'campaigns', 'payments', 'generated_websites']
  await Promise.all(
    tableNames.map(async (t) => {
      try {
        const { error } = await supabase.from(t).select('id', { count: 'exact', head: true })
        push({ id: `table:${t}`, label: `Table exists: ${t}`, ok: !error, detail: error?.message })
      } catch (e) {
        push({ id: `table:${t}`, label: `Table exists: ${t}`, ok: false, detail: (e as Error).message })
      }
    })
  )

  // 3) Column checks on businesses
  try {
    const { error } = await supabase
      .from('businesses')
      .select('business_name,address,city,state,zip_code,phone,email,industry_type', { count: 'exact', head: true })
    push({ id: 'businesses:columns', label: 'Businesses columns present', ok: !error, detail: error?.message })
  } catch (e) {
    push({ id: 'businesses:columns', label: 'Businesses columns present', ok: false, detail: (e as Error).message })
  }

  // 4) Unique constraint heuristic for upsert
  // We cannot introspect constraints without a function. Provide guidance.
  push({
    id: 'upsert:unique',
    label: 'Upsert UNIQUE constraint (business_name, city, state, phone)',
    ok: false,
    detail: 'Cannot verify automatically. Ensure a table-level UNIQUE constraint exists.',
    advice: 'Run: ALTER TABLE businesses ADD CONSTRAINT uniq_business_identity_cols UNIQUE (business_name, city, state, phone);'
  })

  // 5) maybeSingle sanity
  try {
    const { error } = await supabase.from('website_previews').select('id').eq('id', '00000000-0000-0000-0000-000000000000').maybeSingle()
    push({ id: 'maybeSingle', label: 'maybeSingle() returns null (no PGRST116)', ok: !error, detail: error?.message })
  } catch (e) {
    push({ id: 'maybeSingle', label: 'maybeSingle() returns null (no PGRST116)', ok: false, detail: (e as Error).message })
  }

  // 6) Row counts (fast)
  async function countRows(table: string, id: string) {
    try {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
      push({ id, label: `Row count: ${table}`, ok: !error, detail: typeof count === 'number' ? `${count}` : error?.message })
    } catch (e) {
      push({ id, label: `Row count: ${table}`, ok: false, detail: (e as Error).message })
    }
  }

  await Promise.all([
    countRows('businesses', 'count:businesses'),
    countRows('website_previews', 'count:website_previews'),
    countRows('campaigns', 'count:campaigns'),
  ])

  return NextResponse.json({ ok, checks })
}
