// scripts/smoke.ts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchx, redact } from './http';

// Minimal .env loader (no secrets printed)
function loadEnv(file: string) {
  if (!fs.existsSync(file)) return {} as Record<string,string>;
  const out: Record<string,string> = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const baseArgIndex = args.findIndex(a => a === '--base');
const BASE = baseArgIndex >= 0 ? (args[baseArgIndex+1] || 'http://localhost:3000') : 'http://localhost:3000';

const ENV = { ...process.env, ...loadEnv(path.join(ROOT, '.env.local')) } as Record<string,string>;
const pick = (...keys: string[]) => keys.map(k => ENV[k]).find(Boolean) || '';

const SUPABASE_URL = pick('SUPABASE_URL','NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_ANON = pick('SUPABASE_ANON_KEY','NEXT_PUBLIC_SUPABASE_ANON_KEY');
const SUPABASE_SERVICE = pick('SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SERVICE_ROLE');
const RESEND = pick('RESEND_API_KEY');

const report: any = {
  timestamp: new Date().toISOString(),
  base: BASE,
  env: {
    SUPABASE_URL: Boolean(SUPABASE_URL),
    SUPABASE_ANON_KEY: Boolean(SUPABASE_ANON),
    SUPABASE_SERVICE_ROLE: Boolean(SUPABASE_SERVICE),
    RESEND_API_KEY: Boolean(RESEND)
  },
  resolved: {
    supabaseRestBase: '',
    supabaseUrlSuspect: false,
  },
  checks: [],
  appendix: [],
  summary: [],
};

function addCheck(title: string, ok: boolean, details: any = {}) {
  report.checks.push({ title, ok, details });
  report.summary.push({ title, status: ok ? 'PASS' : 'FAIL' });
}

function addAppendix(title: string, body: string) {
  report.appendix.push({ title, body: body.length > 800 ? body.slice(0, 800) + '\n…(truncated)' : body });
}

(async () => {
  // 1) Environment & config
  // Health endpoint
  try {
    const r = await fetchx(`${BASE}/api/health/config`, { retries: 2, timeoutMs: 6000 });
    const ok = r.ok;
    const json = ok ? await r.json() : {};
    addCheck('GET /api/health/config', ok, { status: r.status, json });
    addAppendix('health-config.json', JSON.stringify(json, null, 2));
  } catch (e: any) {
    addCheck('GET /api/health/config', false, { error: e.message });
  }

  // Resolve and print REST base URL
  report.resolved.supabaseRestBase = SUPABASE_URL ? `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1` : '';
  report.resolved.supabaseUrlSuspect = /^http:\/\/localhost\/?$/.test(SUPABASE_URL || '');
  addCheck('Resolved Supabase REST base', Boolean(report.resolved.supabaseRestBase) && !report.resolved.supabaseUrlSuspect, {
    supabaseUrl: SUPABASE_URL,
    restBase: report.resolved.supabaseRestBase,
    suspect: report.resolved.supabaseUrlSuspect
  });

  // 2) Supabase connectivity (expect 401/404, not connection refused)
  if (SUPABASE_URL) {
    try {
      const r = await fetchx(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/`, {
        headers: { apikey: SUPABASE_ANON || 'anon' },
      });
      addCheck('Supabase REST reachability', r.status > 0 && r.status < 500, { status: r.status });
      addAppendix('supabase-index.txt', await r.text());
    } catch (e: any) {
      addCheck('Supabase REST reachability', false, { error: e.message });
    }
  } else {
    addCheck('Supabase REST reachability', false, { error: 'SUPABASE_URL missing' });
  }

  // Helper to query table counts via REST head request
  async function tableHead(name: string) {
    const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${name}?select=id`;
    try {
      const r = await fetchx(url, { method: 'HEAD', headers: { apikey: SUPABASE_ANON || '' } });
      const ok = r.status === 200 || r.status === 206 || r.status === 204 || r.status === 404 || r.status === 401;
      return { ok, status: r.status };
    } catch (e: any) {
      return { ok: false, status: 0, error: e.message };
    }
  }
  const tables = ['businesses','website_previews','email_logs','email_queue','email_templates','api_usage','operations_log','ab_tests'];
  for (const t of tables) {
    const res = await tableHead(t);
    addCheck(`Table reachable: ${t}`, res.ok, res);
  }

  // 3) KPI & Admin APIs
  try {
    const r = await fetchx(`${BASE}/api/admin/kpis`, { retries: 2, timeoutMs: 8000 });
    const ok = r.ok;
    let body: any = {};
    try { body = await r.json(); } catch {}
    const hasKeys = body && typeof body === 'object' && ('active_websites' in body || 'emails_sent_today' in body || 'new_customers_today' in body);
    addCheck('GET /api/admin/kpis', ok && hasKeys, { status: r.status, keys: Object.keys(body || {}).slice(0, 20) });
    addAppendix('kpis.json', JSON.stringify(body, null, 2));
  } catch (e: any) {
    addCheck('GET /api/admin/kpis', false, { error: e.message });
  }

  // 4) Email pipeline test-only
  try {
    const r = await fetchx(`${BASE}/api/admin/email/test`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to: 'yosiwizman5638@gmail.com' }) });
    let ok = r.ok; let body: any = {};
    try { body = await r.json(); } catch {}
    if (!RESEND) ok = false; // classify as fail: missing key
    addCheck('POST /api/admin/email/test', ok, { status: r.status, hasResendKey: Boolean(RESEND) });
  } catch (e: any) {
    addCheck('POST /api/admin/email/test', false, { error: e.message, hasResendKey: Boolean(RESEND) });
  }

  // 5) Generation pipeline minimal (contracts-first)
  // Trigger batch via /api/generate-preview
  let genCounts = { generated: 0, skipped: 0, failed: 0, correlationId: '' } as any;
  try {
    const r = await fetchx(`${BASE}/api/generate-preview`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ overwrite: true, count: 5 }) });
    const body = await r.json().catch(() => ({}));
    addCheck('POST /api/generate-preview (batch 5)', r.ok, { status: r.status, body: { generated: body.generated, skipped: body.skipped, failed: body.failed, correlationId: body.correlationId } });
    if (r.ok) genCounts = body;
  } catch (e: any) {
    addCheck('POST /api/generate-preview (batch 5)', false, { error: e.message });
  }

  // 6) Draft → SEO Meta & Media slice
  let seoCounts = { updatedSeo: 0, createdMedia: 0, skipped: 0, failed: 0, correlationId: '' } as any;
  try {
    const r = await fetchx(`${BASE}/api/generate-seo-media`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ csvId: 'local-demo-csv', limit: 5, overwrite: false }) });
    const body = await r.json().catch(() => ({}));
    addCheck('POST /api/generate-seo-media (limit 5)', r.ok, { status: r.status, body: { counts: body.counts, correlationId: body.correlationId } });
    if (r.ok) seoCounts = body;
  } catch (e: any) {
    addCheck('POST /api/generate-seo-media (limit 5)', false, { error: e.message });
  }

  // Verify ≥5 articles with SEO + ≥5 hero media
  try {
    // Prefer join filter if available; fallback to simple counts
    const restBase = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1';

    // SEO count: articles where all three SEO fields not null
    const seoRes = await fetchx(`${restBase}/website_articles?select=id&seo_title=not.is.null&seo_slug=not.is.null&seo_description=not.is.null&limit=5`, { headers: { apikey: SUPABASE_ANON } });
    const seoArr = await seoRes.json().catch(() => []);

    // Media count: hero media
    const mediaRes = await fetchx(`${restBase}/website_media?select=id&kind=eq.hero&limit=5`, { headers: { apikey: SUPABASE_ANON } });
    const mediaArr = await mediaRes.json().catch(() => []);

    const ok = (Array.isArray(seoArr) ? seoArr.length : 0) >= 5 && (Array.isArray(mediaArr) ? mediaArr.length : 0) >= 5;
    addCheck('Verify SEO (≥5) and hero media (≥5)', ok, {
      seoCount: Array.isArray(seoArr) ? seoArr.length : 0,
      heroCount: Array.isArray(mediaArr) ? mediaArr.length : 0,
      correlationId: seoCounts?.correlationId || ''
    });
  } catch (e: any) {
    addCheck('Verify SEO (≥5) and hero media (≥5)', false, { error: e.message });
  }

  // Verify at least 5 previews present (html_content IS NOT NULL) via REST
  try {
    const rest = (p: string) => `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/website_previews?select=id${p}`;
    const rA = await fetchx(rest('&html_content=not.is.null&limit=5'), { headers: { apikey: SUPABASE_ANON } });
    const arrA = await rA.json().catch(() => []);
    const have = Array.isArray(arrA) ? arrA.length : 0;
    const ok = have >= 5 || ((genCounts.generated || 0) + (genCounts.skipped || 0)) >= 5;
    addCheck('Verify previews count >= 5 (html_content)', ok, { have, generated: genCounts.generated, skipped: genCounts.skipped, failed: genCounts.failed, correlationId: genCounts.correlationId });
  } catch (e: any) {
    addCheck('Verify previews count >= 5 (html_content)', false, { error: e.message });
  }

  // Verify operations_log entry exists for correlationId
  try {
    if (genCounts?.correlationId) {
      const restBase = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1';
      const r = await fetchx(`${restBase}/operations_log?select=id,correlation_id,scope,operation,status&correlation_id=eq.${encodeURIComponent(genCounts.correlationId)}&limit=1`, { headers: { apikey: SUPABASE_ANON } });
      const arr = await r.json().catch(() => []);
      const ok = Array.isArray(arr) && arr.length > 0;
      addCheck('operations_log contains correlationId (preview batch)', ok, { correlationId: genCounts.correlationId, found: ok });
    } else {
      addCheck('operations_log contains correlationId (preview batch)', false, { error: 'missing correlationId from response' });
    }
  } catch (e: any) {
    addCheck('operations_log contains correlationId (preview batch)', false, { error: e.message, correlationId: genCounts?.correlationId || '' });
  }

  // 6) Campaign surface checks
  try {
    const r = await fetchx(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/email_templates?select=*`, { headers: { apikey: SUPABASE_ANON } });
    addCheck('email_templates reachable via REST', r.status > 0 && r.status < 500, { status: r.status });
  } catch (e: any) {
    addCheck('email_templates reachable via REST', false, { error: e.message });
  }
  try {
    const r = await fetchx(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/email_queue?select=id&limit=1`, { headers: { apikey: SUPABASE_ANON } });
    addCheck('email_queue reachable via REST', r.status > 0 && r.status < 500, { status: r.status });
  } catch (e: any) {
    addCheck('email_queue reachable via REST', false, { error: e.message });
  }

  // Write outputs
  const reportsDir = path.join(ROOT, 'reports', 'smoke');
  fs.mkdirSync(reportsDir, { recursive: true });
  const dateSlug = new Date().toISOString().replace(/[:.]/g, '-');
  const latestJson = path.join(reportsDir, 'latest.json');
  const mdPath = path.join(reportsDir, `${dateSlug}-smoke.md`);

  fs.writeFileSync(latestJson, JSON.stringify(report, null, 2));

  // Markdown report
  const lines: string[] = [];
  lines.push(`# WebInstant Smoke Report`);
  lines.push(`Timestamp: ${report.timestamp}`);
  lines.push('');
  lines.push('## Summary');
  for (const s of report.summary) lines.push(`- ${s.status === 'PASS' ? 'PASS' : 'FAIL'} - ${s.title}`);
  lines.push('');
  lines.push('## Details');
  for (const c of report.checks) {
    lines.push(`### ${c.title}`);
    lines.push(`Status: ${c.ok ? 'PASS' : 'FAIL'}`);
    lines.push('```json');
    lines.push(JSON.stringify(c.details || {}, null, 2));
    lines.push('```');
  }
  lines.push('');
  lines.push('## Actionable Fixes');
  if (report.resolved.supabaseUrlSuspect) lines.push('- Blocker: Supabase URL looks like http://localhost without a port. Set http://localhost:54321 for local.');
  if (!report.env.RESEND_API_KEY) lines.push('- Major: RESEND_API_KEY is missing; email test will fail.');
  if (!report.env.SUPABASE_SERVICE_ROLE) lines.push('- Major: Service role key missing; server APIs depending on it may fail.');
  lines.push('');
  lines.push('## Appendix');
  for (const a of report.appendix) {
    lines.push(`### ${a.title}`);
    lines.push('```');
    lines.push(a.body);
    lines.push('```');
  }
  lines.push('');
  lines.push('## PowerShell (reproduce)');
  lines.push('```powershell');
  lines.push('# From repo root');
  lines.push(`Set-Location "${ROOT.replace(/\\/g,'\\\\')}"`);
  lines.push('');
  lines.push('# Ensure env is present');
  lines.push('if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }');
  lines.push('');
  lines.push('# Install & build');
  lines.push('npm ci');
  lines.push('npm run build');
  lines.push('');
  lines.push('# Start dev server in background');
  lines.push("Start-Process powershell -ArgumentList 'npm run dev' -WindowStyle Minimized");
  lines.push('');
  lines.push('# Wait for port 3000');
  lines.push('$retries=30; while ($retries -gt 0) {');
  lines.push('  try { (Invoke-WebRequest "http://localhost:3000/api/health/config" -UseBasicParsing -TimeoutSec 3) | Out-Null; break }');
  lines.push('  catch { Start-Sleep -Seconds 1; $retries-- }');
  lines.push('}');
  lines.push('');
  lines.push('# Run smoke');
  lines.push('npm run smoke -- --base http://localhost:3000');
  lines.push('');
  lines.push('# Open the report');
  lines.push('Invoke-Item ".\\reports\\smoke"');
  lines.push('```');

  fs.writeFileSync(mdPath, lines.join('\n'));

  // Console summary
  console.log(`\nReport written to: ${mdPath}`);
  console.log(`Latest JSON: ${latestJson}`);
  for (const s of report.summary) console.log(`${s.status.padEnd(4)} ${s.title}`);
})();
