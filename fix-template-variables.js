const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixTemplateVariables() {
  console.log('🔧 FIXING TEMPLATE VARIABLES IN HTML\n');
  
  const { data: previews } = await supabase
    .from('website_previews')
    .select('*');
    
  const pizzaImage = 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=600&fit=crop';
  const defaultImage = 'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=800&h=600&fit=crop';
  
  for (const preview of previews || []) {
    let html = preview.html_content;
    let updated = false;
    
    // Fix template variables like ${img.src}, ${image}, etc.
    if (html.includes('${')) {
      console.log(`\n🍕 Fixing preview: ${preview.id}`);
      
      // Replace all template variables with actual images
      html = html.replace(/\$\{[^}]+\}/g, (match) => {
        updated = true;
        console.log(`   Replacing: ${match}`);
        
        // Use appropriate image based on business type
        if (preview.template_used?.includes('restaurant') || 
            preview.html_content?.includes('Pizza')) {
          return pizzaImage;
        }
        return defaultImage;
      });
      
      // Also fix any src="" or src='' 
      html = html.replace(/src=["'][\s]*["']/gi, `src="${defaultImage}"`);
    }
    
    if (updated) {
      await supabase
        .from('website_previews')
        .update({ html_content: html })
        .eq('id', preview.id);
        
      console.log(`   ✅ Fixed and saved!`);
    }
  }
  
  console.log('\n✨ Template variable fix complete!');
}

fixTemplateVariables();
