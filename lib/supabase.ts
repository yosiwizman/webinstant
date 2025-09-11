// Re-export the browser singleton to avoid multiple GoTrue clients
import { getBrowserSupabase } from './supabaseClient'
export const supabase = getBrowserSupabase()
export default supabase
