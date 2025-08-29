-- ====================================
-- WEBINSTANT DATABASE FIX
-- ====================================
-- Run this complete SQL in your Supabase SQL editor to fix all database issues
-- Dashboard URL: https://supabase.com/dashboard/project/YOUR-PROJECT/sql/new

-- ====================================
-- 1. CREATE EMAIL_TEMPLATES TABLE
-- ====================================

-- Drop table if exists (for clean setup)
DROP TABLE IF EXISTS email_templates CASCADE;

-- Create email_templates table
CREATE TABLE email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  subject VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_email_templates_name ON email_templates(name);
CREATE INDEX idx_email_templates_active ON email_templates(is_active);

-- Enable RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Create policy for anon users to read
CREATE POLICY "Allow anon read" ON email_templates
  FOR SELECT USING (true);

-- Create policy for authenticated users to manage
CREATE POLICY "Allow authenticated manage" ON email_templates
  FOR ALL USING (auth.role() = 'authenticated');

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_email_templates_modtime
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default templates
INSERT INTO email_templates (name, subject, content, variables) VALUES 
(
  'preview_ready',
  'Your WebInstant Preview is Ready! 🎉',
  'Hi {{businessName}},

Your professional website preview is ready to view!

🌟 Preview your website: {{previewUrl}}

What''s included with your $150 website:
✅ Custom domain name (.com)
✅ Premium web hosting for 1 year
✅ SSL security certificate
✅ Mobile-responsive design
✅ Monthly updates & maintenance
✅ 24/7 customer support

Ready to go live? Click here to pay and launch: {{paymentUrl}}

⏰ This preview expires in 7 days, so don''t wait!

Best regards,
The WebInstant Team

P.S. Reply to this email if you have any questions!',
  '["businessName", "previewUrl", "paymentUrl"]'::jsonb
),
(
  'payment_received',
  'Welcome to WebInstant! Your Website is Going Live 🚀',
  'Hi {{businessName}},

Thank you for your payment! We''re now setting up your website.

Your website will be live within 24 hours at: {{domain}}

What happens next:
1. We''ll register your domain name
2. Set up your hosting and SSL certificate
3. Deploy your website
4. Send you login credentials

You''ll receive another email once everything is ready.

Thank you for choosing WebInstant!

Best regards,
The WebInstant Team',
  '["businessName", "domain"]'::jsonb
),
(
  'website_live',
  'Your Website is Now Live! 🎊',
  'Hi {{businessName}},

Great news - your website is now live at: {{websiteUrl}}

Here are your website details:
🌐 Website URL: {{websiteUrl}}
📧 Admin Email: {{adminEmail}}
🔒 Admin Portal: {{adminUrl}}

Your website includes:
✅ Custom domain name
✅ SSL security certificate
✅ Mobile-responsive design
✅ Fast loading speeds
✅ SEO optimization

Need to make changes? Reply to this email and we''ll help!

Congratulations on your new website!

Best regards,
The WebInstant Team',
  '["businessName", "websiteUrl", "adminEmail", "adminUrl"]'::jsonb
);

-- ====================================
-- 2. FIX OPERATIONS_LOG TABLE
-- ====================================

-- Check if table exists, if not create it
CREATE TABLE IF NOT EXISTS operations_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operation_type TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add any missing columns
ALTER TABLE operations_log 
  ADD COLUMN IF NOT EXISTS operation_type TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_operations_log_type ON operations_log(operation_type);
CREATE INDEX IF NOT EXISTS idx_operations_log_status ON operations_log(status);
CREATE INDEX IF NOT EXISTS idx_operations_log_created ON operations_log(created_at DESC);

-- Enable RLS
ALTER TABLE operations_log ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow anon read operations_log" ON operations_log
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert operations_log" ON operations_log
  FOR INSERT WITH CHECK (true);

-- ====================================
-- 3. CREATE ERROR_LOGS TABLE (if needed)
-- ====================================

CREATE TABLE IF NOT EXISTS error_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  level VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  context VARCHAR(255),
  error_message TEXT,
  error_stack TEXT,
  metadata JSONB,
  environment VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_error_logs_level ON error_logs(level);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC);

-- Enable RLS
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated read error_logs" ON error_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert error_logs" ON error_logs
  FOR INSERT WITH CHECK (true);

-- ====================================
-- 4. VERIFY EMAIL_LOGS TABLE
-- ====================================

-- Ensure email_logs table has correct structure
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id),
  recipient_email TEXT NOT NULL,
  template_id UUID REFERENCES email_templates(id),
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add any missing columns
ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES email_templates(id),
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_logs_business ON email_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at DESC);

-- Enable RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow anon read email_logs" ON email_logs
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated manage email_logs" ON email_logs
  FOR ALL USING (auth.role() = 'authenticated');

-- ====================================
-- 5. VERIFY AND TEST
-- ====================================

-- Test query to verify all tables are working
SELECT 
  'email_templates' as table_name, 
  COUNT(*) as record_count 
FROM email_templates
UNION ALL
SELECT 
  'operations_log' as table_name, 
  COUNT(*) as record_count 
FROM operations_log
UNION ALL
SELECT 
  'email_logs' as table_name, 
  COUNT(*) as record_count 
FROM email_logs
UNION ALL
SELECT 
  'error_logs' as table_name, 
  COUNT(*) as record_count 
FROM error_logs;

-- Show email templates
SELECT * FROM email_templates;

-- ====================================
-- SUCCESS MESSAGE
-- ====================================
-- If you see the results above without errors, all tables are fixed!
-- You should see 3 email templates and counts for all tables.
