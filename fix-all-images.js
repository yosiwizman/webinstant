import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixAllImages() {
  console.log('🔧 Fixing all broken images in database...');
  console.log('================================================\n');
  
  const placeholders = {
    hero: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&h=600&fit=crop',
    gallery: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=600&fit=crop',
    default: 'https://via.placeholder.com/800x600/0066cc/ffffff?text=Professional+Website'
  };
  
  const { data: previews, error } = await supabase
    .from('website_previews')
    .select('id, html_content, business_id');
  
  if (error) {
    console.error('❌ Error fetching previews:', error);
    return;
  }
  
  console.log(`📋 Found ${previews?.length || 0} previews to check\n`);
  
  let totalFixed = 0;
  
  for (const preview of previews || []) {
    let updated = false;
    let html = preview.html_content;
    let fixCount = 0;
    
    // Fix img tags
    html = html.replace(
      /<img([^>]*?)src=["']([^"']*?)["']([^>]*?)>/gi,
      (match, before, src, after) => {
        if (!src || src === 'undefined' || src === 'null' || 
            !src.startsWith('http') || src.includes('undefined')) {
          updated = true;
          fixCount++;
          const placeholder = before.includes('hero') ? placeholders.hero : placeholders.default;
          return `<img${before}src="${placeholder}"${after}>`;
        }
        return match;
      }
    );
    
    // Fix background images in style attributes
    html = html.replace(
      /background-image:\s*url\(['"]?([^'")]+)['"]?\)/gi,
      (match, url) => {
        if (!url || url === 'undefined' || !url.startsWith('http')) {
          updated = true;
          fixCount++;
          return `background-image: url('${placeholders.hero}')`;
        }
        return match;
      }
    );
    
    // Fix background shorthand property
    html = html.replace(
      /background:\s*([^;]*?)url\(['"]?([^'")]+)['"]?\)([^;]*?);/gi,
      (match, before, url, after) => {
        if (!url || url === 'undefined' || !url.startsWith('http')) {
          updated = true;
          fixCount++;
          return `background: ${before}url('${placeholders.hero}')${after};`;
        }
        return match;
      }
    );
    
    if (updated) {
      const { error: updateError } = await supabase
        .from('website_previews')
        .update({ html_content: html })
        .eq('id', preview.id);
      
      if (updateError) {
        console.error(`❌ Failed to update preview ${preview.id}:`, updateError);
      } else {
        console.log(`✅ Fixed ${fixCount} images for preview: ${preview.id} (Business: ${preview.business_id})`);
        totalFixed++;
      }
    }
  }
  
  console.log('\n================================================');
  console.log(`✨ All done! Fixed images in ${totalFixed} previews`);
}

// Run the fix
fixAllImages().catch(console.error);
