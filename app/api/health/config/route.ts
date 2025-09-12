import { NextResponse } from 'next/server'

export async function GET() {
  const has = (k: string) => Boolean(process.env[k])
  return NextResponse.json({
    SUPABASE_URL: has('SUPABASE_URL') || has('NEXT_PUBLIC_SUPABASE_URL'),
    SUPABASE_ANON_KEY: has('SUPABASE_ANON_KEY') || has('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    SUPABASE_SERVICE_ROLE: has('SUPABASE_SERVICE_ROLE_KEY') || has('SUPABASE_SERVICE_ROLE'),
    RESEND_API_KEY: has('RESEND_API_KEY'),
    NEXT_PUBLIC_BASE_URL: has('NEXT_PUBLIC_BASE_URL'),
  })
}