# WebInstant Route Inventory

This inventory lists all App Router pages and API routes detected under `app/`.

Note: Methods are derived from exported handlers in each `route.ts`.

## Pages

| Route | File Path | Dynamic Params | Notes |
|---|---|---|---|
| / | app/page.tsx | — | Next.js starter content present |
| /admin | app/admin/page.tsx | — | Admin dashboard (client components, Supabase reads) |
| /claim | app/claim/page.tsx | — | Static claim landing (optional)
| /claim/[id] | app/claim/[id]/page.tsx | id | Uses Supabase to fetch preview; note potential field mismatch (preview_url vs url)
| /preview/[id] | app/preview/[id]/page.tsx | id | Renders stored HTML (dangerouslySetInnerHTML); Edit modal present but actions are placeholders |
| /payment/success | app/payment/success/page.tsx | — | Verifies payment via /api/verify-payment |

## API Routes

| API Route | File Path | Methods | Dynamic Params | Notes |
|---|---|---|---|---|
| /api/create-checkout-session | app/api/create-checkout-session/route.ts | POST, GET | — | Stripe Checkout; writes to payment_intents |
| /api/send-email | app/api/send-email/route.ts | POST, GET | — | Resend integration; dev-mode recipient override |
| /api/generate-preview | app/api/generate-preview/route.ts | POST | — | Generates content + images (Together/Replicate); writes website_previews and businesses |
| /api/screenshot | app/api/screenshot/route.ts | GET, POST | — | Placeholder SVG screenshot generator |
| /api/save-edit | app/api/save-edit/route.ts | POST, GET | — | Writes website_previews.custom_edits |
| /api/preview/update | app/api/preview/update/route.ts | POST, GET | — | Updates HTML content and custom_edits; uses SUPABASE_SERVICE_ROLE_KEY; env var typo present |
| /api/verify-payment | app/api/verify-payment/route.ts | POST | — | Verifies Stripe session; updates payment_intents and businesses; triggers send-email |
| /api/track-email | app/api/track-email/route.ts | GET | — | 1x1 pixel; logs operations_log |
| /api/admin/export-report | app/api/admin/export-report/route.ts | GET | — | CSV export of businesses |
| /api/fix-preview-urls | app/api/fix-preview-urls/route.ts | POST, GET | — | Fixes preview_url for previews (and businesses) |
| /api/import-businesses | app/api/import-businesses/route.ts | POST, GET | — | CSV upload parser; uses createBusinessImporter() |
| /api/log-error | app/api/log-error/route.ts | POST, GET | — | Logs errors to operations_log |
| /api/upload-logo | app/api/upload-logo/route.ts | POST, GET | — | Saves logo locally under public/uploads/logos and updates website_previews |
| /api/send-campaign | app/api/send-campaign/route.ts | POST, GET | — | Batch preview generation + batch email via EmailService |
| /api/campaign/send | app/api/campaign/send/route.ts | POST, GET | — | Placeholder endpoint for campaign send |


