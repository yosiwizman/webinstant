/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Test email sending with real business from database
 * Run with: node test-email-real-business.js
 */

const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

const { createClient } = require("@supabase/supabase-js");

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testEmailSending() {
  console.log("📧 Testing Email Send with Real Business\n" + "=".repeat(50));

  try {
    // Get a real business from the database
    console.log("1. Finding businesses in database...");
    const { data: businesses, error: bizError } = await supabase
      .from("businesses")
      .select("id, business_name, email")
      .limit(5);

    if (bizError || !businesses || businesses.length === 0) {
      console.log("❌ No businesses found");
      return;
    }

    console.log(`   Found ${businesses.length} businesses:`);
    businesses.forEach((b, i) => {
      console.log(`   ${i + 1}. ${b.business_name} (${b.id})`);
    });

    // Use the first business
    const testBusiness = businesses[0];
    console.log(`\n2. Using business: ${testBusiness.business_name}`);
    console.log(`   ID: ${testBusiness.id}`);

    // Test the email endpoint
    console.log("\n3. Calling /api/send-email endpoint...");

    // Import node-fetch for making HTTP requests
    const fetch = require("node-fetch");

    const response = await fetch("http://localhost:3000/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: testBusiness.id,
        template: "preview_ready",
      }),
    });

    const result = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log("   Response:", result);

    if (response.status === 200) {
      console.log("\n✅ SUCCESS! Email sent!");
      console.log(
        "   Check your email inbox (in dev mode: yosiwizman5638@gmail.com)"
      );
    } else {
      console.log("\n❌ Email failed");
      if (result.error) {
        console.log("   Error:", result.error);
      }
    }

    // Also test email_templates are accessible
    console.log("\n4. Checking email templates...");
    const { data: templates, error: templateError } = await supabase
      .from("email_templates")
      .select("name, subject");

    if (templates) {
      console.log("   Templates available:");
      templates.forEach((t) => {
        console.log(`   - ${t.name}: "${t.subject}"`);
      });
    }
  } catch (error) {
    if (error.code === "ECONNREFUSED") {
      console.log("❌ Server not running. Run: npm run dev");
    } else {
      console.log("❌ Error:", error.message);
    }
  }
}

// Run test
testEmailSending();
