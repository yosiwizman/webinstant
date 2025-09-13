## What’s included
- SQL: `supabase/migrations/20250912_csv_preview_slice.sql`
  - `website_previews.updated_at` + trigger
  - `website_previews.slug` unique index when non-null
  - `operations_log.correlation_id` + index
- Shared zod types: `packages/shared/types.ts`
  - `GeneratePreviewRequestSchema`, `GeneratePreviewResultSchema`
- API: `app/api/generate-preview/route.ts`
  - Validates `{ overwrite?: boolean, count?: number<=100 }`
  - Pool concurrency = 4; overwrite honored; single summary log row with `correlation_id`
- Smoke: `scripts/smoke.ts`
  - Calls `POST /api/generate-preview` with `{ overwrite: true, count: 5 }`
  - Asserts ≥5 previews with `html_content` or `preview_url`
  - Records `correlationId` in report details
- README: adds **CSV → Preview Slice (headless)** section with PowerShell run block

## How to run locally
```powershell
Set-Location "C:\Users\yosiw\Desktop\webinstant"
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm ci
npm run build
Start-Process powershell -ArgumentList 'npm run dev' -WindowStyle Minimized
$tries=60; while ($tries-- -gt 0) { try { Invoke-RestMethod http://localhost:3000/api/health/config -TimeoutSec 2 | Out-Null; break } catch { Start-Sleep 1 } }
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/generate-preview' -ContentType 'application/json' -Body '{ "overwrite": true, "count": 5 }'
npm run smoke -- --base http://localhost:3000
Invoke-Item .\reports\smoke

Acceptance

Lint/Typecheck/Build/Smoke pass

API returns { generated, skipped, failed, correlationId, sampleIds }

One operations_log summary row per batch with correlationId

Smoke verifies ≥5 previews exist
```
