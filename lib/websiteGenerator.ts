import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';
import { ContentGenerator, GeneratedContent, BusinessInfo } from './contentGenerator';

// Import templates - these would need to be imported from your components
import RestaurantTemplate from '../components/templates/RestaurantTemplate';
import ServiceTemplate from '../components/templates/ServiceTemplate';

export interface Business {
  id: string;
  business_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email?: string;
  website?: string;
  business_type?: string;
}

export interface WebsiteGenerationResult {
  success: boolean;
  previewUrl?: string;
  htmlContent?: string;
  screenshot?: string;
  error?: string;
}

export class WebsiteGenerator {
  private supabase;
  private contentGenerator: ContentGenerator;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials are required');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.contentGenerator = new ContentGenerator();
  }

  async generateWebsite(businessId: string): Promise<WebsiteGenerationResult> {
    try {
      // Fetch business data
      const business = await this.fetchBusiness(businessId);
      if (!business) {
        return {
          success: false,
          error: 'Business not found'
        };
      }

      // Generate content using AI
      const content = await this.generateContent(business);

      // Select appropriate template
      const templateType = this.selectTemplate(business);

      // Render HTML
      const htmlContent = this.renderTemplate(business, content, templateType);

      // Generate preview screenshot
      const screenshot = await this.generateScreenshot(htmlContent);

      // Save to database
      const previewUrl = await this.savePreview(businessId, htmlContent, screenshot);

      return {
        success: true,
        previewUrl,
        htmlContent,
        screenshot
      };
    } catch (error) {
      console.error('Error generating website:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private async fetchBusiness(businessId: string): Promise<Business | null> {
    const { data, error } = await this.supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (error) {
      console.error('Error fetching business:', error);
      return null;
    }

    return data as Business;
  }

  private async generateContent(business: Business): Promise<GeneratedContent> {
    const businessInfo: BusinessInfo = {
      businessName: business.business_name,
      businessType: business.business_type,
      address: business.address,
      city: business.city,
      state: business.state
    };

    return await this.contentGenerator.generateContent(businessInfo);
  }

  private selectTemplate(business: Business): 'restaurant' | 'service' | 'retail' {
    const name = business.business_name.toLowerCase();
    const type = (business.business_type || '').toLowerCase();
    const combined = `${name} ${type}`;

    // Restaurant keywords
    if (/restaurant|pizza|food|cafe|bakery|diner|grill|bistro|kitchen|eat/.test(combined)) {
      return 'restaurant';
    }

    // Service keywords
    if (/plumber|plumbing|electric|electrical|repair|cleaning|maintenance|service|contractor|hvac|landscap/.test(combined)) {
      return 'service';
    }

    // Retail keywords
    if (/shop|store|boutique|retail|mart|market|outlet|emporium|goods/.test(combined)) {
      return 'retail';
    }

    // Default to service
    return 'service';
  }

  private renderTemplate(business: Business, content: GeneratedContent, templateType: string): string {
    // Prepare common props
    const commonProps = {
      businessName: business.business_name,
      address: `${business.address}, ${business.city}, ${business.state} ${business.zip}`,
      phone: business.phone,
      hours: this.getDefaultHours(templateType),
      tagline: content.tagline,
      aboutUs: content.aboutUs
    };

    let component: React.ReactElement;

    switch (templateType) {
      case 'restaurant':
        component = React.createElement(RestaurantTemplate, {
          ...commonProps,
          menu: this.getDefaultMenu(),
          specialties: ['Daily Specials', 'Fresh Ingredients', 'Family Recipes'],
          cuisine: 'American'
        });
        break;

      case 'service':
        component = React.createElement(ServiceTemplate, {
          ...commonProps,
          services: this.parseServices(content.servicesDescription),
          serviceArea: `${business.city} and surrounding areas`,
          certifications: ['Licensed', 'Insured', 'Certified Professionals']
        });
        break;

      case 'retail':
        // For now, use service template for retail
        component = React.createElement(ServiceTemplate, {
          ...commonProps,
          services: ['Quality Products', 'Expert Advice', 'Competitive Prices'],
          serviceArea: `Serving ${business.city}`,
          certifications: ['Authorized Dealer', 'Warranty Service', 'Price Match Guarantee']
        });
        break;

      default:
        component = React.createElement(ServiceTemplate, {
          ...commonProps,
          services: this.parseServices(content.servicesDescription),
          serviceArea: `${business.city} and surrounding areas`,
          certifications: []
        });
    }

    // Wrap in HTML document
    const htmlString = renderToStaticMarkup(component);
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${business.business_name} - ${content.tagline}</title>
  <meta name="description" content="${content.aboutUs}">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    header { background: #2563eb; color: white; padding: 2rem 0; text-align: center; }
    h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
    .tagline { font-size: 1.2rem; opacity: 0.9; }
    section { margin: 3rem 0; }
    h2 { color: #1e40af; margin-bottom: 1rem; }
    .contact-info { background: #f3f4f6; padding: 2rem; border-radius: 8px; margin: 2rem 0; }
    .hours { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; max-width: 400px; }
    footer { background: #1f2937; color: white; text-align: center; padding: 2rem 0; margin-top: 4rem; }
  </style>
</head>
<body>
  ${htmlString}
</body>
</html>`;
  }

  private getDefaultHours(templateType: string): { [key: string]: string } {
    if (templateType === 'restaurant') {
      return {
        'Monday': '11:00 AM - 10:00 PM',
        'Tuesday': '11:00 AM - 10:00 PM',
        'Wednesday': '11:00 AM - 10:00 PM',
        'Thursday': '11:00 AM - 10:00 PM',
        'Friday': '11:00 AM - 11:00 PM',
        'Saturday': '11:00 AM - 11:00 PM',
        'Sunday': '12:00 PM - 9:00 PM'
      };
    }
    
    return {
      'Monday': '8:00 AM - 6:00 PM',
      'Tuesday': '8:00 AM - 6:00 PM',
      'Wednesday': '8:00 AM - 6:00 PM',
      'Thursday': '8:00 AM - 6:00 PM',
      'Friday': '8:00 AM - 6:00 PM',
      'Saturday': '9:00 AM - 4:00 PM',
      'Sunday': 'Closed'
    };
  }

  private getDefaultMenu(): Array<{ category: string; items: string[] }> {
    return [
      {
        category: 'Appetizers',
        items: ['House Salad', 'Soup of the Day', 'Garlic Bread']
      },
      {
        category: 'Main Courses',
        items: ['Grilled Chicken', 'Fresh Pasta', 'Daily Special']
      },
      {
        category: 'Desserts',
        items: ['Homemade Pie', 'Ice Cream', 'Chocolate Cake']
      }
    ];
  }

  private parseServices(servicesDescription: string): string[] {
    // Extract key services from the description
    const services = [];
    const sentences = servicesDescription.split('.');
    
    for (const sentence of sentences.slice(0, 3)) {
      if (sentence.trim()) {
        services.push(sentence.trim());
      }
    }

    if (services.length === 0) {
      services.push('Professional Service', 'Quality Workmanship', 'Customer Satisfaction');
    }

    return services;
  }

  private async generateScreenshot(htmlContent: string): Promise<string> {
    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 800 });
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      const screenshot = await page.screenshot({
        encoding: 'base64',
        type: 'png'
      });

      await browser.close();

      return screenshot;
    } catch (error) {
      console.error('Error generating screenshot:', error);
      // Return empty string if screenshot generation fails
      return '';
    }
  }

  private async savePreview(businessId: string, htmlContent: string, screenshot: string): Promise<string> {
    // Generate unique preview ID
    const previewId = `preview_${businessId}_${Date.now()}`;
    
    // Save to database
    const { data, error } = await this.supabase
      .from('website_previews')
      .upsert({
        business_id: businessId,
        preview_id: previewId,
        html_content: htmlContent,
        screenshot: screenshot,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving preview:', error);
      throw new Error('Failed to save preview to database');
    }

    // Return preview URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/preview/${previewId}`;
  }
}

export function createWebsiteGenerator(): WebsiteGenerator {
  return new WebsiteGenerator();
}
