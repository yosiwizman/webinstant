import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables:', {
    url: !!supabaseUrl,
    key: !!supabaseAnonKey
  })
  // Don't throw in development to allow the app to run without Supabase
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Missing Supabase environment variables. Please check your .env.local file.')
  }
}

// Create a singleton instance
let supabaseInstance: SupabaseClient | null = null

if (supabaseUrl && supabaseAnonKey) {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  })
}

// Export the singleton instance
export const supabase = supabaseInstance!

// Helper function to check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return !!supabaseInstance
}

// Helper function to get a safe Supabase client (returns null if not configured)
export const getSupabaseClient = (): SupabaseClient | null => {
  return supabaseInstance
}
