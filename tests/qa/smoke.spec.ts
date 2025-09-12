import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const QA_DIR = path.join(process.cwd(), 'logs', 'qa')
const CONSOLE_LOG = path.join(QA_DIR, 'console.log')
const NETWORK_LOG = path.join(QA_DIR, 'network.log')
const SCREEN_DIR = path.join(QA_DIR, 'screenshots')
const FINDINGS_MD = path.join(process.cwd(), 'docs', 'QA-Findings.md')

function now() { return new Date().toISOString() }

async function ensureDirs() {
  await fs.promises.mkdir(QA_DIR, { recursive: true })
  await fs.promises.mkdir(SCREEN_DIR, { recursive: true })
  await fs.promises.mkdir(path.dirname(FINDINGS_MD), { recursive: true })
}

function sanitize(route: string) {
  return route.replace(/[^a-z0-9-_]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

test.use({
  trace: 'on-first-retry',
  screenshot: 'on',
  video: 'retain-on-failure',
})

test('QA smoke: admin, metrics, preview, claim', async ({ browser }) => {
  await ensureDirs()

  const base = process.env.BASE_URL || 'http://localhost:3000'
  const routes = ['/admin', '/admin/metrics', '/preview/00000000-0000-0000-0000-000000000000', '/claim/00000000-0000-0000-0000-000000000000']

  const findings: Array<{ route: string; pass: boolean; consoleTop?: string[]; failedRequests?: string[]; screenshot?: string; severity: string }> = []

  for (const route of routes) {
    const page = await browser.newPage()
    const consoleErrs: string[] = []
    const failedReqs: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const line = `[${now()}] ${route} console: ${msg.text()}`
        fs.appendFileSync(CONSOLE_LOG, line + '\n')
        consoleErrs.push(msg.text())
      }
    })
    page.on('pageerror', (err) => {
      const line = `[${now()}] ${route} pageerror: ${err.message}`
      fs.appendFileSync(CONSOLE_LOG, line + '\n')
      consoleErrs.push(err.message)
    })
    page.on('requestfailed', (req) => {
      const rec = `[${now()}] ${route} requestfailed: ${req.url()} -> ${req.failure()?.errorText}`
      fs.appendFileSync(NETWORK_LOG, rec + '\n')
      failedReqs.push(`${req.url()} -> ${req.failure()?.errorText}`)
    })

    let pass = true
    try {
      await page.goto(base + route, { waitUntil: 'networkidle' })
    } catch (e: any) {
      pass = false
      fs.appendFileSync(CONSOLE_LOG, `[${now()}] ${route} navigation error: ${e.message}\n`)
    }

    const shotPath = path.join(SCREEN_DIR, `qa-${sanitize(route)}.png`)
    await page.screenshot({ path: shotPath, fullPage: true })

    const sev = pass && consoleErrs.length === 0 && failedReqs.length === 0 ? 'Cosmetic' : pass ? 'Minor' : 'Major'
    findings.push({ route, pass, consoleTop: consoleErrs.slice(0, 5), failedRequests: failedReqs.slice(0, 5), screenshot: shotPath, severity: sev })

    await page.close()
  }

  // Write QA Findings markdown
  const lines: string[] = []
  lines.push('# QA Findings (Auto)')
  lines.push('')
  lines.push(`Timestamp: ${now()}`)
  lines.push('')
  for (const f of findings) {
    lines.push(`## Route: ${f.route}`)
    lines.push(`- Result: ${f.pass ? 'PASS' : 'FAIL'}`)
    lines.push(`- Severity: ${f.severity}`)
    if (f.screenshot) lines.push(`- Screenshot: ${f.screenshot}`)
    if (f.consoleTop && f.consoleTop.length) {
      lines.push('- Console (top):')
      for (const c of f.consoleTop) lines.push(`  - ${c}`)
    }
    if (f.failedRequests && f.failedRequests.length) {
      lines.push('- Failed Requests (top):')
      for (const r of f.failedRequests) lines.push(`  - ${r}`)
    }
    lines.push('')
  }
  await fs.promises.writeFile(FINDINGS_MD, lines.join('\n'), 'utf-8')

  // Basic assertion to keep test green unless critical nav failure
  expect(findings.some(f => !f.pass)).toBeFalsy()
})

