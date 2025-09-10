# QA Findings (Auto)

Timestamp: 2025-09-10T19:22:29.079Z

## Route: /admin
- Result: PASS
- Severity: Minor
- Screenshot: C:\Users\yosiw\Desktop\webinstant\logs\qa\screenshots\qa-admin.png
- Failed Requests (top):
  - https://gidhshkekazxdbhlvoiw.supabase.co/rest/v1/businesses?select=* -> net::ERR_ABORTED
  - https://gidhshkekazxdbhlvoiw.supabase.co/rest/v1/website_previews?select=*&html_content=not.is.null -> net::ERR_ABORTED
  - https://gidhshkekazxdbhlvoiw.supabase.co/rest/v1/emails?select=* -> net::ERR_ABORTED
  - https://gidhshkekazxdbhlvoiw.supabase.co/rest/v1/emails?select=*&opened_at=not.is.null -> net::ERR_ABORTED
  - https://gidhshkekazxdbhlvoiw.supabase.co/rest/v1/emails?select=*&clicked_at=not.is.null -> net::ERR_ABORTED

## Route: /admin/metrics
- Result: PASS
- Severity: Minor
- Screenshot: C:\Users\yosiw\Desktop\webinstant\logs\qa\screenshots\qa-admin-metrics.png
- Failed Requests (top):
  - https://gidhshkekazxdbhlvoiw.supabase.co/rest/v1/website_previews?select=id&created_at=gte.2025-09-03T19%3A22%3A26.420Z&created_at=lt.2025-09-10T19%3A22%3A26.420Z -> net::ERR_ABORTED
  - https://gidhshkekazxdbhlvoiw.supabase.co/rest/v1/businesses?select=id&created_at=gte.2025-09-03T19%3A22%3A26.420Z&created_at=lt.2025-09-10T19%3A22%3A26.420Z -> net::ERR_ABORTED
  - https://gidhshkekazxdbhlvoiw.supabase.co/rest/v1/payments?select=id&created_at=gte.2025-09-03T19%3A22%3A26.420Z&created_at=lt.2025-09-10T19%3A22%3A26.420Z -> net::ERR_ABORTED
  - https://gidhshkekazxdbhlvoiw.supabase.co/rest/v1/generated_websites?select=id&status=eq.live -> net::ERR_ABORTED

## Route: /preview/00000000-0000-0000-0000-000000000000
- Result: PASS
- Severity: Cosmetic
- Screenshot: C:\Users\yosiw\Desktop\webinstant\logs\qa\screenshots\qa-preview-00000000-0000-0000-0000-000000000000.png

## Route: /claim/00000000-0000-0000-0000-000000000000
- Result: PASS
- Severity: Minor
- Screenshot: C:\Users\yosiw\Desktop\webinstant\logs\qa\screenshots\qa-claim-00000000-0000-0000-0000-000000000000.png
- Console (top):
  - Failed to load resource: the server responded with a status of 406 ()
