import puppeteer from 'puppeteer'
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const outDir = path.join(process.cwd(), 'logs', 'local-prod')
const screensDir = path.join(outDir, 'screens')
const consoleLogPath = path.join(outDir, 'runtime-console.log')

async function ensureDirs() {
  await fs.promises.mkdir(screensDir, { recursive: true })
}

async function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

async function getPreviewId(baseUrl) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  const supabase = createClient(url, key)
  const { data: pv } = await supabase.from('website_previews').select('id').order('created_at', { ascending: false }).limit(1)
  if (pv && pv.length > 0) return pv[0].id
  return null
}

function sanitize(route) { return route.replace(/[^a-z0-9-_]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') }

async function run() {
  await ensureDirs()
  const base = process.env.BASE_URL || 'http://localhost:3000'
  const browser = await puppeteer.launch({ headless: 'new' })

  const previewId = await getPreviewId(base)
  const routes = ['/admin', '/admin/metrics']
  if (previewId) {
    routes.push(`/preview/${previewId}`, `/claim/${previewId}`)
  } else {
    const ph = '00000000-0000-0000-0000-000000000000'
    routes.push(`/preview/${ph}`, `/claim/${ph}`)
  }

  const results = {}

  for (const route of routes) {
    const page = await browser.newPage()
    const consoleErrors = []
    const requestFails = []

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
        fs.appendFileSync(consoleLogPath, `[${new Date().toISOString()}] ${route} console error: ${msg.text()}\n`)
      }
    })
    page.on('pageerror', err => {
      consoleErrors.push(err.message)
      fs.appendFileSync(consoleLogPath, `[${new Date().toISOString()}] ${route} pageerror: ${err.message}\n`)
    })
    page.on('requestfailed', req => {
      const rec = { url: req.url(), error: req.failure()?.errorText }
      requestFails.push(rec)
      fs.appendFileSync(consoleLogPath, `[${new Date().toISOString()}] ${route} requestfailed: ${JSON.stringify(rec)}\n`)
    })

    let success = true
    try {
      await page.goto(base + route, { waitUntil: 'networkidle2', timeout: 60000 })
      await delay(800)
      const shot = path.join(screensDir, `prod-${sanitize(route)}.png`)
      await page.screenshot({ path: shot, fullPage: true })
    } catch (e) {
      success = false
      fs.appendFileSync(consoleLogPath, `[${new Date().toISOString()}] ${route} navigation error: ${e.message}\n`)
    }

    results[route] = { success, consoleErrors, requestFails }
    await page.close()
  }

  await browser.close()
  console.log(JSON.stringify({ base, results }))
}

run().catch(e => { fs.appendFileSync(consoleLogPath, `[${new Date().toISOString()}] script error: ${e.message}\n`) })

