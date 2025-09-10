import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

let _browser: ReturnType<typeof createClient> | undefined

export function getBrowserSupabase() {
  if (!_browser) {
    _browser = createClient(url, anon, {
      auth: { persistSession: true }
    })
  }
  return _browser
}

export function getServerSupabase() {
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, service)
}

