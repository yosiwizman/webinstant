'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react'

interface Check { id: string; label: string; ok: boolean; detail?: string; advice?: string }
interface Report { ok: boolean; checks: Check[] }

export default function DbHealthCard() {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientCount, setClientCount] = useState<number>(0)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/db-health', { cache: 'no-store' })
      const json = await res.json()
      setReport(json)
      try {
        // @ts-expect-error window probe
        setClientCount((window as any).__sbClientCreated || 0)
      } catch {}
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchReport() }, [fetchReport])

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">DB Health</h2>
        <button onClick={fetchReport} disabled={loading}
          className="px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-50">{loading ? 'Checking…' : 'Refresh'}</button>
      </div>

      {error && <div className="text-red-600 text-sm mb-2">{error}</div>}

      {clientCount > 1 && (
        <div className="text-amber-600 text-sm mb-2">⚠️ Multiple Supabase browser clients detected ({clientCount}). Ensure singleton usage.</div>
      )}

      <ul className="space-y-1 text-sm">
        {report?.checks?.map((c) => (
          <li key={c.id} className="flex items-start gap-2">
            <span>{c.ok ? '✅' : '❌'}</span>
            <span className="text-gray-900 dark:text-gray-100">{c.label}</span>
            {!c.ok && (c.detail || c.advice) && (
              <div className="ml-2 text-gray-600 dark:text-gray-300">
                {c.detail && <div>Detail: {c.detail}</div>}
                {c.advice && (
                  <div>
                    Advice: {c.advice}
                    {c.id === 'upsert:unique' && (
                      <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-auto">{`ALTER TABLE businesses
  ADD CONSTRAINT uniq_business_identity_cols
  UNIQUE (business_name, city, state, phone);`}</pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
