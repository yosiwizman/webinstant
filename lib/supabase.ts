// Re-export helpers to avoid multiple GoTrue clients and keep imports consistent
export { getBrowserSupabase, getServerSupabase } from './supabaseClient'
import { getBrowserSupabase } from './supabaseClient'
export const supabase = getBrowserSupabase()
export default supabase
