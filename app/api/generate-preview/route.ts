import { NextRequest, NextResponse } from 'next/server';
import { createWebsiteGenerator } from '@/lib/websiteGenerator';

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

    const generator = createWebsiteGenerator();
    const result = await generator.generateWebsite(business_id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate website' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      previewUrl: result.previewUrl,
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
