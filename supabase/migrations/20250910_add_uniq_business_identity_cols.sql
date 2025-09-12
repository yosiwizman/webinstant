-- Add UNIQUE constraint to support PostgREST upserts with on_conflict
-- This must match the upsert keys used by the client (business_name, city, state, phone)
ALTER TABLE businesses
  ADD CONSTRAINT IF NOT EXISTS uniq_business_identity_cols
  UNIQUE (business_name, city, state, phone);

