// WebInstant Environment Setup Script
// This script creates the necessary .env files for your project

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

// Environment template
const envTemplate = `# ========================================
# WEBINSTANT ENVIRONMENT CONFIGURATION
# ========================================
# IMPORTANT: Replace placeholder values with your actual keys
# Keep this file secure and never commit to version control

# ========================================
# SUPABASE (REQUIRED)
# ========================================
# Get these from: https://supabase.com/dashboard/project/YOUR-PROJECT/settings/api
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR-ANON-KEY
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR-SERVICE-ROLE-KEY

# ========================================
# APPLICATION CONFIG (REQUIRED)
# ========================================
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# ========================================
# EMAIL SERVICE - RESEND (REQUIRED)
# ========================================
# Get your API key from: https://resend.com/api-keys
# For development, use onboarding@resend.dev as from email
RESEND_API_KEY=re_YOUR_RESEND_API_KEY_HERE
RESEND_FROM_EMAIL=onboarding@resend.dev

# ========================================
# PAYMENT - STRIPE (REQUIRED FOR PRODUCTION)
# ========================================
# Create payment link at: https://dashboard.stripe.com/payment-links
STRIPE_SECRET_KEY=sk_test_YOUR_STRIPE_SECRET_KEY
STRIPE_PAYMENT_LINK_URL=https://buy.stripe.com/test_YOUR_PAYMENT_LINK
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET

# ========================================
# AI SERVICES (AT LEAST ONE REQUIRED)
# ========================================
# Option 1: OpenAI - https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-YOUR_OPENAI_API_KEY

# Option 2: Together AI - https://api.together.xyz/settings/api-keys
# Recommended for cost-effective AI generation
TOGETHER_API_KEY=YOUR_TOGETHER_API_KEY_HERE

# Option 3: Anthropic Claude - https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=sk-ant-YOUR_ANTHROPIC_KEY

# Option 4: Groq - https://console.groq.com/keys
GROQ_API_KEY=gsk_YOUR_GROQ_API_KEY

# ========================================
# IMAGE & SEARCH SERVICES (OPTIONAL)
# ========================================
# Replicate for AI image generation - https://replicate.com/account/api-tokens
REPLICATE_API_TOKEN=r8_YOUR_REPLICATE_TOKEN

# TinyPNG for image optimization - https://tinypng.com/developers
TINYPNG_API_KEY=YOUR_TINYPNG_KEY

# SerpAPI for website checks - https://serpapi.com/manage-api-key
SERPAPI_KEY=YOUR_SERPAPI_KEY

# ========================================
# SCREENSHOT SERVICE (OPTIONAL FOR MVP)
# ========================================
# Leave empty to skip screenshot functionality
SCREENSHOT_API_URL=
SCREENSHOT_API_KEY=
USE_LOCAL_PUPPETEER=false

# ========================================
# ADDITIONAL SERVICES (OPTIONAL)
# ========================================
# Google Places API for business data enrichment
GOOGLE_PLACES_API_KEY=YOUR_GOOGLE_API_KEY

# Vercel deployment token
VERCEL_TOKEN=YOUR_VERCEL_TOKEN
`;

// Create .env.example
const examplePath = path.join(__dirname, ".env.example");
fs.writeFileSync(examplePath, envTemplate);
console.log("✅ Created .env.example");

// Check if .env.local exists
const envLocalPath = path.join(__dirname, ".env.local");
if (fs.existsSync(envLocalPath)) {
  console.log("⚠️  .env.local already exists - not overwriting");
  console.log("   To create a fresh one, delete the existing file first");
} else {
  // Create .env.local with same template
  fs.writeFileSync(envLocalPath, envTemplate);
  console.log("✅ Created .env.local");
}

// Also add .env.local to .gitignore if not already there
const gitignorePath = path.join(__dirname, ".gitignore");
if (fs.existsSync(gitignorePath)) {
  const gitignore = fs.readFileSync(gitignorePath, "utf8");
  if (!gitignore.includes(".env.local")) {
    fs.appendFileSync(
      gitignorePath,
      "\n# Environment variables\n.env.local\n.env\n"
    );
    console.log("✅ Added .env.local to .gitignore");
  }
}

console.log("\n📝 NEXT STEPS:");
console.log(
  "1. Edit .env.local and replace placeholder values with your actual keys"
);
console.log("2. Required services to configure:");
console.log("   - Supabase (database)");
console.log("   - Resend (email)");
console.log("   - At least one AI service (OpenAI, Together AI, or Anthropic)");
console.log("3. Run: npm run dev to test the configuration");
console.log("\n🔗 Service Links:");
console.log("   Supabase: https://supabase.com");
console.log("   Resend: https://resend.com");
console.log(
  "   Together AI: https://api.together.xyz (recommended - cost effective)"
);
console.log("   OpenAI: https://platform.openai.com");
console.log("   Stripe: https://dashboard.stripe.com");
