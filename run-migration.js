/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Run database migration programmatically
 * Run with: node run-migration.js
 */

const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

// Use service role key for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function runMigration() {
  console.log("🚀 Running Database Migration\n" + "=".repeat(50));

  try {
    // Read the migration file
    const migrationSQL = fs.readFileSync("./FIX_DATABASE_TABLES.sql", "utf8");

    // Split into individual statements (be careful with this approach)
    // For now, we'll test if tables exist and create them one by one

    console.log("📋 Creating email_templates table...");

    // Since we can't run raw SQL directly, let's test if the table exists
    // and report what needs to be done
    const { error: testError } = await supabase
      .from("email_templates")
      .select("count")
      .single();

    if (testError && testError.code === "PGRST205") {
      console.log("❌ email_templates table does not exist");
      console.log("   You need to run the migration in Supabase SQL Editor");

      console.log("\n" + "=".repeat(50));
      console.log("📋 MANUAL STEPS REQUIRED:\n");
      console.log("1. Go to your Supabase Dashboard SQL Editor:");
      console.log(
        `   ${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(
          ".supabase.co",
          ".supabase.com"
        )}/project/_/sql/new`
      );
      console.log("\n2. Copy ALL contents from: FIX_DATABASE_TABLES.sql");
      console.log('\n3. Paste into SQL editor and click "Run"');
      console.log("\n4. After running, execute: node test-db-fix.js");

      return;
    }

    console.log("✅ email_templates table already exists!");

    // Check if we have templates
    const { data: templates, error: templatesError } = await supabase
      .from("email_templates")
      .select("*");

    if (!templatesError) {
      console.log(`   Found ${templates?.length || 0} templates`);

      if (templates && templates.length > 0) {
        console.log("\n📧 Email Templates:");
        templates.forEach((t) => {
          console.log(`   - ${t.name}: "${t.subject}"`);
        });
      }
    }

    // Test other tables
    console.log("\n🔍 Checking other tables...");

    const tables = [
      "operations_log",
      "email_logs",
      "businesses",
      "website_previews",
    ];

    for (const table of tables) {
      const { error } = await supabase.from(table).select("count").single();

      if (error && error.code === "PGRST205") {
        console.log(`❌ ${table} table does not exist`);
      } else if (error && error.code === "PGRST116") {
        // No rows but table exists
        console.log(`✅ ${table} table exists (empty)`);
      } else if (!error) {
        console.log(`✅ ${table} table exists`);
      } else {
        console.log(`⚠️  ${table}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error("❌ Migration check failed:", error.message);
  }
}

// Run the migration check
console.log("Note: Direct SQL execution requires Supabase dashboard access.");
console.log("This script will check table status and guide you.\n");

runMigration();
