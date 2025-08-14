import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface BusinessRow {
  business_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
}

interface ImportStatistics {
  total: number;
  imported: number;
  skipped: number;
  duplicates: number;
  errors: number;
  errorDetails: Array<{
    row: number;
    error: string;
    data?: Partial<BusinessRow>;
  }>;
}

export async function POST(request: NextRequest) {
  const stats: ImportStatistics = {
    total: 0,
    imported: 0,
    skipped: 0,
    duplicates: 0,
    errors: 0,
    errorDetails: []
  };

  try {
    console.log('Starting business import...');
    
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

    // Read file content
    const csvContent = await file.text();
    console.log('CSV content length:', csvContent.length);

    if (!csvContent.trim()) {
      return NextResponse.json(
        { error: 'CSV file is empty' },
        { status: 400 }
      );
    }

    // Parse CSV content
    const businesses = parseCSV(csvContent);
    stats.total = businesses.length;
    console.log(`Parsed ${businesses.length} businesses from CSV`);

    if (businesses.length === 0) {
      return NextResponse.json(
        { error: 'No valid data found in CSV' },
        { status: 400 }
      );
    }

    // Get existing businesses to check for duplicates
    const { data: existingBusinesses, error: fetchError } = await supabase
      .from('businesses')
      .select('email, phone');

    if (fetchError) {
      console.error('Error fetching existing businesses:', fetchError);
      throw new Error('Failed to check for existing businesses');
    }

    // Create sets for duplicate checking
    const existingEmails = new Set(
      existingBusinesses?.filter(b => b.email).map(b => b.email.toLowerCase()) || []
    );
    const existingPhones = new Set(
      existingBusinesses?.filter(b => b.phone).map(b => normalizePhone(b.phone)) || []
    );

    console.log(`Found ${existingEmails.size} existing emails and ${existingPhones.size} existing phones`);

    // Process businesses in batches
    const batchSize = 50;
    const businessesToInsert = [];
    const processedRows = new Map<number, BusinessRow>();

    for (let i = 0; i < businesses.length; i++) {
      const business = businesses[i];
      const rowNumber = i + 2; // +2 because row 1 is headers, and arrays are 0-indexed
      processedRows.set(rowNumber, business);

      try {
        // Validate business data
        const validation = validateBusiness(business, rowNumber);
        if (!validation.isValid) {
          stats.errors++;
          stats.errorDetails.push({
            row: rowNumber,
            error: validation.errors.join('; '),
            data: business
          });
          continue;
        }

        // Check for duplicates
        const normalizedPhone = normalizePhone(business.phone);
        const normalizedEmail = business.email.toLowerCase();

        if (existingEmails.has(normalizedEmail)) {
          stats.duplicates++;
          stats.skipped++;
          stats.errorDetails.push({
            row: rowNumber,
            error: `Duplicate email: ${business.email}`,
            data: business
          });
          continue;
        }

        if (existingPhones.has(normalizedPhone)) {
          stats.duplicates++;
          stats.skipped++;
          stats.errorDetails.push({
            row: rowNumber,
            error: `Duplicate phone: ${business.phone}`,
            data: business
          });
          continue;
        }

        // Prepare business for insertion
        const businessToInsert = {
          business_name: business.business_name.trim(),
          address: business.address.trim(),
          city: business.city.trim(),
          state: business.state.trim().toUpperCase(),
          zip: business.zip.trim(),
          phone: business.phone.trim(),
          email: business.email.trim().toLowerCase(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        businessesToInsert.push({ data: businessToInsert, rowNumber });

        // Add to existing sets to prevent duplicates within the same import
        existingEmails.add(normalizedEmail);
        existingPhones.add(normalizedPhone);

        // Insert in batches
        if (businessesToInsert.length >= batchSize) {
          const dataToInsert = businessesToInsert.map(item => item.data);
          const { data: insertedData, error: insertError } = await supabase
            .from('businesses')
            .insert(dataToInsert)
            .select();

          if (insertError) {
            console.error('Batch insert error:', insertError);
            stats.errors += businessesToInsert.length;
            for (const item of businessesToInsert) {
              stats.errorDetails.push({
                row: item.rowNumber,
                error: `Database insert failed: ${insertError.message}`,
                data: item.data
              });
            }
          } else {
            stats.imported += businessesToInsert.length;
            console.log(`Inserted batch of ${businessesToInsert.length} businesses`);
          }

          businessesToInsert.length = 0; // Clear the array
        }

      } catch (error) {
        stats.errors++;
        stats.errorDetails.push({
          row: rowNumber,
          error: error instanceof Error ? error.message : 'Unknown error',
          data: business
        });
        console.error(`Error processing row ${rowNumber}:`, error);
      }
    }

    // Insert any remaining businesses
    if (businessesToInsert.length > 0) {
      const dataToInsert = businessesToInsert.map(item => item.data);
      const { data: insertedData, error: insertError } = await supabase
        .from('businesses')
        .insert(dataToInsert)
        .select();

      if (insertError) {
        console.error('Final batch insert error:', insertError);
        stats.errors += businessesToInsert.length;
        for (const item of businessesToInsert) {
          stats.errorDetails.push({
            row: item.rowNumber,
            error: `Database insert failed: ${insertError.message}`,
            data: item.data
          });
        }
      } else {
        stats.imported += businessesToInsert.length;
        console.log(`Inserted final batch of ${businessesToInsert.length} businesses`);
      }
    }

    console.log('Import completed:', stats);

    // Return success response with statistics
    return NextResponse.json({
      success: true,
      message: `Successfully imported ${stats.imported} businesses`,
      statistics: {
        total: stats.total,
        imported: stats.imported,
        skipped: stats.skipped,
        duplicates: stats.duplicates,
        errors: stats.errors,
        errorDetails: stats.errorDetails.slice(0, 100) // Limit error details to first 100
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
        statistics: stats
      },
      { status: 500 }
    );
  }
}

function parseCSV(csvContent: string): BusinessRow[] {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  // Parse headers
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const requiredHeaders = ['business_name', 'address', 'city', 'state', 'zip', 'phone', 'email'];
  
  // Check for required headers
  const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
  }

  // Get header indices
  const headerIndices: { [key: string]: number } = {};
  requiredHeaders.forEach(header => {
    headerIndices[header] = headers.indexOf(header);
  });

  // Parse data rows
  const businesses: BusinessRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    
    // Skip rows that don't have enough columns
    if (values.length < Object.keys(headerIndices).length) {
      console.warn(`Skipping row ${i + 1}: insufficient columns`);
      continue;
    }
    
    const business: BusinessRow = {
      business_name: values[headerIndices.business_name] || '',
      address: values[headerIndices.address] || '',
      city: values[headerIndices.city] || '',
      state: values[headerIndices.state] || '',
      zip: values[headerIndices.zip] || '',
      phone: values[headerIndices.phone] || '',
      email: values[headerIndices.email] || ''
    };

    businesses.push(business);
  }

  return businesses;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add last field
  result.push(current.trim());

  return result;
}

function validateBusiness(business: BusinessRow, rowNumber: number): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required fields
  if (!business.business_name?.trim()) {
    errors.push('Business name is required');
  }
  if (!business.phone?.trim()) {
    errors.push('Phone number is required');
  }
  if (!business.email?.trim()) {
    errors.push('Email is required');
  }
  if (!business.address?.trim()) {
    errors.push('Address is required');
  }
  if (!business.city?.trim()) {
    errors.push('City is required');
  }
  if (!business.state?.trim()) {
    errors.push('State is required');
  }
  if (!business.zip?.trim()) {
    errors.push('ZIP code is required');
  }

  // Validate email format
  if (business.email && !isValidEmail(business.email)) {
    errors.push(`Invalid email format: ${business.email}`);
  }

  // Validate phone format (basic check)
  if (business.phone) {
    const cleanPhone = business.phone.replace(/[\s\-\(\)\.]/g, '');
    if (!/^\d{10,15}$/.test(cleanPhone)) {
      errors.push(`Invalid phone number: ${business.phone}`);
    }
  }

  // Validate state (2 letter code)
  if (business.state && business.state.trim().length !== 2) {
    errors.push(`State must be a 2-letter code: ${business.state}`);
  }

  // Validate ZIP code
  if (business.zip) {
    const cleanZip = business.zip.replace(/[\s\-]/g, '');
    if (!/^\d{5}(\d{4})?$/.test(cleanZip)) {
      errors.push(`Invalid ZIP code: ${business.zip}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)\.]/g, '');
}

// Optional: Add GET method to check endpoint status
export async function GET() {
  try {
    // Test database connection
    const { count, error } = await supabase
      .from('businesses')
      .select('*', { count: 'exact', head: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      message: 'Business import endpoint is ready',
      databaseConnected: true,
      existingBusinesses: count || 0,
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
      sampleCSV: 'business_name,address,city,state,zip,phone,email\n"ABC Restaurant","123 Main St","New York","NY","10001","212-555-0100","contact@abcrestaurant.com"'
    });
  } catch (error) {
    console.error('Database connection error:', error);
    return NextResponse.json({
      message: 'Business import endpoint has database connection issues',
      error: error instanceof Error ? error.message : 'Unknown error',
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
    }, { status: 500 });
  }
}
