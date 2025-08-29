import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const operation_type = body.operation_type || 'client_error'
    const status = body.status || 'error'
    const message = body.message || 'Client error'
    const details = body.details || null

    const { error } = await supabase
      .from('operations_log')
      .insert({
        operation_type,
        status,
        message,
        details,
        created_at: new Date().toISOString(),
      })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Log error endpoint',
    method: 'POST',
    fields: ['operation_type', 'status', 'message', 'details'],
    status: 'ready',
  })
}

