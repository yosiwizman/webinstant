import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { searchPlaces, getPlaceDetails } from '@/lib/places'
import { serpLocalSearch } from '@/lib/serp'

export const runtime = 'nodejs'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  try {
    const { city, state, category } = await req.json()
    if (!city || !state || !category) {
      return NextResponse.json({ error: 'city, state, category required' }, { status: 400 })
    }

    const query = `${category} in ${city}, ${state}`
    let summaries: { place_id: string; name: string; formatted_address?: string }[] = []
    let usedFallback = false

    // Step 1: Places search
    try {
      summaries = await searchPlaces({ query, limit: 15 })
    } catch {
      usedFallback = true
      // Step 3: Fallback to SerpAPI
      const serp = await serpLocalSearch(query, 12)
      summaries = serp
        .filter((s) => s.place_id || s.website)
        .map((s) => ({ place_id: s.place_id || s.website!, name: s.title || 'Business', formatted_address: s.address }))
    }

    // Step 2: For each place_id, fetch Place Details for website/phone/hours
    const details: Array<{
      place_id: string
      name: string
      formatted_address?: string
      website?: string | null
      phone?: string | null
    }> = []

    for (const s of summaries) {
      try {
        if (!usedFallback) {
          const d = await getPlaceDetails(s.place_id)
          details.push({ place_id: s.place_id, name: d.name || s.name, formatted_address: d.formatted_address, website: d.website, phone: d.phone })
        } else {
          // Fallback had no details endpoint; reuse serp data
          details.push({ place_id: s.place_id, name: s.name, formatted_address: s.formatted_address, website: s.place_id.startsWith('http') ? s.place_id : undefined, phone: undefined })
        }
      } catch {
        // On individual failure, skip to next
      }
    }

    // Step 4: Upsert into businesses with has_website flag
    let inserted = 0
    for (const d of details) {
      const record: Record<string, unknown> = {
        business_name: d.name,
        website_url: d.website || null,
        phone: d.phone || null,
        address: d.formatted_address || null,
        city,
        state,
        has_website: !!d.website,
        updated_at: new Date().toISOString(),
      }
      try {
        const { error } = await supabase.from('businesses').upsert(record, { onConflict: 'business_name' })
        if (!error) inserted++
      } catch {
        // Best-effort only; continue
      }
    }

    // Log operation (non-fatal)
    try {
      await supabase.from('operations_log').insert({
        operation_type: 'leads_ingest',
        status: 'success',
        details: { city, state, category, inserted, usedFallback },
        created_at: new Date().toISOString(),
      })
    } catch {}

    return NextResponse.json({ success: true, count: inserted, usedFallback })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

