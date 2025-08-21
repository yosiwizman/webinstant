const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugImageIssues() {
  console.log('🔍 DEEP IMAGE DEBUGGING\n');
  console.log('='.repeat(60));
  
  // Check Joe's Pizza specifically
  const { data: joesPizza } = await supabase
    .from('website_previews')
    .select('*')
    .eq('id', 'a5ca2655-f415-4e43-888f-1c5cc1e387fb')
    .single();
    
  if (joesPizza) {
    console.log('\n🍕 JOE\'S PIZZA ANALYSIS:');
    console.log('-'.repeat(40));
    
    // Check for template variables
    const templateVarRegex = /\$\{[^}]+\}/g;
    const templateVars = joesPizza.html_content.match(templateVarRegex);
    
    if (templateVars) {
      console.log('⚠️ FOUND UNPROCESSED TEMPLATE VARIABLES:');
      templateVars.forEach(v => console.log(`   - ${v}`));
    }
    
    // Check for broken image patterns
    const brokenPatterns = [
      /src="\$\{[^}]+\}"/gi,
      /src='undefined'/gi,
      /src="undefined"/gi,
      /src="null"/gi,
      /src='null'/gi,
      /src=""/gi,
      /src=''/gi
    ];
    
    console.log('\n🔍 CHECKING FOR BROKEN PATTERNS:');
    brokenPatterns.forEach((pattern, i) => {
      const matches = joesPizza.html_content.match(pattern);
      if (matches) {
        console.log(`   Pattern ${i+1}: Found ${matches.length} instances`);
        console.log(`   Sample: ${matches[0]}`);
      }
    });
    
    // Extract all img tags to see exactly what's there
    const imgRegex = /<img[^>]+>/gi;
    const imgTags = joesPizza.html_content.match(imgRegex);
    
    console.log('\n📷 ALL IMG TAGS (first 3):');
    imgTags?.slice(0, 3).forEach((tag, i) => {
      console.log(`\n   ${i+1}. ${tag.substring(0, 200)}${tag.length > 200 ? '...' : ''}`);
    });
  }
  
  // Check all previews for similar issues
  console.log('\n\n🔍 CHECKING ALL PREVIEWS FOR TEMPLATE VARIABLES:');
  console.log('='.repeat(60));
  
  const { data: allPreviews } = await supabase
    .from('website_previews')
    .select('id, business_id');
    
  for (const preview of allPreviews || []) {
    const { data } = await supabase
      .from('website_previews')
      .select('html_content')
      .eq('id', preview.id)
      .single();
      
    if (data?.html_content.includes('${')) {
      console.log(`\n⚠️ ${preview.id} has template variables!`);
      const vars = data.html_content.match(/\$\{[^}]+\}/g);
      console.log(`   Found: ${vars?.slice(0, 3).join(', ')}`);
    }
  }
}

debugImageIssues();
