import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

// Helper function to validate URL
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Helper function to generate error image
function generateErrorImage(): Buffer {
  // Simple 1x1 transparent PNG as fallback
  const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  return Buffer.from(base64, 'base64');
}

export async function GET(request: NextRequest) {
  let browser = null;
  const searchParams = request.nextUrl.searchParams;
  const targetUrl = searchParams.get('url');
  
  try {
    // Validate URL parameter
    if (!targetUrl) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    if (!isValidUrl(targetUrl)) {
      console.error(`Invalid URL format: ${targetUrl}`);
      return NextResponse.json(
        { error: 'Invalid URL format. Please provide a valid HTTP or HTTPS URL.' },
        { status: 400 }
      );
    }

    console.log(`Capturing screenshot for: ${targetUrl}`);

    // Launch puppeteer with optimized settings
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });

    // Create a new page
    const page = await browser.newPage();

    // Set viewport to standard email preview size
    await page.setViewport({
      width: 1200,
      height: 630,
      deviceScaleFactor: 1
    });

    // Set reasonable timeout
    page.setDefaultNavigationTimeout(30000);

    // Navigate to the URL and wait for network idle
    await page.goto(targetUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Take screenshot
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false,
      encoding: 'binary'
    });

    // Close the browser
    await browser.close();
    browser = null;

    // Create response with image and caching headers
    const response = new NextResponse(Buffer.from(screenshot), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
        'X-Screenshot-URL': targetUrl,
        'X-Screenshot-Timestamp': new Date().toISOString()
      }
    });

    return response;

  } catch (error) {
    // Log error with the exact URL that failed for debugging
    console.error(`Screenshot capture failed for URL: ${targetUrl}`);
    console.error('Error details:', error);
    
    // Clean up browser if it's still open
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Failed to close browser:', closeError);
      }
    }

    // Return fallback error image
    const errorImage = generateErrorImage();
    
    return new NextResponse(errorImage, {
      status: 500,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache',
        'X-Error': 'Screenshot generation failed',
        'X-Failed-URL': targetUrl || 'unknown'
      }
    });
  }
}
