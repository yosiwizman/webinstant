const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function testAPIs() {
  console.log('🔬 TESTING AI API CONNECTIONS\n');
  
  // Test Together AI
  console.log('1. Testing Together AI...');
  try {
    const response = await fetch('https://api.together.xyz/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`
      }
    });
    if (response.ok) {
      console.log('   ✅ Together AI connected');
    } else {
      console.log('   ❌ Together AI failed:', response.status);
    }
  } catch (e) {
    console.log('   ❌ Together AI error:', e.message);
  }
  
  // Test Replicate
  console.log('\n2. Testing Replicate...');
  try {
    const response = await fetch('https://api.replicate.com/v1/models', {
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`
      }
    });
    if (response.ok) {
      console.log('   ✅ Replicate connected');
    } else {
      console.log('   ❌ Replicate failed:', response.status);
    }
  } catch (e) {
    console.log('   ❌ Replicate error:', e.message);
  }
  
  // Test Anthropic
  console.log('\n3. Testing Anthropic...');
  if (process.env.ANTHROPIC_API_KEY) {
    console.log('   ✅ Anthropic API key exists');
  } else {
    console.log('   ⚠️  Anthropic API key missing');
  }
  
  console.log('\n📋 Environment Variables:');
  console.log('   TOGETHER_API_KEY:', process.env.TOGETHER_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('   REPLICATE_API_TOKEN:', process.env.REPLICATE_API_TOKEN ? '✅ Set' : '❌ Missing');
  console.log('   ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? '✅ Set' : '❌ Missing');
}

testAPIs();
