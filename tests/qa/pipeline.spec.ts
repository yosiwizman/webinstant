import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const QA_DIR = path.join(process.cwd(), 'logs', 'qa')
const SCREEN_DIR = path.join(QA_DIR, 'screenshots')
const CONSOLE_LOG = path.join(QA_DIR, 'console.log')
const NETWORK_LOG = path.join(QA_DIR, 'network.log')

function now() { return new Date().toISOString() }
async function ensureDirs() { await fs.promises.mkdir(SCREEN_DIR, { recursive: true }) }

function logConsole(route: string, msg: string) {
  fs.appendFileSync(CONSOLE_LOG, `[${now()}] ${route} ${msg}\n`)
}
function logNet(route: string, msg: string) {
  fs.appendFileSync(NETWORK_LOG, `[${now()}] ${route} ${msg}\n`)
}

async function attachCsv(page: import('@playwright/test').Page) {
  const samplePath = path.join(process.cwd(), 'scripts', 'sample-businesses.csv')
  const fileInput = page.locator('input[data-testid="csv-file"]')
  await expect(fileInput).toBeVisible()
  await fileInput.setInputFiles(samplePath)
}

test('Pipeline: import, generate, email', async ({ page }) => {
  await ensureDirs()
  const base = process.env.BASE_URL || 'http://localhost:3000'

  page.on('console', m => { if (m.type() === 'error') logConsole('/admin', `console: ${m.text()}`) })
  page.on('pageerror', e => logConsole('/admin', `pageerror: ${e.message}`))
  page.on('requestfailed', r => logNet('/admin', `requestfailed: ${r.url()} -> ${r.failure()?.errorText}`))

  await page.goto(base + '/admin', { waitUntil: 'networkidle' })
  await attachCsv(page)

  // run import
  await page.getByTestId('import-run').click()
  await expect(page.getByText('Import complete', { exact: false })).toBeVisible({ timeout: 60000 })

  // set count=3 and run Generate & Email
  const countInput = page.locator('[data-testid="gen-count"]')
  await countInput.fill('3')
  await page.getByTestId('gen-email-run').click()

  // Wait for both steps status messages
  await expect(page.locator('#gen-email-status')).toContainText('Generated', { timeout: 120000 })
  await expect(page.locator('#gen-email-status')).toContainText('Emails sent', { timeout: 180000 })

  const shot = path.join(SCREEN_DIR, `qa-pipeline-${Date.now()}.png`)
  await page.screenshot({ path: shot, fullPage: true })
})

