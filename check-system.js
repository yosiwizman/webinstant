import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSystem() {
  console.log('🔍 SYSTEM CHECK STARTING');
  console.log('=' .repeat(80));
  
  // 1. Check Environment Variables
  console.log('\n📋 ENVIRONMENT VARIABLES STATUS:');
  console.log('-'.repeat(40));
  const envVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'RESEND_API_KEY',
    'TOGETHER_API_KEY',
    'REPLICATE_API_TOKEN',
    'ANTHROPIC_API_KEY',
    'SERPAPI_KEY',
    'TINIFY_API_KEY'
  ];
  
  envVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      const displayValue = varName.includes('SUPABASE_URL') 
        ? value 
        : `${value.substring(0, 8)}...${value.substring(value.length - 4)}`;
      console.log(`  ${varName}: ✅ Set (${displayValue})`);
    } else {
      console.log(`  ${varName}: ❌ Missing`);
    }
  });
  
  // 2. Get all businesses
  console.log('\n📊 ALL BUSINESSES IN DATABASE:');
  console.log('-'.repeat(40));
  
  const { data: businesses, error: businessError } = await supabase
    .from('businesses')
    .select('id, business_name, email, phone, city, state, has_website, created_at')
    .order('created_at', { ascending: false });
  
  if (businessError) {
    console.error('❌ Error fetching businesses:', businessError.message);
  } else if (!businesses || businesses.length === 0) {
    console.log('  No businesses found in database');
  } else {
    console.log(`  Total businesses: ${businesses.length}`);
    console.log('');
    businesses.forEach((business, index) => {
      console.log(`  ${index + 1}. ${business.business_name}`);
      console.log(`     ID: ${business.id}`);
      console.log(`     Email: ${business.email || 'N/A'}`);
      console.log(`     Phone: ${business.phone || 'N/A'}`);
      console.log(`     Location: ${business.city}, ${business.state}`);
      console.log(`     Has Website: ${business.has_website ? '✅ Yes' : '❌ No'}`);
      console.log(`     Created: ${new Date(business.created_at).toLocaleDateString()}`);
      console.log('');
    });
  }
  
  // 3. Get all website previews
  console.log('\n🌐 ALL WEBSITE PREVIEWS:');
  console.log('-'.repeat(40));
  
  const { data: previews, error: previewError } = await supabase
    .from('website_previews')
    .select('id, business_id, preview_url, template_used, slug, created_at, html_content')
    .order('created_at', { ascending: false });
  
  if (previewError) {
    console.error('❌ Error fetching previews:', previewError.message);
  } else if (!previews || previews.length === 0) {
    console.log('  No website previews found');
  } else {
    console.log(`  Total previews: ${previews.length}`);
    console.log('');
    
    for (const [index, preview] of previews.entries()) {
      // Find the business name for this preview
      const business = businesses?.find(b => b.id === preview.business_id);
      const businessName = business ? business.business_name : 'Unknown Business';
      
      console.log(`  ${index + 1}. Preview for: ${businessName}`);
      console.log(`     Preview ID: ${preview.id}`);
      console.log(`     Business ID: ${preview.business_id}`);
      console.log(`     Template: ${preview.template_used || 'N/A'}`);
      console.log(`     Slug: ${preview.slug || 'N/A'}`);
      console.log(`     Preview URL: ${preview.preview_url}`);
      console.log(`     Created: ${new Date(preview.created_at).toLocaleDateString()}`);
      
      // Show first 200 chars of HTML
      if (preview.html_content) {
        const htmlSample = preview.html_content.substring(0, 200).replace(/\n/g, ' ').replace(/\s+/g, ' ');
        console.log(`     HTML Sample: ${htmlSample}...`);
      } else {
        console.log(`     HTML Sample: No HTML content`);
      }
      console.log('');
    }
  }
  
  // 4. Business-Preview Mapping
  console.log('\n🔗 BUSINESS-PREVIEW MAPPING:');
  console.log('-'.repeat(40));
  
  if (businesses && businesses.length > 0) {
    const businessesWithPreviews = [];
    const businessesWithoutPreviews = [];
    
    businesses.forEach(business => {
      const hasPreview = previews?.some(p => p.business_id === business.id);
      if (hasPreview) {
        const preview = previews.find(p => p.business_id === business.id);
        businessesWithPreviews.push({
          businessName: business.business_name,
          businessId: business.id,
          previewId: preview?.id,
          previewUrl: preview?.preview_url
        });
      } else {
        businessesWithoutPreviews.push({
          businessName: business.business_name,
          businessId: business.id
        });
      }
    });
    
    console.log(`\n  ✅ Businesses WITH previews (${businessesWithPreviews.length}):`);
    if (businessesWithPreviews.length > 0) {
      businessesWithPreviews.forEach((item, index) => {
        console.log(`     ${index + 1}. ${item.businessName}`);
        console.log(`        Business ID: ${item.businessId}`);
        console.log(`        Preview ID: ${item.previewId}`);
        console.log(`        URL: ${item.previewUrl}`);
      });
    } else {
      console.log('     None');
    }
    
    console.log(`\n  ❌ Businesses WITHOUT previews (${businessesWithoutPreviews.length}):`);
    if (businessesWithoutPreviews.length > 0) {
      businessesWithoutPreviews.forEach((item, index) => {
        console.log(`     ${index + 1}. ${item.businessName} (ID: ${item.businessId})`);
      });
    } else {
      console.log('     None');
    }
  }
  
  // 5. Summary Statistics
  console.log('\n📈 SUMMARY STATISTICS:');
  console.log('-'.repeat(40));
  console.log(`  Total Businesses: ${businesses?.length || 0}`);
  console.log(`  Total Previews: ${previews?.length || 0}`);
  console.log(`  Businesses with has_website=true: ${businesses?.filter(b => b.has_website).length || 0}`);
  console.log(`  Businesses with has_website=false: ${businesses?.filter(b => !b.has_website).length || 0}`);
  
  // Check for data inconsistencies
  console.log('\n⚠️  DATA CONSISTENCY CHECK:');
  console.log('-'.repeat(40));
  
  let inconsistencies = 0;
  
  // Check if businesses marked as has_website=true actually have previews
  if (businesses) {
    const businessesMarkedWithWebsite = businesses.filter(b => b.has_website);
    businessesMarkedWithWebsite.forEach(business => {
      const hasPreview = previews?.some(p => p.business_id === business.id);
      if (!hasPreview) {
        console.log(`  ⚠️  ${business.business_name} marked has_website=true but no preview found`);
        inconsistencies++;
      }
    });
    
    // Check if businesses with previews are marked has_website=true
    if (previews) {
      previews.forEach(preview => {
        const business = businesses.find(b => b.id === preview.business_id);
        if (business && !business.has_website) {
          console.log(`  ⚠️  ${business.business_name} has preview but has_website=false`);
          inconsistencies++;
        }
      });
    }
  }
  
  if (inconsistencies === 0) {
    console.log('  ✅ No data inconsistencies found');
  } else {
    console.log(`\n  Found ${inconsistencies} inconsistencies`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ SYSTEM CHECK COMPLETE');
}

// Run the check
checkSystem().catch(console.error);
