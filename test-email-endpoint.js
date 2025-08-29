/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Test the send-email endpoint
 * Run with: node test-email-endpoint.js
 */

const fetch = require("node-fetch");

async function testEmailEndpoint() {
  const url = "http://localhost:3000/api/send-email";

  console.log("📧 Testing Email Endpoint\n" + "=".repeat(50));
  console.log(`Testing: ${url}\n`);

  try {
    // Test 1: Invalid request (no businessId)
    console.log("Test 1: Invalid request (should return 400)...");
    const response1 = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: true }),
    });

    console.log(`  Status: ${response1.status} ${response1.statusText}`);
    const data1 = await response1.json();
    console.log(`  Response:`, data1);

    if (response1.status === 400) {
      console.log("  ✅ Endpoint accessible and validation works");
    } else if (response1.status === 404) {
      console.log("  ❌ Endpoint returns 404 - check route export");
    }

    // Test 2: Check with fake businessId
    console.log(
      "\nTest 2: With fake businessId (should return 404 for business)..."
    );
    const response2 = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: "00000000-0000-0000-0000-000000000000",
        template: "website_ready",
      }),
    });

    console.log(`  Status: ${response2.status} ${response2.statusText}`);
    const data2 = await response2.json();
    console.log(`  Response:`, data2);

    console.log("\n" + "=".repeat(50));
    console.log("📊 RESULTS:\n");

    if (response1.status === 404 || response2.status === 404) {
      console.log(
        "⚠️  The /api/send-email endpoint might not be properly exported."
      );
      console.log(
        "   Check that app/api/send-email/route.ts exports a POST function."
      );
    } else if (response1.status === 400) {
      console.log("✅ The /api/send-email endpoint is working correctly!");
      console.log(
        "   It properly validates requests and returns appropriate errors."
      );
    }
  } catch (error) {
    if (error.code === "ECONNREFUSED") {
      console.log(
        "❌ Connection refused - is your Next.js dev server running?"
      );
      console.log("   Run: npm run dev");
    } else {
      console.log("❌ Error:", error.message);
    }
  }
}

// Check if server is likely running first
fetch("http://localhost:3000")
  .then(() => {
    console.log("✅ Server is running on localhost:3000\n");
    testEmailEndpoint();
  })
  .catch(() => {
    console.log("❌ Server is not running on localhost:3000");
    console.log("   Please run: npm run dev");
    console.log("   Then run this test again.");
  });
