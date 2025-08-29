-- ====================================
-- FIX OPERATIONS_LOG TABLE
-- ====================================
-- Run this in Supabase SQL Editor to fix the 400 error

-- First, check current structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'operations_log'
ORDER BY ordinal_position;

-- Add any missing columns
ALTER TABLE operations_log 
  ADD COLUMN IF NOT EXISTS operation_type TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure NOT NULL constraints where needed
UPDATE operations_log 
SET operation_type = 'unknown' 
WHERE operation_type IS NULL;

UPDATE operations_log 
SET status = 'unknown' 
WHERE status IS NULL;

-- Now add NOT NULL constraints
ALTER TABLE operations_log 
  ALTER COLUMN operation_type SET NOT NULL,
  ALTER COLUMN status SET NOT NULL;

-- Test insert to verify it works
INSERT INTO operations_log (operation_type, status, message, metadata)
VALUES ('test', 'success', 'Testing operations_log table', '{"test": true}'::jsonb);

-- Verify the test worked
SELECT * FROM operations_log 
WHERE operation_type = 'test' 
ORDER BY created_at DESC 
LIMIT 1;

-- Clean up test data (optional)
DELETE FROM operations_log WHERE operation_type = 'test';

-- Show final structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'operations_log'
ORDER BY ordinal_position;
