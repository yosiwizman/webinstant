import { NextRequest, NextResponse } from 'next/server';
import { createContentGenerator } from '@/lib/contentGenerator';
import { supabase } from '@/lib/supabase';
import { renderToStaticMarkup } from 'react-dom/server';
import RestaurantTemplate from '@/components/templates/RestaurantTemplate';
import React from 'react';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { business_id } = body;

    if (!business_id) {
      return NextResponse.json(
        { error: 'business_id is required' },
        { status: 400 }
      );
    }

    console.log('Generating preview for business:', business_id);

    // 1. Fetch business data from Supabase
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

    console.log('Business data:', business);

    // 2. Generate AI content
    const contentGenerator = createContentGenerator();
    const generatedContent = await contentGenerator.generateContent({
      businessName: business.business_name,
      businessType: inferBusinessType(business.business_name),
      address: business.address,
      city: business.city,
      state: business.state
    });

    console.log('Generated content:', generatedContent);

    // 3. Determine business type and select template
    const businessType = inferBusinessType(business.business_name);
    
    // 4. Prepare template data
    const templateData = {
      businessName: business.business_name,
      address: business.address || '',
      phone: business.phone || '',
      hours: {
        'Monday-Friday': '9:00 AM - 6:00 PM',
        'Saturday': '10:00 AM - 4:00 PM',
        'Sunday': 'Closed'
      },
      tagline: generatedContent.tagline,
      aboutUs: generatedContent.aboutUs,
      services: generatedContent.servicesDescription,
      email: business.email || '',
      city: business.city || '',
      state: business.state || '',
      zipCode: business.zip_code || ''
    };

    // 5. Render template to HTML string
    let htmlContent = '';
    
    if (businessType === 'restaurant') {
      // For restaurant businesses
      htmlContent = renderToStaticMarkup(
        React.createElement(RestaurantTemplate, templateData)
      );
    } else {
      // For service businesses (plumbing, etc.) - create a simple service template
      htmlContent = generateServiceTemplate(templateData);
    }

    // Wrap in complete HTML document
    const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${business.business_name} - Professional Website</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem 0; text-align: center; }
        .header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
        .header p { font-size: 1.2rem; opacity: 0.9; }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .section { margin-bottom: 3rem; }
        .section h2 { color: #667eea; margin-bottom: 1rem; font-size: 2rem; }
        .contact-info { background: #f8f9fa; padding: 2rem; border-radius: 8px; margin-top: 2rem; }
        .contact-info h3 { color: #667eea; margin-bottom: 1rem; }
        .contact-item { margin-bottom: 0.5rem; }
        .services { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-top: 1.5rem; }
        .service-card { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .footer { background: #2d3748; color: white; text-align: center; padding: 2rem 0; margin-top: 3rem; }
        .hours-table { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .hours-table table { width: 100%; border-collapse: collapse; }
        .hours-table th, .hours-table td { padding: 1rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
        .hours-table th { background: #667eea; color: white; }
    </style>
</head>
<body>
    ${htmlContent}
</body>
</html>`;

    // 6. Create data URL from HTML
    const base64Html = Buffer.from(fullHtml).toString('base64');
    const dataUrl = `data:text/html;base64,${base64Html}`;

    // 7. Store in generated_websites table
    const { data: websiteRecord, error: insertError } = await supabase
      .from('generated_websites')
      .upsert({
        business_id: business_id,
        preview_url: dataUrl,
        template_used: businessType,
        content: {
          tagline: generatedContent.tagline,
          aboutUs: generatedContent.aboutUs,
          services: generatedContent.servicesDescription
        },
        generated_at: new Date().toISOString()
      }, {
        onConflict: 'business_id'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error storing website record:', insertError);
      // Continue anyway - we have the preview
    }

    // 8. Return success with preview URL
    return NextResponse.json({
      success: true,
      previewUrl: dataUrl,
      businessId: business_id,
      businessName: business.business_name,
      templateUsed: businessType,
      message: 'Website preview generated successfully'
    });

  } catch (error) {
    console.error('Error in generate-preview endpoint:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

function inferBusinessType(businessName: string): string {
  const name = businessName.toLowerCase();
  
  // Restaurant keywords
  if (/restaurant|pizza|food|cafe|bakery|diner|grill|bistro|kitchen|eat|burger|sushi|thai|chinese|mexican|italian/.test(name)) {
    return 'restaurant';
  }
  
  // Service business keywords
  if (/plumb|electric|hvac|repair|service|contractor|construction|landscap|clean|maintenance|automotive|mechanic/.test(name)) {
    return 'service';
  }
  
  // Retail keywords
  if (/store|shop|boutique|market|mart|retail|supply|outlet/.test(name)) {
    return 'retail';
  }
  
  // Default to service
  return 'service';
}

function generateServiceTemplate(data: any): string {
  return `
    <div class="header">
        <h1>${data.businessName}</h1>
        <p>${data.tagline}</p>
    </div>
    
    <div class="container">
        <div class="section">
            <h2>About Us</h2>
            <p>${data.aboutUs}</p>
        </div>
        
        <div class="section">
            <h2>Our Services</h2>
            <p>${data.services}</p>
            <div class="services">
                <div class="service-card">
                    <h3>Professional Service</h3>
                    <p>We provide top-quality professional services with attention to detail.</p>
                </div>
                <div class="service-card">
                    <h3>Expert Team</h3>
                    <p>Our experienced team is dedicated to exceeding your expectations.</p>
                </div>
                <div class="service-card">
                    <h3>Customer Satisfaction</h3>
                    <p>Your satisfaction is our top priority. We guarantee our work.</p>
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>Business Hours</h2>
            <div class="hours-table">
                <table>
                    <thead>
                        <tr>
                            <th>Day</th>
                            <th>Hours</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(data.hours).map(([day, hours]) => `
                            <tr>
                                <td>${day}</td>
                                <td>${hours}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="contact-info">
            <h3>Contact Us</h3>
            <div class="contact-item"><strong>Phone:</strong> ${data.phone}</div>
            <div class="contact-item"><strong>Email:</strong> ${data.email}</div>
            <div class="contact-item"><strong>Address:</strong> ${data.address}, ${data.city}, ${data.state} ${data.zipCode}</div>
        </div>
    </div>
    
    <div class="footer">
        <p>&copy; ${new Date().getFullYear()} ${data.businessName}. All rights reserved.</p>
        <p>Generated with AI-Powered Website Builder</p>
    </div>
  `;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const businessId = searchParams.get('business_id');

  if (!businessId) {
    return NextResponse.json({
      message: 'Website preview generator endpoint',
      method: 'POST',
      requiredParams: {
        business_id: 'string - The ID of the business to generate preview for'
      },
      description: 'Generates a website preview for the specified business using AI-generated content and appropriate templates'
    });
  }

  // If business_id is provided in GET, redirect to POST
  return NextResponse.json(
    { 
      error: 'Please use POST method to generate preview',
      requiredBody: { business_id: businessId }
    },
    { status: 405 }
  );
}
