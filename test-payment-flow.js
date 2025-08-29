const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function testPaymentFlow() {
  console.log('💳 Testing Payment Flow');
  console.log('==================================================\n');

  // Test businesses we can use
  const testBusinessId = '4b226c6c-6912-4010-bdf4-97c2be451ca3'; // Joe's Pizza
  
  console.log('1️⃣ Testing Checkout Session Creation...');
  
  try {
    const response = await fetch('http://localhost:3000/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: testBusinessId,
        domainName: 'testpizza.com',
        email: 'test@example.com',
        businessName: 'Test Pizza Shop'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API returned ${response.status}: ${error}`);
    }

    const data = await response.json();
    
    if (data.checkoutUrl && data.sessionId) {
      console.log('✅ Checkout session created successfully!');
      console.log('   Session ID:', data.sessionId);
      console.log('   Checkout URL:', data.checkoutUrl.substring(0, 50) + '...');
      
      console.log('\n2️⃣ Payment Link Ready!');
      console.log('   To test payment:');
      console.log('   1. Open the checkout URL in your browser');
      console.log('   2. Use test card: 4242 4242 4242 4242');
      console.log('   3. Any future expiry, any CVC');
      console.log('   4. Complete the payment');
      console.log('\n📋 Full Checkout URL:');
      console.log(data.checkoutUrl);
      
    } else {
      throw new Error('Invalid response from API');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Make sure the server is running: npm run dev');
    console.log('   2. Check that Stripe API key is valid');
    console.log('   3. Verify database tables exist (run CREATE_PAYMENT_TABLES.sql)');
  }
}

// Check if server is running first
fetch('http://localhost:3000/api/health')
  .then(() => {
    console.log('✅ Server is running\n');
    testPaymentFlow();
  })
  .catch(() => {
    console.log('❌ Server not running!');
    console.log('   Run: npm run dev');
    console.log('   Then run this test again');
  });
