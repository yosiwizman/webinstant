import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function forceFixImages() {
  console.log('Force fixing ALL images with Unsplash photos...\n');
  
  // High-quality Unsplash images for different business types
  const imagesByType = {
    restaurant: {
      hero: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1600&h=900&fit=crop',
      gallery: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=600&fit=crop'
    },
    cleaning: {
      hero: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1600&h=900&fit=crop',
      gallery: 'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=800&h=600&fit=crop'
    },
    beauty: {
      hero: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1600&h=900&fit=crop',
      gallery: 'https://images.unsplash.com/photo-1522337094846-8a818192de1f?w=800&h=600&fit=crop'
    },
    auto: {
      hero: 'https://images.unsplash.com/photo-1625047509248-ec889cbff17f?w=1600&h=900&fit=crop',
      gallery: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=800&h=600&fit=crop'
    },
    default: {
      hero: 'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=1600&h=900&fit=crop',
      gallery: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800&h=600&fit=crop'
    }
  };
  
  const { data: previews } = await supabase
    .from('website_previews')
    .select('*');
  
  for (const preview of previews || []) {
    let type = 'default';
    
    // Determine business type from template or content
    if (preview.template_used?.includes('restaurant') || preview.html_content?.includes('Pizza')) {
      type = 'restaurant';
    } else if (preview.template_used?.includes('cleaning') || preview.html_content?.includes('Cleaners')) {
      type = 'cleaning';
    } else if (preview.template_used?.includes('beauty') || preview.html_content?.includes('Salon')) {
      type = 'beauty';
    } else if (preview.template_used?.includes('auto') || preview.html_content?.includes('Auto')) {
      type = 'auto';
    }
    
    const images = imagesByType[type];
    let html = preview.html_content;
    let changeCount = 0;
    
    // Replace ALL img src attributes
    html = html.replace(/<img([^>]*?)src=["'][^"']*["']([^>]*?)>/gi, (match, before, after) => {
      changeCount++;
      const isHero = (before + after).toLowerCase().includes('hero');
      const newSrc = isHero ? images.hero : images.gallery;
      return `<img${before}src="${newSrc}"${after}>`;
    });
    
    // Replace ALL background images
    html = html.replace(/background-image:\s*url\([^)]+\)/gi, () => {
      changeCount++;
      return `background-image: url('${images.hero}')`;
    });
    
    html = html.replace(/background:\s*([^;]*?)url\([^)]+\)([^;]*?);/gi, (match, before, after) => {
      changeCount++;
      return `background: ${before}url('${images.hero}')${after};`;
    });
    
    if (changeCount > 0) {
      await supabase
        .from('website_previews')
        .update({ html_content: html })
        .eq('id', preview.id);
      
      console.log(`✅ Fixed ${changeCount} images for ${preview.id} (Type: ${type})`);
    }
  }
  
  console.log('\n✅ Force fix complete!');
}

forceFixImages();
