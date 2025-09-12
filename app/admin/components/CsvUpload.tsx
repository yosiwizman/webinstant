"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useMemo } from 'react'
import Papa from 'papaparse'
import { getBrowserSupabase } from '@/lib/supabase'

interface CsvRow { [key: string]: string | number | null | undefined }

const DB_FIELDS = [
  'business_name',
  'address',
  'city',
  'state',
  'zip_code',
  'phone',
  'email',
  'industry_type'
] as const

type DbField = typeof DB_FIELDS[number]

export default function CsvUpload() {
  const supabase = getBrowserSupabase()
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<CsvRow[]>([])
  const [mapping, setMapping] = useState<Record<DbField, string>>({
    business_name: '', address: '', city: '', state: '', zip_code: '', phone: '', email: '', industry_type: ''
  })
  const [validating, setValidating] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<string>('')
  const [generatePreviews, setGeneratePreviews] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [insertedIds, setInsertedIds] = useState<string[]>([])
  const [overwrite, setOverwrite] = useState<boolean>(false)
  const [emailToId, setEmailToId] = useState<Record<string, string>>({})

  const previewRows = useMemo(() => rows.slice(0, 10), [rows])

  // Compute available IDs (inserted or annotated by email)
  const availableIds = useMemo(() => {
    if (insertedIds.length > 0) return insertedIds
    const ids = new Set<string>()
    rows.forEach((r) => {
      const em = String(r['email'] ?? '').toLowerCase(); const id = emailToId[em]; if (id) ids.add(id)
    })
    return Array.from(ids)
  }, [insertedIds, rows, emailToId])

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFileName(f.name)
    setProgress('Parsing…')
    Papa.parse<CsvRow>(f, {
      header: true,
      worker: true,
      skipEmptyLines: true,
      complete: (res: Papa.ParseResult<CsvRow>) => {
        const data = (res.data || []).filter((r: CsvRow) => Object.keys(r || {}).length > 0)
        const hdrs = res.meta.fields || []
        setHeaders(hdrs)
        setRows(data as CsvRow[])
        setProgress(`Parsed ${data.length} rows`)
        // naive auto-map by exact header match
        const auto: Record<DbField, string> = { ...mapping }
        DB_FIELDS.forEach(df => { if (hdrs.includes(df)) auto[df] = df })
        setMapping(auto)
      },
      error: (err: any) => {
        setProgress(`Parse error: ${err?.message || err}`)
      }
    })
  }

  function normalizePhone(p?: string | number | null): string | null {
    if (p == null) return null
    const s = String(p)
    const digits = s.replace(/\D/g, '')
    return digits ? digits : null
  }

  function getVal(r: CsvRow, header: string | undefined) {
    if (!header) return undefined
    return r[header]
  }

  async function runImport() {
    try {
      setValidating(true)
      setUploading(true)
      setResult('')
      setInsertedIds([])
      if (rows.length === 0) { setResult('No rows to import'); return }

      // build prepared objects
      const prepared = rows.map(r => {
        const rec: Record<string, unknown> = {}
        DB_FIELDS.forEach(df => {
          const hv = getVal(r, mapping[df])
          let v: unknown = hv
          if (df === 'phone') v = normalizePhone(hv as string | undefined)
          if (typeof v === 'string') v = v.trim()
          rec[df] = v ?? null
        })
        if (rec['has_website'] == null) rec['has_website'] = false
        return rec
      })

      // validate required (business_name and (phone or email))
      const invalids = prepared.filter(rec => !rec['business_name'] || (!(rec['phone']) && !(rec['email'])))
      if (invalids.length > 0) {
        setResult(`Validation failed: ${invalids.length} rows missing business_name or contact`)
        return
      }

      // chunk insert (email-based) to avoid ON CONFLICT errors
      const CHUNK = 300
      let affected = 0
      const insertedIds: string[] = []

      for (let i = 0; i < prepared.length; i += CHUNK) {
        const batch = prepared.slice(i, i + CHUNK)
        setProgress(`Importing ${i + 1}-${Math.min(i + CHUNK, prepared.length)} of ${prepared.length}…`)

        // Build unique email list for this batch
        const emails = Array.from(new Set(batch.map(r => String((r as any).email || '')).filter(Boolean)))
        let existingEmails: Array<{ id: string; email: string }> = []
        if (emails.length > 0) {
          const { data: exist } = await supabase
            .from('businesses')
            .select('id,email')
            .in('email', emails)
          existingEmails = (exist as Array<{ id: string; email: string }> | null | undefined) ?? []
        }
        const existingSet = new Set(existingEmails.map(e => (e.email || '').toLowerCase()))
        const toInsert = batch.filter(r => {
          const em = String((r as any).email || '').toLowerCase()
          return em && !existingSet.has(em)
        })

        if (toInsert.length > 0) {
          const { data, error } = await supabase
            .from('businesses')
            .insert(toInsert)
            .select('id,email')
          if (error) { setResult(`Batch error at ${i + 1}: ${error.message}`); return }
          affected += data ? data.length : 0
          const ids: string[] = []
          ;(data as Array<{ id: string; email?: string }> | null | undefined)?.forEach((d) => {
            if (d?.id) {
              insertedIds.push(d.id); ids.push(d.id)
              const em = String(d.email || '').toLowerCase(); if (em) setEmailToId(prev => ({ ...prev, [em]: d.id }))
            }
          })
          if (ids.length) setInsertedIds(prev => [...prev, ...ids])
        }
      }

      setResult(`Import complete. Affected: ${affected}`)

      if (generatePreviews) {
        let done = 0
        for (const id of insertedIds) {
          setProgress(`Generating previews ${++done} / ${insertedIds.length}`)
          await fetch('/api/generate-preview', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ businessId: id })
          })
          await new Promise(r => setTimeout(r, 200))
        }
        setProgress('Preview generation complete')
      }
    } finally {
      setValidating(false)
      setUploading(false)
    }
  }

  return (
    <div className="bg-white text-gray-900 dark:bg-neutral-950 dark:text-neutral-50 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">CSV Import</h2>
        <a className="text-sm text-blue-600 hover:underline" href="/scripts/sample-businesses.csv" download>
          CSV Samples
        </a>
      </div>

      <div className="space-y-3">
        <label htmlFor="csvFile" className="inline-flex items-center px-4 py-2 rounded bg-indigo-600 text-white cursor-pointer w-fit">Choose CSV</label>
        <input id="csvFile" data-testid="csv-file" type="file" accept=".csv" onChange={onFile}
          className="sr-only" />
        {fileName && <div className="text-xs text-gray-500">Selected: {fileName}</div>}
        {progress && <div className="text-xs text-gray-500">{progress}</div>}
      </div>

      {headers.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold mb-2 text-gray-800 dark:text-gray-200">Field Mapping</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {DB_FIELDS.map(df => (
              <div key={df} className="flex items-center gap-2">
                <label className="w-40 text-sm text-gray-700 dark:text-gray-300">{df}</label>
                <select className="flex-1 border rounded px-2 py-1"
                  value={mapping[df]}
                  onChange={(e) => setMapping(prev => ({ ...prev, [df]: e.target.value }))}
                >
                  <option value="">-- not mapped --</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={generatePreviews} onChange={(e) => setGeneratePreviews(e.target.checked)} />
              Generate previews for imported rows
            </label>
            <label className="inline-flex items-center gap-2 text-sm" title="If enabled, existing previews may be regenerated">
              <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
              Overwrite existing
            </label>
            <button data-testid="import-run" onClick={runImport} disabled={validating || uploading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {uploading ? 'Importing…' : 'Run Import'}
            </button>
            <button onClick={async () => {
              setGenerating(true)
              setResult('')
              try {
                const ids = availableIds.slice(0, 100)
                if (ids.length === 0) { alert('Import a CSV first to enable'); return }
                setProgress(`Queueing ${ids.length} jobs (cap 100)…`)
                const pool = 4
                let active = 0, idx = 0, generated = 0, failed = 0, skipped = 0
                await new Promise<void>((resolve) => {
                  const runNext = () => {
                    while (active < pool && idx < ids.length) {
                      const current = ids[idx++]
                      active++
                      setProgress(`Generating ${idx}/${ids.length}…`)
                      fetch('/api/generate-preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessId: current, overwrite }) })
                        .then(r => r.json().catch(()=>({}))).then(j => { if (j?.skipped) skipped++; else generated++; })
                        .catch(()=>{ failed++ })
                        .finally(()=>{ active--; if (idx < ids.length) runNext(); else if (active===0) resolve() })
                    }
                  }
                  runNext()
                })
                setResult(`Generated: ${generated} • Skipped: ${skipped} • Failed: ${failed}`)
                setProgress('')
              } finally {
                setGenerating(false)
              }
            }} disabled={generating || availableIds.length === 0} title={availableIds.length===0 ? 'Import a CSV first to enable' : undefined}
              className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-50">
              {generating ? 'Generating…' : 'Generate Websites'}
            </button>
          </div>

          {result && <div className="mt-3 text-sm text-green-700">{result}</div>}
        </div>
      )}

      {previewRows.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Preview (first 10 rows)</h3>
          <div className="overflow-auto border rounded">
            <table className="min-w-full text-xs">
              <thead>
                <tr>{headers.map(h => <th key={h} className="px-2 py-1 border-b text-left">{h}</th>)}</tr>
              </thead>
              <tbody>
                {previewRows.map((r, i) => (
                  <tr key={i} className="odd:bg-gray-50">
                    {headers.map(h => {
                      const val = String(r[h] ?? '')
                      if (h === 'business_name') {
                        const em = String(r['email'] ?? '').toLowerCase(); const bid = emailToId[em]
                        if (bid) return <td key={h} className="px-2 py-1 border-b"><a className="text-blue-600 underline" href={`/admin/businesses/${bid}`}>{val}</a></td>
                      }
                      if (h === 'address') {
                        const addr = `${r['address'] ?? ''}, ${r['city'] ?? ''} ${r['state'] ?? ''} ${r['zip_code'] ?? ''}`
                        return <td key={h} className="px-2 py-1 border-b"><a className="text-blue-600 underline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`}>{val}</a></td>
                      }
                      if (h === 'phone') {
                        return <td key={h} className="px-2 py-1 border-b"><a className="text-blue-600 underline" href={`tel:${val.replace(/\D/g,'')}`}>{val}</a></td>
                      }
                      if (h === 'email') {
                        return <td key={h} className="px-2 py-1 border-b"><a className="text-blue-600 underline" href={`mailto:${val}`}>{val}</a></td>
                      }
                      return <td key={h} className="px-2 py-1 border-b">{val}</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

