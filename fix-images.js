const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Placeholder image URL
const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/800x600/007bff/ffffff?text=Professional+Image';

// Common broken image patterns to look for
const BROKEN_IMAGE_PATTERNS = [
  /https?:\/\/images\.unsplash\.com\/[^"'\s>]*/gi,
  /https?:\/\/source\.unsplash\.com\/[^"'\s>]*/gi,
  /https?:\/\/picsum\.photos\/[^"'\s>]*/gi,
  /https?:\/\/placehold\.it\/[^"'\s>]*/gi,
  /https?:\/\/placeholder\.com\/[^"'\s>]*/gi,
  /https?:\/\/via\.placeholder\.com\/[^"'\s>]*/gi,
  /https?:\/\/loremflickr\.com\/[^"'\s>]*/gi,
  /https?:\/\/lorempixel\.com\/[^"'\s>]*/gi,
  /\/api\/placeholder\/[^"'\s>]*/gi,
  /src=["']([^"']*\.(jpg|jpeg|png|gif|webp|svg))[^"']*/gi,
  /url\(["']?([^"')]*\.(jpg|jpeg|png|gif|webp|svg))[^"')]*\)/gi,
  /background-image:\s*url\(["']?([^"')]*)[^"')]*\)/gi
];

async function fixImages() {
  console.log('🔧 Starting image fix process');
  console.log('================================================');
  console.log(`📷 Placeholder image: ${PLACEHOLDER_IMAGE}`);
  console.log('');

  try {
    // Step 1: Fetch all website previews
    console.log('📋 Fetching all website previews...');
    const { data: previews, error: fetchError } = await supabase
      .from('website_previews')
      .select('id, business_id, html_content, preview_url')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('❌ Error fetching previews:', fetchError);
      return;
    }

    if (!previews || previews.length === 0) {
      console.log('ℹ️ No website previews found');
      return;
    }

    console.log(`✅ Found ${previews.length} website previews`);
    console.log('');

    let totalFixed = 0;
    let totalErrors = 0;
    const updatePromises = [];

    // Step 2: Process each preview
    for (let i = 0; i < previews.length; i++) {
      const preview = previews[i];
      console.log(`\n[${i + 1}/${previews.length}] Processing preview ID: ${preview.id}`);
      console.log(`   Business ID: ${preview.business_id}`);

      if (!preview.html_content) {
        console.log('   ⚠️ No HTML content found, skipping...');
        continue;
      }

      let htmlContent = preview.html_content;
      let replacementCount = 0;

      // Step 3: Replace all image URLs with placeholder
      // First, handle img src attributes
      htmlContent = htmlContent.replace(/<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi, (match, before, src, after) => {
        // Skip if already using our placeholder
        if (src === PLACEHOLDER_IMAGE) {
          return match;
        }
        
        // Skip data URLs and SVGs
        if (src.startsWith('data:') || src.endsWith('.svg')) {
          return match;
        }

        replacementCount++;
        console.log(`   🔄 Replacing img src: ${src.substring(0, 50)}...`);
        return `<img${before}src="${PLACEHOLDER_IMAGE}"${after}>`;
      });

      // Handle background-image in style attributes
      htmlContent = htmlContent.replace(/style=["']([^"']*background-image:\s*url\([^)]+\)[^"']*)/gi, (match, styleContent) => {
        const newStyle = styleContent.replace(/background-image:\s*url\([^)]+\)/gi, `background-image: url(${PLACEHOLDER_IMAGE})`);
        if (newStyle !== styleContent) {
          replacementCount++;
          console.log(`   🔄 Replacing background-image in style attribute`);
        }
        return `style="${newStyle}`;
      });

      // Handle background shorthand in style attributes
      htmlContent = htmlContent.replace(/style=["']([^"']*background:\s*[^;]*url\([^)]+\)[^"']*)/gi, (match, styleContent) => {
        const newStyle = styleContent.replace(/url\([^)]+\)/gi, `url(${PLACEHOLDER_IMAGE})`);
        if (newStyle !== styleContent) {
          replacementCount++;
          console.log(`   🔄 Replacing background url in style attribute`);
        }
        return `style="${newStyle}`;
      });

      // Handle CSS background-image declarations in <style> tags
      htmlContent = htmlContent.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, cssContent) => {
        let newCss = cssContent;
        let cssChanged = false;

        // Replace background-image URLs
        newCss = newCss.replace(/background-image:\s*url\([^)]+\)/gi, (bgMatch) => {
          if (!bgMatch.includes(PLACEHOLDER_IMAGE)) {
            cssChanged = true;
            console.log(`   🔄 Replacing background-image in CSS`);
            return `background-image: url(${PLACEHOLDER_IMAGE})`;
          }
          return bgMatch;
        });

        // Replace background shorthand URLs
        newCss = newCss.replace(/background:\s*[^;]*url\([^)]+\)[^;]*/gi, (bgMatch) => {
          if (!bgMatch.includes(PLACEHOLDER_IMAGE)) {
            const replaced = bgMatch.replace(/url\([^)]+\)/gi, `url(${PLACEHOLDER_IMAGE})`);
            if (replaced !== bgMatch) {
              cssChanged = true;
              console.log(`   🔄 Replacing background url in CSS`);
            }
            return replaced;
          }
          return bgMatch;
        });

        if (cssChanged) {
          replacementCount++;
        }

        return match.replace(cssContent, newCss);
      });

      // Handle any remaining URLs that look like images
      BROKEN_IMAGE_PATTERNS.forEach(pattern => {
        const matches = htmlContent.match(pattern);
        if (matches && matches.length > 0) {
          htmlContent = htmlContent.replace(pattern, (match) => {
            // Skip if already our placeholder
            if (match.includes(PLACEHOLDER_IMAGE)) {
              return match;
            }
            
            // For src attributes
            if (match.includes('src=')) {
              replacementCount++;
              console.log(`   🔄 Replacing src pattern: ${match.substring(0, 50)}...`);
              return `src="${PLACEHOLDER_IMAGE}"`;
            }
            
            // For url() in CSS
            if (match.includes('url(')) {
              replacementCount++;
              console.log(`   🔄 Replacing url() pattern: ${match.substring(0, 50)}...`);
              return `url(${PLACEHOLDER_IMAGE})`;
            }
            
            // Default replacement
            replacementCount++;
            console.log(`   🔄 Replacing pattern: ${match.substring(0, 50)}...`);
            return PLACEHOLDER_IMAGE;
          });
        }
      });

      if (replacementCount > 0) {
        console.log(`   ✅ Replaced ${replacementCount} image references`);
        
        // Step 4: Update the database
        const updatePromise = supabase
          .from('website_previews')
          .update({ 
            html_content: htmlContent,
            updated_at: new Date().toISOString()
          })
          .eq('id', preview.id)
          .then(({ error: updateError }) => {
            if (updateError) {
              console.error(`   ❌ Failed to update preview ${preview.id}:`, updateError);
              totalErrors++;
              return false;
            } else {
              console.log(`   💾 Database updated successfully`);
              totalFixed++;
              return true;
            }
          });

        updatePromises.push(updatePromise);
      } else {
        console.log(`   ℹ️ No images found to replace`);
      }
    }

    // Wait for all updates to complete
    if (updatePromises.length > 0) {
      console.log('\n⏳ Waiting for all database updates to complete...');
      await Promise.all(updatePromises);
    }

    // Final summary
    console.log('\n================================================');
    console.log('📊 IMAGE FIX SUMMARY:');
    console.log('================================================');
    console.log(`✅ Successfully updated: ${totalFixed} previews`);
    console.log(`❌ Failed updates: ${totalErrors} previews`);
    console.log(`ℹ️ Total processed: ${previews.length} previews`);
    console.log('================================================');
    console.log('✨ Image fix process completed!');

  } catch (error) {
    console.error('❌ Unexpected error during image fix:', error);
  }
}

// Run the fix
fixImages().catch(console.error);
