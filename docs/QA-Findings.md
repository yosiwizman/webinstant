# QA Findings (Auto)

Timestamp: 2025-09-10T22:50:27.420Z

## Route: /admin
- Result: PASS
- Severity: Minor
- Screenshot: C:\Users\yosiw\Desktop\webinstant\logs\qa\screenshots\qa-admin.png
- Failed Requests (top):
  - https://gidhshkekazxdbhlvoiw.supabase.co/rest/v1/businesses?select=* -> net::ERR_ABORTED
  - https://gidhshkekazxdbhlvoiw.supabase.co/rest/v1/website_previews?select=*&html_content=not.is.null -> net::ERR_ABORTED
  - https://gidhshkekazxdbhlvoiw.supabase.co/rest/v1/businesses?select=* -> net::ERR_ABORTED
  - https://gidhshkekazxdbhlvoiw.supabase.co/rest/v1/website_previews?select=*&html_content=not.is.null -> net::ERR_ABORTED
  - https://gidhshkekazxdbhlvoiw.supabase.co/rest/v1/emails?select=* -> net::ERR_ABORTED

## Route: /admin/metrics
- Result: PASS
- Severity: Minor
- Screenshot: C:\Users\yosiw\Desktop\webinstant\logs\qa\screenshots\qa-admin-metrics.png
- Failed Requests (top):
  - https://gidhshkekazxdbhlvoiw.supabase.co/rest/v1/website_previews?select=id&created_at=gte.2025-09-03T22%3A50%3A21.686Z&created_at=lt.2025-09-10T22%3A50%3A21.686Z -> net::ERR_ABORTED
  - https://gidhshkekazxdbhlvoiw.supabase.co/rest/v1/payments?select=id&created_at=gte.2025-09-03T22%3A50%3A21.686Z&created_at=lt.2025-09-10T22%3A50%3A21.686Z -> net::ERR_ABORTED
  - https://gidhshkekazxdbhlvoiw.supabase.co/rest/v1/businesses?select=id&created_at=gte.2025-09-03T22%3A50%3A21.686Z&created_at=lt.2025-09-10T22%3A50%3A21.686Z -> net::ERR_ABORTED
  - https://gidhshkekazxdbhlvoiw.supabase.co/rest/v1/generated_websites?select=id&status=eq.live -> net::ERR_ABORTED

## Route: /preview/00000000-0000-0000-0000-000000000000
- Result: PASS
- Severity: Minor
- Screenshot: C:\Users\yosiw\Desktop\webinstant\logs\qa\screenshots\qa-preview-00000000-0000-0000-0000-000000000000.png
- Console (top):
  - %c%s%c ❌ Supabase error: background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;color: light-dark(#000000, #ffffff);border-radius: 2px  Server   {code: PGRST116, details: The result contains 0 rows, hint: null, message: Cannot coerce the result to a single JSON object}

## Route: /claim/00000000-0000-0000-0000-000000000000
- Result: PASS
- Severity: Minor
- Screenshot: C:\Users\yosiw\Desktop\webinstant\logs\qa\screenshots\qa-claim-00000000-0000-0000-0000-000000000000.png
- Console (top):
  - Failed to load resource: the server responded with a status of 406 ()

## Known Issues
- [2025-09-10 18:51:09 -04:00] Pipeline E2E failed during CSV import: did not detect 'Import complete' text in admin UI.
- Likely cause: missing table-level UNIQUE constraint required for upsert on businesses(business_name, city, state, phone).
- Fix (run in Supabase SQL editor):

    ALTER TABLE businesses
      ADD CONSTRAINT uniq_business_identity_cols
      UNIQUE (business_name, city, state, phone);

- Artifacts: logs/qa/console.log, logs/qa/network.log; Playwright error context under test-results/.

