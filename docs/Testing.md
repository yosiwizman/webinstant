# Testing Harness

## Stripe
- Local webhook:
  - stripe listen --forward-to localhost:3000/api/stripe/webhook
  - Trigger: stripe trigger checkout.session.completed
- Verify:
  - payments row inserted
  - payment_intents updated to completed
  - generated_websites row created with status=pending_deploy

## Resend
- Configure webhook in dashboard to POST to /api/resend/webhook
- Send a test email (via /api/send-email or admin panel)
- Verify events logged: email.delivered, email.opened, email.clicked

## Domains
- Call POST /api/deploy with { business_id, target_domain }
- Expect verification instructions if required (TXT/CNAME). Add DNS record manually.
- Optionally call verify endpoint downstream (auto-attempt if no instructions were needed).

## Leads (Places → Details)
- Call POST /api/leads/ingest with a small city/category (e.g., { city: "Austin", state: "TX", category: "plumber" })
- Confirm Place Details is used to fetch website if available.
- If Places quota is hit, fallback to SerpAPI should still ingest records where possible.
- Verify businesses updated with has_website.

## Supabase RLS sanity
- Confirm that tables accessed from client have appropriate RLS policies for anon/auth roles.
- Ensure server-side routes use service role key (or server-side privileges) where needed.

## UI Smoke
- npm run dev
- Visit /admin, /admin/metrics, /preview/<id>, /claim/<id>
- Optional: capture screenshots into logs/screens/phase4/*.png

