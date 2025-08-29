-- ====================================
-- QUICK FIX FOR OPERATIONS_LOG 400 ERROR
-- ====================================
-- Run this ENTIRE script in Supabase SQL Editor

-- Drop the old table if it has issues
DROP TABLE IF EXISTS operations_log CASCADE;

-- Create fresh operations_log table with correct schema
CREATE TABLE operations_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operation_type TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  metadata JSONB DEFAULT '{}',
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE operations_log ENABLE ROW LEVEL SECURITY;

-- Create policy for anonymous access (adjust as needed)
CREATE POLICY "Allow all operations for anon" ON operations_log
  FOR ALL USING (true) WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_operations_log_created_at ON operations_log(created_at DESC);
CREATE INDEX idx_operations_log_operation_type ON operations_log(operation_type);

-- Test insert
INSERT INTO operations_log (operation_type, status, message)
VALUES ('test', 'success', 'Table recreated successfully');

-- Verify it works
SELECT * FROM operations_log ORDER BY created_at DESC LIMIT 1;
