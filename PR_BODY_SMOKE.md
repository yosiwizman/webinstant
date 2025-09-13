# chore: add headless smoke-test suite + env health + Supabase client singleton

## What’s included
- scripts/http.ts — minimal fetch wrapper (retry, timeouts, redact()).
- scripts/smoke.ts — end-to-end headless smoke; writes:
  - reports/smoke/<DATE>-smoke.md
  - reports/smoke/latest.json
- app/api/health/config/route.ts — boolean env presence.
- package.json — "smoke": "tsx scripts/smoke.ts --base http://localhost:3000"
- postcss.config.js — stable Tailwind v4 on Windows.
- Admin refactor — all client modules use the browser Supabase singleton.

## How to run locally

```
npm ci
npm run build
npm run dev # can run in background
npm run smoke -- --base http://localhost:3000
```

## Acceptance
- `GET /api/health/config` all `true` with correct envs.
- `npm run smoke` produces Markdown + JSON report.
- No secrets logged.

## Notes from first run
- Supabase REST OK.
- App endpoints that require envs failed due to missing/partial envs on the runner. See the Markdown report for the exact keys and next actions.
