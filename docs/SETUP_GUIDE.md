# WebInstant Environment Setup Guide

## 🚀 Quick Start

Follow these steps to configure WebInstant for local development:

### Step 1: Create Environment Files

Run the setup script to create the necessary files:

```bash
node setup-env.js
```

This creates:

- `.env.local` - Your actual configuration (keep secret)
- `.env.example` - Template for reference

### Step 2: Configure Required Services

Edit `.env.local` and add your actual keys:

#### 🗄️ Supabase (Database) - REQUIRED

1. Go to [Supabase](https://supabase.com) and create a new project
2. Navigate to Settings → API
3. Copy these values:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

Example:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xyzcompany.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emNvbXBhbnkiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYyNzIwODU0MSwiaWV4cCI6MTk1Mjc4NDU0MX0.abcdef123456
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emNvbXBhbnkiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjI3MjA4NTQxLCJleHAiOjE5NTI3ODQ1NDF9.ghijkl789012
```

#### 📧 Resend (Email) - REQUIRED

1. Sign up at [Resend](https://resend.com)
2. Go to [API Keys](https://resend.com/api-keys)
3. Create an API key
4. Copy it to `RESEND_API_KEY`

Example:

```env
RESEND_API_KEY=re_abcd1234_5678efghijklmnop
RESEND_FROM_EMAIL=onboarding@resend.dev  # Use this for development
```

#### 🤖 AI Service - AT LEAST ONE REQUIRED

Choose one (Together AI recommended for cost):

**Option 1: Together AI (Recommended - $0.20/preview)**

1. Sign up at [Together AI](https://api.together.xyz)
2. Get API key from [Settings](https://api.together.xyz/settings/api-keys)
3. Add to `TOGETHER_API_KEY`

**Option 2: OpenAI ($0.50-1.00/preview)**

1. Sign up at [OpenAI](https://platform.openai.com)
2. Get API key from [API Keys](https://platform.openai.com/api-keys)
3. Add to `OPENAI_API_KEY`

**Option 3: Anthropic Claude ($0.30-0.60/preview)**

1. Sign up at [Anthropic](https://console.anthropic.com)
2. Get API key from [Settings](https://console.anthropic.com/settings/keys)
3. Add to `ANTHROPIC_API_KEY`

### Step 3: Test Your Configuration

Run the connection test:

```bash
npx tsx test-connection.ts
```

You should see:

```
✅ NEXT_PUBLIC_SUPABASE_URL: Configured
✅ NEXT_PUBLIC_SUPABASE_ANON_KEY: Configured
✅ NEXT_PUBLIC_BASE_URL: Configured
✅ RESEND_API_KEY: Configured
✅ Supabase connection successful!
✅ AI services configured: Together AI
```

### Step 4: Set Up Database Tables

Create the required tables in Supabase:

1. Go to your Supabase project
2. Open SQL Editor
3. Run this migration:

```sql
-- Create businesses table
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(20),
  industry_type VARCHAR(100),
  website_url TEXT,
  has_website BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create website_previews table
CREATE TABLE IF NOT EXISTS website_previews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  slug VARCHAR(255) UNIQUE NOT NULL,
  html_content TEXT,
  preview_url TEXT,
  template_used VARCHAR(100),
  screenshot_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create email_logs table
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  email_type VARCHAR(100),
  recipient_email VARCHAR(255) NOT NULL,
  subject TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  email_sent_at TIMESTAMP WITH TIME ZONE,
  message_id VARCHAR(255),
  preview_url TEXT,
  metadata JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create operations_log table
CREATE TABLE IF NOT EXISTS operations_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_businesses_email ON businesses(email);
CREATE INDEX IF NOT EXISTS idx_website_previews_business ON website_previews(business_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_business ON email_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_operations_log_created ON operations_log(created_at DESC);
```

### Step 5: Run the Application

```bash
npm run dev
```

Visit http://localhost:3000

## 💳 Payment Setup (For Production)

### Stripe Configuration

1. Create a [Stripe](https://stripe.com) account
2. Create a Payment Link:
   - Go to [Payment Links](https://dashboard.stripe.com/payment-links)
   - Create new link for $150
   - Add metadata fields for `business_id`
3. Add to `.env.local`:
   ```env
   STRIPE_PAYMENT_LINK_URL=https://buy.stripe.com/test_YOUR_LINK
   STRIPE_SECRET_KEY=sk_test_YOUR_KEY
   ```

## 🔧 Optional Services

### Image Generation (Replicate)

- Sign up at [Replicate](https://replicate.com)
- Get token from [Account](https://replicate.com/account/api-tokens)
- Add `REPLICATE_API_TOKEN`

### Image Optimization (TinyPNG)

- Sign up at [TinyPNG](https://tinypng.com/developers)
- Get API key
- Add `TINYPNG_API_KEY`

### Website Checking (SerpAPI)

- Sign up at [SerpAPI](https://serpapi.com)
- Get API key from [Manage API Key](https://serpapi.com/manage-api-key)
- Add `SERPAPI_KEY`

## ❓ Troubleshooting

### "Missing Supabase environment variables"

- Make sure `.env.local` exists and contains your keys
- Restart the development server after adding keys

### "businesses table not found"

- Run the SQL migrations in Step 4
- Check Supabase dashboard → Table Editor to verify tables exist

### "No AI services configured"

- Add at least one AI service API key
- Together AI is recommended for cost-effectiveness

### Email not sending

- Check RESEND_API_KEY is correct
- In development, emails go to test address (check logs)

## 📊 Service Costs Estimate

Per website generation:

- **Together AI**: ~$0.20
- **OpenAI GPT-4**: ~$0.50-1.00
- **Anthropic Claude**: ~$0.30-0.60
- **Replicate Images**: ~$0.01 per image
- **Resend Email**: Free tier (100/day)
- **Supabase**: Free tier sufficient for MVP

## 🚀 Ready to Launch?

Once all checks pass:

1. Create a test business: http://localhost:3000/admin
2. Generate a preview
3. Send test email
4. Complete payment flow

Need help? Check the logs in:

- Browser console
- Terminal running `npm run dev`
- Supabase dashboard → Logs
