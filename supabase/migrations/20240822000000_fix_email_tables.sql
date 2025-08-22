-- Create email_templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ab_tests table if it doesn't exist
CREATE TABLE IF NOT EXISTS ab_tests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255),
  template_a_id UUID,
  template_a_name VARCHAR(255),
  template_a_subject VARCHAR(255),
  template_a_content TEXT,
  template_b_id UUID,
  template_b_name VARCHAR(255),
  template_b_subject VARCHAR(255),
  template_b_content TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create emails table if it doesn't exist
CREATE TABLE IF NOT EXISTS emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID,
  email VARCHAR(255),
  template_id UUID,
  ab_test_id UUID,
  ab_variant VARCHAR(1),
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create email_queue table if it doesn't exist
CREATE TABLE IF NOT EXISTS email_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID,
  email VARCHAR(255),
  template_id UUID,
  scheduled_for TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create operations_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS operations_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operation_type VARCHAR(255),
  status VARCHAR(50),
  message TEXT,
  details JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create businesses table if it doesn't exist
CREATE TABLE IF NOT EXISTS businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(255),
  state VARCHAR(50),
  zip VARCHAR(20),
  website_url TEXT,
  priority VARCHAR(50),
  last_contact TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create website_previews table if it doesn't exist
CREATE TABLE IF NOT EXISTS website_previews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id),
  preview_url TEXT,
  html_content TEXT,
  template_used VARCHAR(255),
  slug VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_emails_business_id ON emails(business_id);
CREATE INDEX IF NOT EXISTS idx_emails_sent_at ON emails(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled_for ON email_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_operations_log_created_at ON operations_log(created_at);
CREATE INDEX IF NOT EXISTS idx_website_previews_business_id ON website_previews(business_id);

-- Add default email templates
INSERT INTO email_templates (name, subject, content, is_active)
VALUES 
  (
    'Professional Template',
    'Your New Professional Website is Ready!',
    'Hi {{business_name}},

Your stunning new website is live and ready to attract customers!

View your website: {{preview_url}}

This professional website includes:
• Mobile-responsive design
• SEO optimization
• Contact forms
• Business hours & location

Best regards,
The Team',
    true
  ),
  (
    'Friendly Template',
    'Hey {{business_name}}! Check Out Your Amazing New Website 🎉',
    'Hey there!

Great news - your brand new website just went live and it looks fantastic!

Check it out here: {{preview_url}}

We''ve included everything you need to grow your business online. Your customers are going to love it!

Cheers,
The Team',
    true
  )
ON CONFLICT DO NOTHING;
