"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useMemo } from 'react'
import Papa from 'papaparse'
import { getBrowserSupabase } from '@/lib/supabaseClient'

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

  const previewRows = useMemo(() => rows.slice(0, 10), [rows])

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
      setResult('')
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

      // chunk upsert
      const CHUNK = 500
      let affected = 0
      const insertedIds: string[] = []

      for (let i = 0; i < prepared.length; i += CHUNK) {
        const batch = prepared.slice(i, i + CHUNK)
        setProgress(`Upserting ${i + 1}-${Math.min(i + CHUNK, prepared.length)} of ${prepared.length}…`)
        const { data, error } = await supabase
          .from('businesses')
          .upsert(batch, { onConflict: 'business_name,city,state,phone' })
          .select('id')
        if (error) {
          setResult(`Batch error at ${i + 1}: ${error.message}`)
          return
        }
        affected += data ? data.length : 0;
        (data as Array<{ id: string }> | null | undefined)?.forEach((d: { id: string }) => { if (d?.id) insertedIds.push(d.id) })
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
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">CSV Import</h2>
        <a className="text-sm text-blue-600 hover:underline" href="/scripts/sample-businesses.csv" download>
          CSV Samples
        </a>
      </div>

      <div className="space-y-3">
        <input data-testid="csv-file" type="file" accept=".csv" onChange={onFile}
          className="block w-full text-sm text-gray-700" />
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
            <button data-testid="import-run" onClick={runImport} disabled={validating}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {validating ? 'Importing…' : 'Run Import'}
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
                    {headers.map(h => <td key={h} className="px-2 py-1 border-b">{String(r[h] ?? '')}</td>)}
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

