// scripts/smoke.mjs
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import http from "http";
import https from "https";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadEnv(file) {
  const p = path.resolve(ROOT, file);
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const env = { ...process.env, ...loadEnv(".env.local") };
const pick = (...keys) => keys.map(k => env[k]).find(Boolean);

const BASE = pick("NEXT_PUBLIC_BASE_URL") || "http://localhost:3000";
const SUPABASE_URL = pick("SUPABASE_URL","NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE = pick("SUPABASE_SERVICE_ROLE","SUPABASE_SERVICE_ROLE_KEY");
const ANON = pick("NEXT_PUBLIC_SUPABASE_ANON_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !ANON) {
  console.error("❌ Missing Supabase env. Need SUPABASE_URL, SUPABASE_SERVICE_ROLE, NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

const { createClient } = await import("@supabase/supabase-js");
const sadmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

const fetch2 = (url, opts={}) => new Promise((resolve,reject)=>{
  const lib = url.startsWith("https") ? https : http;
  const req = lib.request(url,{method:opts.method||"GET",headers:opts.headers||{}},(res)=>{
    const chunks=[]; res.on("data",d=>chunks.push(d));
    res.on("end",()=> {
      const body = Buffer.concat(chunks);
      const ok = res.statusCode>=200 && res.statusCode<300;
      resolve({ ok, status:res.statusCode, headers:res.headers,
        text:()=>Promise.resolve(body.toString("utf8")),
        json:()=>Promise.resolve(JSON.parse(body.toString("utf8")||"{}")),
        buffer:()=>Promise.resolve(body)
      });
    });
  });
  req.on("error",reject);
  if (opts.body) req.write(typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body));
  req.end();
});

async function waitForReady(url, timeoutMs=90000) {
  const t0=Date.now();
  while (Date.now()-t0<timeoutMs) {
    try { const r=await fetch2(url); if (r.ok) return true; } catch {}
    await new Promise(r=>setTimeout(r,1200));
  }
  return false;
}

function startDevDetached() {
  const npmCmd = process.platform==="win32" ? "npm.cmd" : "npm";
  const child = spawn(npmCmd, ["run","dev"], { cwd:ROOT, detached:true, stdio:"ignore", shell:false });
  child.unref();
}

const report = { base: BASE, server_up:false, seeded:false, preview:null,
  screenshot_ok:false, send_email_ok:false, open_ok:false, click_ok:false, kpis_ok:false, urls:{}, notes:[] };

(async () => {
  let up = await waitForReady(BASE);
  if (!up) { report.notes.push("Dev not responding; starting 'npm run dev' detached."); startDevDetached(); up = await waitForReady(BASE); }
  report.server_up = up;
  if (!up) { report.notes.push("Server did not become ready."); return finalize(); }

  // find or seed
  let biz, prev;
  {
    const { data: rows, error } = await sadmin
      .from("website_previews")
      .select("id, preview_url, html_content, screenshot_url, business_id, businesses:business_id(id,business_name,email)")
      .order("created_at",{ascending:false}).limit(1);
    if (!error && rows?.length) {
      prev = rows[0]; biz = prev.businesses || { id: prev.business_id };
    } else {
      const emailRand = crypto.randomBytes(3).toString("hex");
      const bizName = `Smoke Test ${emailRand}`;
      const toEmail = `smoke-${emailRand}@example.com`;
      const { data: b, error: e1 } = await sadmin.from("businesses").insert({ business_name: bizName, email: toEmail }).select().single();
      if (e1) { report.notes.push(`Seed business failed: ${e1.message}`); return finalize(); }
      biz = b;
      const { data: p, error: e2 } = await sadmin.from("website_previews").insert({ business_id: biz.id }).select().single();
      if (e2) { report.notes.push(`Seed preview failed: ${e2.message}`); return finalize(); }
      prev = p; report.seeded = true;
    }
  }

  const previewId = prev.id; const previewUrl = `${BASE}/preview/${previewId}`;
  report.preview = { id: previewId, url: previewUrl }; report.urls.preview = previewUrl;

  if (!prev.html_content) {
    await fetch2(`${BASE}/api/preview/render`, { method:"POST", headers:{ "content-type":"application/json" }, body:{ previewId } });
    await new Promise(r=>setTimeout(r,1500));
  }

  try {
    const r = await fetch2(`${BASE}/api/screenshot`, { method:"POST", headers:{ "content-type":"application/json" },
      body:{ url: previewUrl, previewId } });
    report.screenshot_ok = r.ok;
  } catch(e){ report.notes.push(`Screenshot error: ${e.message}`); }

  let emailId;
  try {
    const r = await fetch2(`${BASE}/api/send-email`, { method:"POST", headers:{ "content-type":"application/json" },
      body:{ businessId: biz.id } });
    report.send_email_ok = r.ok;
    const body = await r.json().catch(()=> ({}));
    emailId = body.emailId;
  } catch(e){ report.notes.push(`send-email error: ${e.message}`); }

  if (!emailId) {
    const { data: logs } = await sadmin.from("email_logs").select("id,sent_at").eq("business_id", biz.id).order("sent_at",{ascending:false}).limit(1);
    if (logs?.length) emailId = logs[0].id;
  }

  if (emailId) {
    const openUrl = `${BASE}/api/track-email?e=${emailId}`;
    const enc = encodeURIComponent(previewUrl);
    const clickUrl = `${BASE}/api/r?e=${emailId}&b=${biz.id}&u=${enc}`;
    report.urls.open = openUrl; report.urls.click = clickUrl;
    try { const o = await fetch2(openUrl); report.open_ok = o.ok; } catch {}
    try { const c = await fetch2(clickUrl); report.click_ok = c.ok || (c.status>=300 && c.status<400); } catch {}
  } else {
    report.notes.push("No emailId found to flip open/click.");
  }

  try {
    const r = await fetch2(`${BASE}/api/admin/kpis`);
    if (r.ok) { const body = await r.json(); if (body?.revenue?.series_30d?.length===30) report.kpis_ok = true; report.urls.kpis = `${BASE}/api/admin/kpis`; }
  } catch {}

  finalize();
})().catch(e => { report.notes.push(`Fatal: ${e.message}`); finalize(); });

function finalize() {
  const out = path.resolve(ROOT, "smoke-report.json");
  fs.writeFileSync(out, JSON.stringify(report,null,2));
  const pass = report.server_up && report.preview && report.screenshot_ok && report.send_email_ok && (report.open_ok || report.click_ok) && report.kpis_ok;
  console.log("\n==== SMOKE SUMMARY ====");
  console.log(`Server:     ${report.server_up ? "PASS":"FAIL"}`);
  console.log(`Preview:    ${report.preview ? "PASS":"FAIL"}`);
  console.log(`Screenshot: ${report.screenshot_ok ? "PASS":"FAIL"}`);
  console.log(`Send email: ${report.send_email_ok ? "PASS":"FAIL"}`);
  console.log(`Open flip:  ${report.open_ok ? "PASS":"FAIL"}`);
  console.log(`Click flip: ${report.click_ok ? "PASS":"FAIL"}`);
  console.log(`KPIs API:   ${report.kpis_ok ? "PASS":"FAIL"}`);
  console.log("URLs:", report.urls);
  if (report.notes.length) console.log("Notes:", report.notes);
  console.log(`Report: ${out}`);
  console.log(`OVERALL: ${pass ? "PASS ✅" : "FAIL ❌"}`);
}

