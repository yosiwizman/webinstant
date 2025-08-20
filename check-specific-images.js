import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSpecificImages() {
  console.log('Checking specific preview images...\n');
  
  // Get the specific previews we're having issues with
  const { data: previews } = await supabase
    .from('website_previews')
    .select('id, business_id, html_content')
    .in('id', [
      'd3c40ae9-add7-4b7a-a9f5-0b32037ca0ce', // Sunshine Cleaners
      'a5ca2655-f415-4e43-888f-1c5cc1e387fb'  // Joe's Pizza
    ]);
  
  previews?.forEach(preview => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Preview ID: ${preview.id}`);
    console.log(`Business ID: ${preview.business_id}`);
    console.log(`${'='.repeat(60)}`);
    
    // Check for img tags
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const images = [];
    let match;
    
    while ((match = imgRegex.exec(preview.html_content)) !== null) {
      images.push(match[1]);
    }
    
    console.log(`\nFound ${images.length} <img> tags:`);
    images.forEach((src, i) => {
      console.log(`  ${i+1}. ${src.substring(0, 100)}${src.length > 100 ? '...' : ''}`);
    });
    
    // Check for background images
    const bgRegex = /background(?:-image)?:\s*url\(['"]?([^'")]+)['"]?\)/gi;
    const bgImages = [];
    
    while ((match = bgRegex.exec(preview.html_content)) !== null) {
      bgImages.push(match[1]);
    }
    
    console.log(`\nFound ${bgImages.length} background images:`);
    bgImages.forEach((src, i) => {
      console.log(`  ${i+1}. ${src.substring(0, 100)}${src.length > 100 ? '...' : ''}`);
    });
    
    // Check if HTML contains the word "Professional" (from placeholder)
    if (preview.html_content.includes('Professional+Website')) {
      console.log('\n⚠️ Contains placeholder image text');
    }
  });
}

checkSpecificImages();
