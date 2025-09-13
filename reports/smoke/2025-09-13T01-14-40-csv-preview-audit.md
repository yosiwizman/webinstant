# CSV → Preview (5 items) Audit Report

Timestamp: 2025-09-13T01:14:40Z

## Summary Scores

- SQL contracts ready: 75%
- Shared types (zod) present: 10%
- API implementation (/api/generate-preview): 55%
- Logging to operations_log with correlation IDs: 30%
- Smoke coverage for ≥5 previews: 60%
- Docs & run (README, .env.example, PowerShell): 80%

## Details

### 1) SQL contracts ready — website_previews + operations_log
Status: Partial (75%)
Evidence:
- supabase/migrations/20240822000000_fix_email_tables.sql: lines 84-93 define website_previews(id, business_id, preview_url, html_content, template_used, slug, created_at)
- supabase/migrations/20240822000000_fix_email_tables.sql: lines 95-102 create indexes incl. idx_website_previews_business_id
- supabase/migrations/20240822000000_fix_email_tables.sql: lines 56-65 create operations_log(id, operation_type, status, message, details, metadata, created_at)
- sql/FIX_OPERATIONS_LOG.sql and sql/FIX_OPERATIONS_LOG_NOW.sql include fixes/policies for operations_log
Gaps:
- website_previews lacks updated_at column
- website_previews.slug has no unique index (recommended if used as routing key)
- operations_log lacks correlation_id column required by scope
Next actions:
- Add migration to introduce website_previews.updated_at with trigger
- Add unique index on website_previews(slug)
- Add operations_log.correlation_id text and helpful indexes (created_at DESC)
ETA: S (1–2h)

### 2) Shared types — zod schemas for request/response
Status: Missing/minimal (10%)
Evidence:
- types/index.ts contains TS interfaces, but no zod
- No packages/shared/types.ts present
Gaps:
- No zod schemas for GeneratePreviewRequest/Result
Next actions:
- Create packages/shared or types/shared with zod schemas; export both zod and inferred TS types
ETA: S (1h)

### 3) API implementation — POST /api/generate-preview
Status: Partial (55%)
Evidence:
- app/api/generate-preview/route.ts exists and generates content/images and writes website_previews and businesses
- Does attempt slugging and preview_url; logs via console
Gaps against spec:
- No input validation with zod; supports optional businessId but not the overwrite/count batch API as described in slice (that’s in /api/generate-preview-batch)
- No concurrency pool=4 in this route (sequential per business, batch occurs via /api/generate-preview-batch calling it per id)
- No explicit cap to 100 in route
- Logging not structured with correlation IDs
Next actions:
- Implement contracts-first zod parsing in /api/generate-preview (or consolidate with batch)
- Add correlation id generation and structured logging
- Respect overwrite flag and count cap (100) for the batch entry or unify endpoints
ETA: M (1–2 days)

### 4) Logging — operations_log with correlation IDs and counts
Status: Partial (30%)
Evidence:
- app/api/send-email/route.ts inserts into operations_log with operation_type 'email_sent' (lines 238–257)
- app/api/log-error/route.ts writes generic operations_log
- app/api/jobs/daily/route.ts writes operations_log for cron summary (lines 114–122)
Gaps:
- No correlation_id usage across generate-preview or batch flow
- No single summary entry for batch generate with {generated, skipped, failed}
Next actions:
- Generate correlationId per batch request; write one summary row to operations_log with counts and sampleIds
- Propagate correlationId to per-item logs if added later
ETA: S (2–4h)

### 5) Smoke coverage — asserts ≥5 previews
Status: Partial (60%)
Evidence:
- scripts/smoke.ts exists; calls POST /api/generate-preview-batch with {limit:5, overwrite:true} and then checks /api/admin/kpis for counts ≥5
- Current run output: PASS for health and REST checks; FAIL for generate-preview-batch and count>=5 on this environment (likely data/env)
Gaps:
- It checks kpis, not direct table query for html_content IS NOT NULL; acceptable but indirect
- It does not log returned ids or batch result; doesn’t call /api/generate-preview directly for 5 items as requested in the slice
Next actions:
- Extend smoke to call /api/generate-preview with {overwrite:true, count:5}; store result counts and last ids and assert ≥5 content rows
ETA: S (1–2h)

### 6) Docs & run — README, .env.example, PowerShell
Status: Good (80%)
Evidence:
- README.md has setup and run instructions; .env.example present
- Our smoke report embeds a PowerShell block and there is scripts/smoke.ps1
Gaps:
- README does not include a specific CSV → Preview slice run block
- .env.example does not call out ported Supabase local URL (54321) explicitly
Next actions:
- Add “CSV → Preview Slice” section with curl example; note SUPABASE_URL port guidance
ETA: S (1h)

## Blockers vs Quick Wins
Blockers:
- Missing correlation_id in operations_log (affects audit requirements)
- /api/generate-preview lacks zod validation and count/overwrite handling per spec
Quick Wins:
- Add updated_at and slug unique index to website_previews
- Extend smoke to use /api/generate-preview with {overwrite:true,count:5} and assert direct row presence
- Add docs section + PowerShell

## Console Summary (Scores)
- SQL contracts: 75%
- Shared zod types: 10%
- API implementation: 55%
- Logging (correlationId): 30%
- Smoke coverage: 60%
- Docs & run: 80%

Blockers: correlation_id column missing; API route lacks zod and batch contract.
