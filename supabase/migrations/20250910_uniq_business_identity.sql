-- Unique index to de-duplicate businesses based on identity keys
-- Matches client upsert keys and normalization
CREATE UNIQUE INDEX IF NOT EXISTS uniq_business_identity
ON businesses (
  LOWER(business_name),
  LOWER(city),
  LOWER(state),
  REGEXP_REPLACE(phone, '\\D', '', 'g')
);

