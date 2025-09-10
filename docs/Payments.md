# Payments

This document explains the Stripe payment flow and how to test it locally.

Flow
- Client: Claim page collects domain and calls POST /api/create-checkout-session with { businessId, domainName, email }.
- Stripe: User is redirected to Checkout to pay $150 (USD).
- Success redirect: /payment/success?session_id=...&business_id=...
- Webhook: Stripe sends checkout.session.completed to /api/stripe/webhook, which:
  - Inserts a row into payments (best-effort) and updates payment_intents (legacy) to completed.
  - Creates a generated_websites row with status=pending_deploy and target_domain.

Local webhook testing
- Install Stripe CLI and run:
  stripe listen --forward-to localhost:3000/api/stripe/webhook
- Trigger a test event after creating a session:
  stripe trigger checkout.session.completed

Environment variables (names only)
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- NEXT_PUBLIC_BASE_URL

Notes
- The webhook route uses raw body verification via stripe.webhooks.constructEvent and requires runtime=nodejs.
- If you prefer Payment Links, set STRIPE_PAYMENT_LINK_URL and open it from the claim page with appropriate query params. Checkout Session is the default for metadata and flow control.

