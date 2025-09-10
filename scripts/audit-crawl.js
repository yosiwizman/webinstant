// scripts/audit-crawl.js
// Headless, read-only crawl using Puppeteer to collect console and network errors
// SAFE: does not write to production; only loads pages and captures logs/screens

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

async function ensureDir(p) {
  await fs.promises.mkdir(p, { recursive: true }).catch(() => {});
}

function sanitize(name) {
  return name.replace(/[^a-z0-9-_]/gi, '_');
}

async function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const logsDir = path.join(repoRoot, 'logs');
  const screensDir = path.join(logsDir, 'screens');
  await ensureDir(logsDir);
  await ensureDir(screensDir);

  const baseUrl = process.env.AUDIT_BASE_URL || 'http://localhost:3000';
  const routes = ['/', '/admin', '/preview/test', '/claim/test'];

  const logFile = path.join(logsDir, 'runtime-console.log');
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });
  const log = (msg) => logStream.write(`[${new Date().toISOString()}] ${msg}\n`);

  log(`Starting headless crawl against ${baseUrl}`);

  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

    for (const route of routes) {
      const url = baseUrl.replace(/\/$/, '') + route;
      const routeName = sanitize(route === '/' ? 'home' : route.slice(1));

      const page = await browser.newPage();

      page.on('console', (msg) => {
        try {
          log(`[console.${msg.type()}] ${route} :: ${msg.text()}`);
        } catch {}
      });

      page.on('pageerror', (err) => {
        log(`[pageerror] ${route} :: ${err?.message || err}`);
      });

      page.on('requestfailed', (req) => {
        log(`[requestfailed] ${route} :: ${req.method()} ${req.url()} :: ${req.failure()?.errorText}`);
      });

      try {
        const resp = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
        log(`[nav] ${route} :: status=${resp?.status?.()} ok=${resp?.ok?.()}`);

        // Small settle wait to catch late console errors
        await page.waitForTimeout(2500);

        const shotPath = path.join(screensDir, `${routeName}.png`);
        await page.screenshot({ path: shotPath, fullPage: true }).catch((e) => {
          log(`[screenshot-error] ${route} :: ${e?.message}`);
        });
      } catch (e) {
        log(`[navigation-error] ${route} :: ${e?.message}`);
      } finally {
        await page.close().catch(() => {});
      }
    }
  } catch (e) {
    log(`[fatal] ${e?.message}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    log('Headless crawl finished');
    logStream.end();
  }
}

main().catch((e) => {
  // Best-effort logging
  try {
    fs.appendFileSync(path.join(__dirname, '..', 'logs', 'runtime-console.log'), `[${new Date().toISOString()}] [fatal-main] ${e?.message}\n`);
  } catch {}
  process.exit(1);
});

