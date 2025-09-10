export interface PlaceSummary {
  place_id: string
  name: string
  formatted_address?: string
}

export interface PlaceDetails {
  place_id: string
  name?: string
  formatted_address?: string
  website?: string | null
  phone?: string | null
  opening_hours?: { weekday_text?: string[] } | null
}

const MAPS_BASE = 'https://maps.googleapis.com/maps/api/place'

function mapsKey(): string {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || ''
}

export async function searchPlaces(params: { query?: string; city?: string; state?: string; type?: string; limit?: number }): Promise<PlaceSummary[]> {
  const key = mapsKey()
  if (!key) throw new Error('GOOGLE_MAPS_API_KEY (or GOOGLE_PLACES_API_KEY) not set')

  const { query, city, state, type, limit = 20 } = params
  const q = query || `${type || 'business'} in ${city || ''} ${state || ''}`.trim()
  const url = new URL(`${MAPS_BASE}/textsearch/json`)
  url.searchParams.set('query', q)
  url.searchParams.set('key', key)

  const resp = await fetch(url.toString())
  const json = await resp.json()
  if (!resp.ok || json.status === 'REQUEST_DENIED') {
    throw new Error(json.error_message || `Places search failed: ${json.status}`)
  }
  type MapsResult = { place_id: string; name: string; formatted_address?: string }
  const results = ((json.results || []) as MapsResult[]).slice(0, limit).map((r) => ({
    place_id: r.place_id,
    name: r.name,
    formatted_address: r.formatted_address,
  })) as PlaceSummary[]
  return results
}

export async function getPlaceDetails(place_id: string, fields: string[] = ['website','formatted_phone_number','opening_hours','formatted_address','name']): Promise<PlaceDetails> {
  const key = mapsKey()
  if (!key) throw new Error('GOOGLE_MAPS_API_KEY (or GOOGLE_PLACES_API_KEY) not set')
  const url = new URL(`${MAPS_BASE}/details/json`)
  url.searchParams.set('place_id', place_id)
  url.searchParams.set('fields', fields.join(','))
  url.searchParams.set('key', key)

  const resp = await fetch(url.toString())
  const json = await resp.json()
  if (!resp.ok || json.status !== 'OK') {
    // Bubble up error so caller can fallback to SerpAPI
    throw new Error(json.error_message || `Place details failed: ${json.status}`)
  }
  const r = json.result || {}
  return {
    place_id,
    name: r.name,
    formatted_address: r.formatted_address,
    website: r.website || null,
    phone: r.formatted_phone_number || null,
    opening_hours: r.opening_hours || null,
  }
}

