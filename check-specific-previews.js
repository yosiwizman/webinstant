const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local file manually
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    });
  }
}

loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Specific preview IDs to check
const PREVIEW_IDS_WITH_IMAGES = [
  'd3c40ae9-add7-4b7a-a9f5-0b52037cd0ce',
  '6ef97049-ec98-4978-a5dc-28662d302688',
  '5ac18784-e0da-46f3-8e3f-a5820f36e8e1',
  '2ff9b300-30e6-4116-95b5-6ab7b90d9def'
];

const PREVIEW_IDS_WITHOUT_IMAGES = [
  'a5ca2655-f415-4e43-888f-1c5cc1e387fb'
];

// Check if a URL is valid
function isValidHttpUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

// Extract all image URLs from HTML
function extractImageUrls(html) {
  if (!html) return { imgTags: [], backgroundImages: [], allImageUrls: [] };
  
  const imgTags = [];
  const backgroundImages = [];
  const allImageUrls = [];
  
  // Find img tags with src attribute
  const imgRegex = /<img[^>]*src=["']([^"']*)["'][^>]*>/gi;
  let match;
  
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    imgTags.push({
      fullTag: match[0],
      src: src,
      isValid: isValidHttpUrl(src)
    });
    allImageUrls.push(src);
  }
  
  // Find background-image in style attributes
  const bgImageRegex = /background-image:\s*url\(['"]?([^'")]+)['"]?\)/gi;
  
  while ((match = bgImageRegex.exec(html)) !== null) {
    const url = match[1];
    backgroundImages.push({
      fullMatch: match[0],
      url: url,
      isValid: isValidHttpUrl(url)
    });
    allImageUrls.push(url);
  }
  
  // Also check for background: url() patterns
  const bgRegex = /background:\s*[^;]*url\(['"]?([^'")]+)['"]?\)/gi;
  
  while ((match = bgRegex.exec(html)) !== null) {
    const url = match[1];
    if (!allImageUrls.includes(url)) {
      backgroundImages.push({
        fullMatch: match[0],
        url: url,
        isValid: isValidHttpUrl(url)
      });
      allImageUrls.push(url);
    }
  }
  
  return { imgTags, backgroundImages, allImageUrls };
}

async function checkSpecificPreviews() {
  console.log('🔍 CHECKING SPECIFIC PREVIEW IDS');
  console.log('================================================\n');
  
  try {
    // Check previews that HAVE images
    console.log('📋 PREVIEWS WITH WORKING IMAGES:');
    console.log('-'.repeat(40));
    
    for (const previewId of PREVIEW_IDS_WITH_IMAGES) {
      const { data: preview, error } = await supabase
        .from('website_previews')
        .select(`
          id,
          business_id,
          html_content,
          businesses!inner(
            business_name
          )
        `)
        .eq('id', previewId)
        .single();
      
      if (error || !preview) {
        console.log(`\n❌ Could not fetch preview: ${previewId}`);
        continue;
      }
      
      const businessName = preview.businesses?.business_name || 'Unknown';
      const { imgTags, backgroundImages, allImageUrls } = extractImageUrls(preview.html_content);
      
      console.log(`\n✅ ${businessName}`);
      console.log(`   Preview ID: ${previewId}`);
      console.log(`   Total images found: ${allImageUrls.length}`);
      console.log(`   - <img> tags: ${imgTags.length}`);
      console.log(`   - Background images: ${backgroundImages.length}`);
      
      if (allImageUrls.length > 0) {
        console.log(`   Sample URLs:`);
        allImageUrls.slice(0, 2).forEach((url, i) => {
          const isValid = isValidHttpUrl(url);
          console.log(`     ${i + 1}. [${isValid ? '✓' : '✗'}] ${url.substring(0, 80)}${url.length > 80 ? '...' : ''}`);
        });
      }
    }
    
    // Check previews that DON'T have images
    console.log('\n\n📋 PREVIEWS WITHOUT WORKING IMAGES:');
    console.log('-'.repeat(40));
    
    for (const previewId of PREVIEW_IDS_WITHOUT_IMAGES) {
      const { data: preview, error } = await supabase
        .from('website_previews')
        .select(`
          id,
          business_id,
          html_content,
          businesses!inner(
            business_name
          )
        `)
        .eq('id', previewId)
        .single();
      
      if (error || !preview) {
        console.log(`\n❌ Could not fetch preview: ${previewId}`);
        continue;
      }
      
      const businessName = preview.businesses?.business_name || 'Unknown';
      const { imgTags, backgroundImages, allImageUrls } = extractImageUrls(preview.html_content);
      
      console.log(`\n❌ ${businessName}`);
      console.log(`   Preview ID: ${previewId}`);
      console.log(`   Total images found: ${allImageUrls.length}`);
      console.log(`   - <img> tags: ${imgTags.length}`);
      console.log(`   - Background images: ${backgroundImages.length}`);
      
      if (allImageUrls.length > 0) {
        console.log(`   Image URLs found (but not displaying):`);
        allImageUrls.forEach((url, i) => {
          const isValid = isValidHttpUrl(url);
          console.log(`     ${i + 1}. [${isValid ? '✓ VALID' : '✗ BROKEN'}] ${url}`);
        });
        
        // Show broken images in detail
        const brokenImgs = imgTags.filter(img => !img.isValid);
        const brokenBgs = backgroundImages.filter(bg => !bg.isValid);
        
        if (brokenImgs.length > 0) {
          console.log(`\n   🔴 BROKEN <img> tags:`);
          brokenImgs.forEach((img, i) => {
            console.log(`     ${i + 1}. ${img.src}`);
            console.log(`        Full tag: ${img.fullTag.substring(0, 100)}...`);
          });
        }
        
        if (brokenBgs.length > 0) {
          console.log(`\n   🔴 BROKEN background images:`);
          brokenBgs.forEach((bg, i) => {
            console.log(`     ${i + 1}. ${bg.url}`);
          });
        }
      } else {
        console.log(`   ⚠️ NO IMAGE TAGS FOUND IN HTML!`);
        console.log(`   HTML snippet (first 500 chars):`);
        console.log(`   ${preview.html_content.substring(0, 500)}...`);
      }
    }
    
    // Analysis summary
    console.log('\n\n' + '='.repeat(50));
    console.log('📊 ANALYSIS SUMMARY:');
    console.log('='.repeat(50));
    console.log('\nThe previews without images likely have:');
    console.log('1. Broken/invalid image URLs that need to be replaced');
    console.log('2. Missing image tags in the HTML content');
    console.log('3. Images using data URIs or relative paths instead of HTTP URLs');
    console.log('\nRun the fix script to replace broken URLs with working Unsplash images.');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the check
checkSpecificPreviews();
