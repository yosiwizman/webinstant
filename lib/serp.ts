export interface SerpLocalResult {
  place_id?: string
  title?: string
  address?: string
  website?: string
  phone?: string
}

export async function serpLocalSearch(query: string, limit = 10): Promise<SerpLocalResult[]> {
  const key = process.env.SERPAPI_KEY
  if (!key) throw new Error('SERPAPI_KEY not set')
  const url = new URL('https://serpapi.com/search.json')
  url.searchParams.set('engine', 'google_maps')
  url.searchParams.set('q', query)
  url.searchParams.set('api_key', key)

  const resp = await fetch(url.toString())
  const json = await resp.json()
  if (!resp.ok || json.error) {
    throw new Error(json.error || 'SerpAPI request failed')
  }

  type SerpAny = { place_id?: string; data_id?: string; title?: string; name?: string; address?: string; website?: string; link?: string; phone?: string }
  const results = (json.local_results || json.place_results || []) as SerpAny[]
  return results.slice(0, limit).map((r) => ({
    place_id: r.place_id || r.data_id,
    title: r.title || r.name,
    address: r.address,
    website: r.website || r.link,
    phone: r.phone,
  }))
}

