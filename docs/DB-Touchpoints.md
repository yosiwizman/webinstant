# Supabase & DB Touchpoints

This document inventories all known DB interactions by table, notes schema mismatches, and maps read/write flows.

## Tables (observed in code)
- businesses
- website_previews
- payment_intents
- email_logs
- operations_log
- campaigns
- api_usage

Additional (optional/guarded in UI components)
- subscriptions, transactions, emails, customers, admin_settings, business_notes, preview_edits

## Per-table Inventory

### businesses
- Reads:
  - app/api/create-checkout-session/route.ts (fetch business by id)
  - app/api/generate-preview/route.ts (fetch businesses; compute missing previews)
  - app/claim/[id]/page.tsx (fetch preview by id, then associated business data indirectly in UI)
  - components/admin/* (various dashboards)
- Writes/Updates:
  - app/api/generate-preview/route.ts (update website_url, industry_type)
  - app/api/verify-payment/route.ts (set payment_status, paid_at, domain_name)
  - app/api/send-campaign/route.ts (update preview_url, preview_generated_at, email_sent flags)
  - app/api/fix-preview-urls/route.ts (update preview_url)

Schema notes:
- Address fields used in multiple forms; ensure consistent names across UI and DB

### website_previews
- Reads:
  - app/preview/[id]/page.tsx (id, html_content, slug)
  - app/api/generate-preview/route.ts (existing previews)
- Writes/Updates:
  - app/api/generate-preview/route.ts (insert/update html_content, preview_url, template_used, slug)
  - app/api/save-edit/route.ts (update custom_edits)
  - app/api/preview/update/route.ts (update html_content, custom_edits, last_edited_at, email, social_links)
  - app/api/upload-logo/route.ts (update logo_url; and optional HTML tag replacement)
  - app/api/fix-preview-urls/route.ts (update preview_url)

Schema notes:
- Added optional columns to support UX edits: email (string), social_links (jsonb)
- last_edited_at vs updated_at (different endpoints set different timestamps)
- preview.slug vs website_previews.preview_url used inconsistently in some UIs

### payment_intents
- Writes:
  - app/api/create-checkout-session/route.ts (insert: stripe_session_id, business_id, domain_name, amount, status=pending, customer_email)
- Updates:
  - app/api/verify-payment/route.ts (status=completed, completed_at)

### email_logs
- Writes:
  - app/api/send-email/route.ts (sent/failed log entries with metadata)
- Reads:
  - app/api/send-email/route.ts (GET: status summary)

### operations_log
- Writes:
  - app/api/send-email/route.ts (operation logs for email)
  - app/api/track-email/route.ts (email event tracking)
  - app/api/log-error/route.ts (generic error logging)

### campaigns
- Writes:
  - app/api/campaign/send-bulk/route.ts (summary record for bulk campaign run)
  - app/api/send-campaign/route.ts (legacy summary record)

### api_usage
- Writes:
  - lib/apiTracker.ts (trackAPIUsage for Together/Anthropic/Replicate/SerpAPI/Resend/TinyPNG)
- Reads:
  - components/admin/ApiUsageMonitor.tsx (dashboard aggregations)

## Known Schema Mismatches and Risks
- website_previews timestamps: some code uses updated_at, some last_edited_at → standardize to updated_at (or add DB view)
- Claim page expects preview.url but DB column is preview_url → P0 bug
- zip vs zip_code fields referenced in different places → normalize in UI and code

## Read/Write Flows (high level)
- Generate → Preview (AI):
  - /api/generate-preview → reads businesses, writes website_previews (html_content, slug, preview_url), updates businesses.website_url
- Email Send:
  - /api/send-email → reads businesses and website_previews; sends via Resend; logs to email_logs and operations_log
- Payment:
  - /api/create-checkout-session → reads businesses, inserts payment_intents
  - /api/verify-payment → verifies Stripe session, updates payment_intents and businesses; triggers send-email
- Edit Path:
  - /api/save-edit → updates website_previews.custom_edits
  - /api/preview/update → replaces phone/hours/prices in html_content, merges custom_edits


