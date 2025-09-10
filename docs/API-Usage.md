# API Usage Audit

This matrix lists real call sites to external providers, how errors are handled, and whether results are used.

Legend
- EH: Error handling
- Usage: Whether the result is consumed downstream
- Flags: Env toggles or code paths preventing actual calls

## Together AI
- Where:
  - lib/contentGenerator.ts: together.chat.completions.create (≈ lines 334–348 and 949–963)
- EH: try/catch around API; logs and trackAPIUsage; on error, falls back to default content
- Usage: Parses JSON content and builds BusinessContent
- Flags: Requires TOGETHER_API_KEY; Images generation is enforced (see below)

## Anthropic (Claude)
- Where:
  - lib/contentGenerator.ts: dynamic import + new Anthropic(); messages.create (≈ 193–232)
- EH: try/catch; logs and trackAPIUsage; parsing guarded; fallback to generateBusinessContent on error
- Usage: Parses JSON-like response; builds content
- Flags: Requires ANTHROPIC_API_KEY; optional (used if configured)

## OpenAI
- Where:
  - No concrete runtime call sites detected in app/lib; dependency present in package.json
- EH: N/A
- Usage: N/A
- Flags: OPENAI_API_KEY documented in .env.example but no active usage in code

## Replicate
- Where:
  - lib/contentGenerator.ts: replicate.run for logo (≈ 428–438)
  - lib/contentGenerator.ts: replicate.run for video (≈ 514–527)
- EH: try/catch; trackAPIUsage; fallback to typography logo or null video
- Usage: Result URLs used for images/video in generated content
- Flags: Requires REPLICATE_API_TOKEN

## Resend
- Where:
  - lib/email.ts: new Resend(key) in constructor (≈ 317–328); emails.send via sendWithRetry (≈ 373–383)
  - app/api/send-email/route.ts: new Resend(process.env.RESEND_API_KEY); resend.emails.send (≈ 200–207)
- EH: try/catch; DB logging to email_logs and operations_log for success/failure
- Usage: Sends transactional emails; logs message IDs
- Flags: In lib/email.ts, simulates if no RESEND_API_KEY; In /api/send-email, dev mode forces recipient to test address

## TinyPNG (tinify)
- Where:
  - lib/contentGenerator.ts: optional compression after Replicate image generation (≈ 818–839)
  - Logo compression attempt (≈ 447–459)
- EH: Wrapped in try/catch; trackAPIUsage for success/failure
- Usage: Attempts to compress; proceeds if fails
- Flags: Requires TINYPNG_API_KEY, optional

## Stripe
- Where:
  - app/api/create-checkout-session/route.ts: new Stripe(STRIPE_SECRET_KEY) (line ≈ 5); checkout.sessions.create
  - app/api/verify-payment/route.ts: new Stripe(STRIPE_SECRET_KEY) (line ≈ 5); sessions.retrieve
- EH: try/catch; JSON error responses with 400/500 on failure
- Usage: Creates sessions; verifies and updates DB; triggers confirmation email
- Flags: Requires STRIPE_SECRET_KEY; return URLs use NEXT_PUBLIC_BASE_URL

## SerpAPI / Google Search
- Where:
  - lib/contentGenerator.ts: dynamic import 'serpapi'; getJson(...) (≈ 142–148)
- EH: try/catch; trackAPIUsage; logs and returns false on failure
- Usage: Heuristic check for existing websites
- Flags: Requires SERPAPI_KEY; optional

## Google Places
- Where:
  - No direct usage in code; documented in .env.example (GOOGLE_PLACES_API_KEY)

## Supabase (DB client)
- Where (non-exhaustive):
  - lib/supabase.ts, lib/supabase-client.ts (client creation)
  - app/api/* routes: frequent reads/writes to businesses, website_previews, payment_intents, email_logs, operations_log, campaign_logs, api_usage
- EH: Generally try/catch and error checks; often non-fatal logs for logging paths
- Usage: Core persistence across features
- Flags: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY; service role key on server endpoints

---

Notes
- trackAPIUsage (lib/apiTracker.ts) records per-call usage to api_usage with provider endpoint, token estimates, cost, and success flag.
- Some providers (OpenAI, Google Places) are present as dependencies or in env docs but have no active call sites.
- Image generation is strictly enforced to use Together AI (no stock fallback), which can cause preview generation to fail in unconfigured environments.

