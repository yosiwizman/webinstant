# Domains & Deployment

This document explains how custom domain mapping works via Vercel and how to handle DNS verification.

Flow
- Admin/API: POST /api/deploy with { business_id, target_domain }.
- Vercel: The API adds the domain to the project. If verification is needed, Vercel responds with verification records.
- Response: The API returns instructions to create DNS TXT/CNAME records (if required), and persists verification JSON to generated_websites.
- Verification: Once DNS is in place, Vercel verification can be triggered (the API attempts automatic verification when no records are required).

Vercel setup (env names only)
- VERCEL_TOKEN
- VERCEL_PROJECT_ID
- VERCEL_TEAM_ID (optional)

DNS automation (optional; Phase 3 defaults OFF)
- Porkbun: USE_PORKBUN_API, PORKBUN_API_KEY, PORKBUN_SECRET_KEY
- Namecheap: USE_NAMECHEAP_API, NAMECHEAP_API_USER, NAMECHEAP_API_KEY, NAMECHEAP_CLIENT_IP

Manual DNS instructions
- If the /api/deploy response contains instructions, add the TXT or CNAME records at your DNS provider for the target domain.
- After propagation (can take minutes to hours), domains will verify in Vercel and the site can be marked live.

API references
- Vercel Domains API: POST /v10/projects/:id/domains and POST /v10/projects/:id/domains/:domain/verify
- Our helper functions in lib/vercel.ts wrap these calls.

