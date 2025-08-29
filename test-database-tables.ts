/**
 * Test script to verify database tables are correctly set up
 * Run with: npx tsx test-database-tables.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { supabase } from "./lib/supabase";

async function testDatabaseTables() {
  console.log("🔍 Testing Database Tables\n" + "=".repeat(50));

  try {
    // Test 1: Check email_templates table
    console.log("\n📧 Testing email_templates table...");
    const { data: templates, error: templatesError } = await supabase
      .from("email_templates")
      .select("*")
      .limit(5);

    if (templatesError) {
      console.log("❌ email_templates error:", templatesError.message);
      if (templatesError.code === "42P01") {
        console.log(
          "   → Table does not exist! Run FIX_DATABASE_TABLES.sql in Supabase"
        );
      }
    } else {
      console.log("✅ email_templates table exists");
      console.log(`   Found ${templates?.length || 0} templates`);
      templates?.forEach((t) => {
        console.log(`   - ${t.name}: "${t.subject}"`);
      });
    }

    // Test 2: Check operations_log table
    console.log("\n📝 Testing operations_log table...");
    const { data: operations, error: opsError } = await supabase
      .from("operations_log")
      .select("*")
      .limit(1);

    if (opsError) {
      console.log("❌ operations_log error:", opsError.message);
      if (opsError.code === "42P01") {
        console.log(
          "   → Table does not exist! Run FIX_DATABASE_TABLES.sql in Supabase"
        );
      } else if (opsError.code === "42703") {
        console.log("   → Column missing! Table structure is incorrect");
      }
    } else {
      console.log("✅ operations_log table exists and is accessible");
    }

    // Test 3: Check email_logs table
    console.log("\n📬 Testing email_logs table...");
    const { data: emailLogs, error: emailLogsError } = await supabase
      .from("email_logs")
      .select("*")
      .limit(1);

    if (emailLogsError) {
      console.log("❌ email_logs error:", emailLogsError.message);
    } else {
      console.log("✅ email_logs table exists");
    }

    // Test 4: Test sending an email (dry run)
    console.log("\n🚀 Testing email send endpoint...");
    const testUrl = `${
      process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
    }/api/send-email`;
    console.log(`   Testing: ${testUrl}`);

    try {
      const response = await fetch(testUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: true }),
      });

      if (response.status === 404) {
        console.log("❌ /api/send-email endpoint returns 404");
        console.log(
          "   Check that app/api/send-email/route.ts exists and exports POST"
        );
      } else if (response.status === 400) {
        console.log(
          "✅ /api/send-email endpoint is accessible (returned 400 for test data)"
        );
      } else {
        const data = await response.json();
        console.log(
          `   Response: ${response.status} - ${JSON.stringify(data)}`
        );
      }
    } catch (error) {
      console.log("⚠️  Could not test endpoint (server may not be running)");
    }

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("📊 SUMMARY:");
    console.log("\nTo fix any issues:");
    console.log("1. Go to Supabase SQL Editor");
    console.log("2. Copy contents of FIX_DATABASE_TABLES.sql");
    console.log("3. Run the SQL to create missing tables");
    console.log("4. Re-run this test to verify");
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run the test
testDatabaseTables();
