# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] — 2025-09-10
### Added
- Stripe Checkout integration and secure webhook route (App Router) to record payments and enqueue deployments
- Domain deployment API integrating Vercel Domains (add/verify) with DNS instructions
- Resend webhook route to capture email delivered/opened/clicked/failed events
- Edit Panel UX: email + social links and structured business hours editor
- Bulk email campaigns: admin UI with selection, A/B templates, and API for batched sends
- Leads ingestion: Google Places Search → Place Details pipeline with SerpAPI fallback
- Daily automation endpoint with CRON secret to generate previews and send A/B emails
- Admin metrics funnel dashboard (imports → previews → emails → open/click → paid → live)
- Circuit breaker utilities (rate/cost guards) and structured logging helper

### Changed
- Hardened preview update route with hours normalization and safer merges
- Next config updated to silence workspace root inference warning
- Build/lint/typecheck workflows made stricter to ensure zero warnings

### Fixed
- Claim page preview URL usage and null guards
- ESLint and TS issues across API routes and content generator


