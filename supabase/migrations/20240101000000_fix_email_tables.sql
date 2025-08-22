-- Add missing columns to email_templates
ALTER TABLE email_templates 
ADD COLUMN IF NOT EXISTS opened INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS clicked INTEGER DEFAULT 0;

-- Ensure email_queue has all needed columns
ALTER TABLE email_queue
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES email_templates(id);

-- Ensure emails table has all needed columns  
ALTER TABLE emails
ADD COLUMN IF NOT EXISTS opened BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS clicked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;
