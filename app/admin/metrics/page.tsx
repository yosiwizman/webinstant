'use client'

import { useEffect, useMemo, useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabaseClient'

export default function MetricsPage() {
  const [days, setDays] = useState<7 | 30>(7)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState({
    imports: 0,
    previews: 0,
    emailsSent: 0,
    openRate: 0,
    clickRate: 0,
    paid: 0,
    live: 0,
    recentCampaigns: [] as Array<{ id: string; template?: string; sent?: number; opened?: number; clicked?: number; paid?: number }>
  })

  const range = useMemo(() => {
    const to = new Date()
    const from = new Date()
    from.setDate(to.getDate() - days)
    return { from: from.toISOString(), to: to.toISOString() }
  }, [days])

  const supabase = getBrowserSupabase()

  useEffect(() => {
    (async () => {
      setLoading(true)
      setError(null)
      try {
        const [{ count: imports }, { count: previews }, emailsRes, paymentsRes, liveRes] = await Promise.all([
          supabase.from('businesses').select('id', { count: 'exact', head: true }).gte('created_at', range.from).lt('created_at', range.to),
          supabase.from('website_previews').select('id', { count: 'exact', head: true }).gte('created_at', range.from).lt('created_at', range.to),
          supabase.from('emails').select('*').gte('sent_at', range.from).lt('sent_at', range.to),
          supabase.from('payments').select('id', { count: 'exact', head: true }).gte('created_at', range.from).lt('created_at', range.to),
          supabase.from('generated_websites').select('id', { count: 'exact', head: true }).eq('status', 'live')
        ])

        type EmailRow = { sent_at?: string | null; opened_at?: string | null; clicked_at?: string | null }
        const emails = (emailsRes.data as EmailRow[]) || []
        const sent = emails.filter(e => !!e.sent_at).length
        const opened = emails.filter(e => !!e.opened_at).length
        const clicked = emails.filter(e => !!e.clicked_at).length

        setData({
          imports: imports || 0,
          previews: previews || 0,
          emailsSent: sent,
          openRate: sent ? Math.round((opened / sent) * 100) : 0,
          clickRate: sent ? Math.round((clicked / sent) * 100) : 0,
          paid: paymentsRes.count || 0,
          live: liveRes.count || 0,
          recentCampaigns: []
        })
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    })()
  }, [range])

  if (loading) return <div className="p-6">Loading...</div>
  if (error) return <div className="p-6 text-red-600">{error}</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Funnel Metrics</h1>
        <div className="flex gap-2">
          <button className={`px-3 py-1 rounded ${days === 7 ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setDays(7)}>7d</button>
          <button className={`px-3 py-1 rounded ${days === 30 ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setDays(30)}>30d</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Imports" value={data.imports} />
        <MetricCard label="Previews" value={data.previews} />
        <MetricCard label="Emails Sent" value={data.emailsSent} />
        <MetricCard label="Open Rate" value={`${data.openRate}%`} />
        <MetricCard label="Click Rate" value={`${data.clickRate}%`} />
        <MetricCard label="Paid" value={data.paid} />
        <MetricCard label="Live" value={data.live} />
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  )
}

