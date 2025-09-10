# Fix Plan

Prioritization per acceptance criteria.

## P0 — Enable import → generate (AI) → preview → edit → save
1) Fix env var typo breaking edit updates
   - File: app/api/preview/update/route.ts
   - Action: Change `NEXT_PUBLIC_SUPABASE_AN_KEY` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Verify: POST /api/preview/update updates only intended fields and merges custom_edits
2) Unblock build failing due to ESLint errors (minimal changes)
   - Option A: Fix errors in place (no-explicit-any, no-unescaped-entities)
   - Option B: Configure lint not to block build in dev (CI can still block)
3) Make preview generation resilient in dev
   - Add a guarded dev flag or fallback path for images when TOGETHER_API_KEY is absent (e.g., data URLs or placeholder stock images under an explicit “audit/dev mode” flag)
   - Ensure generate-preview returns success in dev without paid calls
4) Edit Panel minimal wiring
   - Add client forms for Phone / Hours / Email
   - POST to /api/preview/update with granular updates
   - Normalize hours to `h:mm A` on server
   - Fix hours regex to only target correct day labels (anchor to label spans or scoped containers)
5) Claim page preview URL
   - Update app/claim/[id]/page.tsx to use `preview.preview_url` (or map to `url` after select) so iframe renders correctly

## P1 — Developer experience & reliability
1) Type & Lint
   - Fix Stripe apiVersion TS mismatch
   - Resolve top eslint issues; add rule exceptions only where justified
2) Structured logging over silent catches
   - Standardize try/catch paths to log error + relevant context; centralize with a small logger util
3) Env hygiene
   - Ensure docs/ENVIRONMENT.md and .env.example fully reflect required names; add validation on boot (throw helpful errors)
4) Next outputFileTracingRoot
   - Configure next.config.ts to set `outputFileTracingRoot` to the monorepo root warning context or remove stray lockfiles

## P2 — Next 48h wins
1) Email + social links editing in Edit Panel
   - Extend UI + API update to support email + social URLs
2) Lightweight API usage dashboard in admin
   - Add simple table in /admin pulling last 24h from api_usage with provider breakdown
3) Screenshot route improvement (optional)
   - Integrate Puppeteer locally under a dev flag to capture real screenshots or keep SVG placeholder in prod
4) Bulk Email Campaigns (Phase 2)
   - API: POST /api/campaign/send-bulk (accepts businessIds[], template) → uses existing /api/send-email
   - UI: Admin dashboard panel with checkboxes, template dropdown, send button, and basic open/click metrics
   - Logging: Insert campaign summaries into campaigns table (id, type, template, totals, results)
   - Build hygiene: eliminate ESLint warnings, set next.config.ts outputFileTracingRoot to silence workspace warning

## Validation & Tests
- Add a minimal route test suite for /api/preview/update with fixture HTML and asserts on replacements
- Add a smoke test for /api/generate-preview in dev mode (no external calls) to validate end-to-end insert/update

## Rollout
- Branch: fix/p0-core (after audit/diagnostics)
- Phase 1: Apply P0 fixes, run type/lint/build/dev, confirm headless crawl passes
- Phase 2: Apply P1 improvements; phase 3: P2 enhancements

## Release v0.2.0
- Features: Payments (Stripe Checkout + webhook), Vercel domain deploy, Resend webhook, bulk email campaigns with A/B, leads ingestion (Places + SerpAPI), daily automation, admin metrics, circuit breakers.
- Date: 2025-09-10
- Tag: v0.2.0
- Notes: See CHANGELOG.md for full details.

