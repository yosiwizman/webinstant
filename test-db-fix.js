/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Test script to verify database tables are correctly set up
 * Run with: node test-db-fix.js
 */

const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

const { createClient } = require("@supabase/supabase-js");

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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
      console.log("   Code:", templatesError.code);
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
      console.log("   Code:", opsError.code);
      if (opsError.code === "42P01") {
        console.log(
          "   → Table does not exist! Run FIX_DATABASE_TABLES.sql in Supabase"
        );
      } else if (opsError.code === "42703") {
        console.log("   → Column missing! Table structure is incorrect");
      }
    } else {
      console.log("✅ operations_log table exists and is accessible");
      console.log(`   Found ${operations?.length || 0} records`);
    }

    // Test 3: Check email_logs table
    console.log("\n📬 Testing email_logs table...");
    const { data: emailLogs, error: emailLogsError } = await supabase
      .from("email_logs")
      .select("*")
      .limit(1);

    if (emailLogsError) {
      console.log("❌ email_logs error:", emailLogsError.message);
      console.log("   Code:", emailLogsError.code);
    } else {
      console.log("✅ email_logs table exists");
      console.log(`   Found ${emailLogs?.length || 0} records`);
    }

    // Test 4: Check businesses table
    console.log("\n🏢 Testing businesses table...");
    const { count: bizCount, error: bizError } = await supabase
      .from("businesses")
      .select("*", { count: "exact", head: true });

    if (bizError) {
      console.log("❌ businesses error:", bizError.message);
    } else {
      console.log("✅ businesses table exists");
      console.log(`   Total businesses: ${bizCount || 0}`);
    }

    // Test 5: Check website_previews table
    console.log("\n🌐 Testing website_previews table...");
    const { count: previewCount, error: previewError } = await supabase
      .from("website_previews")
      .select("*", { count: "exact", head: true });

    if (previewError) {
      console.log("❌ website_previews error:", previewError.message);
    } else {
      console.log("✅ website_previews table exists");
      console.log(`   Total previews: ${previewCount || 0}`);
    }

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("📊 SUMMARY:\n");

    const hasEmailTemplatesIssue =
      templatesError && templatesError.code === "42P01";
    const hasOperationsLogIssue =
      opsError && (opsError.code === "42P01" || opsError.code === "42703");

    if (hasEmailTemplatesIssue || hasOperationsLogIssue) {
      console.log("⚠️  ISSUES FOUND:\n");
      if (hasEmailTemplatesIssue) {
        console.log("  1. email_templates table does not exist");
      }
      if (hasOperationsLogIssue) {
        console.log("  2. operations_log table has issues");
      }

      console.log("\n📋 TO FIX:");
      console.log("1. Go to your Supabase Dashboard");
      console.log("2. Navigate to SQL Editor");
      console.log("3. Copy ALL contents of FIX_DATABASE_TABLES.sql");
      console.log("4. Paste and run the SQL");
      console.log("5. Re-run this test to verify");
      console.log("\nSupabase Dashboard URL:");
      console.log(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/project/_/sql/new`);
    } else {
      console.log("✅ All database tables are properly configured!");

      if (!templates || templates.length === 0) {
        console.log("\n⚠️  Note: No email templates found.");
        console.log("   Run FIX_DATABASE_TABLES.sql to add default templates.");
      }
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

// Run the test
testDatabaseTables();
