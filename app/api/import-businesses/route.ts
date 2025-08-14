import { NextRequest, NextResponse } from 'next/server';
import { createBusinessImporter } from '@/lib/businessImporter';

export async function POST(request: NextRequest) {
  try {
    // Parse the form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Check file type
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      return NextResponse.json(
        { error: 'File must be a CSV' },
        { status: 400 }
      );
    }

    // Check file size (limit to 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    // Read file content
    const csvContent = await file.text();

    if (!csvContent.trim()) {
      return NextResponse.json(
        { error: 'CSV file is empty' },
        { status: 400 }
      );
    }

    // Create importer and process the CSV
    const importer = createBusinessImporter();
    const statistics = await importer.importFromCSV(csvContent);

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
        message: errorMessage
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
    maxFileSize: '10MB'
  });
}
