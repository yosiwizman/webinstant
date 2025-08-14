import OpenAI from 'openai';

export interface GeneratedContent {
  tagline: string;
  aboutUs: string;
  servicesDescription: string;
}

export interface BusinessInfo {
  businessName: string;
  businessType?: string;
  address?: string;
  city?: string;
  state?: string;
}

export class ContentGenerator {
  private openai: OpenAI;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error('OpenAI API key is required');
    }
    
    this.openai = new OpenAI({
      apiKey: key,
    });
  }

  async generateContent(businessInfo: BusinessInfo): Promise<GeneratedContent> {
    try {
      const businessType = this.inferBusinessType(businessInfo);
      const industryKeywords = this.getIndustryKeywords(businessType);
      
      const prompt = this.buildPrompt(businessInfo, businessType, industryKeywords);
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a professional copywriter specializing in creating compelling, SEO-friendly content for business websites. Create content that is engaging, professional, and includes relevant industry keywords naturally.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('Failed to generate content');
      }

      return this.parseResponse(response);
    } catch (error) {
      console.error('Error generating content:', error);
      throw new Error(`Content generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private inferBusinessType(businessInfo: BusinessInfo): string {
    const name = businessInfo.businessName.toLowerCase();
    const type = (businessInfo.businessType || '').toLowerCase();
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

  private getIndustryKeywords(businessType: string): string[] {
    const keywordMap: { [key: string]: string[] } = {
      restaurant: [
        'fresh', 'delicious', 'menu', 'dining', 'cuisine', 'chef',
        'ingredients', 'atmosphere', 'reservation', 'takeout', 'delivery',
        'locally sourced', 'homemade', 'authentic', 'flavors'
      ],
      service: [
        'professional', 'reliable', 'experienced', 'licensed', 'insured',
        'quality', 'affordable', 'trusted', 'expert', 'certified',
        'emergency', 'available', 'satisfaction guaranteed', 'free estimate'
      ],
      retail: [
        'quality', 'selection', 'products', 'brands', 'shopping',
        'customer service', 'value', 'unique', 'curated', 'exclusive',
        'new arrivals', 'sale', 'collection', 'merchandise'
      ]
    };

    return keywordMap[businessType] || keywordMap.service;
  }

  private buildPrompt(businessInfo: BusinessInfo, businessType: string, keywords: string[]): string {
    const location = businessInfo.city && businessInfo.state 
      ? `${businessInfo.city}, ${businessInfo.state}` 
      : 'the local area';

    return `Generate compelling website content for ${businessInfo.businessName}, a ${businessType} business located in ${location}.

Please create the following content pieces, incorporating these SEO keywords naturally: ${keywords.slice(0, 5).join(', ')}.

Format your response EXACTLY as follows (include the labels):

TAGLINE: [Create a compelling tagline of exactly 10 words that captures the essence of the business]

ABOUT_US: [Write an engaging "About Us" section of approximately 50 words that tells the business story, emphasizes their values, and connects with customers]

SERVICES_DESCRIPTION: [Write a comprehensive services/products description of approximately 100 words that highlights what the business offers, their expertise, and why customers should choose them]

Make the content professional, engaging, and focused on customer benefits. Use active voice and include a call to action where appropriate.`;
  }

  private parseResponse(response: string): GeneratedContent {
    const lines = response.split('\n').filter(line => line.trim());
    
    let tagline = '';
    let aboutUs = '';
    let servicesDescription = '';
    
    for (const line of lines) {
      if (line.startsWith('TAGLINE:')) {
        tagline = line.replace('TAGLINE:', '').trim();
      } else if (line.startsWith('ABOUT_US:')) {
        aboutUs = line.replace('ABOUT_US:', '').trim();
      } else if (line.startsWith('SERVICES_DESCRIPTION:')) {
        servicesDescription = line.replace('SERVICES_DESCRIPTION:', '').trim();
      }
    }

    // Fallback content if parsing fails
    if (!tagline || !aboutUs || !servicesDescription) {
      return {
        tagline: 'Your Trusted Local Business Partner for Quality Service',
        aboutUs: 'We are dedicated to providing exceptional service to our community. With years of experience and a commitment to excellence, we strive to exceed your expectations every time. Our team of professionals is here to serve you.',
        servicesDescription: 'We offer a comprehensive range of services designed to meet your needs. Our experienced team uses the latest techniques and highest quality materials to ensure outstanding results. From consultation to completion, we handle every aspect with professionalism and attention to detail. Customer satisfaction is our top priority, and we stand behind our work with a satisfaction guarantee.'
      };
    }

    return {
      tagline,
      aboutUs,
      servicesDescription
    };
  }
}

export function createContentGenerator(apiKey?: string): ContentGenerator {
  return new ContentGenerator(apiKey);
}
