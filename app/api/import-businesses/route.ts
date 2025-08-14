import { NextRequest, NextResponse } from 'next/server';
import { createBusinessImporter } from '@/lib/businessImporter';

export async function POST(request: NextRequest) {
  console.log('=== Starting business import API call ===');
  
  try {
    // Parse the form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.error('No file provided in request');
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log('File details:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    // Check file type
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv' && file.type !== 'application/vnd.ms-excel') {
      console.error('Invalid file type:', file.type);
      return NextResponse.json(
        { error: 'File must be a CSV' },
        { status: 400 }
      );
    }

    // Check file size (limit to 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      console.error('File too large:', file.size);
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    // Read file content as text
    console.log('Reading file content...');
    const csvContent = await file.text();
    console.log('CSV content length:', csvContent.length);
    console.log('First 500 characters of CSV:', csvContent.substring(0, 500));

    if (!csvContent.trim()) {
      console.error('CSV file is empty');
      return NextResponse.json(
        { error: 'CSV file is empty' },
        { status: 400 }
      );
    }

    // Create importer instance and import businesses
    console.log('Creating business importer...');
    const importer = createBusinessImporter();
    
    console.log('Starting import process...');
    const statistics = await importer.importFromCSV(csvContent);
    
    console.log('Import completed with statistics:', statistics);

    // Return success response with statistics
    return NextResponse.json({
      success: true,
      message: `Successfully imported ${statistics.imported} businesses`,
      statistics: {
        total: statistics.total,
        imported: statistics.imported,
        skipped: statistics.skipped,
        duplicates: statistics.duplicates,
        errors: statistics.errors,
        errorDetails: statistics.errorDetails.slice(0, 100) // Limit error details to first 100
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Import error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Import failed',
        message: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Optional: Add GET method to check endpoint status
export async function GET() {
  return NextResponse.json({
    message: 'Business import endpoint is ready',
    acceptedFormat: 'CSV',
    requiredColumns: [
      'business_name',
      'address',
      'city',
      'state',
      'zip',
      'phone',
      'email'
    ],
    maxFileSize: '10MB',
    sampleCSV: 'business_name,address,city,state,zip,phone,email\nJoe\'s Pizza,123 Main St,Miami,FL,33131,305-555-0001,joe@example.com',
    instructions: 'Upload a CSV file with the required columns. Each business will be imported with has_website set to false.'
  });
}
