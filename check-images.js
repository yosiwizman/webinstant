import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkImages() {
  console.log('Checking image URLs in previews...\n');
  
  const { data: previews } = await supabase
    .from('website_previews')
    .select('id, business_id, html_content')
    .in('business_id', [
      'a5ca2655-f415-4e43-888f-1c5cc1e387fb', // Joe's Pizza
      'd3c40ae9-add7-4b7a-a9f5-0b32037ca0ce'  // Sunshine Cleaners
    ]);
  
  previews?.forEach(preview => {
    console.log(`\nPreview: ${preview.id}`);
    console.log('='.repeat(50));
    
    // Extract all img tags
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;
    let imgCount = 0;
    
    while ((match = imgRegex.exec(preview.html_content)) !== null) {
      imgCount++;
      console.log(`  Image ${imgCount}: ${match[1]}`);
    }
    
    if (imgCount === 0) {
      console.log('  No images found');
    }
  });
}

checkImages();
