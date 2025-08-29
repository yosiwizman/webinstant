-- Create update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create email_templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  subject VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_templates_name ON email_templates(name);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active);

-- Add RLS policies
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Enable read access for all users" ON email_templates
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON email_templates
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable update for authenticated users only" ON email_templates
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Create updated_at trigger
DROP TRIGGER IF EXISTS update_email_templates_modtime ON email_templates;
CREATE TRIGGER update_email_templates_modtime
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default templates (only if they don't exist)
INSERT INTO email_templates (name, subject, content, variables) 
VALUES 
(
  'preview_ready',
  'Your WebInstant Website Preview is Ready! 🎉',
  E'<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; padding: 15px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your Website is Ready!</h1>
    </div>
    <div class="content">
      <h2>Hi {{businessName}},</h2>
      <p>Great news! Your professional website preview has been generated and is ready for review.</p>
      <p><strong>Preview URL:</strong> {{previewUrl}}</p>
      <a href="{{previewUrl}}" class="button">View Your Website</a>
      <p>This preview will be available for 7 days. Claim your website for just $150 to make it permanent!</p>
    </div>
  </div>
</body>
</html>',
  '["businessName", "previewUrl", "businessEmail", "createdAt"]'::jsonb
),
(
  'payment_received', 
  'Welcome to WebInstant! Payment Confirmed ✅',
  E'<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Payment Confirmed!</h1>
    </div>
    <div class="content">
      <h2>Thank you, {{businessName}}!</h2>
      <p>We''ve received your payment of ${{amount}}. Your website will be live within 24 hours.</p>
      <h3>What happens next?</h3>
      <ul>
        <li>Domain setup and configuration</li>
        <li>SSL certificate installation</li>
        <li>Final optimization and testing</li>
        <li>Launch confirmation email with your live URL</li>
      </ul>
      <p>If you have any questions, just reply to this email!</p>
    </div>
  </div>
</body>
</html>',
  '["businessName", "amount", "paymentDate", "websiteUrl"]'::jsonb
),
(
  'website_live',
  'Your Website is Live! 🚀',
  E'<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; padding: 15px 30px; background: #f59e0b; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your Website is Live!</h1>
    </div>
    <div class="content">
      <h2>Congratulations, {{businessName}}!</h2>
      <p>Your professional website is now live and accessible to customers worldwide!</p>
      <p><strong>Your Website:</strong> <a href="{{websiteUrl}}">{{websiteUrl}}</a></p>
      <a href="{{websiteUrl}}" class="button">Visit Your Website</a>
      <h3>Share your new website:</h3>
      <p>Start driving traffic to your new website by sharing it on social media, adding it to your business cards, and including it in your email signature.</p>
    </div>
  </div>
</body>
</html>',
  '["businessName", "websiteUrl", "launchDate"]'::jsonb
)
ON CONFLICT (name) DO UPDATE 
SET 
  subject = EXCLUDED.subject,
  content = EXCLUDED.content,
  variables = EXCLUDED.variables,
  updated_at = TIMEZONE('utc', NOW());

-- Add comment to table
COMMENT ON TABLE email_templates IS 'Stores email templates for various system communications';
COMMENT ON COLUMN email_templates.variables IS 'JSON array of variable names that can be replaced in the template';
