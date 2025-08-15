import Together from 'together-ai';
import Replicate from 'replicate';

// Initialize AI clients
const together = new Together({
  apiKey: process.env.TOGETHER_API_KEY || '',
});

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || '',
});

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

export interface BusinessContent {
  tagline: string;
  description: string;
  services: string[];
  testimonials: Array<{name: string, text: string, rating: number}>;
  hours: { [key: string]: string };
  theme: BusinessTheme;
  businessType: string;
  images?: BusinessImages;
}

export interface BusinessTheme {
  primary: string;
  accent: string;
  background: string;
  text: string;
  isDark: boolean;
}

export interface BusinessImages {
  hero: string;
  service: string;
  team: string;
  gallery?: string[];
}

export interface CategoryTheme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    hero: string;
    text: string;
    light: string;
    dark: string;
  };
  fonts: {
    heading: string;
    body: string;
    accent?: string;
  };
  style: string;
}

export class ContentGenerator {
  private together: Together;
  private replicate: Replicate;

  constructor(togetherKey?: string, replicateToken?: string) {
    this.together = new Together({
      apiKey: togetherKey || process.env.TOGETHER_API_KEY || '',
    });
    
    this.replicate = new Replicate({
      auth: replicateToken || process.env.REPLICATE_API_TOKEN || '',
    });
  }

  async generateContent(businessInfo: BusinessInfo): Promise<GeneratedContent> {
    try {
      const businessType = this.inferBusinessType(businessInfo);
      const industryKeywords = this.getIndustryKeywords(businessType);
      
      const prompt = this.buildPrompt(businessInfo, businessType, industryKeywords);
      
      // Use Together AI with Mixtral for better quality and cost efficiency
      const completion = await this.together.chat.completions.create({
        model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        messages: [
          {
            role: 'system',
            content: 'You are a premium website copywriter specializing in creating compelling, SEO-optimized content for high-end business websites. Create content that is sophisticated, engaging, and converts visitors into customers. Use power words and emotional triggers.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 800,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('Failed to generate content');
      }

      return this.parseResponse(response);
    } catch (error) {
      console.error('Error generating content:', error);
      // Fallback to default content if AI fails
      return this.getDefaultContent(businessInfo);
    }
  }

  private getDefaultContent(businessInfo: BusinessInfo): GeneratedContent {
    const businessType = this.inferBusinessType(businessInfo);
    return {
      tagline: generateTagline(businessType, businessInfo.businessName),
      aboutUs: `Welcome to ${businessInfo.businessName}, your trusted partner in ${businessInfo.city || 'the area'}. With years of experience and dedication to excellence, we deliver outstanding results that exceed expectations. Our commitment to quality and customer satisfaction sets us apart.`,
      servicesDescription: `At ${businessInfo.businessName}, we offer comprehensive solutions tailored to your needs. Our expert team uses the latest techniques and highest quality materials to ensure exceptional results. From consultation to completion, we handle every detail with professionalism and care.`
    };
  }

  private inferBusinessType(businessInfo: BusinessInfo): string {
    const name = businessInfo.businessName.toLowerCase();
    const type = (businessInfo.businessType || '').toLowerCase();
    const combined = `${name} ${type}`;

    // Restaurant keywords
    if (/restaurant|pizza|food|cafe|bakery|diner|grill|bistro|kitchen|eat|cuisine|dining/.test(combined)) {
      return 'restaurant';
    }
    
    // Plumbing keywords
    if (/plumber|plumbing|pipe|drain|water|leak|sewer|faucet|toilet|sink/.test(combined)) {
      return 'plumbing';
    }
    
    // Beauty keywords
    if (/salon|beauty|hair|nail|spa|barber|styling|cuts|color|makeup|cosmetic/.test(combined)) {
      return 'beauty';
    }
    
    // Auto keywords
    if (/auto|car|mechanic|repair|tire|brake|oil|transmission|automotive|garage|motor/.test(combined)) {
      return 'auto';
    }
    
    // Cleaning keywords
    if (/clean|maid|janitorial|housekeeping|sanitiz|wash|spotless/.test(combined)) {
      return 'cleaning';
    }
    
    // Electrical keywords
    if (/electric|electrical|wire|wiring|power|voltage|outlet|circuit/.test(combined)) {
      return 'electrical';
    }
    
    // Construction keywords
    if (/construct|build|contractor|remodel|renovation|carpenter/.test(combined)) {
      return 'construction';
    }
    
    // Retail keywords
    if (/store|shop|mart|market|boutique|retail|mall/.test(combined)) {
      return 'retail';
    }
    
    // Dental keywords
    if (/dental|dentist|teeth|orthodont|oral/.test(combined)) {
      return 'dental';
    }
    
    // Medical keywords
    if (/medical|clinic|doctor|health|care|wellness|hospital/.test(combined)) {
      return 'medical';
    }

    // Default to service
    return 'service';
  }

  private getIndustryKeywords(businessType: string): string[] {
    const keywordMap: { [key: string]: string[] } = {
      restaurant: [
        'fresh', 'delicious', 'menu', 'dining', 'cuisine', 'chef',
        'ingredients', 'atmosphere', 'reservation', 'takeout', 'delivery',
        'locally sourced', 'homemade', 'authentic', 'flavors', 'gourmet',
        'award-winning', 'signature dishes', 'craft cocktails'
      ],
      plumbing: [
        'emergency', '24/7', 'licensed', 'insured', 'leak repair',
        'drain cleaning', 'water heater', 'pipe replacement', 'certified',
        'reliable', 'professional', 'fast response', 'guaranteed work',
        'master plumber', 'residential', 'commercial'
      ],
      beauty: [
        'luxury', 'pamper', 'transform', 'glamorous', 'trendy',
        'professional stylists', 'premium products', 'relaxation',
        'makeover', 'cutting-edge', 'personalized', 'rejuvenate',
        'award-winning', 'celebrity stylist', 'organic products'
      ],
      auto: [
        'certified mechanics', 'diagnostic', 'warranty', 'genuine parts',
        'preventive maintenance', 'ASE certified', 'state-of-the-art',
        'honest pricing', 'quick turnaround', 'all makes models',
        'factory trained', 'computer diagnostics', 'fleet service'
      ],
      cleaning: [
        'eco-friendly', 'spotless', 'sanitized', 'deep clean',
        'professional grade', 'bonded', 'insured', 'thorough',
        'attention to detail', 'green cleaning', 'satisfaction guaranteed',
        'commercial grade', 'HEPA filtration', 'CDC compliant'
      ],
      service: [
        'professional', 'reliable', 'experienced', 'licensed', 'insured',
        'quality', 'affordable', 'trusted', 'expert', 'certified',
        'emergency', 'available', 'satisfaction guaranteed', 'free estimate'
      ]
    };

    return keywordMap[businessType] || keywordMap.service;
  }

  private buildPrompt(businessInfo: BusinessInfo, businessType: string, keywords: string[]): string {
    const location = businessInfo.city && businessInfo.state 
      ? `${businessInfo.city}, ${businessInfo.state}` 
      : 'the local area';

    return `Generate premium, conversion-focused website content for ${businessInfo.businessName}, a high-end ${businessType} business located in ${location}.

Create compelling, sophisticated content that positions this as a premium $2000+ value business. Use power words and emotional triggers.

Incorporate these SEO keywords naturally: ${keywords.slice(0, 8).join(', ')}.

Format your response EXACTLY as follows (include the labels):

TAGLINE: [Create a powerful, memorable tagline of 8-12 words that captures the premium essence and unique value proposition]

ABOUT_US: [Write a compelling "About Us" section of 80-100 words that tells an engaging story, emphasizes expertise and premium quality, builds trust, and creates emotional connection with affluent customers]

SERVICES_DESCRIPTION: [Write a comprehensive, benefit-focused services description of 120-150 words that highlights premium offerings, expertise, exclusive benefits, and positions as the best choice in the market. Include social proof elements and urgency triggers]

Make the content sophisticated, aspirational, and focused on premium value. Use active voice, power words, and include subtle calls to action.`;
  }

  private parseResponse(response: string): GeneratedContent {
    const lines = response.split('\n').filter(line => line.trim());
    
    let tagline = '';
    let aboutUs = '';
    let servicesDescription = '';
    
    let currentSection = '';
    
    for (const line of lines) {
      if (line.startsWith('TAGLINE:')) {
        currentSection = 'tagline';
        tagline = line.replace('TAGLINE:', '').trim();
      } else if (line.startsWith('ABOUT_US:')) {
        currentSection = 'about';
        aboutUs = line.replace('ABOUT_US:', '').trim();
      } else if (line.startsWith('SERVICES_DESCRIPTION:')) {
        currentSection = 'services';
        servicesDescription = line.replace('SERVICES_DESCRIPTION:', '').trim();
      } else if (currentSection && line.trim()) {
        // Continue adding to current section if it's multi-line
        if (currentSection === 'tagline' && !tagline.includes(line.trim())) {
          tagline += ' ' + line.trim();
        } else if (currentSection === 'about' && !aboutUs.includes(line.trim())) {
          aboutUs += ' ' + line.trim();
        } else if (currentSection === 'services' && !servicesDescription.includes(line.trim())) {
          servicesDescription += ' ' + line.trim();
        }
      }
    }

    // Premium fallback content if parsing fails
    if (!tagline || !aboutUs || !servicesDescription) {
      return {
        tagline: 'Excellence Redefined. Experience the Difference Today.',
        aboutUs: 'We are industry leaders dedicated to delivering exceptional service that exceeds expectations. With decades of combined expertise and an unwavering commitment to excellence, we transform ordinary experiences into extraordinary ones. Our passion for perfection and attention to detail sets us apart as the premier choice for discerning clients.',
        servicesDescription: 'Experience unparalleled service with our comprehensive suite of premium solutions. Our expert team leverages cutting-edge techniques and industry-leading practices to deliver results that speak for themselves. From initial consultation through flawless execution, we maintain the highest standards of quality and professionalism. Choose us for an experience that redefines excellence and delivers value that lasts.'
      };
    }

    return {
      tagline,
      aboutUs,
      servicesDescription
    };
  }
}

export function createContentGenerator(togetherKey?: string, replicateToken?: string): ContentGenerator {
  return new ContentGenerator(togetherKey, replicateToken);
}

// AI Image Generation Functions
export async function generateBusinessImages(businessType: string, businessName: string): Promise<BusinessImages> {
  try {
    const replicateClient = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN || '',
    });

    // Generate three distinct images for the business
    const [heroImage, serviceImage, teamImage] = await Promise.all([
      generateImage(replicateClient, getImagePrompt(businessType, 'hero', businessName)),
      generateImage(replicateClient, getImagePrompt(businessType, 'service', businessName)),
      generateImage(replicateClient, getImagePrompt(businessType, 'team', businessName))
    ]);

    return {
      hero: heroImage,
      service: serviceImage,
      team: teamImage,
      gallery: [heroImage, serviceImage, teamImage]
    };
  } catch (error) {
    console.error('Image generation failed, using premium stock photos:', error);
    return getPremiumStockImages(businessType);
  }
}

async function generateImage(client: Replicate, prompt: string): Promise<string> {
  try {
    const output = await client.run(
      "bytedance/sdxl-lightning-4step:5f24084160c9089501c1b3545d9be3c27883ae2239b6f412990e82d4a6210f8f",
      {
        input: {
          prompt: prompt + ", professional photography, high resolution, 8k quality, award winning",
          width: 1920,
          height: 1080,
          num_outputs: 1,
          scheduler: "K_EULER",
          guidance_scale: 7.5,
          num_inference_steps: 4
        }
      }
    );
    
    // Return the first image URL from the output
    if (Array.isArray(output) && output.length > 0) {
      return output[0];
    }
    throw new Error('No image generated');
  } catch (error) {
    console.error('Individual image generation failed:', error);
    throw error;
  }
}

export function getImagePrompt(type: string, imageType: string, businessName: string): string {
  const prompts: { [key: string]: { [key: string]: string } } = {
    restaurant: {
      hero: `luxurious fine dining restaurant interior, ${businessName}, warm ambient lighting, elegant table settings, crystal chandeliers, mahogany furniture, wine cellar visible, professional food photography, michelin star quality, golden hour lighting`,
      service: 'gourmet chef plating exquisite dish, molecular gastronomy, truffle shavings, gold leaf garnish, artistic presentation, steam rising, macro food photography, michelin star presentation',
      team: 'professional chef team in pristine kitchen, white uniforms, stainless steel appliances, coordinated cooking, fine dining kitchen, teamwork, smiling faces',
      gallery: 'restaurant ambiance collage, cocktail bar, wine selection, dessert display, outdoor patio dining, vip private room'
    },
    plumbing: {
      hero: 'ultra modern luxury bathroom, rainfall shower, freestanding tub, gold fixtures, marble surfaces, perfect plumbing installation, spa-like atmosphere, natural lighting',
      service: 'professional master plumber installing high-end fixtures, precision work, copper pipes, modern tools, clean workspace, uniformed technician, detailed craftsmanship',
      team: 'professional plumbing team with service vehicles, branded uniforms, modern equipment, friendly technicians, fleet of trucks, professional appearance',
      gallery: 'plumbing services showcase, pipe repair, water heater installation, bathroom renovation, emergency response, drain cleaning'
    },
    beauty: {
      hero: `glamorous luxury beauty salon interior, ${businessName}, pink velvet chairs, gold mirrors, crystal chandeliers, marble stations, fresh flowers, instagram worthy, high-end salon`,
      service: 'professional hairstylist creating elegant updo, luxury hair treatment, balayage technique, hair transformation, salon lighting, premium products visible',
      team: 'team of expert stylists and beauticians, designer uniforms, warm smiles, diverse team, professional makeup artists, nail technicians',
      gallery: 'beauty transformations, before and after, nail art, makeup application, hair coloring, spa treatments'
    },
    auto: {
      hero: 'state-of-the-art auto repair facility, luxury car service center, spotless garage, high-tech diagnostic equipment, organized tool walls, professional atmosphere',
      service: 'certified mechanic performing precision diagnostics on luxury vehicle, computer analysis, professional tools, clean uniform, expertise in action',
      team: 'ASE certified mechanics team, professional uniforms, modern facility, diagnostic equipment, friendly service advisors, trustworthy appearance',
      gallery: 'automotive services, engine repair, tire service, oil change, brake service, diagnostic testing'
    },
    cleaning: {
      hero: 'sparkling clean luxury home interior, sunlight streaming through spotless windows, pristine surfaces, fresh flowers, organized spaces, magazine worthy',
      service: 'professional cleaners in action, eco-friendly products, detailed cleaning, modern equipment, uniformed staff, systematic approach, attention to detail',
      team: 'professional cleaning crew, matching uniforms, eco-friendly supplies, diverse team, smiling faces, trustworthy appearance',
      gallery: 'before and after transformations, deep cleaning, office cleaning, residential service, carpet cleaning, window washing'
    },
    electrical: {
      hero: 'modern smart home with perfect lighting, LED installations, architectural lighting, control panels, energy efficient, sophisticated electrical work',
      service: 'licensed electrician installing smart home system, safety equipment, precision work, modern tools, code compliance, professional installation',
      team: 'team of certified electricians, safety gear, service vehicles, professional uniforms, modern testing equipment',
      gallery: 'electrical installations, panel upgrades, smart home setup, outdoor lighting, commercial wiring, emergency repairs'
    },
    construction: {
      hero: 'stunning modern home construction, architectural masterpiece, quality craftsmanship, sunset lighting, professional build, dream home',
      service: 'skilled contractors working on luxury home addition, precision framing, quality materials, professional tools, attention to detail',
      team: 'professional construction crew, hard hats, safety equipment, project planning, experienced builders, teamwork',
      gallery: 'construction projects, home additions, renovations, commercial builds, before and after, architectural details'
    },
    retail: {
      hero: `upscale boutique retail interior, ${businessName}, designer displays, luxury shopping experience, elegant fixtures, curated collections, ambient lighting`,
      service: 'personal shopping experience, customer service excellence, product presentation, boutique atmosphere, premium brands display',
      team: 'professional retail team, stylish uniforms, customer assistance, friendly service, product knowledge experts',
      gallery: 'product collections, seasonal displays, customer experiences, store events, new arrivals, exclusive items'
    },
    dental: {
      hero: 'state-of-the-art dental office, modern treatment rooms, comfortable patient chairs, advanced technology, calming atmosphere, pristine cleanliness',
      service: 'dentist performing cosmetic procedure, modern dental technology, patient comfort, professional care, advanced equipment',
      team: 'professional dental team, white coats, friendly smiles, modern office, patient care, hygienists and assistants',
      gallery: 'smile transformations, before and after, cosmetic dentistry, orthodontics, dental technology, patient comfort'
    },
    medical: {
      hero: 'modern medical facility, welcoming reception area, comfortable waiting room, professional atmosphere, healthcare excellence, natural light',
      service: 'doctor consulting with patient, modern examination room, medical technology, compassionate care, professional healthcare',
      team: 'medical professionals team, doctors and nurses, white coats, stethoscopes, caring expressions, diverse healthcare team',
      gallery: 'medical services, patient care, modern equipment, consultation rooms, wellness programs, health screenings'
    },
    general: {
      hero: 'professional modern business exterior, impressive architecture, company signage, landscaped entrance, corporate building, sunset lighting',
      service: 'professional team providing excellent service, modern workspace, client meeting, quality work, attention to detail',
      team: 'professional business team, corporate attire, diverse group, teamwork, office environment, friendly faces',
      gallery: 'business services, client testimonials, office spaces, team activities, awards and recognition, community involvement'
    }
  };
  
  const businessPrompts = prompts[type] || prompts.general;
  return businessPrompts[imageType] || businessPrompts.hero;
}

function getPremiumStockImages(businessType: string): BusinessImages {
  const stockImages: { [key: string]: BusinessImages } = {
    restaurant: {
      hero: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1920&h=1080&fit=crop',
      service: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=600&fit=crop',
      team: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop'
    },
    plumbing: {
      hero: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=1920&h=1080&fit=crop',
      service: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800&h=600&fit=crop',
      team: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&h=600&fit=crop'
    },
    beauty: {
      hero: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1920&h=1080&fit=crop',
      service: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=800&h=600&fit=crop',
      team: 'https://images.unsplash.com/photo-1595475884562-073c30d45670?w=800&h=600&fit=crop'
    },
    auto: {
      hero: 'https://images.unsplash.com/photo-1625047509168-a7026f36de04?w=1920&h=1080&fit=crop',
      service: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=800&h=600&fit=crop',
      team: 'https://images.unsplash.com/photo-1632823471565-1ecdf5c6da2c?w=800&h=600&fit=crop'
    },
    cleaning: {
      hero: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1920&h=1080&fit=crop',
      service: 'https://images.unsplash.com/photo-1628177142898-93e36e4e3a50?w=800&h=600&fit=crop',
      team: 'https://images.unsplash.com/photo-1627905646269-7f034dcc5738?w=800&h=600&fit=crop'
    },
    general: {
      hero: 'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=1920&h=1080&fit=crop',
      service: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=600&fit=crop',
      team: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=600&fit=crop'
    }
  };
  
  return stockImages[businessType] || stockImages.general;
}

// Enhanced Category Theme Functions
export function getCategoryTheme(type: string): CategoryTheme {
  const themes: { [key: string]: CategoryTheme } = {
    restaurant: {
      colors: {
        primary: '#D2691E',
        secondary: '#FF6347',
        accent: '#FFD700',
        hero: 'linear-gradient(135deg, #8B4513 0%, #D2691E 50%, #FF6347 100%)',
        text: '#2C1810',
        light: '#FFF8DC',
        dark: '#4A2C17'
      },
      fonts: {
        heading: '"Playfair Display", serif',
        body: '"Lora", serif',
        accent: '"Dancing Script", cursive'
      },
      style: 'elegant'
    },
    plumbing: {
      colors: {
        primary: '#0066CC',
        secondary: '#00AA44',
        accent: '#FF9900',
        hero: 'linear-gradient(135deg, #003D7A 0%, #0066CC 50%, #0099FF 100%)',
        text: '#FFFFFF',
        light: '#E6F2FF',
        dark: '#002244'
      },
      fonts: {
        heading: '"Oswald", sans-serif',
        body: '"Roboto", sans-serif',
        accent: '"Bebas Neue", cursive'
      },
      style: 'professional'
    },
    beauty: {
      colors: {
        primary: '#FF1493',
        secondary: '#DDA0DD',
        accent: '#FFB6C1',
        hero: 'linear-gradient(135deg, #FF69B4 0%, #FF1493 50%, #C71585 100%)',
        text: '#4A0E2E',
        light: '#FFF0F5',
        dark: '#8B008B'
      },
      fonts: {
        heading: '"Dancing Script", cursive',
        body: '"Quicksand", sans-serif',
        accent: '"Great Vibes", cursive'
      },
      style: 'glamorous'
    },
    auto: {
      colors: {
        primary: '#2C3E50',
        secondary: '#E74C3C',
        accent: '#F39C12',
        hero: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%)',
        text: '#FFFFFF',
        light: '#ECF0F1',
        dark: '#0C0C1E'
      },
      fonts: {
        heading: '"Russo One", sans-serif',
        body: '"Exo 2", sans-serif',
        accent: '"Orbitron", sans-serif'
      },
      style: 'industrial'
    },
    cleaning: {
      colors: {
        primary: '#00CED1',
        secondary: '#40E0D0',
        accent: '#AFEEEE',
        hero: 'linear-gradient(135deg, #00CED1 0%, #40E0D0 50%, #7FFFD4 100%)',
        text: '#0C4A4D',
        light: '#F0FFFF',
        dark: '#008B8B'
      },
      fonts: {
        heading: '"Comfortaa", cursive',
        body: '"Open Sans", sans-serif',
        accent: '"Pacifico", cursive'
      },
      style: 'fresh'
    },
    electrical: {
      colors: {
        primary: '#FFA500',
        secondary: '#FFD700',
        accent: '#FF4500',
        hero: 'linear-gradient(135deg, #FF8C00 0%, #FFA500 50%, #FFD700 100%)',
        text: '#1A1A1A',
        light: '#FFF5E6',
        dark: '#CC5500'
      },
      fonts: {
        heading: '"Electrolize", sans-serif',
        body: '"Source Sans Pro", sans-serif',
        accent: '"Audiowide", cursive'
      },
      style: 'energetic'
    },
    construction: {
      colors: {
        primary: '#8B4513',
        secondary: '#D2691E',
        accent: '#FF8C00',
        hero: 'linear-gradient(135deg, #654321 0%, #8B4513 50%, #D2691E 100%)',
        text: '#FFFFFF',
        light: '#F5DEB3',
        dark: '#3E2723'
      },
      fonts: {
        heading: '"Bebas Neue", cursive',
        body: '"Work Sans", sans-serif',
        accent: '"Alfa Slab One", cursive'
      },
      style: 'rugged'
    },
    retail: {
      colors: {
        primary: '#9B59B6',
        secondary: '#3498DB',
        accent: '#E74C3C',
        hero: 'linear-gradient(135deg, #8E44AD 0%, #9B59B6 50%, #3498DB 100%)',
        text: '#2C3E50',
        light: '#F4ECF7',
        dark: '#6C3483'
      },
      fonts: {
        heading: '"Montserrat", sans-serif',
        body: '"Raleway", sans-serif',
        accent: '"Lobster", cursive'
      },
      style: 'trendy'
    },
    dental: {
      colors: {
        primary: '#4FC3F7',
        secondary: '#81C784',
        accent: '#64B5F6',
        hero: 'linear-gradient(135deg, #29B6F6 0%, #4FC3F7 50%, #81C784 100%)',
        text: '#263238',
        light: '#E1F5FE',
        dark: '#0277BD'
      },
      fonts: {
        heading: '"Nunito", sans-serif',
        body: '"Lato", sans-serif',
        accent: '"Fredoka One", cursive'
      },
      style: 'clinical'
    },
    medical: {
      colors: {
        primary: '#26A69A',
        secondary: '#66BB6A',
        accent: '#42A5F5',
        hero: 'linear-gradient(135deg, #00897B 0%, #26A69A 50%, #66BB6A 100%)',
        text: '#263238',
        light: '#E0F2F1',
        dark: '#00695C'
      },
      fonts: {
        heading: '"Poppins", sans-serif',
        body: '"Inter", sans-serif',
        accent: '"Rubik", sans-serif'
      },
      style: 'medical'
    },
    service: {
      colors: {
        primary: '#667EEA',
        secondary: '#764BA2',
        accent: '#F093FB',
        hero: 'linear-gradient(135deg, #667EEA 0%, #764BA2 50%, #F093FB 100%)',
        text: '#FFFFFF',
        light: '#F3E5F5',
        dark: '#4A148C'
      },
      fonts: {
        heading: '"Rubik", sans-serif',
        body: '"Karla", sans-serif',
        accent: '"Righteous", cursive'
      },
      style: 'modern'
    }
  };
  
  return themes[type] || themes.service;
}

// New functions for enhanced content generation
export function generateBusinessContent(business: any): BusinessContent {
  const name = business.business_name.toLowerCase();
  const businessType = detectBusinessType(name);
  
  return {
    tagline: generateTagline(businessType, business.business_name),
    description: generateDescription(businessType, business),
    services: generateServices(businessType),
    testimonials: generateTestimonials(businessType),
    hours: generateBusinessHours(businessType),
    theme: getThemeForType(businessType),
    businessType
  };
}

export function detectBusinessType(name: string): string {
  if (/restaurant|pizza|burger|cafe|coffee|bakery|deli|grill|kitchen|food|eat|dining|bistro|bar|pub|cuisine/.test(name)) return 'restaurant';
  if (/plumb|pipe|drain|water|leak|sewer|faucet|toilet|sink/.test(name)) return 'plumbing';
  if (/salon|beauty|hair|nail|spa|barber|styling|cuts|color|makeup|cosmetic/.test(name)) return 'beauty';
  if (/auto|car|mechanic|repair|tire|brake|oil|transmission|automotive|garage|motor/.test(name)) return 'auto';
  if (/clean|maid|janitorial|housekeeping|sanitiz|wash|spotless/.test(name)) return 'cleaning';
  if (/electric|electrical|wire|wiring|power|voltage|outlet|circuit/.test(name)) return 'electrical';
  if (/construct|build|contractor|remodel|renovation|carpenter/.test(name)) return 'construction';
  if (/store|shop|mart|market|boutique|retail|mall/.test(name)) return 'retail';
  if (/dental|dentist|teeth|orthodont|oral/.test(name)) return 'dental';
  if (/medical|clinic|doctor|health|care|wellness|hospital/.test(name)) return 'medical';
  return 'general';
}

export function generateTagline(type: string, businessName: string): string {
  const taglines: { [key: string]: string[] } = {
    restaurant: [
      'Where Every Meal Becomes a Memory',
      'Taste the Difference, Feel the Passion',
      'Fresh Flavors, Unforgettable Dining Experience',
      'Your Neighborhood\'s Favorite Dining Destination',
      'Crafting Culinary Excellence Since Day One'
    ],
    plumbing: [
      'Your Trusted Plumbing Experts, Available 24/7',
      'Fast, Reliable, Professional Plumbing Solutions',
      'Fixing Problems, Building Trust Daily',
      'Emergency Plumbing Services You Can Trust',
      'Quality Plumbing at Honest Prices'
    ],
    beauty: [
      'Where Beauty Meets Artistry and Excellence',
      'Transform Your Look, Elevate Your Confidence',
      'Your Personal Beauty Transformation Destination',
      'Creating Beautiful Moments Every Day',
      'Expert Care for Your Beauty Needs'
    ],
    auto: [
      'Keeping Your Vehicle Running Like New',
      'Expert Auto Care You Can Trust',
      'Your Complete Automotive Service Solution',
      'Drive with Confidence, Service with Excellence',
      'Professional Auto Repair Done Right'
    ],
    cleaning: [
      'Spotless Results, Every Single Time',
      'Professional Cleaning Services You Can Trust',
      'Making Your Space Shine Bright',
      'Clean Spaces, Happy Places, Always',
      'Your Trusted Partner in Cleanliness'
    ],
    electrical: [
      'Powering Your Home and Business Safely',
      'Licensed Electricians, Guaranteed Quality Work',
      'Bright Ideas, Professional Electrical Solutions',
      'Your Safety is Our Priority',
      'Expert Electrical Services, Competitive Prices'
    ],
    construction: [
      'Building Dreams, Delivering Quality Results',
      'Your Vision, Our Expert Construction',
      'Quality Construction from Foundation to Finish',
      'Transforming Spaces, Exceeding Expectations Daily',
      'Professional Contractors You Can Trust'
    ],
    retail: [
      'Quality Products, Exceptional Service Always',
      'Your One-Stop Shopping Destination',
      'Discover Something Special Every Visit',
      'Where Quality Meets Great Value',
      'Shopping Made Easy and Enjoyable'
    ],
    dental: [
      'Creating Healthy Smiles for Life',
      'Gentle Care, Beautiful Smile Results',
      'Your Comfort is Our Priority',
      'Advanced Dental Care, Personal Touch',
      'Smile with Confidence, Trust Our Care'
    ],
    medical: [
      'Caring for Your Health and Wellness',
      'Compassionate Care, Professional Medical Excellence',
      'Your Health is Our Mission',
      'Quality Healthcare When You Need It',
      'Trusted Medical Care for Your Family'
    ],
    general: [
      'Excellence in Service, Every Single Time',
      'Your Trusted Local Business Partner',
      'Quality Service You Can Count On',
      'Committed to Your Complete Satisfaction',
      'Professional Service with Personal Touch'
    ]
  };
  
  const typeTaglines = taglines[type] || taglines.general;
  return typeTaglines[Math.floor(Math.random() * typeTaglines.length)];
}

export function generateDescription(type: string, business: any): string {
  const city = business.city || 'the area';
  const descriptions: { [key: string]: string } = {
    restaurant: `Welcome to ${business.business_name}, where culinary excellence meets warm hospitality in the heart of ${city}. Our award-winning chefs prepare every dish with fresh, locally-sourced ingredients, creating unforgettable flavors that keep our guests coming back. From our signature dishes to daily specials, every meal is a celebration of taste and tradition. Whether you're joining us for a romantic dinner, family gathering, or quick lunch, we promise an exceptional dining experience that delights all your senses. Our sommelier-curated wine list and craft cocktails perfectly complement our menu, making every visit memorable.`,
    
    plumbing: `${business.business_name} is ${city}'s most trusted plumbing service, available 24/7 for all your plumbing emergencies. With over 15 years of experience, our licensed master plumbers handle everything from simple repairs to complete system overhauls. We pride ourselves on transparent pricing, rapid response times, and guaranteed workmanship. Our team uses the latest technology including video pipe inspection and hydro-jetting to diagnose and fix problems quickly, saving you time and money while ensuring your plumbing systems work flawlessly. We're fully licensed, bonded, and insured for your complete peace of mind.`,
    
    beauty: `At ${business.business_name}, we believe beauty is an art form that enhances your natural radiance. Our award-winning stylists and aestheticians are dedicated to helping you look and feel your absolute best. Using premium products from leading brands and the latest techniques including balayage, keratin treatments, and microblading, we create personalized beauty experiences tailored to your unique style. Step into our luxurious salon where transformation meets relaxation, and leave feeling refreshed, renewed, and absolutely beautiful. We also offer exclusive VIP packages and membership programs for our valued clients.`,
    
    auto: `${business.business_name} is your premier destination for all automotive needs in ${city}. Our ASE-certified master mechanics use state-of-the-art diagnostic equipment to keep your vehicle running at peak performance. From routine maintenance to major repairs, we treat every car like our own, ensuring safety and reliability on every drive. With factory-trained technicians, genuine OEM parts, and comprehensive warranties, we've earned the trust of thousands of satisfied customers. Our digital vehicle inspection reports keep you informed, and our comfortable waiting area with WiFi and refreshments makes service visits convenient.`,
    
    cleaning: `${business.business_name} delivers spotless results for homes and businesses throughout ${city}. Our professionally trained and background-checked team uses eco-friendly, EPA-approved products and HEPA-filtered equipment to create healthier, more beautiful spaces. Whether you need regular maintenance, deep cleaning, or specialized services like carpet cleaning and window washing, we customize our approach to exceed your expectations. With flexible scheduling, competitive rates, and a 200% satisfaction guarantee, we make it easy to maintain a pristine environment. We're fully bonded and insured, and proud members of the ISSA.`,
    
    electrical: `${business.business_name} provides comprehensive electrical services to ${city} residents and businesses. Our licensed master electricians are equipped to handle everything from simple outlet repairs to complete smart home installations. We prioritize safety, efficiency, and code compliance in every job. With upfront pricing, same-day service availability, and a lifetime warranty on our work, we're the electrical contractor you can trust. Our team stays current with the latest technology including EV charger installation, solar integration, and energy-efficient lighting solutions.`,
    
    construction: `${business.business_name} brings your construction visions to life with expertise, precision, and dedication. Serving ${city} for over two decades, we specialize in custom homes, additions, and commercial projects of all sizes. Our skilled team of licensed contractors manages every aspect from architectural planning to final inspection, ensuring your project stays on time and within budget. We combine traditional craftsmanship with modern building techniques and sustainable materials to deliver exceptional results that stand the test of time. Our portfolio includes award-winning projects and hundreds of satisfied clients.`,
    
    retail: `Welcome to ${business.business_name}, ${city}'s premier shopping destination for quality products and exceptional service. Our carefully curated selection features exclusive brands and unique finds you won't see anywhere else. Our knowledgeable personal shoppers are always ready to help you find exactly what you're looking for. With competitive prices, regular VIP events, and a generous rewards program, we make shopping a pleasure. Visit our beautifully designed showroom or shop online with free same-day delivery. Experience the difference of shopping with a retailer that truly cares about your satisfaction.`,
    
    dental: `${business.business_name} is committed to providing gentle, comprehensive dental care for the entire family. Our modern ${city} office combines advanced technology including digital X-rays, laser dentistry, and same-day crowns with a warm, spa-like atmosphere to ensure your comfort at every visit. From routine cleanings to complex cosmetic procedures and Invisalign, our experienced team delivers personalized care that keeps your smile healthy and beautiful. We offer flexible financing, accept most insurance plans, and provide a lifetime warranty on our work. Experience dentistry redefined with comfort and excellence.`,
    
    medical: `At ${business.business_name}, your health and well-being are our top priorities. Our board-certified physicians and experienced medical team provide comprehensive healthcare services to ${city} and surrounding communities. We combine cutting-edge medical technology with genuine compassion, taking time to listen to your concerns and develop personalized treatment plans. From preventive care to chronic disease management and telemedicine options, we're your partner in achieving optimal health. Our patient portal provides 24/7 access to your records, and our concierge services ensure you receive the attention you deserve.`,
    
    general: `${business.business_name} has been proudly serving ${city} with dedication and excellence for over a decade. Our commitment to quality service and customer satisfaction has made us a trusted name in the community. We go above and beyond to ensure every client receives personalized attention and outstanding results. With competitive pricing, professional expertise, and a genuine care for our customers' needs, we've built lasting relationships based on trust and exceptional service. Our team of certified professionals is ready to exceed your expectations with every interaction.`
  };
  
  return descriptions[type] || descriptions.general;
}

export function generateServices(type: string): string[] {
  const services: { [key: string]: string[] } = {
    restaurant: [
      '🍽️ Fine Dining Experience with Prix Fixe Menu',
      '🥡 Contactless Takeout & Express Delivery',
      '🎉 Full-Service Event Catering & Planning',
      '👨‍🍳 Interactive Chef\'s Table Experience',
      '🍷 Sommelier-Led Wine Pairing Dinners',
      '🎂 Custom Celebration Packages & Private Events'
    ],
    plumbing: [
      '🚨 24/7 Emergency Response (30 Minutes or Less)',
      '🚿 Advanced Drain Cleaning with Video Inspection',
      '🛁 Complete Bathroom & Kitchen Renovations',
      '🔥 Tankless Water Heater Installation & Service',
      '🔧 Whole-House Repiping with Lifetime Warranty',
      '📋 Annual Maintenance Protection Plans'
    ],
    beauty: [
      '✂️ Precision Cuts by Award-Winning Stylists',
      '🎨 Custom Balayage & Color Correction',
      '💅 Luxury Spa Manicure & Pedicure Services',
      '✨ Advanced Facial Treatments & Dermaplaning',
      '👰 Complete Bridal & Event Beauty Packages',
      '💆 Therapeutic Massage & Wellness Services'
    ],
    auto: [
      '🛢️ Synthetic Oil Changes & 50-Point Inspection',
      '🔧 Complete Brake Service with Warranty',
      '💻 Advanced Computer Diagnostics & Tuning',
      '🔋 Hybrid & Electric Vehicle Specialists',
      '❄️ Climate Control Service & Repair',
      '🔄 4-Wheel Alignment & Suspension Service'
    ],
    cleaning: [
      '🏠 Deep Clean & Sanitization Services',
      '🏢 Commercial & Medical Facility Cleaning',
      '✨ Move-In/Out Complete Cleaning Package',
      '🪟 Professional Window & Pressure Washing',
      '🏗️ Post-Construction & Renovation Cleanup',
      '📅 Customized Weekly/Bi-Weekly Service Plans'
    ],
    electrical: [
      '⚡ 24-Hour Emergency Electrical Response',
      '💡 Smart Home Automation & Lighting',
      '🔌 EV Charger Installation & Service',
      '📦 Complete Panel Upgrades to 200+ Amps',
      '🏠 Whole-Home Rewiring & Renovation',
      '🔍 Comprehensive Safety Inspections & Repairs'
    ],
    construction: [
      '🏗️ Custom Home Design & Construction',
      '🔨 Luxury Additions & Second Stories',
      '🏠 Complete Home Remodeling & Renovation',
      '🚪 Gourmet Kitchen & Spa Bath Design',
      '🏛️ Commercial Tenant Improvements',
      '📐 3D Design & Virtual Walk-Through Services'
    ],
    retail: [
      '🛍️ Personal Shopping & Style Consultation',
      '💳 VIP Membership & Exclusive Benefits',
      '🚚 Free Same-Day Local Delivery',
      '🎁 Custom Gift Wrapping & Registry',
      '💰 Rewards Program with Cash Back',
      '📱 Buy Online, Pick Up In Store'
    ],
    dental: [
      '🦷 Comprehensive Exams with Digital X-Rays',
      '✨ Professional Zoom Teeth Whitening',
      '🔧 Same-Day CEREC Crowns & Restorations',
      '👑 Porcelain Veneers & Smile Makeovers',
      '😁 Invisalign Clear Aligner Therapy',
      '🚨 Same-Day Emergency Appointments'
    ],
    medical: [
      '🏥 Comprehensive Primary Care Services',
      '💉 Travel Medicine & Immunizations',
      '🔬 On-Site Laboratory & Diagnostic Testing',
      '🩺 Executive Health & Wellness Programs',
      '💊 Chronic Disease Management Programs',
      '🚑 Urgent Care with No Appointment Needed'
    ],
    general: [
      '⭐ Premium Consultation Services',
      '📞 24/7 Priority Customer Support',
      '👥 Dedicated Account Management',
      '✅ 100% Satisfaction Guarantee',
      '💲 Flexible Financing Options',
      '🏆 Industry-Leading Warranty Coverage'
    ]
  };
  
  return services[type] || services.general;
}

export function generateTestimonials(type: string): Array<{name: string, text: string, rating: number}> {
  const testimonials: { [key: string]: Array<{name: string, text: string, rating: number}> } = {
    restaurant: [
      { name: 'Sarah Mitchell', text: 'Absolutely incredible! The tasting menu was a journey through flavors I\'ve never experienced. The ambiance is perfect for special occasions, and the service is impeccable. This is now our anniversary tradition!', rating: 5 },
      { name: 'Dr. James Chen', text: 'As a food critic, I\'m rarely impressed, but this restaurant exceeded every expectation. The chef\'s attention to detail and use of local ingredients creates magic on every plate. Michelin-star quality without question!', rating: 5 },
      { name: 'Maria Rodriguez', text: 'We\'ve hosted three corporate events here and each one has been flawless. The private dining room, custom menus, and professional staff make this our go-to venue. Our clients are always impressed!', rating: 5 }
    ],
    plumbing: [
      { name: 'Robert Thompson', text: 'They saved our home from major water damage! Responded within 20 minutes at 2 AM, fixed the burst pipe professionally, and helped with insurance documentation. True lifesavers with honest pricing!', rating: 5 },
      { name: 'Linda Foster', text: 'Complete bathroom remodel was stunning! They handled everything from design to permits to installation. Finished ahead of schedule and the quality is exceptional. Worth every penny!', rating: 5 },
      { name: 'Mike Sullivan', text: 'Been using them for 10 years for our commercial properties. Always professional, reliable, and their preventive maintenance program has saved us thousands. The best plumbing service in the city!', rating: 5 }
    ],
    beauty: [
      { name: 'Jennifer Laurent', text: 'My colorist is an absolute artist! She transformed my damaged hair into a gorgeous balayage that looks natural and healthy. The salon experience is luxurious and relaxing. I won\'t go anywhere else!', rating: 5 },
      { name: 'Ashley Kim', text: 'The bridal package was perfection! Hair, makeup, nails - everything was flawless and lasted all day. The team made me feel like a princess. My wedding photos are stunning thanks to them!', rating: 5 },
      { name: 'Nicole Patterson', text: 'Their spa services are next level! The hydrafacial and lash extensions have transformed my look. The staff is professional, the products are premium, and the results speak for themselves!', rating: 5 }
    ],
    auto: [
      { name: 'David Harrison', text: 'Most honest mechanics I\'ve ever dealt with! They showed me exactly what needed fixing with video inspection, gave options, and never pushed unnecessary services. My BMW runs like new!', rating: 5 },
      { name: 'Susan Bradley', text: 'They diagnosed an issue three dealerships couldn\'t find! Saved me from buying a new car. Their expertise with European vehicles is unmatched. Fair prices and exceptional service!', rating: 5 },
      { name: 'Tom Williams', text: 'Fleet maintenance for our 20 company vehicles. They keep detailed records, remind us of service schedules, and their preventive maintenance has reduced our downtime by 60%. Outstanding partner!', rating: 5 }
    ],
    cleaning: [
      { name: 'Emily Richardson', text: 'The deep clean service is incredible! They cleaned places I didn\'t know existed. Eco-friendly products, professional team, and my home has never looked better. The attention to detail is amazing!', rating: 5 },
      { name: 'James Cooper', text: 'Our office has never been cleaner! They work around our schedule, use hospital-grade disinfectants, and the staff is trustworthy and efficient. Clients always comment on how pristine everything looks!', rating: 5 },
      { name: 'Patricia Martinez', text: 'Post-construction cleanup was a miracle! They transformed our renovation chaos into a spotless home in one day. Professional, thorough, and reasonably priced. Highly recommend their services!', rating: 5 }
    ],
    electrical: [
      { name: 'Mark Taylor', text: 'Complete smart home installation was flawless! They integrated lighting, security, and climate control seamlessly. Very knowledgeable about the latest technology and code requirements. Exceptional work!', rating: 5 },
      { name: 'Carol Stevens', text: 'Emergency service at 11 PM during a storm. They restored our power quickly and safely, then came back to install a whole-house generator. Professional, reliable, and worth every penny!', rating: 5 },
      { name: 'Brian Lewis', text: 'EV charger installation was perfect! They handled permits, upgraded our panel, and the installation is clean and professional. They even helped us understand the tax credits. Highly recommended!', rating: 5 }
    ],
    construction: [
      { name: 'Steve Morgan', text: 'Our dream home became reality! From breaking ground to move-in, they managed everything perfectly. Quality craftsmanship, attention to detail, and they finished on time and on budget. Absolutely thrilled!', rating: 5 },
      { name: 'Diana Knight', text: 'Kitchen and master suite addition exceeded our wildest expectations! The design team listened to our vision and the execution was flawless. It\'s like living in a new home. Worth every investment!', rating: 5 },
      { name: 'Paul Robinson', text: 'Commercial build-out for our restaurant was exceptional! They worked with our timeline, handled all permits, and the quality is outstanding. Our customers love the space. True professionals!', rating: 5 }
    ],
    retail: [
      { name: 'Lisa Henderson', text: 'Personal shopping service is a game-changer! They know my style, size, and preferences. I get a curated selection monthly and everything is perfect. The convenience and quality are unmatched!', rating: 5 },
      { name: 'Kevin Davis', text: 'VIP member for 3 years and the benefits are incredible! Early access to sales, exclusive events, and the rewards add up fast. The staff knows me by name and always goes above and beyond!', rating: 5 },
      { name: 'Rachel Green', text: 'Best shopping experience in town! Unique products you can\'t find anywhere else, fair prices, and the customer service is exceptional. They even delivered a last-minute gift on Sunday!', rating: 5 }
    ],
    dental: [
      { name: 'Amanda Fisher', text: 'Completely transformed my smile with veneers! Dr. and team are artists. The process was comfortable, results are natural-looking, and I finally have the confidence to smile. Life-changing experience!', rating: 5 },
      { name: 'Richard Brown', text: 'Dental anxiety is gone! They use the latest pain-free techniques, explain everything clearly, and the spa-like atmosphere is so relaxing. My whole family loves coming here now!', rating: 5 },
      { name: 'Jessica Turner', text: 'Same-day crown was amazing! One visit, no temporary, and it matches perfectly. The technology is impressive and the staff is wonderful. Best dental practice I\'ve ever been to!', rating: 5 }
    ],
    medical: [
      { name: 'Nancy Wilson', text: 'The concierge medical service is worth every penny! Same-day appointments, doctors who actually listen, and they coordinate with specialists. I feel like I have a health advocate, not just a doctor!', rating: 5 },
      { name: 'George Hamilton', text: 'Managing my diabetes has never been easier! The care team is proactive, the technology for monitoring is cutting-edge, and my numbers have never been better. They truly care about my health!', rating: 5 },
      { name: 'Mary Lopez', text: 'From pediatrics to geriatrics, they care for our entire family! The convenience of having all our records in one place and doctors who know our history is invaluable. Exceptional healthcare!', rating: 5 }
    ],
    general: [
      { name: 'Alex Johnson', text: 'Exceeded every expectation! Professional, reliable, and the quality of work is outstanding. They went above and beyond to ensure our satisfaction. Can\'t recommend them highly enough!', rating: 5 },
      { name: 'Chris Miller', text: 'Been a customer for 5 years and they never disappoint! Consistent quality, fair pricing, and they stand behind their work. The team is knowledgeable and always helpful. Simply the best!', rating: 5 },
      { name: 'Taylor Smith', text: 'Absolutely fantastic experience from start to finish! They listened to our needs, provided expert advice, and delivered exceptional results. Professional, courteous, and trustworthy. Five stars!', rating: 5 }
    ]
  };
  
  return testimonials[type] || testimonials.general;
}

export function generateBusinessHours(type: string): { [key: string]: string } {
  const hours: { [key: string]: { [key: string]: string } } = {
    restaurant: {
      'Monday': '11:00 AM - 10:00 PM',
      'Tuesday': '11:00 AM - 10:00 PM',
      'Wednesday': '11:00 AM - 10:00 PM',
      'Thursday': '11:00 AM - 10:00 PM',
      'Friday': '11:00 AM - 11:00 PM',
      'Saturday': '11:00 AM - 11:00 PM',
      'Sunday': '12:00 PM - 9:00 PM'
    },
    beauty: {
      'Monday': 'Closed',
      'Tuesday': '9:00 AM - 7:00 PM',
      'Wednesday': '9:00 AM - 7:00 PM',
      'Thursday': '9:00 AM - 8:00 PM',
      'Friday': '9:00 AM - 8:00 PM',
      'Saturday': '9:00 AM - 6:00 PM',
      'Sunday': '10:00 AM - 5:00 PM'
    },
    auto: {
      'Monday': '8:00 AM - 6:00 PM',
      'Tuesday': '8:00 AM - 6:00 PM',
      'Wednesday': '8:00 AM - 6:00 PM',
      'Thursday': '8:00 AM - 6:00 PM',
      'Friday': '8:00 AM - 6:00 PM',
      'Saturday': '8:00 AM - 4:00 PM',
      'Sunday': 'Closed'
    },
    plumbing: {
      'Monday': '24 Hours',
      'Tuesday': '24 Hours',
      'Wednesday': '24 Hours',
      'Thursday': '24 Hours',
      'Friday': '24 Hours',
      'Saturday': '24 Hours',
      'Sunday': '24 Hours'
    },
    retail: {
      'Monday': '10:00 AM - 8:00 PM',
      'Tuesday': '10:00 AM - 8:00 PM',
      'Wednesday': '10:00 AM - 8:00 PM',
      'Thursday': '10:00 AM - 8:00 PM',
      'Friday': '10:00 AM - 9:00 PM',
      'Saturday': '10:00 AM - 9:00 PM',
      'Sunday': '11:00 AM - 6:00 PM'
    },
    medical: {
      'Monday': '8:00 AM - 5:00 PM',
      'Tuesday': '8:00 AM - 5:00 PM',
      'Wednesday': '8:00 AM - 5:00 PM',
      'Thursday': '8:00 AM - 5:00 PM',
      'Friday': '8:00 AM - 5:00 PM',
      'Saturday': '9:00 AM - 1:00 PM',
      'Sunday': 'Closed'
    },
    general: {
      'Monday': '9:00 AM - 6:00 PM',
      'Tuesday': '9:00 AM - 6:00 PM',
      'Wednesday': '9:00 AM - 6:00 PM',
      'Thursday': '9:00 AM - 6:00 PM',
      'Friday': '9:00 AM - 6:00 PM',
      'Saturday': '10:00 AM - 4:00 PM',
      'Sunday': 'Closed'
    }
  };
  
  return hours[type] || hours.general;
}

export function getThemeForType(type: string): BusinessTheme {
  const themes: { [key: string]: BusinessTheme } = {
    restaurant: {
      primary: 'linear-gradient(135deg, #8B4513, #D2691E)',
      accent: '#FF6347',
      background: 'linear-gradient(-45deg, #8B4513, #D2691E, #FF6347, #FFD700)',
      text: '#2C1810',
      isDark: false
    },
    plumbing: {
      primary: 'linear-gradient(135deg, #003D7A, #0066CC)',
      accent: '#00AA44',
      background: 'linear-gradient(-45deg, #003D7A, #0066CC, #0099FF, #00AA44)',
      text: '#FFFFFF',
      isDark: true
    },
    beauty: {
      primary: 'linear-gradient(135deg, #FF69B4, #FF1493)',
      accent: '#DDA0DD',
      background: 'linear-gradient(-45deg, #FF69B4, #FF1493, #C71585, #FFB6C1)',
      text: '#4A0E2E',
      isDark: false
    },
    auto: {
      primary: 'linear-gradient(135deg, #1A1A2E, #16213E)',
      accent: '#E74C3C',
      background: 'linear-gradient(-45deg, #1A1A2E, #16213E, #0F3460, #E74C3C)',
      text: '#FFFFFF',
      isDark: true
    },
    cleaning: {
      primary: 'linear-gradient(135deg, #00CED1, #40E0D0)',
      accent: '#7FFFD4',
      background: 'linear-gradient(-45deg, #00CED1, #40E0D0, #7FFFD4, #AFEEEE)',
      text: '#0C4A4D',
      isDark: false
    },
    electrical: {
      primary: 'linear-gradient(135deg, #FF8C00, #FFA500)',
      accent: '#FFD700',
      background: 'linear-gradient(-45deg, #FF8C00, #FFA500, #FFD700, #FF4500)',
      text: '#1A1A1A',
      isDark: false
    },
    construction: {
      primary: 'linear-gradient(135deg, #654321, #8B4513)',
      accent: '#D2691E',
      background: 'linear-gradient(-45deg, #654321, #8B4513, #D2691E, #FF8C00)',
      text: '#FFFFFF',
      isDark: true
    },
    retail: {
      primary: 'linear-gradient(135deg, #8E44AD, #9B59B6)',
      accent: '#3498DB',
      background: 'linear-gradient(-45deg, #8E44AD, #9B59B6, #3498DB, #E74C3C)',
      text: '#2C3E50',
      isDark: false
    },
    dental: {
      primary: 'linear-gradient(135deg, #29B6F6, #4FC3F7)',
      accent: '#81C784',
      background: 'linear-gradient(-45deg, #29B6F6, #4FC3F7, #81C784, #64B5F6)',
      text: '#263238',
      isDark: false
    },
    medical: {
      primary: 'linear-gradient(135deg, #00897B, #26A69A)',
      accent: '#66BB6A',
      background: 'linear-gradient(-45deg, #00897B, #26A69A, #66BB6A, #42A5F5)',
      text: '#263238',
      isDark: false
    },
    general: {
      primary: 'linear-gradient(135deg, #667eea, #764ba2)',
      accent: '#667eea',
      background: 'linear-gradient(-45deg, #667eea, #764ba2, #f093fb, #f5576c)',
      text: '#ffffff',
      isDark: true
    }
  };
  
  return themes[type] || themes.general;
}

export function createSlug(businessName: string): string {
  return businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}
