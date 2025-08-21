const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function regeneratePreviews() {
  console.log('🔄 RE-GENERATING ALL PREVIEWS\n');
  
  const { data: businesses } = await supabase
    .from('businesses')
    .select('*');
    
  for (const business of businesses || []) {
    console.log(`\n🏢 Regenerating preview for ${business.business_name}...`);
    
    try {
      const response = await fetch('http://localhost:3000/api/generate-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          businessName: business.business_name,
          businessType: business.business_type || 'general',
          city: business.city,
          state: business.state
        })
      });
      
      if (response.ok) {
        console.log(`   ✅ Preview regenerated successfully`);
      } else {
        console.log(`   ❌ Failed to regenerate`);
      }
    } catch (error) {
      console.log(`   ⚠️ Error: ${error.message}`);
    }
  }
  
  console.log('\n✨ Regeneration complete!');
}

regeneratePreviews();
