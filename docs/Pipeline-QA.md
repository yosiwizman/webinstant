# Pipeline QA Runbook

This runbook describes the automated end-to-end pipeline QA: CSV import → generate previews → bulk email.

How to run
- Start local prod server (if not already):
  npm run build && (npm run start > logs/local-prod/start-qa.log 2>&1 &)
- Execute pipeline smoke:
  npm run qa:pipeline

Artifacts
- Logs: logs/qa/console.log, logs/qa/network.log, logs/qa/import.log
- Screenshots: logs/qa/screenshots/*
- Findings: docs/QA-Findings.md (from general smoke) and import log

Known failure modes
- API key/env missing: TOGETHER_API_KEY, RESEND_API_KEY, SUPABASE envs, Stripe keys
- Rate limits (AI providers, email) — re-run with smaller count (e.g., 3)
- Existing previews: uncheck overwrite in the UI or set overwrite=true to regenerate

Local notes
- Stripe webhook (local):
  stripe listen --forward-to localhost:3000/api/stripe/webhook
  stripe trigger checkout.session.completed
- Resend webhook (optional): expose localhost with ngrok and point to /api/resend/webhook

No “Multiple GoTrueClient”
- Confirmed resolved via getBrowserSupabase() singleton.

