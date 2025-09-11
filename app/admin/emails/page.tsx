'use client'

import { useEffect, useMemo, useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase'

type Row = {
  id: string
  business_id: string
  to_email: string
  subject: string | null
  sent_at: string | null
  opened_at: string | null
  clicked_at: string | null
  unsubscribed: boolean | null
  business_name?: string | null
}

type SortKey = 'business' | 'to_email' | 'subject' | 'sent_at' | 'opened_at' | 'clicked_at'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  )
}

export default function EmailsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showOpened, setShowOpened] = useState(false)
  const [showClicked, setShowClicked] = useState(false)
  const [showUnsub, setShowUnsub] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('sent_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  useEffect(() => {
    const supabase = getBrowserSupabase()
    ;(async () => {
      setLoading(true)
      const { data: emails } = await supabase
        .from('email_logs')
        .select('id,business_id,to_email,subject,sent_at,opened_at,clicked_at')
        .order('sent_at', { ascending: false })
        .limit(100)

      const businessIds = [...new Set((emails ?? []).map(e => e.business_id))].filter(Boolean)
      const map: Record<string, { name: string|null, unsubscribed: boolean|null }> = {}
      if (businessIds.length) {
        type BizRow = { id: string; business_name?: string|null; unsubscribed?: boolean|null }
        const { data: bs } = await supabase
          .from('businesses')
          .select('id,business_name,unsubscribed')
          .in('id', businessIds)
        ;(bs as BizRow[] | null | undefined)?.forEach((b: BizRow) => {
          map[b.id] = { name: b.business_name ?? null, unsubscribed: b.unsubscribed ?? null }
        })
      }

      const merged = (emails ?? []).map(e => {
        const bid = String(e.business_id)
        const info = map[bid]
        return {
          id: String(e.id),
          business_id: bid,
          to_email: String(e.to_email),
          subject: (e.subject as string) ?? null,
          sent_at: (e.sent_at as string) ?? null,
          opened_at: (e.opened_at as string) ?? null,
          clicked_at: (e.clicked_at as string) ?? null,
          unsubscribed: info ? info.unsubscribed : null,
          business_name: info ? info.name : null,
        }
      }) as Row[]
      setRows(merged)
      setLoading(false)
    })()
  }, [])

  const stats = useMemo(() => {
    const total = rows.length || 1
    const opened = rows.filter(r => r.opened_at).length
    const clicked = rows.filter(r => r.clicked_at).length
    const unsub = rows.filter(r => r.unsubscribed).length
    return {
      openRate: Math.round((opened / total) * 100),
      clickRate: Math.round((clicked / total) * 100),
      unsubRate: Math.round((unsub / total) * 100),
      total: rows.length
    }
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let out = rows
    if (q) {
      out = out.filter(r =>
        (r.to_email || '').toLowerCase().includes(q) ||
        (r.subject || '').toLowerCase().includes(q) ||
        (r.business_name || r.business_id || '').toLowerCase().includes(q)
      )
    }
    if (showOpened) out = out.filter(r => !!r.opened_at)
    if (showClicked) out = out.filter(r => !!r.clicked_at)
    if (showUnsub) out = out.filter(r => !!r.unsubscribed)
    return out
  }, [rows, search, showOpened, showClicked, showUnsub])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      switch (sortKey) {
        case 'business': {
          const av = (a.business_name || a.business_id || '').toLowerCase()
          const bv = (b.business_name || b.business_id || '').toLowerCase()
          return av.localeCompare(bv) * dir
        }
        case 'to_email': return (a.to_email || '').localeCompare(b.to_email || '') * dir
        case 'subject': return (a.subject || '').localeCompare(b.subject || '') * dir
        case 'opened_at': return ((a.opened_at ? 1 : 0) - (b.opened_at ? 1 : 0)) * dir
        case 'clicked_at': return ((a.clicked_at ? 1 : 0) - (b.clicked_at ? 1 : 0)) * dir
        case 'sent_at':
        default: {
          const at = a.sent_at ? new Date(a.sent_at).getTime() : 0
          const bt = b.sent_at ? new Date(b.sent_at).getTime() : 0
          return (at - bt) * dir
        }
      }
    })
    return arr
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, currentPage, pageSize])

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(k); setSortDir('asc') }
  }

  return (
    <div className="bg-white text-gray-900 dark:bg-neutral-950 dark:text-neutral-50 min-h-screen p-6 space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Email Analytics</h1>
          <p className="text-sm text-muted-foreground">Last {stats.total} sends</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search subject, recipient, business…"
            className="px-3 py-2 rounded border bg-white dark:bg-neutral-900"
          />
          <button onClick={()=>{ setShowOpened(v=>!v); setPage(1) }} className={`px-2 py-1 rounded text-xs border ${showOpened? 'bg-green-100 text-green-800 border-green-300' : 'bg-white dark:bg-neutral-900'}`}>Opened</button>
          <button onClick={()=>{ setShowClicked(v=>!v); setPage(1) }} className={`px-2 py-1 rounded text-xs border ${showClicked? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-white dark:bg-neutral-900'}`}>Clicked</button>
          <button onClick={()=>{ setShowUnsub(v=>!v); setPage(1) }} className={`px-2 py-1 rounded text-xs border ${showUnsub? 'bg-red-100 text-red-800 border-red-300' : 'bg-white dark:bg-neutral-900'}`}>Unsub</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Open rate" value={`${stats.openRate}%`} />
        <Stat label="Click rate" value={`${stats.clickRate}%`} />
        <Stat label="Unsubscribe rate" value={`${stats.unsubRate}%`} />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground">No emails yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b sticky top-0 bg-white dark:bg-neutral-900">
                <th className="py-2 px-3 cursor-pointer" onClick={()=>toggleSort('business')}>Business {sortKey==='business' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                <th className="px-3 cursor-pointer" onClick={()=>toggleSort('to_email')}>To {sortKey==='to_email' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                <th className="px-3 cursor-pointer" onClick={()=>toggleSort('subject')}>Subject {sortKey==='subject' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                <th className="px-3 cursor-pointer" onClick={()=>toggleSort('sent_at')}>Sent {sortKey==='sent_at' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                <th className="px-3 cursor-pointer" onClick={()=>toggleSort('opened_at')}>Opened {sortKey==='opened_at' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                <th className="px-3 cursor-pointer" onClick={()=>toggleSort('clicked_at')}>Clicked {sortKey==='clicked_at' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                <th className="px-3">Unsubscribed</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(r => (
                <tr key={r.id} className="border-b odd:bg-gray-50 dark:odd:bg-neutral-900">
                  <td className="py-2 px-3 font-mono">
                    <a href={`/admin/businesses/${r.business_id}`} className="text-blue-600 hover:underline">
                      {(r.business_name ?? r.business_id.slice(0,8))}
                    </a>
                  </td>
                  <td className="px-3">{r.to_email ?? '—'}</td>
                  <td className="px-3 max-w-[360px] truncate">{r.subject ?? '—'}</td>
                  <td className="px-3">{r.sent_at ? new Date(r.sent_at).toLocaleString() : '—'}</td>
                  <td className="px-3">{r.opened_at ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">Opened</span> : '—'}</td>
                  <td className="px-3">{r.clicked_at ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">Clicked</span> : '—'}</td>
                  <td className="px-3">{r.unsubscribed ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">Unsub</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between p-3 text-xs">
            <div>Page {currentPage} of {totalPages} • {sorted.length} rows</div>
            <div className="flex items-center gap-2">
              <button className="px-2 py-1 border rounded disabled:opacity-50" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={currentPage<=1}>Prev</button>
              <button className="px-2 py-1 border rounded disabled:opacity-50" onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={currentPage>=totalPages}>Next</button>
              <select className="ml-2 border rounded px-2 py-1" value={pageSize} onChange={e=>{ setPageSize(parseInt(e.target.value,10)); setPage(1) }}>
                {[10,20,50,100].map(n=> <option key={n} value={n}>{n}/page</option>)}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

