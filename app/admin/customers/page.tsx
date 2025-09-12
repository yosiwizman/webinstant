import { getBrowserSupabase } from '@/lib/supabase'
'use client'

import { useEffect, useMemo, useState } from 'react'

export default function CustomersList() {
  const sb = getBrowserSupabase()
  const [rows, setRows] = useState<Array<{ id: string; name: string|null; email: string|null; phone: string|null; created_at?: string|null }>>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data } = await sb
        .from('customers')
        .select('id,name,email,phone,created_at')
        .order('created_at', { ascending: false })
        .limit(200)
      setRows((data as any[]) || [])
      setLoading(false)
    })()
  }, [sb])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter(r => (r.email || '').toLowerCase().includes(s) || (r.name || '').toLowerCase().includes(s))
  }, [rows, q])

  return (
    <div className="bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-50 min-h-screen p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <input className="border rounded px-3 py-2 bg-white dark:bg-neutral-900" placeholder="Search name/email" value={q} onChange={e=>setQ(e.target.value)} />
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : (
        <div className="rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 dark:text-gray-300 border-b">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b">
                  <td className="px-3 py-2"><a href={`/admin/customers/${c.id}`} className="text-blue-600 hover:underline">{c.name || '—'}</a></td>
                  <td className="px-3 py-2">{c.email || '—'}</td>
                  <td className="px-3 py-2">{c.phone || '—'}</td>
                  <td className="px-3 py-2">{c.created_at ? new Date(c.created_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

