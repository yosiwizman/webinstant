import { createClient } from '@supabase/supabase-js';

// TypeScript types
export interface BusinessRow {
  business_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
}

export interface ImportStatistics {
  total: number;
  imported: number;
  skipped: number;
  errors: number;
  duplicates: number;
  errorDetails: Array<{
    row: number;
    error: string;
    data?: Partial<BusinessRow>;
  }>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export class BusinessImporter {
  private stats: ImportStatistics;
  private existingEmails: Set<string>;
  private existingPhones: Set<string>;

  constructor() {
    this.stats = {
      total: 0,
      imported: 0,
      skipped: 0,
      errors: 0,
      duplicates: 0,
      errorDetails: []
    };
    this.existingEmails = new Set();
    this.existingPhones = new Set();
  }

  /**
   * Parse CSV content into array of business objects
   */
  private parseCSV(csvContent: string): BusinessRow[] {
    console.log('Starting CSV parsing...');
    
    // Split into lines and filter out empty lines
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
    console.log(`Found ${lines.length} non-empty lines in CSV`);
    
    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Parse headers - handle both comma-separated and properly quoted CSV
    const headerLine = lines[0];
    console.log('Header line:', headerLine);
    
    const headers = this.parseCSVLine(headerLine).map(h => 
      h.trim().toLowerCase().replace(/\s+/g, '_').replace(/['"]/g, '')
    );
    console.log('Parsed headers:', headers);
    
    const requiredHeaders = ['business_name', 'address', 'city', 'state', 'zip', 'phone', 'email'];
    
    // Check for required headers
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      console.error('Missing headers:', missingHeaders);
      throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
    }

    // Get header indices
    const headerIndices: { [key: string]: number } = {};
    requiredHeaders.forEach(header => {
      headerIndices[header] = headers.indexOf(header);
    });
    console.log('Header indices:', headerIndices);

    // Parse data rows
    const businesses: BusinessRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        console.log(`Skipping empty line ${i + 1}`);
        continue;
      }

      console.log(`Parsing line ${i + 1}: ${line}`);
      const values = this.parseCSVLine(line);
      console.log(`Parsed values for line ${i + 1}:`, values);
      
      // Create business object
      const business: BusinessRow = {
        business_name: (values[headerIndices.business_name] || '').trim(),
        address: (values[headerIndices.address] || '').trim(),
        city: (values[headerIndices.city] || '').trim(),
        state: (values[headerIndices.state] || '').trim(),
        zip: (values[headerIndices.zip] || '').trim(),
        phone: (values[headerIndices.phone] || '').trim(),
        email: (values[headerIndices.email] || '').trim()
      };

      console.log(`Created business object for line ${i + 1}:`, business);
      businesses.push(business);
    }

    console.log(`Successfully parsed ${businesses.length} businesses from CSV`);
    return businesses;
  }

  /**
   * Parse a single CSV line handling quoted values
   */
  private parseCSVLine(line: string): string[] {
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

  /**
   * Validate a business row
   */
  private validateBusiness(business: BusinessRow, rowNumber: number): ValidationResult {
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
    if (business.email && !this.isValidEmail(business.email)) {
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

  /**
   * Check if email is valid
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Normalize phone number for duplicate checking
   */
  private normalizePhone(phone: string): string {
    return phone.replace(/[\s\-\(\)\.]/g, '');
  }

  /**
   * Load existing businesses from database
   */
  private async loadExistingBusinesses(): Promise<void> {
    console.log('Loading existing businesses from database...');
    
    const { data, error } = await supabase
      .from('businesses')
      .select('email, phone');

    if (error) {
      console.error('Error loading existing businesses:', error);
      throw new Error(`Failed to load existing businesses: ${error.message}`);
    }

    this.existingEmails = new Set(
      (data || []).filter(b => b.email).map(b => b.email.toLowerCase())
    );
    
    this.existingPhones = new Set(
      (data || []).filter(b => b.phone).map(b => this.normalizePhone(b.phone))
    );

    console.log(`Loaded ${this.existingEmails.size} existing emails and ${this.existingPhones.size} existing phones`);
  }

  /**
   * Import businesses from CSV content
   */
  public async importFromCSV(csvContent: string): Promise<ImportStatistics> {
    console.log('Starting business import...');
    console.log('CSV content length:', csvContent.length);
    console.log('First 500 chars of CSV:', csvContent.substring(0, 500));

    try {
      // Parse CSV
      const businesses = this.parseCSV(csvContent);
      this.stats.total = businesses.length;
      console.log(`Parsed ${this.stats.total} businesses from CSV`);

      // Load existing businesses for duplicate checking
      await this.loadExistingBusinesses();

      // Process each business
      const validBusinesses: any[] = [];
      const processedEmails = new Set<string>();
      const processedPhones = new Set<string>();

      for (let i = 0; i < businesses.length; i++) {
        const business = businesses[i];
        const rowNumber = i + 2; // +2 because row 1 is headers, and arrays are 0-indexed

        console.log(`Processing row ${rowNumber}:`, business);

        // Validate business
        const validation = this.validateBusiness(business, rowNumber);
        if (!validation.isValid) {
          this.stats.errors++;
          this.stats.errorDetails.push({
            row: rowNumber,
            error: validation.errors.join('; '),
            data: business
          });
          console.log(`Row ${rowNumber}: Validation failed - ${validation.errors.join('; ')}`);
          continue;
        }

        // Check for duplicates
        const normalizedPhone = this.normalizePhone(business.phone);
        const normalizedEmail = business.email.toLowerCase();
        
        // Check against existing database records
        if (this.existingEmails.has(normalizedEmail)) {
          this.stats.duplicates++;
          this.stats.skipped++;
          console.log(`Row ${rowNumber}: Duplicate email (exists in database) - ${business.email}`);
          continue;
        }

        if (this.existingPhones.has(normalizedPhone)) {
          this.stats.duplicates++;
          this.stats.skipped++;
          console.log(`Row ${rowNumber}: Duplicate phone (exists in database) - ${business.phone}`);
          continue;
        }

        // Check against already processed records in this import
        if (processedEmails.has(normalizedEmail)) {
          this.stats.duplicates++;
          this.stats.skipped++;
          console.log(`Row ${rowNumber}: Duplicate email (in current import) - ${business.email}`);
          continue;
        }

        if (processedPhones.has(normalizedPhone)) {
          this.stats.duplicates++;
          this.stats.skipped++;
          console.log(`Row ${rowNumber}: Duplicate phone (in current import) - ${business.phone}`);
          continue;
        }

        // Prepare business for insertion with has_website field
        const businessToInsert = {
          business_name: business.business_name.trim(),
          address: business.address.trim(),
          city: business.city.trim(),
          state: business.state.trim().toUpperCase(),
          zip: business.zip.trim(),
          phone: business.phone.trim(),
          email: business.email.trim().toLowerCase(),
          has_website: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Add to valid businesses
        validBusinesses.push(businessToInsert);
        processedEmails.add(normalizedEmail);
        processedPhones.add(normalizedPhone);
        
        console.log(`Row ${rowNumber}: Business validated and ready for insertion`);
      }

      // Bulk insert valid businesses
      if (validBusinesses.length > 0) {
        console.log(`Inserting ${validBusinesses.length} valid businesses...`);
        console.log('Sample business to insert:', validBusinesses[0]);
        
        // Insert in batches of 50 for better performance
        const batchSize = 50;
        for (let i = 0; i < validBusinesses.length; i += batchSize) {
          const batch = validBusinesses.slice(i, i + batchSize);
          
          console.log(`Inserting batch ${Math.floor(i / batchSize) + 1} with ${batch.length} businesses`);
          
          const { data, error } = await supabase
            .from('businesses')
            .insert(batch)
            .select();

          if (error) {
            console.error(`Error inserting batch starting at index ${i}:`, error);
            this.stats.errors += batch.length;
            this.stats.errorDetails.push({
              row: -1,
              error: `Database insert error: ${error.message}`,
              data: { batchStart: i, batchSize: batch.length }
            });
          } else {
            this.stats.imported += batch.length;
            console.log(`Successfully inserted batch of ${batch.length} businesses`);
            if (data) {
              console.log(`Inserted business IDs:`, data.map((b: any) => b.id));
            }
          }
        }
      } else {
        console.log('No valid businesses to insert');
      }

      console.log('Import completed:', {
        total: this.stats.total,
        imported: this.stats.imported,
        skipped: this.stats.skipped,
        duplicates: this.stats.duplicates,
        errors: this.stats.errors
      });

      return this.stats;
    } catch (error) {
      console.error('Import failed:', error);
      throw error;
    }
  }

  /**
   * Get current import statistics
   */
  public getStatistics(): ImportStatistics {
    return { ...this.stats };
  }
}

// Export a factory function for creating new importer instances
export function createBusinessImporter(): BusinessImporter {
  return new BusinessImporter();
}
