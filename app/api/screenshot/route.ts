import { NextRequest, NextResponse } from 'next/server';

// Helper function to validate URL
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Helper function to generate a nice placeholder image
function generatePlaceholderSVG(businessName?: string): string {
  const name = businessName || 'Your Business';
  return `
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#grad)"/>
      <rect x="50" y="50" width="1100" height="530" fill="white" rx="10"/>
      <text x="600" y="200" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#333" text-anchor="middle">
        ${name}
      </text>
      <text x="600" y="280" font-family="Arial, sans-serif" font-size="24" fill="#666" text-anchor="middle">
        Your professional website is ready!
      </text>
      <rect x="450" y="350" width="300" height="60" fill="#667eea" rx="30"/>
      <text x="600" y="390" font-family="Arial, sans-serif" font-size="20" fill="white" text-anchor="middle">
        View Website
      </text>
    </svg>
  `;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const targetUrl = searchParams.get('url');
  
  try {
    // If no URL provided, return a generic placeholder
    if (!targetUrl) {
      const svg = generatePlaceholderSVG();
      
      return new NextResponse(svg, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    // Validate URL format
    if (!isValidUrl(targetUrl)) {
      console.error(`Invalid URL format: ${targetUrl}`);
      const svg = generatePlaceholderSVG();
      
      return new NextResponse(svg, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    console.log(`Generating screenshot placeholder for: ${targetUrl}`);

    // Try to extract business name from URL if possible
    let businessName = 'Your Business';
    try {
      const url = new URL(targetUrl);
      const pathParts = url.pathname.split('/');
      if (pathParts.length > 2 && pathParts[1] === 'preview') {
        // This is a preview URL, we could potentially fetch the business name
        // For now, just use a generic name
        businessName = 'Your Business';
      }
    } catch (e) {
      // Ignore URL parsing errors
    }

    // Generate a nice placeholder image
    const svg = generatePlaceholderSVG(businessName);
    
    return new NextResponse(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
        'X-Screenshot-URL': targetUrl,
        'X-Screenshot-Type': 'placeholder'
      }
    });

  } catch (error) {
    console.error(`Screenshot generation error:`, error);
    
    // Return error placeholder image
    const svg = generatePlaceholderSVG();
    
    return new NextResponse(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache'
      }
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, html, businessName } = body;
    
    // Generate a placeholder screenshot
    const svg = generatePlaceholderSVG(businessName);
    
    // Convert SVG to base64 data URL
    const base64 = Buffer.from(svg).toString('base64');
    const dataUrl = `data:image/svg+xml;base64,${base64}`;
    
    return NextResponse.json({
      success: true,
      screenshot: dataUrl,
      message: 'Screenshot generated (placeholder)',
      type: 'placeholder'
    });
    
  } catch (error) {
    console.error('Screenshot generation error:', error);
    
    // Return a data URL for error case
    const svg = generatePlaceholderSVG();
    const base64 = Buffer.from(svg).toString('base64');
    const dataUrl = `data:image/svg+xml;base64,${base64}`;
    
    return NextResponse.json({
      success: false,
      error: 'Failed to generate screenshot',
      screenshot: dataUrl,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
