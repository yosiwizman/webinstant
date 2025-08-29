/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Test if operations_log table is fixed
 * Run with: node test-operations-log.js
 */

const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testOperationsLog() {
  console.log("🔍 Testing operations_log table\n" + "=".repeat(50));

  // Check if details column exists
  const { data: testInsert, error: insertError } = await supabase
    .from("operations_log")
    .insert({
      operation_type: "test",
      status: "testing",
      message: "Testing if details column exists",
      details: "This is a test detail",
    })
    .select();

  if (insertError) {
    if (insertError.message.includes("details")) {
      console.log("❌ 'details' column is MISSING");
      console.log("   Error:", insertError.message);
      console.log("\n📝 FIX REQUIRED:");
      console.log("   1. Go to Supabase SQL Editor");
      console.log("   2. Run FIX_OPERATIONS_LOG_NOW.sql");
    } else {
      console.log("❌ Different error:", insertError.message);
    }
    return;
  }

  console.log("✅ operations_log table is working!");
  console.log("   'details' column exists");

  // Clean up test data
  if (testInsert && testInsert[0]) {
    await supabase.from("operations_log").delete().eq("id", testInsert[0].id);
    console.log("   Test data cleaned up");
  }

  console.log("\n✅ Table is properly configured!");
}

testOperationsLog();
