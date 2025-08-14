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

export interface BusinessContent {
  tagline: string;
  description: string;
  services: string[];
  testimonials: Array<{name: string, text: string, rating: number}>;
  hours: { [key: string]: string };
  theme: BusinessTheme;
  businessType: string;
}

export interface BusinessTheme {
  primary: string;
  accent: string;
  background: string;
  text: string;
  isDark: boolean;
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
  if (/restaurant|pizza|burger|cafe|coffee|bakery|deli|grill|kitchen|food|eat|dining|bistro|bar|pub/.test(name)) return 'restaurant';
  if (/plumb|pipe|drain|water|leak|sewer|faucet/.test(name)) return 'plumbing';
  if (/salon|beauty|hair|nail|spa|barber|styling|cuts|color/.test(name)) return 'beauty';
  if (/auto|car|mechanic|repair|tire|brake|oil|transmission|automotive|garage/.test(name)) return 'auto';
  if (/clean|maid|janitorial|housekeeping|sanitiz/.test(name)) return 'cleaning';
  if (/electric|electrical|wire|wiring|power|voltage/.test(name)) return 'electrical';
  if (/construct|build|contractor|remodel|renovation/.test(name)) return 'construction';
  if (/store|shop|mart|market|boutique|retail/.test(name)) return 'retail';
  if (/dental|dentist|teeth|orthodont/.test(name)) return 'dental';
  if (/medical|clinic|doctor|health|care|wellness/.test(name)) return 'medical';
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
    restaurant: `Welcome to ${business.business_name}, where culinary excellence meets warm hospitality in the heart of ${city}. Our chefs prepare every dish with fresh, locally-sourced ingredients, creating unforgettable flavors that keep our guests coming back. From our signature dishes to daily specials, every meal is a celebration of taste and tradition. Whether you're joining us for a romantic dinner, family gathering, or quick lunch, we promise an exceptional dining experience that delights all your senses.`,
    
    plumbing: `${business.business_name} is ${city}'s most trusted plumbing service, available 24/7 for all your plumbing emergencies. With over 15 years of experience, our licensed and insured plumbers handle everything from simple repairs to complete system overhauls. We pride ourselves on transparent pricing, rapid response times, and guaranteed workmanship. Our team uses the latest technology and techniques to diagnose and fix problems quickly, saving you time and money while ensuring your plumbing systems work flawlessly.`,
    
    beauty: `At ${business.business_name}, we believe beauty is an art form that enhances your natural radiance. Our talented stylists and aestheticians are dedicated to helping you look and feel your absolute best. Using premium products and the latest techniques, we create personalized beauty experiences tailored to your unique style and preferences. Step into our modern, relaxing salon where transformation meets relaxation, and leave feeling refreshed, renewed, and absolutely beautiful.`,
    
    auto: `${business.business_name} is your one-stop destination for all automotive needs in ${city}. Our ASE-certified mechanics use state-of-the-art diagnostic equipment to keep your vehicle running at peak performance. From routine maintenance to major repairs, we treat every car like our own, ensuring safety and reliability on every drive. With honest pricing, detailed explanations, and a commitment to excellence, we've earned the trust of thousands of satisfied customers who rely on us for all their automotive needs.`,
    
    cleaning: `${business.business_name} delivers spotless results for homes and businesses throughout ${city}. Our professional cleaning team uses eco-friendly products and proven techniques to create healthier, more beautiful spaces. Whether you need regular maintenance or deep cleaning, we customize our services to exceed your expectations. With flexible scheduling, competitive rates, and a 100% satisfaction guarantee, we make it easy to maintain a pristine environment that you'll love coming home or working in.`,
    
    electrical: `${business.business_name} provides comprehensive electrical services to ${city} residents and businesses. Our licensed electricians are equipped to handle everything from simple outlet repairs to complete rewiring projects. We prioritize safety, efficiency, and code compliance in every job. With upfront pricing, same-day service availability, and a commitment to quality, we're the electrical contractor you can trust for all your power needs.`,
    
    construction: `${business.business_name} brings your construction visions to life with expertise, precision, and dedication. Serving ${city} for over a decade, we specialize in residential and commercial projects of all sizes. Our skilled team manages every aspect from planning to completion, ensuring your project stays on time and within budget. We combine traditional craftsmanship with modern techniques to deliver exceptional results that stand the test of time.`,
    
    retail: `Welcome to ${business.business_name}, ${city}'s premier shopping destination for quality products and exceptional service. Our carefully curated selection features the best brands and unique finds you won't see anywhere else. Our knowledgeable staff is always ready to help you find exactly what you're looking for. With competitive prices, regular promotions, and a commitment to customer satisfaction, we make shopping a pleasure, not a chore.`,
    
    dental: `${business.business_name} is committed to providing gentle, comprehensive dental care for the entire family. Our modern ${city} office combines advanced technology with a warm, welcoming atmosphere to ensure your comfort at every visit. From routine cleanings to complex procedures, our experienced team delivers personalized care that keeps your smile healthy and beautiful. We believe in preventive care and patient education, empowering you to maintain optimal oral health for life.`,
    
    medical: `At ${business.business_name}, your health and well-being are our top priorities. Our experienced medical team provides comprehensive healthcare services to ${city} and surrounding communities. We combine medical expertise with genuine compassion, taking time to listen to your concerns and develop personalized treatment plans. From preventive care to chronic disease management, we're your partner in achieving and maintaining optimal health.`,
    
    general: `${business.business_name} has been proudly serving ${city} with dedication and excellence. Our commitment to quality service and customer satisfaction has made us a trusted name in the community. We go above and beyond to ensure every client receives personalized attention and outstanding results. With competitive pricing, professional expertise, and a genuine care for our customers' needs, we've built lasting relationships based on trust and exceptional service.`
  };
  
  return descriptions[type] || descriptions.general;
}

export function generateServices(type: string): string[] {
  const services: { [key: string]: string[] } = {
    restaurant: [
      '🍽️ Fine Dining Experience',
      '🥡 Takeout & Delivery',
      '🎉 Private Event Catering',
      '👨‍🍳 Chef\'s Special Menu',
      '🍷 Wine & Beverage Pairing',
      '🎂 Special Occasion Celebrations'
    ],
    plumbing: [
      '🚨 24/7 Emergency Leak Repair',
      '🚿 Drain Cleaning & Unclogging',
      '🛁 Bathroom & Kitchen Remodeling',
      '🔥 Water Heater Installation & Repair',
      '🔧 Pipe Replacement & Repiping',
      '📋 Annual Maintenance Plans'
    ],
    beauty: [
      '✂️ Precision Haircuts & Styling',
      '🎨 Custom Color & Highlights',
      '💅 Manicure & Pedicure Services',
      '✨ Facial & Skin Treatments',
      '👰 Bridal & Special Event Packages',
      '💆 Relaxation Massage Therapy'
    ],
    auto: [
      '🛢️ Oil Changes & Fluid Services',
      '🔧 Complete Brake Service',
      '💻 Engine Diagnostics & Repair',
      '🔋 Battery Testing & Replacement',
      '❄️ AC Service & Repair',
      '🔄 Tire Rotation & Alignment'
    ],
    cleaning: [
      '🏠 Residential Deep Cleaning',
      '🏢 Commercial Office Services',
      '✨ Move-In/Move-Out Cleaning',
      '🪟 Window & Glass Cleaning',
      '🏗️ Post-Construction Cleanup',
      '📅 Weekly/Monthly Service Plans'
    ],
    electrical: [
      '⚡ Emergency Electrical Repairs',
      '💡 Lighting Installation & Design',
      '🔌 Outlet & Switch Installation',
      '📦 Panel Upgrades & Replacement',
      '🏠 Whole Home Rewiring',
      '🔍 Electrical Safety Inspections'
    ],
    construction: [
      '🏗️ New Construction Projects',
      '🔨 Home Additions & Extensions',
      '🏠 Complete Home Remodeling',
      '🚪 Kitchen & Bath Renovation',
      '🏛️ Commercial Build-Outs',
      '📐 Design & Planning Services'
    ],
    retail: [
      '🛍️ Wide Product Selection',
      '💳 Flexible Payment Options',
      '🚚 Home Delivery Service',
      '🎁 Gift Wrapping Available',
      '💰 Loyalty Rewards Program',
      '📱 Online Shopping Available'
    ],
    dental: [
      '🦷 Routine Cleanings & Exams',
      '✨ Teeth Whitening Services',
      '🔧 Fillings & Restorations',
      '👑 Crowns & Bridges',
      '😁 Cosmetic Dentistry',
      '🚨 Emergency Dental Care'
    ],
    medical: [
      '🏥 Primary Care Services',
      '💉 Vaccinations & Immunizations',
      '🔬 Laboratory Testing',
      '🩺 Annual Health Checkups',
      '💊 Chronic Disease Management',
      '🚑 Urgent Care Services'
    ],
    general: [
      '⭐ Premium Quality Service',
      '📞 24/7 Customer Support',
      '👥 Professional Expert Team',
      '✅ Satisfaction Guarantee',
      '💲 Competitive Pricing',
      '🏆 Award-Winning Service'
    ]
  };
  
  return services[type] || services.general;
}

export function generateTestimonials(type: string): Array<{name: string, text: string, rating: number}> {
  const testimonials: { [key: string]: Array<{name: string, text: string, rating: number}> } = {
    restaurant: [
      { name: 'Sarah M.', text: 'Absolutely incredible food! The atmosphere is perfect and the staff treats you like family. This is our go-to spot for special occasions.', rating: 5 },
      { name: 'John D.', text: 'Best dining experience in town! Fresh ingredients, amazing flavors, and portions that never disappoint. Highly recommend the chef\'s special!', rating: 5 },
      { name: 'Maria G.', text: 'We\'ve been coming here for years and it never disappoints. The consistency and quality are unmatched. A true gem in our community!', rating: 5 }
    ],
    plumbing: [
      { name: 'Robert K.', text: 'They saved us during a midnight emergency! Fast response, professional service, and fair pricing. These are the only plumbers we\'ll ever call.', rating: 5 },
      { name: 'Linda T.', text: 'Finally found honest plumbers! They explained everything clearly, stuck to their quote, and cleaned up perfectly. Exceptional service!', rating: 5 },
      { name: 'Mike S.', text: 'Had multiple issues fixed in one visit. Their expertise is evident, and they stand behind their work. Worth every penny!', rating: 5 }
    ],
    beauty: [
      { name: 'Jennifer L.', text: 'My hair has never looked better! They really listen to what you want and deliver beyond expectations. I won\'t go anywhere else!', rating: 5 },
      { name: 'Ashley R.', text: 'The entire team is amazing! From the moment you walk in, you feel pampered. My color and cut are always perfect.', rating: 5 },
      { name: 'Nicole P.', text: 'They transformed my look completely! Professional, talented, and genuinely care about making you feel beautiful. Highly recommend!', rating: 5 }
    ],
    auto: [
      { name: 'David H.', text: 'Most trustworthy mechanics I\'ve found! They explain everything, never push unnecessary services, and their work is guaranteed.', rating: 5 },
      { name: 'Susan B.', text: 'Been bringing my cars here for 10 years. Honest, reliable, and they always get it right the first time. Wouldn\'t go anywhere else!', rating: 5 },
      { name: 'Tom W.', text: 'They diagnosed a problem three other shops missed. Saved me thousands! Professional, knowledgeable, and fair pricing.', rating: 5 }
    ],
    cleaning: [
      { name: 'Emily R.', text: 'My house has never been cleaner! They pay attention to every detail and use eco-friendly products. Absolutely worth it!', rating: 5 },
      { name: 'James C.', text: 'Professional, punctual, and thorough. They transformed our office space! The team is friendly and trustworthy.', rating: 5 },
      { name: 'Patricia M.', text: 'I\'ve tried many cleaning services, but none compare. Consistent quality, great communication, and reasonable prices!', rating: 5 }
    ],
    electrical: [
      { name: 'Mark T.', text: 'Fixed our electrical issues quickly and safely. Very knowledgeable, explained everything, and cleaned up perfectly. Highly recommend!', rating: 5 },
      { name: 'Carol S.', text: 'Professional from start to finish. They upgraded our entire panel and the work was flawless. Fair pricing and excellent service!', rating: 5 },
      { name: 'Brian L.', text: 'Emergency service at its best! They came out immediately and fixed our power outage. Reliable and trustworthy electricians!', rating: 5 }
    ],
    construction: [
      { name: 'Steve M.', text: 'They transformed our home beautifully! On time, on budget, and the quality exceeded our expectations. True professionals!', rating: 5 },
      { name: 'Diana K.', text: 'From design to completion, everything was perfect. They communicated throughout the project and delivered amazing results!', rating: 5 },
      { name: 'Paul R.', text: 'Best contractors we\'ve worked with! Attention to detail, quality craftsmanship, and they stand behind their work. Highly recommend!', rating: 5 }
    ],
    retail: [
      { name: 'Lisa H.', text: 'Amazing selection and incredible service! The staff is knowledgeable and always helpful. My favorite place to shop!', rating: 5 },
      { name: 'Kevin D.', text: 'Great prices and quality products! They have everything I need and the customer service is outstanding. Highly recommend!', rating: 5 },
      { name: 'Rachel G.', text: 'Love shopping here! Unique items, fair prices, and they always go above and beyond to help. A true community gem!', rating: 5 }
    ],
    dental: [
      { name: 'Amanda F.', text: 'Best dental experience ever! Gentle, thorough, and they really care about your comfort. My whole family goes here now!', rating: 5 },
      { name: 'Richard B.', text: 'They made my dental anxiety disappear! Professional, caring, and the results are amazing. Couldn\'t be happier!', rating: 5 },
      { name: 'Jessica T.', text: 'Outstanding dental care! Modern equipment, friendly staff, and they explain everything clearly. Highly recommend to everyone!', rating: 5 }
    ],
    medical: [
      { name: 'Nancy W.', text: 'Exceptional medical care! The doctors really listen and take time to explain everything. I feel like I\'m in great hands!', rating: 5 },
      { name: 'George H.', text: 'Professional, compassionate, and thorough. They\'ve helped manage my health conditions perfectly. Couldn\'t ask for better care!', rating: 5 },
      { name: 'Mary L.', text: 'The entire staff is wonderful! From reception to doctors, everyone is caring and professional. Best medical practice in town!', rating: 5 }
    ],
    general: [
      { name: 'Alex J.', text: 'Outstanding service every time! Professional, reliable, and they always exceed expectations. Highly recommend to everyone!', rating: 5 },
      { name: 'Chris M.', text: 'Best in the business! Quality work, fair prices, and exceptional customer service. They\'ve earned a customer for life!', rating: 5 },
      { name: 'Taylor S.', text: 'Absolutely fantastic! They go above and beyond to ensure satisfaction. Professional, courteous, and deliver amazing results!', rating: 5 }
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
      primary: 'linear-gradient(135deg, #ff6b6b, #ffd93d)',
      accent: '#ff6b6b',
      background: 'linear-gradient(-45deg, #ff6b6b, #ffd93d, #ff8787, #ffb347)',
      text: '#2d3436',
      isDark: false
    },
    plumbing: {
      primary: 'linear-gradient(135deg, #0984e3, #00b894)',
      accent: '#0984e3',
      background: 'linear-gradient(-45deg, #0984e3, #00b894, #00cec9, #74b9ff)',
      text: '#2d3436',
      isDark: false
    },
    beauty: {
      primary: 'linear-gradient(135deg, #e84393, #a29bfe)',
      accent: '#e84393',
      background: 'linear-gradient(-45deg, #e84393, #a29bfe, #fd79a8, #fdcb6e)',
      text: '#2d3436',
      isDark: false
    },
    auto: {
      primary: 'linear-gradient(135deg, #2d3436, #636e72)',
      accent: '#00b894',
      background: 'linear-gradient(-45deg, #2d3436, #636e72, #34495e, #95a5a6)',
      text: '#ffffff',
      isDark: true
    },
    cleaning: {
      primary: 'linear-gradient(135deg, #00cec9, #55efc4)',
      accent: '#00cec9',
      background: 'linear-gradient(-45deg, #00cec9, #55efc4, #81ecec, #74b9ff)',
      text: '#2d3436',
      isDark: false
    },
    electrical: {
      primary: 'linear-gradient(135deg, #fdcb6e, #e17055)',
      accent: '#fdcb6e',
      background: 'linear-gradient(-45deg, #fdcb6e, #e17055, #fab1a0, #ffeaa7)',
      text: '#2d3436',
      isDark: false
    },
    construction: {
      primary: 'linear-gradient(135deg, #636e72, #2d3436)',
      accent: '#e17055',
      background: 'linear-gradient(-45deg, #636e72, #2d3436, #95a5a6, #535c68)',
      text: '#ffffff',
      isDark: true
    },
    retail: {
      primary: 'linear-gradient(135deg, #6c5ce7, #00cec9)',
      accent: '#6c5ce7',
      background: 'linear-gradient(-45deg, #6c5ce7, #00cec9, #a29bfe, #55efc4)',
      text: '#2d3436',
      isDark: false
    },
    dental: {
      primary: 'linear-gradient(135deg, #74b9ff, #a29bfe)',
      accent: '#74b9ff',
      background: 'linear-gradient(-45deg, #74b9ff, #a29bfe, #81ecec, #dfe6e9)',
      text: '#2d3436',
      isDark: false
    },
    medical: {
      primary: 'linear-gradient(135deg, #00b894, #00cec9)',
      accent: '#00b894',
      background: 'linear-gradient(-45deg, #00b894, #00cec9, #55efc4, #81ecec)',
      text: '#2d3436',
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
