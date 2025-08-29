-- ====================================
-- IMMEDIATE FIX FOR OPERATIONS_LOG ERROR
-- ====================================
-- Run this ENTIRE script in Supabase SQL Editor NOW

-- First, check current columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'operations_log'
ORDER BY ordinal_position;

-- Add the missing 'details' column
ALTER TABLE operations_log 
ADD COLUMN IF NOT EXISTS details TEXT;

-- Make sure all required columns exist
ALTER TABLE operations_log 
ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS operation_type TEXT,
ADD COLUMN IF NOT EXISTS status TEXT,
ADD COLUMN IF NOT EXISTS message TEXT,
ADD COLUMN IF NOT EXISTS details TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS user_id UUID,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update any NULL values to defaults
UPDATE operations_log 
SET 
  operation_type = COALESCE(operation_type, 'unknown'),
  status = COALESCE(status, 'unknown'),
  details = COALESCE(details, ''),
  metadata = COALESCE(metadata, '{}'::jsonb);

-- Add constraints only if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'operations_log_pkey'
  ) THEN
    ALTER TABLE operations_log 
    ADD CONSTRAINT operations_log_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Ensure RLS is enabled
ALTER TABLE operations_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow all operations for anon" ON operations_log;

-- Create new policy
CREATE POLICY "Allow all operations" ON operations_log
  FOR ALL USING (true) WITH CHECK (true);

-- Test the fix
INSERT INTO operations_log (
  operation_type, 
  status, 
  message, 
  details
) VALUES (
  'test_fix', 
  'success', 
  'Schema fixed', 
  'All columns added successfully'
);

-- Verify all columns exist
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'operations_log'
ORDER BY ordinal_position;

-- Check if insert worked
SELECT * FROM operations_log 
WHERE operation_type = 'test_fix' 
ORDER BY created_at DESC 
LIMIT 1;
