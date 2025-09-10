import { NextRequest, NextResponse } from 'next/server'
import { addDomainToProject, verifyProjectDomain } from '@/lib/vercel'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  try {
    const { business_id, target_domain } = await req.json()
    if (!business_id || !target_domain) {
      return NextResponse.json({ error: 'business_id and target_domain required' }, { status: 400 })
    }

    // Add domain to Vercel project
    const addResp = await addDomainToProject(target_domain)

    const verification = addResp?.verification || []
    let status: 'pending_verification' | 'live' | 'pending_deploy' = 'pending_verification'

    // Persist generated_websites record (upsert)
    try {
      await supabase.from('generated_websites').upsert({
        business_id,
        target_domain,
        status,
        verification,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'business_id' })
    } catch {}

    // If no verification required, attempt verify immediately and mark live
    if (!verification || verification.length === 0) {
      try {
        const verifyResp = await verifyProjectDomain(target_domain)
        status = 'live'
        await supabase.from('generated_websites').update({ status, verification: verifyResp?.verification || null }).eq('business_id', business_id)
      } catch {
        // keep pending_verification
      }
    }

    type VercelVerification = { type?: string; domain?: string; value?: string }
    const instructions = Array.isArray(verification) && verification.length > 0
      ? (verification as VercelVerification[]).map((v) => ({ type: (v.type || 'TXT').toUpperCase(), name: v.domain || '@', value: v.value || '' }))
      : null

    return NextResponse.json({ success: true, status, vercel: addResp, instructions })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

