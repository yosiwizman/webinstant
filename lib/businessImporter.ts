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
    this.existingPhones = new Set();
  }

  /**
   * Parse CSV content into array of business objects
   */
  private parseCSV(csvContent: string): Array<Partial<BusinessRow>> {
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Parse headers
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const requiredHeaders = ['business_name', 'address', 'city', 'state', 'zip', 'phone', 'email'];
    
    // Check for required headers
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
    }

    // Parse data rows
    const businesses: Array<Partial<BusinessRow>> = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0) continue; // Skip empty lines

      const business: Partial<BusinessRow> = {};
      headers.forEach((header, index) => {
        if (requiredHeaders.includes(header)) {
          business[header as keyof BusinessRow] = values[index]?.trim() || '';
        }
      });
      businesses.push(business);
    }

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
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);

    return result;
  }

  /**
   * Validate a business row
   */
  private validateBusiness(business: Partial<BusinessRow>, rowNumber: number): ValidationResult {
    const errors: string[] = [];

    // Check required fields
    if (!business.business_name?.trim()) {
      errors.push('Business name is required');
    }
    if (!business.phone?.trim()) {
      errors.push('Phone number is required');
    }
    if (!business.city?.trim()) {
      errors.push('City is required');
    }
    if (!business.state?.trim()) {
      errors.push('State is required');
    }

    // Validate email format if provided
    if (business.email && !this.isValidEmail(business.email)) {
      errors.push('Invalid email format');
    }

    // Validate phone format
    if (business.phone && !this.isValidPhone(business.phone)) {
      errors.push('Invalid phone format');
    }

    // Validate state code (2 letters)
    if (business.state && business.state.length !== 2) {
      errors.push('State must be 2-letter code');
    }

    // Validate ZIP code
    if (business.zip && !this.isValidZip(business.zip)) {
      errors.push('Invalid ZIP code format');
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
   * Check if phone is valid (basic validation)
   */
  private isValidPhone(phone: string): boolean {
    // Remove common formatting characters
    const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
    // Check if it's 10 or 11 digits (with or without country code)
    return /^\d{10,11}$/.test(cleaned);
  }

  /**
   * Check if ZIP code is valid
   */
  private isValidZip(zip: string): boolean {
    // US ZIP or ZIP+4 format
    return /^\d{5}(-\d{4})?$/.test(zip);
  }

  /**
   * Normalize phone number for duplicate checking
   */
  private normalizePhone(phone: string): string {
    return phone.replace(/[\s\-\(\)\.]/g, '');
  }

  /**
   * Load existing phone numbers from database
   */
  private async loadExistingPhones(): Promise<void> {
    console.log('Loading existing phone numbers from database...');
    
    const { data, error } = await supabase
      .from('businesses')
      .select('phone');

    if (error) {
      console.error('Error loading existing phones:', error);
      throw new Error(`Failed to load existing businesses: ${error.message}`);
    }

    this.existingPhones = new Set(
      (data || []).map(b => this.normalizePhone(b.phone))
    );

    console.log(`Loaded ${this.existingPhones.size} existing phone numbers`);
  }

  /**
   * Import businesses from CSV content
   */
  public async importFromCSV(csvContent: string): Promise<ImportStatistics> {
    console.log('Starting business import...');

    try {
      // Parse CSV
      const businesses = this.parseCSV(csvContent);
      this.stats.total = businesses.length;
      console.log(`Parsed ${this.stats.total} rows from CSV`);

      // Load existing phones for duplicate checking
      await this.loadExistingPhones();

      // Process each business
      const validBusinesses: BusinessRow[] = [];
      const processedPhones = new Set<string>();

      for (let i = 0; i < businesses.length; i++) {
        const business = businesses[i];
        const rowNumber = i + 2; // +2 because row 1 is headers, and arrays are 0-indexed

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
        const normalizedPhone = this.normalizePhone(business.phone!);
        
        // Check against existing database records
        if (this.existingPhones.has(normalizedPhone)) {
          this.stats.duplicates++;
          this.stats.skipped++;
          console.log(`Row ${rowNumber}: Duplicate phone number (exists in database) - ${business.phone}`);
          continue;
        }

        // Check against already processed records in this import
        if (processedPhones.has(normalizedPhone)) {
          this.stats.duplicates++;
          this.stats.skipped++;
          console.log(`Row ${rowNumber}: Duplicate phone number (in current import) - ${business.phone}`);
          continue;
        }

        // Add to valid businesses
        validBusinesses.push(business as BusinessRow);
        processedPhones.add(normalizedPhone);
      }

      // Bulk insert valid businesses
      if (validBusinesses.length > 0) {
        console.log(`Inserting ${validBusinesses.length} valid businesses...`);
        
        // Insert in batches of 100 for better performance
        const batchSize = 100;
        for (let i = 0; i < validBusinesses.length; i += batchSize) {
          const batch = validBusinesses.slice(i, i + batchSize);
          
          const { error } = await supabase
            .from('businesses')
            .insert(batch.map(b => ({
              business_name: b.business_name,
              address: b.address,
              city: b.city,
              state: b.state,
              zip: b.zip,
              phone: b.phone,
              email: b.email
            })));

          if (error) {
            console.error(`Error inserting batch starting at row ${i}:`, error);
            this.stats.errors += batch.length;
            this.stats.errorDetails.push({
              row: -1,
              error: `Database insert error: ${error.message}`,
              data: { batchStart: i, batchSize: batch.length }
            });
          } else {
            this.stats.imported += batch.length;
            console.log(`Successfully inserted batch of ${batch.length} businesses`);
          }
        }
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
