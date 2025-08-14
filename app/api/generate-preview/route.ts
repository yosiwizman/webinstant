import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // Parse request body - it might be empty
    let businessId: string | undefined;
    try {
      const body = await request.json();
      businessId = body.businessId;
    } catch {
      // No body provided, will generate for all
      businessId = undefined;
    }

    let businessesToProcess = [];
    
    if (businessId) {
      // Generate preview for specific business
      console.log('Generating preview for business:', businessId);
      
      const { data: business, error: fetchError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();

      if (fetchError || !business) {
        console.error('Error fetching business:', fetchError);
        return NextResponse.json(
          { success: false, error: 'Business not found' },
          { status: 404 }
        );
      }
      
      businessesToProcess = [business];
    } else {
      // Generate previews for all businesses without previews
      console.log('Finding businesses without previews');
      
      // Get all businesses
      const { data: allBusinesses, error: fetchError } = await supabase
        .from('businesses')
        .select('*');

      if (fetchError) {
        console.error('Error fetching businesses:', fetchError);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch businesses' },
          { status: 500 }
        );
      }

      // Get existing previews to filter out businesses that already have them
      const { data: existingPreviews, error: previewError } = await supabase
        .from('website_previews')
        .select('business_id');

      if (previewError) {
        console.error('Error fetching existing previews:', previewError);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch existing previews' },
          { status: 500 }
        );
      }

      // Filter out businesses that already have previews
      const existingBusinessIds = new Set(existingPreviews?.map(p => p.business_id) || []);
      businessesToProcess = (allBusinesses || []).filter(b => !existingBusinessIds.has(b.id));

      console.log(`Found ${businessesToProcess.length} businesses without previews`);
    }

    // Generate previews for each business
    let generatedCount = 0;

    for (const business of businessesToProcess) {
      try {
        // Generate HTML using the simple template
        const htmlContent = generateHTML(business);
        
        // Insert preview into database
        const { data: insertedPreview, error: insertError } = await supabase
          .from('website_previews')
          .insert({
            business_id: business.id,
            html_content: htmlContent,
            preview_url: `/preview/${business.id}`,
            template_used: 'basic'
          })
          .select()
          .single();

        if (insertError) {
          // Check if it's a duplicate key error
          if (insertError.code === '23505') {
            // Update existing preview instead
            const { error: updateError } = await supabase
              .from('website_previews')
              .update({
                html_content: htmlContent,
                preview_url: `/preview/${business.id}`,
                template_used: 'basic'
              })
              .eq('business_id', business.id);

            if (updateError) {
              console.error(`Error updating preview for business ${business.id}:`, updateError);
              continue;
            }
          } else {
            console.error(`Error creating preview for business ${business.id}:`, insertError);
            continue;
          }
        }

        generatedCount++;
        console.log(`Preview generated for ${business.business_name} (${business.id})`);
        
      } catch (error) {
        console.error(`Error processing business ${business.id}:`, error);
      }
    }

    // Return success response
    return NextResponse.json({
      success: true,
      count: generatedCount
    });

  } catch (error) {
    console.error('Error in generate-preview endpoint:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

function generateHTML(business: any): string {
  // Safely get values with fallbacks
  const businessName = business.business_name || 'Business';
  const address = business.address || '';
  const city = business.city || '';
  const state = business.state || '';
  const phone = business.phone || '';
  const email = business.email || '';

  // Build the HTML template
  return `<!DOCTYPE html>
<html>
<head>
  <title>${businessName}</title>
  <style>
    body { font-family: Arial; padding: 40px; }
    h1 { color: #333; }
    .info { margin: 20px 0; }
  </style>
</head>
<body>
  <h1>Welcome to ${businessName}</h1>
  <div class="info">
    <p><strong>Address:</strong> ${address}, ${city}, ${state}</p>
    <p><strong>Phone:</strong> ${phone}</p>
    <p><strong>Email:</strong> ${email}</p>
  </div>
  <p>Your professional website is coming soon!</p>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Website preview generator endpoint',
    method: 'POST',
    body: {
      businessId: 'string (optional) - The ID of a specific business to generate preview for. If omitted, generates for all businesses without previews.'
    },
    response: {
      success: 'boolean - Whether the operation was successful',
      count: 'number - Number of previews generated'
    }
  });
}
