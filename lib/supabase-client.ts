// Delegate to the canonical browser singleton to avoid duplicate clients
import { getBrowserSupabase } from './supabaseClient'
export const supabase = getBrowserSupabase()
export function getSupabaseClient() { return supabase }
export default supabase
