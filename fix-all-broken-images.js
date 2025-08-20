import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Unsplash image URLs by business type
const UNSPLASH_IMAGES = {
  restaurant: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&h=800',
  pizza: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&h=800',
  beauty: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&h=800',
  salon: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&h=800',
  spa: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&h=800',
  auto: 'https://images.unsplash.com/photo-1625047509248-ec889cbff17f?w=1200&h=800',
  automotive: 'https://images.unsplash.com/photo-1625047509248-ec889cbff17f?w=1200&h=800',
  mechanic: 'https://images.unsplash.com/photo-1625047509248-ec889cbff17f?w=1200&h=800',
  cleaning: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1200&h=800',
  cleaners: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1200&h=800',
  janitorial: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1200&h=800',
  plumbing: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=1200&h=800',
  plumber: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=1200&h=800',
  default: 'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=1200&h=800'
};

// Check if a URL is valid
function isValidHttpUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

// Determine business type from name
function getBusinessType(businessName) {
  const name = businessName.toLowerCase();
  
  if (name.includes('pizza') || name.includes('restaurant') || name.includes('cafe') || 
      name.includes('diner') || name.includes('grill') || name.includes('kitchen')) {
    return 'restaurant';
  }
  if (name.includes('beauty') || name.includes('salon') || name.includes('spa') || 
      name.includes('nail') || name.includes('hair')) {
    return 'beauty';
  }
  if (name.includes('auto') || name.includes('car') || name.includes('mechanic') || 
      name.includes('tire') || name.includes('repair')) {
    return 'auto';
  }
  if (name.includes('clean') || name.includes('maid') || name.includes('janitorial')) {
    return 'cleaning';
  }
  if (name.includes('plumb') || name.includes('pipe') || name.includes('drain')) {
    return 'plumbing';
  }
  
  return 'default';
}

// Fix images in HTML content
function fixImagesInHtml(html, businessType) {
  if (!html) return html;
  
  const imageUrl = UNSPLASH_IMAGES[businessType] || UNSPLASH_IMAGES.default;
  let fixedHtml = html;
  let changeCount = 0;
  
  // Regular expression to find img tags with src attribute
  const imgRegex = /<img[^>]*src=["']([^"']*)["'][^>]*>/gi;
  const matches = [...fixedHtml.matchAll(imgRegex)];
  
  for (const match of matches) {
    const fullImgTag = match[0];
    const currentSrc = match[1];
    
    // Check if the current src is not a valid HTTP URL
    if (!isValidHttpUrl(currentSrc)) {
      const newImgTag = fullImgTag.replace(currentSrc, imageUrl);
      fixedHtml = fixedHtml.replace(fullImgTag, newImgTag);
      changeCount++;
      console.log(`  ✓ Replaced broken image: ${currentSrc.substring(0, 50)}...`);
    }
  }
  
  // Also check for background-image in style attributes
  const bgImageRegex = /background-image:\s*url\(['"]?([^'")]+)['"]?\)/gi;
  const bgMatches = [...fixedHtml.matchAll(bgImageRegex)];
  
  for (const match of bgMatches) {
    const fullMatch = match[0];
    const currentUrl = match[1];
    
    if (!isValidHttpUrl(currentUrl)) {
      const newMatch = fullMatch.replace(currentUrl, imageUrl);
      fixedHtml = fixedHtml.replace(fullMatch, newMatch);
      changeCount++;
      console.log(`  ✓ Replaced broken background-image: ${currentUrl.substring(0, 50)}...`);
    }
  }
  
  return { html: fixedHtml, changeCount };
}

async function fixAllBrokenImages() {
  console.log('🔧 Starting to fix ALL broken images in database...');
  console.log('================================================\n');
  
  try {
    // Fetch all website previews with business information
    console.log('📋 Fetching all website previews...');
    const { data: previews, error: fetchError } = await supabase
      .from('website_previews')
      .select(`
        id,
        business_id,
        html_content,
        businesses!inner(
          business_name
        )
      `)
      .order('created_at', { ascending: false });
    
    if (fetchError) {
      console.error('❌ Error fetching previews:', fetchError);
      return;
    }
    
    if (!previews || previews.length === 0) {
      console.log('ℹ️ No previews found in database');
      return;
    }
    
    console.log(`📊 Found ${previews.length} previews to check\n`);
    
    let totalFixed = 0;
    let totalImagesFixed = 0;
    
    // Process each preview
    for (const preview of previews) {
      const businessName = preview.businesses?.business_name || 'Unknown Business';
      const businessType = getBusinessType(businessName);
      
      console.log(`\n🏢 Processing: ${businessName}`);
      console.log(`   Type: ${businessType}`);
      console.log(`   Preview ID: ${preview.id}`);
      
      // Fix images in HTML content
      const result = fixImagesInHtml(preview.html_content, businessType);
      
      if (result.changeCount > 0) {
        // Update the preview with fixed HTML
        const { error: updateError } = await supabase
          .from('website_previews')
          .update({ 
            html_content: result.html,
            updated_at: new Date().toISOString()
          })
          .eq('id', preview.id);
        
        if (updateError) {
          console.error(`   ❌ Error updating preview: ${updateError.message}`);
        } else {
          console.log(`   ✅ Fixed ${result.changeCount} broken images`);
          totalFixed++;
          totalImagesFixed += result.changeCount;
        }
      } else {
        console.log(`   ℹ️ No broken images found`);
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 FIX COMPLETE SUMMARY:');
    console.log('='.repeat(50));
    console.log(`✅ Total previews processed: ${previews.length}`);
    console.log(`✅ Previews with fixes: ${totalFixed}`);
    console.log(`✅ Total images fixed: ${totalImagesFixed}`);
    console.log('\n✨ All broken images have been replaced with working Unsplash images!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the fix
fixAllBrokenImages();
