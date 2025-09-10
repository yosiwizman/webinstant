# Leads Ingestion

Overview
- We use a two-step Google Places flow to reliably capture a business website:
  1) Search (Text Search) to find place_ids for a city/category.
  2) Place Details for each place_id to fetch fields like website, formatted_phone_number, opening_hours, and formatted_address.
- If Places quota or errors occur, we fallback to SerpAPI Google Maps local results to capture similar data when possible.

Endpoint
- POST /api/leads/ingest
  - Body: { city, state, category }
  - Behavior:
    - Performs Places Text Search and then Place Details on each place_id.
    - Fallback to SerpAPI local results on failure.
    - Upserts into businesses with has_website derived from whether a website URL was retrieved.
  - Response: { success, count, usedFallback }

Helpers
- lib/places.ts
  - searchPlaces({ query | city, state, type }): returns place_ids and summaries
  - getPlaceDetails(place_id, fields): returns website, phone, opening_hours, etc.
- lib/serp.ts
  - serpLocalSearch(query): fallback to SerpAPI Google Maps local results for basic info

Environment variables (names only)
- GOOGLE_MAPS_API_KEY (alias: GOOGLE_PLACES_API_KEY)
- SERPAPI_KEY
