const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Add delay to avoid rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function diagnosticCheck() {
  console.log('🔍 RUNNING DIAGNOSTIC CHECK\n');
  console.log('=' .repeat(60));
  
  // Check businesses
  const { data: businesses, error: bizError } = await supabase
    .from('businesses')
    .select('*');
    
  if (bizError) {
    console.error('❌ Error fetching businesses:', bizError);
    return false;
  }
  
  console.log(`\n📊 Found ${businesses?.length || 0} businesses`);
  
  // Check previews
  const { data: previews, error: prevError } = await supabase
    .from('website_previews')
    .select('*');
    
  if (prevError) {
    console.error('❌ Error fetching previews:', prevError);
    return false;
  }
  
  console.log(`📊 Found ${previews?.length || 0} previews`);
  
  // Find businesses without previews
  const businessIds = new Set(businesses?.map(b => b.id) || []);
  const previewBusinessIds = new Set(previews?.map(p => p.business_id) || []);
  const missingPreviews = [...businessIds].filter(id => !previewBusinessIds.has(id));
  
  if (missingPreviews.length > 0) {
    console.log(`\n⚠️  ${missingPreviews.length} businesses missing previews:`);
    missingPreviews.forEach(id => {
      const business = businesses.find(b => b.id === id);
      console.log(`   - ${business?.business_name} (${id})`);
    });
  }
  
  // Check for broken HTML content
  console.log('\n🔍 Checking preview content quality...');
  let brokenCount = 0;
  
  for (const preview of previews || []) {
    const business = businesses?.find(b => b.id === preview.business_id);
    const issues = [];
    
    // Check if HTML contains placeholder variables
    if (preview.html_content?.includes('{{') || preview.html_content?.includes('${')) {
      issues.push('contains template variables');
    }
    
    // Check if HTML is too short (likely broken)
    if (!preview.html_content || preview.html_content.length < 500) {
      issues.push('HTML too short or missing');
    }
    
    // Check if preview_url exists
    if (!preview.preview_url) {
      issues.push('missing preview_url');
    }
    
    if (issues.length > 0) {
      brokenCount++;
      console.log(`\n   ❌ ${business?.business_name || 'Unknown'} (${preview.business_id})`);
      issues.forEach(issue => console.log(`      - ${issue}`));
    }
  }
  
  if (brokenCount === 0) {
    console.log('   ✅ All previews appear to have valid content');
  } else {
    console.log(`\n   ⚠️  Found ${brokenCount} previews with issues`);
  }
  
  console.log('\n' + '=' .repeat(60));
  return true;
}

async function regenerateSinglePreview(business) {
  try {
    // First, check if we're running locally
    const testResponse = await fetch('http://localhost:3000/api/health').catch(() => null);
    
    if (!testResponse || !testResponse.ok) {
      console.log('   ⚠️  Local server not running. Please start the dev server first.');
      return false;
    }
    
    const response = await fetch('http://localhost:3000/api/generate-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: business.id,
        businessName: business.business_name,
        businessType: business.business_type || 'general',
        city: business.city,
        state: business.state,
        address: business.address,
        phone: business.phone,
        email: business.email,
        // Force regeneration
        forceRegenerate: true
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`   ✅ Preview regenerated successfully`);
      
      // Verify the preview was actually created/updated
      const { data: preview } = await supabase
        .from('website_previews')
        .select('*')
        .eq('business_id', business.id)
        .single();
        
      if (preview) {
        console.log(`      - Preview URL: ${preview.preview_url}`);
        console.log(`      - HTML length: ${preview.html_content?.length || 0} characters`);
        console.log(`      - Template: ${preview.template_used}`);
      }
      
      return true;
    } else {
      const errorText = await response.text();
      console.log(`   ❌ Failed to regenerate: ${response.status} ${response.statusText}`);
      console.log(`      Error: ${errorText}`);
      return false;
    }
  } catch (error) {
    console.log(`   ⚠️  Error: ${error.message}`);
    return false;
  }
}

async function regeneratePreviews(options = {}) {
  const { 
    onlyBroken = false, 
    specificBusinessId = null,
    batchSize = 5 
  } = options;
  
  console.log('\n🔄 STARTING PREVIEW REGENERATION\n');
  console.log('=' .repeat(60));
  
  // Run diagnostic first
  const diagnosticOk = await diagnosticCheck();
  if (!diagnosticOk) {
    console.log('\n❌ Diagnostic check failed. Please fix database connection first.');
    return;
  }
  
  // Get businesses to process
  let query = supabase.from('businesses').select('*');
  
  if (specificBusinessId) {
    query = query.eq('id', specificBusinessId);
  }
  
  const { data: businesses, error } = await query;
  
  if (error) {
    console.error('❌ Error fetching businesses:', error);
    return;
  }
  
  if (!businesses || businesses.length === 0) {
    console.log('No businesses found to process');
    return;
  }
  
  // Filter for broken previews if requested
  let businessesToProcess = businesses;
  
  if (onlyBroken) {
    console.log('\n🔍 Identifying broken previews...');
    const { data: previews } = await supabase
      .from('website_previews')
      .select('*');
      
    businessesToProcess = businesses.filter(business => {
      const preview = previews?.find(p => p.business_id === business.id);
      
      // Check if preview is broken
      if (!preview) return true; // No preview exists
      if (!preview.html_content || preview.html_content.length < 500) return true;
      if (preview.html_content.includes('{{') || preview.html_content.includes('${')) return true;
      if (!preview.preview_url) return true;
      
      return false;
    });
    
    console.log(`   Found ${businessesToProcess.length} businesses needing regeneration`);
  }
  
  // Process in batches
  console.log(`\n🚀 Processing ${businessesToProcess.length} businesses in batches of ${batchSize}...\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < businessesToProcess.length; i += batchSize) {
    const batch = businessesToProcess.slice(i, i + batchSize);
    console.log(`\n📦 Batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(businessesToProcess.length/batchSize)}`);
    console.log('-' .repeat(40));
    
    const batchPromises = batch.map(async (business) => {
      console.log(`\n🏢 Processing: ${business.business_name}`);
      const success = await regenerateSinglePreview(business);
      
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
      
      return success;
    });
    
    await Promise.all(batchPromises);
    
    // Add delay between batches to avoid rate limiting
    if (i + batchSize < businessesToProcess.length) {
      console.log('\n⏳ Waiting 2 seconds before next batch...');
      await delay(2000);
    }
  }
  
  // Final summary
  console.log('\n' + '=' .repeat(60));
  console.log('✨ REGENERATION COMPLETE!\n');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📊 Total processed: ${businessesToProcess.length}`);
  
  // Run final diagnostic
  console.log('\n🔍 Running final diagnostic...');
  await diagnosticCheck();
}

// Parse command line arguments
const args = process.argv.slice(2);
const flags = {
  onlyBroken: args.includes('--only-broken'),
  diagnostic: args.includes('--diagnostic'),
  businessId: null,
  batchSize: 5
};

// Parse business ID if provided
const businessIdIndex = args.indexOf('--business-id');
if (businessIdIndex !== -1 && args[businessIdIndex + 1]) {
  flags.businessId = args[businessIdIndex + 1];
}

// Parse batch size if provided
const batchSizeIndex = args.indexOf('--batch-size');
if (batchSizeIndex !== -1 && args[batchSizeIndex + 1]) {
  flags.batchSize = parseInt(args[batchSizeIndex + 1], 10);
}

// Main execution
async function main() {
  console.log('🚀 Preview Regeneration Tool');
  console.log('=' .repeat(60));
  console.log('Options:');
  console.log('  --diagnostic       : Run diagnostic only');
  console.log('  --only-broken      : Only regenerate broken previews');
  console.log('  --business-id <id> : Regenerate specific business');
  console.log('  --batch-size <n>   : Process n businesses at a time (default: 5)');
  console.log('=' .repeat(60));
  
  if (flags.diagnostic) {
    await diagnosticCheck();
  } else {
    await regeneratePreviews({
      onlyBroken: flags.onlyBroken,
      specificBusinessId: flags.businessId,
      batchSize: flags.batchSize
    });
  }
  
  process.exit(0);
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
