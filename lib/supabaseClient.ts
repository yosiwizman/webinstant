import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

let _browser: ReturnType<typeof createClient> | undefined

export function getBrowserSupabase() {
  if (!_browser) {
    _browser = createClient(url, anon, {
      auth: { persistSession: true }
    })
    // Track number of browser clients created (for diagnostics in DB Health card)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g: any = globalThis as any
      g.__sbClientCreated = (g.__sbClientCreated || 0) + 1
    } catch {}
  }
  return _browser
}

export function getServerSupabase() {
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, service)
}

