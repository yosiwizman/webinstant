import { getServerSupabase } from '@/lib/supabaseClient'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = getServerSupabase()

  const { data: customer } = await sb.from('customers').select('*').eq('id', id).maybeSingle()
  if (!customer) return (<div className="p-6 text-sm text-gray-500">Customer not found</div>)

  const { data: businesses } = await sb
    .from('businesses')
    .select('id,business_name,city,state,created_at')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })

  const { data: lastEmail } = await sb
    .from('email_logs')
    .select('sent_at')
    .eq('to_email', customer.email)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: latestPreview } = await sb
    .from('website_previews')
    .select('updated_at')
    .in('business_id', (businesses || []).map((b: any) => b.id))
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <div className="bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-50 min-h-screen p-6 space-y-6">
      <Header customer={customer} lastEmail={lastEmail} latestPreview={latestPreview} />
      <KPIs count={(businesses || []).length} lastEmail={lastEmail} latestPreview={latestPreview} created_at={customer.created_at} />
      <BusinessesTable rows={businesses || []} />
      <div className="pt-2">
        <a href="/admin" className="text-sm text-blue-600 hover:underline">← Back to Admin</a>
      </div>
    </div>
  )
}

function Header({ customer, lastEmail, latestPreview }: { customer: any; lastEmail: any; latestPreview: any }) {
  const phoneDigits = (customer.phone || '').replace(/\D/g,'')
  return (
    <div>
      <h1 className="text-2xl font-semibold">{customer.name || customer.email || 'Customer'}</h1>
      <p className="text-sm text-gray-500">
        {customer.email ? <a className="text-blue-600 hover:underline" href={`mailto:${customer.email}`}>{customer.email}</a> : '—'}
        {' • '}
        {customer.phone ? <a className="text-blue-600 hover:underline" href={`tel:${phoneDigits}`}>{customer.phone}</a> : '—'}
      </p>
      <div className="mt-2">
        <a href="/admin/emails" className="px-3 py-2 rounded border text-sm">Compose Email</a>
      </div>
    </div>
  )
}

function KPIs({ count, lastEmail, latestPreview, created_at }: { count: number; lastEmail: any; latestPreview: any; created_at: string }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="rounded-2xl border p-4">
        <div className="text-xs text-gray-500">Total businesses</div>
        <div className="text-2xl font-semibold">{count}</div>
      </div>
      <div className="rounded-2xl border p-4">
        <div className="text-xs text-gray-500">Last preview</div>
        <div className="text-2xl font-semibold">{latestPreview?.updated_at ? new Date(latestPreview.updated_at).toLocaleDateString() : '—'}</div>
      </div>
      <div className="rounded-2xl border p-4">
        <div className="text-xs text-gray-500">Last email</div>
        <div className="text-2xl font-semibold">{lastEmail?.sent_at ? new Date(lastEmail.sent_at).toLocaleDateString() : '—'}</div>
      </div>
    </div>
  )
}

function BusinessesTable({ rows }: { rows: any[] }) {
  return (
    <div className="rounded-2xl border">
      <div className="border-b p-3 text-sm text-gray-500">Businesses</div>
      <div className="divide-y">
        {rows.map((b: any) => (
          <BusinessRow key={b.id} b={b} />
        ))}
      </div>
    </div>
  )
}

async function fetchLatestPreviewForBusiness(id: string) {
  const sb = getServerSupabase()
  const { data } = await sb
    .from('website_previews')
    .select('id,slug,preview_url,updated_at')
    .eq('business_id', id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

function BusinessRow({ b }: { b: any }) {
  return (
    <div className="grid grid-cols-12 gap-2 p-3 text-sm">
      <div className="col-span-4"><a className="text-blue-600 hover:underline" href={`/admin/businesses/${b.id}`}>{b.business_name}</a></div>
      <div className="col-span-3 text-gray-500">{[b.city,b.state].filter(Boolean).join(', ')}</div>
      <LatestPreviewCell businessId={b.id} />
      <LastEmailCell businessId={b.id} />
    </div>
  )
}

async function fetchLastEmailForBusiness(id: string) {
  const sb = getServerSupabase()
  const { data } = await sb
    .from('email_logs')
    .select('sent_at')
    .eq('business_id', id)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

async function LatestPreviewCell({ businessId }: { businessId: string }) {
  const data = await fetchLatestPreviewForBusiness(businessId)
  if (!data) return <div className="col-span-3 text-gray-500">—</div>
  const link = data.slug ? `/preview/${data.slug}` : `/preview/${data.id}`
  return <div className="col-span-3"><a className="text-blue-600 hover:underline" href={link}>Open preview</a></div>
}

async function LastEmailCell({ businessId }: { businessId: string }) {
  const data = await fetchLastEmailForBusiness(businessId)
  return <div className="col-span-2 text-gray-500">{data?.sent_at ? new Date(data.sent_at).toLocaleDateString() : '—'}</div>
}
