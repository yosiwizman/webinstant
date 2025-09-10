import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const QA_DIR = path.join(process.cwd(), 'logs', 'qa')
const SCREEN_DIR = path.join(QA_DIR, 'screenshots')
const IMPORT_LOG = path.join(QA_DIR, 'import.log')

function now() { return new Date().toISOString() }

async function ensureDirs() {
  await fs.promises.mkdir(SCREEN_DIR, { recursive: true })
}

test('CSV import smoke', async ({ page }) => {
  await ensureDirs()
  const base = process.env.BASE_URL || 'http://localhost:3000'
  await page.goto(base + '/admin')

  const fileInput = page.locator('input[data-testid="csv-file"]')
  await expect(fileInput).toBeVisible()

  const samplePath = path.join(process.cwd(), 'scripts', 'sample-businesses.csv')
  await fileInput.setInputFiles(samplePath)

  const runBtn = page.getByTestId('import-run')
  await runBtn.click()

  // wait for a success text to appear
  const success = page.getByText('Import complete', { exact: false })
  await expect(success).toBeVisible({ timeout: 60000 })

  const shot = path.join(SCREEN_DIR, `qa-import-${Date.now()}.png`)
  await page.screenshot({ path: shot, fullPage: true })
  fs.appendFileSync(IMPORT_LOG, `[${now()}] Import success. Screenshot: ${shot}\n`)
})

