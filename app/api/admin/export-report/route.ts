import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value).replace(/\r?\n/g, ' ').replace(/\"/g, '""')
  return `"${str}"`
}

export async function GET() {
  try {
    // Fetch businesses (limit to reasonable number for export)
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const rows = data || []

    // Define columns with safe fallbacks across schema variations
    const headers = [
      'id',
      'business_name',
      'address',
      'city',
      'state',
      'zip',
      'phone',
      'email',
      'business_type',
      'has_website',
      'website',
      'preview_url',
      'email_sent',
      'created_at',
      'updated_at',
    ]

    const lines: string[] = []
    lines.push(headers.join(','))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of rows as any[]) {
      const zip = row.zip ?? row.zip_code ?? ''
      const hasWebsite = typeof row.has_website === 'boolean'
        ? row.has_website
        : (row.website ? true : false)

      const values = [
        row.id,
        row.business_name,
        row.address,
        row.city,
        row.state,
        zip,
        row.phone,
        row.email,
        row.business_type ?? '',
        hasWebsite,
        row.website ?? '',
        row.preview_url ?? '',
        row.email_sent ?? false,
        row.created_at ?? '',
        row.updated_at ?? '',
      ]

      lines.push(values.map(toCsvValue).join(','))
    }

    const csv = lines.join('\n')
    const fileName = `report-${new Date().toISOString().split('T')[0]}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
}

