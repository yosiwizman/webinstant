import { createClient } from '@supabase/supabase-js'

let _browser: ReturnType<typeof createClient> | null = null
let _server: ReturnType<typeof createClient> | null = null

function getUrl() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) throw new Error('SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL is missing')
  return url
}

function getAnon() {
  const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!anon) throw new Error('SUPABASE_ANON_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY is missing')
  return anon
}

function getService() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE) is missing')
  return key
}

export function getBrowserSupabase() {
  if (_browser) return _browser
  _browser = createClient(getUrl(), getAnon(), {
    auth: { persistSession: true },
  })
  // Track number of browser clients created (for diagnostics in DB Health card)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g: any = globalThis as any
    g.__sbClientCreated = (g.__sbClientCreated || 0) + 1
  } catch {}
  return _browser
}

export function getServerSupabase() {
  if (_server) return _server
  _server = createClient(getUrl(), getService())
  return _server
}

