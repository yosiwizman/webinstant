import puppeteer from 'puppeteer'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

async function ensureDirs() {
  const dir = path.join(process.cwd(), 'logs', 'screens')
  await fs.promises.mkdir(dir, { recursive: true })
}

async function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

async function getPreviewId(baseUrl) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase env not set')
  }
  const supabase = createClient(supabaseUrl, supabaseKey)

  // Try an existing preview first
  let { data: previews } = await supabase
    .from('website_previews')
    .select('id, business_id')
    .order('created_at', { ascending: false })
    .limit(1)

  if (previews && previews.length > 0) return previews[0].id

  // Find or create a business
  let { data: businesses } = await supabase
    .from('businesses')
    .select('id, business_name, email')
    .limit(1)

  if (!businesses || businesses.length === 0) {
    // Ingest a few leads
    await fetch(`${baseUrl}/api/leads/ingest`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: 'Austin', state: 'TX', category: 'plumber' })
    })
    await delay(1000)
    const res2 = await supabase.from('businesses').select('id, business_name').limit(1)
    businesses = res2.data || []
  }

  if (!businesses || businesses.length === 0) throw new Error('No business available to generate preview')

  const businessId = businesses[0].id

  // Generate preview
  await fetch(`${baseUrl}/api/generate-preview`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ businessId })
  })

  // Wait for preview to appear
  for (let i = 0; i < 10; i++) {
    const { data: pv } = await supabase
      .from('website_previews')
      .select('id')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(1)
    if (pv && pv.length > 0) return pv[0].id
    await delay(1000)
  }
  throw new Error('Preview not generated in time')
}

function sanitizeRoute(route) { return route.replace(/[^a-z0-9-_]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') }

async function run() {
  const base = process.env.BASE_URL || 'http://localhost:3000'
  await ensureDirs()

  const browser = await puppeteer.launch({ headless: 'new' })

  const routes = []
  const results = {}

  // Prepare preview id for dynamic routes
  let previewId = null
  try {
    previewId = await getPreviewId(base)
  } catch (e) {
    // continue without preview/claim
  }

  const fixedRoutes = ['/admin', '/admin/metrics']
  for (const r of fixedRoutes) routes.push(r)
  if (previewId) {
    routes.push(`/preview/${previewId}`)
    routes.push(`/claim/${previewId}`)
  } else {
    const placeholder = '00000000-0000-0000-0000-000000000000'
    routes.push(`/preview/${placeholder}`)
    routes.push(`/claim/${placeholder}`)
  }

  for (const route of routes) {
    const consoleErrors = []
    const requestFails = []

    const page = await browser.newPage()
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })
    page.on('pageerror', err => consoleErrors.push(err.message))
    page.on('requestfailed', req => requestFails.push({ url: req.url(), error: req.failure()?.errorText }))

    const url = base + route
    let success = true
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })
      await delay(1000)
      const outPath = path.join(process.cwd(), 'logs', 'screens', `visual-${sanitizeRoute(route || 'root')}.png`)
      await page.screenshot({ path: outPath, fullPage: true })
    } catch (e) {
      success = false
      consoleErrors.push((e).message)
    }
    results[route] = { success, consoleErrors, requestFails }
    await page.close()
  }

  await browser.close()
  console.log(JSON.stringify({ base, results }))
}

run().catch(e => { console.log(JSON.stringify({ error: e.message })) })

