import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { business_id } = body;

    let businessesToProcess = [];
    
    if (business_id) {
      // Generate preview for specific business
      console.log('Generating preview for business:', business_id);
      
      const { data: business, error: fetchError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', business_id)
        .single();

      if (fetchError || !business) {
        console.error('Error fetching business:', fetchError);
        return NextResponse.json(
          { error: 'Business not found' },
          { status: 404 }
        );
      }
      
      businessesToProcess = [business];
    } else {
      // Generate previews for ALL businesses without previews
      console.log('Generating previews for all businesses without previews');
      
      // First, get all businesses
      const { data: allBusinesses, error: fetchError } = await supabase
        .from('businesses')
        .select('*');

      if (fetchError) {
        console.error('Error fetching businesses:', fetchError);
        return NextResponse.json(
          { error: 'Failed to fetch businesses' },
          { status: 500 }
        );
      }

      // Get existing previews to filter out businesses that already have them
      const { data: existingPreviews, error: previewError } = await supabase
        .from('website_previews')
        .select('business_id');

      if (previewError) {
        console.error('Error fetching existing previews:', previewError);
        // Continue anyway - we'll just regenerate all
        businessesToProcess = allBusinesses || [];
      } else {
        // Filter out businesses that already have previews
        const existingBusinessIds = new Set(existingPreviews?.map(p => p.business_id) || []);
        businessesToProcess = (allBusinesses || []).filter(b => !existingBusinessIds.has(b.id));
      }

      console.log(`Found ${businessesToProcess.length} businesses without previews`);
    }

    // Generate previews for each business
    let generatedCount = 0;
    const errors = [];

    for (const business of businessesToProcess) {
      try {
        // Generate simple HTML template
        const htmlContent = generateSimpleHTML(business);
        
        // Insert into website_previews table
        const { data: preview, error: insertError } = await supabase
          .from('website_previews')
          .upsert({
            business_id: business.id,
            html_content: htmlContent,
            preview_url: `/preview/${business.id}`,
            template_type: 'simple',
            metadata: {
              generated_at: new Date().toISOString(),
              business_name: business.business_name,
              template_version: '1.0'
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'business_id'
          })
          .select()
          .single();

        if (insertError) {
          console.error(`Error creating preview for business ${business.id}:`, insertError);
          errors.push({
            business_id: business.id,
            business_name: business.business_name,
            error: insertError.message
          });
        } else {
          generatedCount++;
          console.log(`Preview generated for ${business.business_name} (${business.id})`);
        }
      } catch (error) {
        console.error(`Error processing business ${business.id}:`, error);
        errors.push({
          business_id: business.id,
          business_name: business.business_name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Return success response
    const response: any = {
      success: true,
      generated: generatedCount,
      total: businessesToProcess.length
    };

    if (errors.length > 0) {
      response.errors = errors;
      response.message = `Generated ${generatedCount} out of ${businessesToProcess.length} previews`;
    } else {
      response.message = `Successfully generated ${generatedCount} preview(s)`;
    }

    return NextResponse.json(response);

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

function generateSimpleHTML(business: any): string {
  // Escape HTML to prevent XSS
  const escapeHtml = (text: string): string => {
    if (!text) return '';
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  };

  const businessName = escapeHtml(business.business_name || 'Business');
  const address = escapeHtml(business.address || '');
  const city = escapeHtml(business.city || '');
  const state = escapeHtml(business.state || '');
  const phone = escapeHtml(business.phone || '');
  const email = escapeHtml(business.email || '');
  const zipCode = escapeHtml(business.zip_code || '');

  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${businessName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            background: white;
            border-radius: 10px;
            padding: 40px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        h1 {
            color: #667eea;
            margin-bottom: 30px;
            font-size: 2.5em;
            text-align: center;
        }
        .info-section {
            margin: 20px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .info-item {
            margin: 15px 0;
            font-size: 1.1em;
        }
        .label {
            font-weight: bold;
            color: #667eea;
            display: inline-block;
            min-width: 100px;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #e2e8f0;
            color: #718096;
        }
        a {
            color: #667eea;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Welcome to ${businessName}</h1>
        
        <div class="info-section">
            <h2 style="color: #764ba2; margin-bottom: 20px;">Contact Information</h2>
            
            ${address ? `
            <div class="info-item">
                <span class="label">Address:</span>
                <span>${address}${city ? `, ${city}` : ''}${state ? `, ${state}` : ''}${zipCode ? ` ${zipCode}` : ''}</span>
            </div>
            ` : ''}
            
            ${phone ? `
            <div class="info-item">
                <span class="label">Phone:</span>
                <span><a href="tel:${phone}">${phone}</a></span>
            </div>
            ` : ''}
            
            ${email ? `
            <div class="info-item">
                <span class="label">Email:</span>
                <span><a href="mailto:${email}">${email}</a></span>
            </div>
            ` : ''}
        </div>
        
        <div class="info-section">
            <h2 style="color: #764ba2; margin-bottom: 20px;">About Us</h2>
            <p>Welcome to ${businessName}! We are dedicated to providing excellent service to our customers in ${city ? city : 'our area'}${state ? `, ${state}` : ''}. Contact us today to learn more about what we can do for you.</p>
        </div>
        
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${businessName}. All rights reserved.</p>
            <p style="font-size: 0.9em; margin-top: 10px;">Website generated on ${new Date().toLocaleDateString()}</p>
        </div>
    </div>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Website preview generator endpoint',
    method: 'POST',
    body: {
      business_id: 'string (optional) - The ID of a specific business to generate preview for. If omitted, generates for all businesses without previews.'
    },
    response: {
      success: 'boolean - Whether the operation was successful',
      generated: 'number - Count of previews generated',
      total: 'number - Total businesses processed',
      message: 'string - Status message',
      errors: 'array (optional) - List of any errors encountered'
    },
    description: 'Generates simple HTML website previews for businesses and stores them in the website_previews table'
  });
}
