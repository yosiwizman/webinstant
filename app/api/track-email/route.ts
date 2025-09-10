import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 1x1 transparent GIF
const PIXEL_BASE64 = 'R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const params = Object.fromEntries(url.searchParams.entries())

    // Best-effort logging (do not block pixel)
    try {
      await supabase.from('operations_log').insert({
        operation_type: 'email_event',
        status: 'info',
        message: `Email ${params.action || 'open'} event`,
        details: {
          ...params,
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      })
    } catch {
      // non-fatal
    }

    const body = Buffer.from(PIXEL_BASE64, 'base64')
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  } catch {
    // On error, still return a pixel
    const body = Buffer.from(PIXEL_BASE64, 'base64')
    return new NextResponse(body, {
      status: 200,
      headers: { 'Content-Type': 'image/gif' },
    })
  }
}

