# Environment & Secrets

Do not commit real values. This document lists variable NAMES only and their feature mappings.

## Core
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (server-only)
- NEXT_PUBLIC_BASE_URL
- NEXT_PUBLIC_APP_URL
- NODE_ENV

## Email (Resend)
- RESEND_API_KEY
- RESEND_FROM_EMAIL

## Payments (Stripe)
- STRIPE_SECRET_KEY
- STRIPE_PAYMENT_LINK_URL (optional, if Payment Links flow is used)
- STRIPE_WEBHOOK_SECRET (if webhooks are configured)

## AI Providers
- OPENAI_API_KEY (present, no active usage in code)
- TOGETHER_API_KEY (required for image/content generation in current code)
- ANTHROPIC_API_KEY (optional fallback)

## Images & Search
- REPLICATE_API_TOKEN (AI images/video)
- TINYPNG_API_KEY (optional compression)
- SERPAPI_KEY (existing website check)

## Other (documented, not actively used in code)
- GOOGLE_PLACES_API_KEY (future data enrichment)
- VERCEL_TOKEN (deployment automation)

## Feature → Env Map
- Supabase DB (all reads/writes): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (server)
- Preview generation (content): TOGETHER_API_KEY OR ANTHROPIC_API_KEY (fallback)
- Preview generation (images): TOGETHER_API_KEY (enforced)
- Email sending: RESEND_API_KEY, RESEND_FROM_EMAIL
- Payments: STRIPE_SECRET_KEY, NEXT_PUBLIC_BASE_URL (return URLs)
- Screenshot placeholder: none (current route returns SVG placeholder)
- Admin dashboards (API usage, logs, pipeline): Supabase core vars

## Notes & Hygiene
- .env.example exists and should be kept in sync with variable names above.
- Never print or log real env values. Use placeholders in docs and scripts.
- Critical typo to fix during P0: app/api/preview/update/route.ts uses NEXT_PUBLIC_SUPABASE_AN_KEY (missing `ON`).

