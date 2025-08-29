-- Create payment_intents table to track Stripe payments
CREATE TABLE IF NOT EXISTS payment_intents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_session_id TEXT UNIQUE NOT NULL,
  business_id UUID REFERENCES businesses(id),
  domain_name TEXT,
  amount DECIMAL(10,2),
  status TEXT DEFAULT 'pending',
  customer_email TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add payment fields to businesses table if they don't exist
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS domain_name TEXT,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payment_intents_business_id ON payment_intents(business_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_stripe_session ON payment_intents(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_businesses_payment_status ON businesses(payment_status);

-- Create deployed_websites table for tracking live websites
CREATE TABLE IF NOT EXISTS deployed_websites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) UNIQUE,
  domain_name TEXT NOT NULL,
  vercel_deployment_id TEXT,
  deployment_url TEXT,
  nameservers JSONB,
  ssl_status TEXT DEFAULT 'pending',
  status TEXT DEFAULT 'pending',
  deployed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create domain_registrations table
CREATE TABLE IF NOT EXISTS domain_registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id),
  domain_name TEXT NOT NULL,
  registrar TEXT, -- 'porkbun', 'namecheap', etc.
  registration_date TIMESTAMPTZ,
  expiry_date TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'pending',
  registrar_order_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create webhooks_log table for Stripe webhook events
CREATE TABLE IF NOT EXISTS webhooks_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_type TEXT NOT NULL, -- 'stripe', 'vercel', 'porkbun'
  event_type TEXT NOT NULL,
  event_id TEXT UNIQUE,
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployed_websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks_log ENABLE ROW LEVEL SECURITY;

-- Create policies for service role
CREATE POLICY "Service role can manage payment_intents" ON payment_intents
  FOR ALL USING (true);

CREATE POLICY "Service role can manage deployed_websites" ON deployed_websites
  FOR ALL USING (true);

CREATE POLICY "Service role can manage domain_registrations" ON domain_registrations
  FOR ALL USING (true);

CREATE POLICY "Service role can manage webhooks_log" ON webhooks_log
  FOR ALL USING (true);
