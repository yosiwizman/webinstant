const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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
  if (!html) return { imgTags: [], backgroundImages: [] };
  
  const imgTags = [];
  const backgroundImages = [];
  
  // Find img tags with src attribute
  const imgRegex = /<img[^>]*src=["']([^"']*)["'][^>]*>/gi;
  let match;
  
  while ((match = imgRegex.exec(html)) !== null) {
    imgTags.push({
      fullTag: match[0],
      src: match[1],
      isValid: isValidHttpUrl(match[1])
    });
  }
  
  // Find background-image in style attributes
  const bgImageRegex = /background-image:\s*url\(['"]?([^'")]+)['"]?\)/gi;
  
  while ((match = bgImageRegex.exec(html)) !== null) {
    backgroundImages.push({
      fullMatch: match[0],
      url: match[1],
      isValid: isValidHttpUrl(match[1])
    });
  }
  
  return { imgTags, backgroundImages };
}

async function checkBrokenImages() {
  console.log('🔍 DIAGNOSTIC: Checking for broken images in database...');
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
    
    console.log(`📊 Found ${previews.length} previews to analyze\n`);
    
    let totalBrokenImages = 0;
    let totalBrokenBackgrounds = 0;
    let previewsWithIssues = 0;
    const issueDetails = [];
    
    // Process each preview
    for (const preview of previews) {
      const businessName = preview.businesses?.business_name || 'Unknown Business';
      const { imgTags, backgroundImages } = extractImageUrls(preview.html_content);
      
      const brokenImgs = imgTags.filter(img => !img.isValid);
      const brokenBgs = backgroundImages.filter(bg => !bg.isValid);
      
      if (brokenImgs.length > 0 || brokenBgs.length > 0) {
        previewsWithIssues++;
        
        console.log(`\n❌ ISSUES FOUND: ${businessName}`);
        console.log(`   Preview ID: ${preview.id}`);
        console.log(`   Business ID: ${preview.business_id}`);
        
        if (brokenImgs.length > 0) {
          console.log(`   🖼️ Broken <img> tags: ${brokenImgs.length}`);
          brokenImgs.forEach((img, index) => {
            console.log(`      ${index + 1}. src="${img.src}"`);
            if (img.src.length > 100) {
              console.log(`         (truncated, full length: ${img.src.length} chars)`);
            }
          });
          totalBrokenImages += brokenImgs.length;
        }
        
        if (brokenBgs.length > 0) {
          console.log(`   🎨 Broken background-images: ${brokenBgs.length}`);
          brokenBgs.forEach((bg, index) => {
            console.log(`      ${index + 1}. url="${bg.url}"`);
            if (bg.url.length > 100) {
              console.log(`         (truncated, full length: ${bg.url.length} chars)`);
            }
          });
          totalBrokenBackgrounds += brokenBgs.length;
        }
        
        issueDetails.push({
          businessName,
          previewId: preview.id,
          businessId: preview.business_id,
          brokenImgs: brokenImgs.length,
          brokenBgs: brokenBgs.length,
          samples: {
            img: brokenImgs[0]?.src,
            bg: brokenBgs[0]?.url
          }
        });
      } else {
        console.log(`✅ OK: ${businessName} (${preview.id})`);
      }
    }
    
    // Summary Report
    console.log('\n' + '='.repeat(50));
    console.log('📊 DIAGNOSTIC SUMMARY:');
    console.log('='.repeat(50));
    console.log(`Total previews checked: ${previews.length}`);
    console.log(`Previews with broken images: ${previewsWithIssues}`);
    console.log(`Total broken <img> tags: ${totalBrokenImages}`);
    console.log(`Total broken background-images: ${totalBrokenBackgrounds}`);
    console.log(`Total broken images: ${totalBrokenImages + totalBrokenBackgrounds}`);
    
    if (issueDetails.length > 0) {
      console.log('\n📋 TOP ISSUES (first 5):');
      issueDetails.slice(0, 5).forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.businessName}`);
        console.log(`   ID: ${issue.previewId}`);
        console.log(`   Broken imgs: ${issue.brokenImgs}, Broken bgs: ${issue.brokenBgs}`);
        if (issue.samples.img) {
          console.log(`   Sample broken img: "${issue.samples.img.substring(0, 60)}..."`);
        }
        if (issue.samples.bg) {
          console.log(`   Sample broken bg: "${issue.samples.bg.substring(0, 60)}..."`);
        }
      });
      
      console.log('\n⚠️ COMMON PATTERNS FOUND:');
      
      // Analyze common patterns in broken URLs
      const allBrokenUrls = [];
      previews.forEach(preview => {
        const { imgTags, backgroundImages } = extractImageUrls(preview.html_content);
        imgTags.filter(img => !img.isValid).forEach(img => allBrokenUrls.push(img.src));
        backgroundImages.filter(bg => !bg.isValid).forEach(bg => allBrokenUrls.push(bg.url));
      });
      
      const patterns = {
        placeholder: allBrokenUrls.filter(url => url.includes('placeholder')).length,
        dataUri: allBrokenUrls.filter(url => url.startsWith('data:')).length,
        relative: allBrokenUrls.filter(url => url.startsWith('/') || url.startsWith('./')).length,
        empty: allBrokenUrls.filter(url => url === '' || url === '#').length,
        other: 0
      };
      
      patterns.other = allBrokenUrls.length - patterns.placeholder - patterns.dataUri - patterns.relative - patterns.empty;
      
      console.log(`   Placeholder URLs: ${patterns.placeholder}`);
      console.log(`   Data URIs: ${patterns.dataUri}`);
      console.log(`   Relative paths: ${patterns.relative}`);
      console.log(`   Empty/Hash: ${patterns.empty}`);
      console.log(`   Other: ${patterns.other}`);
      
      console.log('\n💡 RECOMMENDATION:');
      console.log('   The broken images need to be replaced with valid HTTP/HTTPS URLs.');
      console.log('   Run the fix script to replace them with working Unsplash images.');
    } else {
      console.log('\n✨ No broken images found! All images are using valid HTTP/HTTPS URLs.');
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the diagnostic
checkBrokenImages();
