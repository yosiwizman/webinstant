// WebInstant Connection Test Script
// Tests connectivity to all configured services

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

console.log("🔍 WebInstant Connection Test\n" + "=".repeat(50));

// Test environment variables
console.log("\n📋 Environment Check:");
const requiredVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_BASE_URL",
  "RESEND_API_KEY",
];

const optionalVars = [
  "OPENAI_API_KEY",
  "TOGETHER_API_KEY",
  "ANTHROPIC_API_KEY",
  "STRIPE_SECRET_KEY",
];

let missingRequired = false;
requiredVars.forEach((varName) => {
  const value = process.env[varName];
  if (!value || value.includes("YOUR-") || value.includes("YOUR_")) {
    console.log(`❌ ${varName}: Not configured`);
    missingRequired = true;
  } else {
    console.log(`✅ ${varName}: Configured`);
  }
});

console.log("\n📋 Optional Services:");
optionalVars.forEach((varName) => {
  const value = process.env[varName];
  if (!value || value.includes("YOUR-") || value.includes("YOUR_")) {
    console.log(`⚠️  ${varName}: Not configured`);
  } else {
    console.log(`✅ ${varName}: Configured`);
  }
});

// Main async function to run all tests
async function runTests() {
  // Test Supabase connection
  console.log("\n🔌 Testing Supabase Connection...");
  if (!missingRequired) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // Test basic connectivity
      const { data: _data, error } = await supabase
        .from("businesses")
        .select("id")
        .limit(1);

      if (error) {
        if (
          error.message.includes('relation "public.businesses" does not exist')
        ) {
          console.log(
            "⚠️  Connected to Supabase but businesses table not found"
          );
          console.log("   Run database migrations to create tables");
        } else {
          console.log("❌ Supabase error:", error.message);
        }
      } else {
        console.log("✅ Supabase connection successful!");

        // Test other tables
        const tables = ["website_previews", "email_logs", "operations_log"];
        for (const table of tables) {
          const { error: tableError } = await supabase
            .from(table)
            .select("id")
            .limit(1);

          if (tableError) {
            console.log(`   ⚠️ Table '${table}' not found`);
          } else {
            console.log(`   ✅ Table '${table}' exists`);
          }
        }
      }
    } catch (error) {
      console.log("❌ Connection failed:", error);
    }
  } else {
    console.log("❌ Cannot test - missing required environment variables");
  }

  // Test Resend (if configured)
  if (
    process.env.RESEND_API_KEY &&
    !process.env.RESEND_API_KEY.includes("YOUR_")
  ) {
    console.log("\n📧 Testing Resend Email Service...");
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      // Just validate the API key
      const response = await resend.emails.send({
        from: "onboarding@resend.dev",
        to: "delivered@resend.dev", // Test email that won't actually send
        subject: "Test",
        html: "<p>Test</p>",
      });

      if (response.error) {
        console.log("❌ Resend error:", response.error);
      } else {
        console.log("✅ Resend API key is valid");
      }
    } catch (error: any) {
      if (error.message?.includes("Resend is not a constructor")) {
        console.log("✅ Resend API key configured (test email not sent)");
      } else {
        console.log("⚠️  Resend test skipped:", error.message);
      }
    }
  }

  // Test AI Services
  console.log("\n🤖 AI Service Status:");
  const aiServices = [];
  if (
    process.env.OPENAI_API_KEY &&
    !process.env.OPENAI_API_KEY.includes("YOUR_")
  ) {
    aiServices.push("OpenAI");
  }
  if (
    process.env.TOGETHER_API_KEY &&
    !process.env.TOGETHER_API_KEY.includes("YOUR_")
  ) {
    aiServices.push("Together AI");
  }
  if (
    process.env.ANTHROPIC_API_KEY &&
    !process.env.ANTHROPIC_API_KEY.includes("YOUR_")
  ) {
    aiServices.push("Anthropic Claude");
  }

  if (aiServices.length > 0) {
    console.log(`✅ AI services configured: ${aiServices.join(", ")}`);
  } else {
    console.log(
      "❌ No AI services configured - content generation will use fallbacks"
    );
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Summary:");
  if (!missingRequired && aiServices.length > 0) {
    console.log("✅ Your WebInstant app is ready to run!");
    console.log("   Run: npm run dev");
  } else if (!missingRequired) {
    console.log("⚠️  Basic setup complete but no AI services configured");
    console.log("   The app will run with fallback content");
    console.log("   Configure at least one AI service for best results");
  } else {
    console.log("❌ Missing required configuration");
    console.log("   Please edit .env.local and add the missing values");
  }
}

// Run the tests
runTests().catch(console.error);
