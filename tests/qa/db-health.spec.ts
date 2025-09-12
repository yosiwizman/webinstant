import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const QA_DIR = path.join(process.cwd(), 'logs', 'qa')
const SCREEN_DIR = path.join(QA_DIR, 'screenshots')

async function ensureDirs() {
  await fs.promises.mkdir(SCREEN_DIR, { recursive: true })
}

test('DB Health card renders and refreshes', async ({ page }) => {
  await ensureDirs()
  const base = process.env.BASE_URL || 'http://localhost:3000'

  await page.goto(base + '/admin', { waitUntil: 'networkidle' })
  const card = page.getByText('DB Health', { exact: false })
  await expect(card).toBeVisible()

  // Click Refresh
  const button = page.getByRole('button', { name: /refresh/i })
  await button.click()

  // Expect at least 5 checks listed
  const items = page.locator('li:has-text("Table exists:")')
  await expect(items.first()).toBeVisible({ timeout: 10000 })

  const shot = path.join(SCREEN_DIR, `qa-db-health-${Date.now()}.png`)
  await page.screenshot({ path: shot, fullPage: true })
})
