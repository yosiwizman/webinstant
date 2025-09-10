# WebInstant — Deep Diagnostic Audit

Branch: audit/diagnostics
Mode: SAFE (no destructive actions, no production changes)

## Environment
- OS: Windows (PowerShell)
- Node: v22.17.1
- npm: 10.9.2
- Package manager: npm (package-lock.json present)

## Frameworks and Tooling
- Next.js: ^15.5.0 (App Router)
- React: 19.1.0
- TypeScript: ^5
- ESLint: ^9 (eslint-config-next 15.4.6)
- Tailwind CSS: ^4 (globals.css uses `@import "tailwindcss"`)
- Headless browser: Puppeteer present; Playwright not installed

## Preliminary P0 Findings (to verify during execution)
1. Env var typo blocks edit updates
   - File: app/api/preview/update/route.ts
   - Issue: Uses `process.env.NEXT_PUBLIC_SUPABASE_AN_KEY` (missing `ON`) for Supabase anon key
   - Impact: Endpoint fails in environments lacking the typo’d var; breaks phone/hours/prices update flow
2. Claim page likely cannot render preview
   - File: app/claim/[id]/page.tsx
   - Issue: Uses `preview.url` but DB field is `preview_url`
   - Impact: Iframe src is incorrect → blank or broken claim page
3. Preview generation hard-depends on Together AI for images
   - File: lib/contentGenerator.ts → generateBusinessImages()
   - Behavior: Throws if `TOGETHER_API_KEY` is not set (no stock fallback)
   - Impact: /api/generate-preview fails in unconfigured/dev environments (blocks generate → preview)
4. Build blocked by lint rules (treated as errors during `next build`)
   - Errors: `@typescript-eslint/no-explicit-any`, `react/no-unescaped-entities`, etc.
   - Impact: Production build fails until lint issues are addressed or lint fail-on-build is relaxed
5. Hydration/SSR fragility in Preview
   - Files: app/preview/[id]/page.tsx, PreviewClient.tsx
   - Notes: Uses `dangerouslySetInnerHTML` with stripping of <head>/<body>; warnings likely under dev

## Task 3 — Type & Lint Scan

TypeScript (npx tsc --noEmit)
- Errors (sample):
  - app/api/create-checkout-session/route.ts(6,3): TS2322: Stripe apiVersion string mismatch
  - app/api/verify-payment/route.ts(6,3): TS2322: Stripe apiVersion string mismatch

ESLint (npm run lint)
- Errors/Warnings (top issues):
  - @typescript-eslint/no-explicit-any (2 errors): app/api/admin/export-report/route.ts lines ~9, ~52
  - react/no-unescaped-entities (4 errors): app/payment/success/page.tsx
  - @typescript-eslint/no-unused-vars (2 warnings): app/api/track-email/route.ts
  - react-hooks/exhaustive-deps (1 warning): app/payment/success/page.tsx (useEffect missing dependency)

Recommendation
- Either relax blocking lint rules for build or address violations; keep fail-on-build for CI only during dev.

## Task 4 — Build & Dev Smoke

Build (npm run build)
- Status: Fails due to ESLint errors during the build phase (see logs/build.log)
- Notable warning: Next.js inferred workspace root to C:\Users\yosiw due to multiple lockfiles; consider setting `outputFileTracingRoot` in next.config.ts

Dev server (npm run dev)
- Not run yet (requires background process handling on Windows; recommend running once you confirm we can kill the dev process safely after 45s)

## Notes on Routes
- Full table saved at docs/Route-Inventory.md
- Key pages: /, /admin, /payment/success, /claim, /claim/[id], /preview/[id]
- Key APIs: create-checkout-session, send-email, generate-preview, screenshot, save-edit, preview/update, verify-payment, track-email, export-report, fix-preview-urls, import-businesses, log-error, upload-logo, send-campaign, campaign/send

## Edit Panel — Focused Audit (initial)

End-to-end flow traced (UI → API → DB):
- UI: app/preview/[id]/PreviewClient.tsx
  - Edit modal renders three buttons (Update Phone, Update Business Hours, Update Prices) but no forms/actions are wired to call APIs yet.
- API: app/api/preview/update/route.ts
  - Accepts { previewId, businessId, updates }, reads website_previews (html_content, custom_edits)
  - Performs regex-based replacements for phone and hours; merges custom_edits; writes back to website_previews
- DB: website_previews.custom_edits JSON is merged with new updates; html_content updated in place

Repro/Findings:
1) Hours editing overwrites multiple days (suspected)
   - Code: app/api/preview/update/route.ts lines ≈ 53–74
   - Risk: Regex `new RegExp(`${dayCapitalized}[:\\s]+[^<\\n]*`, 'g')` can match too broadly, potentially replacing unintended matches.
   - Minimal repro: Provide updates.hours = { monday: "9:00 AM - 5:00 PM" } and verify only Monday line changes in html_content.
2) Time formatting issue ("400 AM" vs "4:00 AM")
   - Likely due to unsanitized input from UI (once implemented); recommend normalizing to `h:mm A` on the server before replacement.
3) Email editing missing/non-functional
   - The edit modal does not contain an email field or any wiring to /api/preview/update.
   - Recommendation: add explicit form inputs and POST handlers for phone/hours/email.
4) Env typo blocks update route
   - File: app/api/preview/update/route.ts (line ≈ 7)
   - `NEXT_PUBLIC_SUPABASE_AN_KEY` typo (missing ON) → causes runtime failure.

Test scaffold (pseudo):
- Create a minimal script (or route test) to call /api/preview/update with fixtures:
  - previewId: existing preview id (or injected test record)
  - updates: { hours: { monday: "9:00 AM - 5:00 PM" }, phone: "(555) 111-2222" }
  - Assert: Only Monday line changes; phone updated in all expected places; custom_edits merged; html valid

## Next Actions
- Proceed with headless crawl via Puppeteer (non-destructive): collect console and network errors, take screenshots
- Complete API Usage matrix with file+line pointers and flags for stub vs real calls
- Enumerate env names → docs/ENVIRONMENT.md; ensure .env.example is complete (no values)
- Map DB touchpoints by table → docs/DB-Touchpoints.md

