/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Script to run database migrations
 * This script helps set up the missing email_templates table and other required tables
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config({ path: ".env.local" });

// Check if Supabase is configured
if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
) {
  console.error("❌ Supabase environment variables not configured");
  console.log("   Please run: npx tsx test-connection.ts");
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkTable(tableName) {
  try {
    const { error } = await supabase.from(tableName).select("id").limit(1);

    if (error && error.message.includes("does not exist")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function runMigrations() {
  console.log("🔄 WebInstant Database Migration Tool");
  console.log("=====================================\n");

  // Check current table status
  console.log("📋 Checking existing tables...");
  const tables = [
    "businesses",
    "website_previews",
    "email_templates",
    "email_logs",
    "operations_log",
    "emails",
    "campaigns",
    "ab_tests",
    "api_usage",
    "subscriptions",
  ];

  const tableStatus = {};
  for (const table of tables) {
    const exists = await checkTable(table);
    tableStatus[table] = exists;
    console.log(`   ${exists ? "✅" : "❌"} ${table}`);
  }

  // Check if email_templates needs to be created
  if (!tableStatus.email_templates) {
    console.log("\n⚠️  Missing email_templates table detected!");
    console.log("   This is required for email functionality.\n");

    // Read migration file
    const migrationPath = path.join(
      __dirname,
      "..",
      "supabase",
      "migrations",
      "20240101000001_create_email_templates.sql"
    );

    if (!fs.existsSync(migrationPath)) {
      console.error("❌ Migration file not found at:", migrationPath);
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, "utf8");

    console.log("📝 Migration SQL ready to execute");
    console.log("\n" + "=".repeat(60));
    console.log("IMPORTANT: Manual steps required!");
    console.log("=".repeat(60));
    console.log("\n1. Go to your Supabase Dashboard:");
    console.log(
      `   ${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(
        ".supabase.co",
        ".supabase.com/project/_/sql/new"
      )}`
    );
    console.log("\n2. Copy and paste the SQL from this file:");
    console.log(`   ${migrationPath}`);
    console.log('\n3. Click "Run" to execute the migration');
    console.log("\n4. Verify the table was created in Table Editor");
    console.log("\n" + "=".repeat(60));

    // Also save a convenience copy
    const outputPath = path.join(process.cwd(), "RUN_THIS_MIGRATION.sql");
    fs.writeFileSync(outputPath, migrationSQL);
    console.log(`\n💡 Migration SQL also saved to: ${outputPath}`);
    console.log("   You can copy from this file to paste into Supabase.\n");
  } else {
    console.log("\n✅ email_templates table already exists!");
  }

  // Check for missing required tables
  const missingTables = Object.entries(tableStatus)
    .filter(([_, exists]) => !exists)
    .map(([table]) => table);

  if (missingTables.length > 0 && !missingTables.includes("email_templates")) {
    console.log(
      "\n⚠️  Other missing tables detected:",
      missingTables.join(", ")
    );
    console.log(
      "   These may be created automatically when features are used."
    );
  }

  // Test email_templates data
  if (tableStatus.email_templates) {
    console.log("\n📊 Checking email templates...");
    const { data: templates, error } = await supabase
      .from("email_templates")
      .select("name, is_active");

    if (error) {
      console.log("   ❌ Error reading templates:", error.message);
    } else if (templates && templates.length > 0) {
      console.log(`   ✅ Found ${templates.length} templates:`);
      templates.forEach((t) => {
        console.log(
          `      - ${t.name} (${t.is_active ? "active" : "inactive"})`
        );
      });
    } else {
      console.log(
        "   ⚠️  No templates found - defaults will be created on first use"
      );
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("✨ Migration check complete!");
  console.log("=".repeat(60));

  if (!tableStatus.email_templates) {
    console.log("\n🚨 ACTION REQUIRED:");
    console.log("   1. Run the migration SQL in Supabase");
    console.log("   2. Then run: npm run dev");
    console.log("   3. Visit http://localhost:3000/admin");
    console.log("   4. Test email sending functionality");
  } else {
    console.log("\n✅ Your database is ready!");
    console.log("   Run: npm run dev");
    console.log("   Visit: http://localhost:3000/admin");
  }
}

// Run the migrations
runMigrations().catch(console.error);
