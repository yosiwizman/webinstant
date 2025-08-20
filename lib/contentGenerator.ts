import Together from 'together-ai';
import Replicate from 'replicate';

// Initialize AI clients
const together = new Together({
  apiKey: process.env.TOGETHER_API_KEY || '',
});

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || '',
});

// Dynamic imports for optional dependencies
let Anthropic: unknown = null;
let getJson: unknown = null;
let tinify: unknown = null;

async function initializeOptionalDependencies() {
  try {
    const anthropicModule = await import('@anthropic-ai/sdk');
    Anthropic = anthropicModule.default;
    console.log('✓ Anthropic SDK loaded');
  } catch (e) {
    console.log('✗ Anthropic SDK not available');
  }

  try {
    const serpModule = await import('serpapi');
    getJson = serpModule.getJson;
    console.log('✓ SerpAPI loaded');
  } catch (e) {
    console.log('✗ SerpAPI not available');
  }

  try {
    const tinifyModule = await import('tinify');
    tinify = tinifyModule.default;
    if (process.env.TINYPNG_API_KEY) {
      (tinify as any).key = process.env.TINYPNG_API_KEY;
      console.log('✓ TinyPNG configured');
    }
  } catch (e) {
    console.log('✗ TinyPNG not available');
  }
}

// Initialize on module load
initializeOptionalDependencies();

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
  logo?: BusinessLogo;
  videoBackground?: string;
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

export interface BusinessLogo {
  type: 'image' | 'text';
  url?: string;
  html?: string;
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

// Layout variation function
export function getLayoutVariation(businessName: string): number {
  // Use business name to consistently pick layout 0, 1, or 2
  const hash = businessName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return hash % 3;
}

// Check existing website using SerpAPI
export async function checkExistingWebsite(business: unknown): Promise<boolean> {
  const businessData = business as { business_name: string; city?: string };
  
  if (!process.env.SERPAPI_KEY || !getJson) {
    console.log('⚠️ SerpAPI not configured, skipping website check');
    return false;
  }
  
  console.log(`🔍 Checking if ${businessData.business_name} has existing website...`);
  
  try {
    console.log('  → Using SerpAPI...');
    const results = await (getJson as any)({
      api_key: process.env.SERPAPI_KEY,
      engine: "google",
      q: `${businessData.business_name} ${businessData.city || ''} official website`,
      location: businessData.city || 'United States',
      num: 3
    });
    
    const hasWebsite = results.organic_results?.some((result: { link?: string }) => {
      const url = result.link?.toLowerCase() || '';
      const businessNameClean = businessData.business_name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return url.includes(businessNameClean);
    });
    
    console.log(hasWebsite ? '  ✓ Has existing website' : '  ✓ No website found - good candidate!');
    return hasWebsite;
    
  } catch (error) {
    console.error('  ✗ SerpAPI check failed:', error);
    return false;
  }
}

// Premium content generation with Claude or Together AI
export async function generatePremiumContent(business: unknown): Promise<BusinessContent> {
  const businessData = business as { business_name: string; city?: string };
  console.log('🚀 API CALL: Starting content generation for:', businessData.business_name);
  console.log(`🎨 Generating content for ${businessData.business_name}...`);
  
  try {
    // Try Claude first if API key is available
    if (process.env.ANTHROPIC_API_KEY && Anthropic) {
      console.log('  → Using Anthropic Claude...');
      return await generateContentWithClaude(business);
    }
    
    // Fallback to Together AI
    console.log('  → Using Together AI...');
    return await generateContentWithTogether(business);
  } catch (error) {
    console.error('  ✗ AI content generation failed, using premium fallback:', error);
    // Use premium fallback content
    return generateBusinessContent(business);
  }
}

async function generateContentWithClaude(business: unknown): Promise<BusinessContent> {
  const businessData = business as { business_name: string; city?: string };
  
  try {
    const anthropic = new (Anthropic as any)({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    const businessType = detectBusinessType(businessData.business_name);
    
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1000,
      temperature: 0.7,
      messages: [{
        role: "user",
        content: `Create compelling website content for ${businessData.business_name}, a ${businessType} in ${businessData.city || 'the area'}. 
        
        Generate a JSON response with:
        {
          "tagline": "Powerful tagline (10-15 words)",
          "about": "About section (75 words) that tells their story",
          "services": ["Service 1 name", "Service 2 name", "Service 3 name"],
          "testimonials": [
            {"name": "Customer Name", "text": "Review text", "rating": 5}
          ]
        }
        
        Make it persuasive, professional, and unique to this business. Return ONLY valid JSON.`
      }]
    });

    console.log('  ✓ Anthropic Claude content generated successfully');
    
    // Parse the response - Claude returns content in a specific format
    let content: { tagline?: string; about?: string; services?: unknown[]; testimonials?: unknown[] };
    try {
      // Claude returns content as an array, get the text from the first item
      const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
      content = JSON.parse(responseText);
    } catch (parseError) {
      console.error('  ⚠️ Failed to parse Claude response, using fallback content');
      // Return fallback if parsing fails
      return generateBusinessContent(business);
    }
    
    // Generate logo and video background
    const logo = await generateBusinessLogo(businessData.business_name, businessType);
    const videoBackground = await generateVideoBackground(businessType);
    
    // Ensure services are strings (add emojis if not present)
    const services = Array.isArray(content.services) 
      ? content.services.map((s: unknown) => {
          if (typeof s === 'string') {
            // Add emoji if not present
            if (!s.match(/^[🍽️🥡🎉👨‍🍳🍷🎂🚨🚿🛁🔥🔧📋✂️🎨💅✨👰💆🛢️💻🔋❄️🔄🏠🏢🪟🏗️📅⭐📞👥✅💲🏆]/)) {
              const emojis = businessType === 'restaurant' ? ['🍽️', '🥡', '🎉'] :
                            businessType === 'plumbing' ? ['🚨', '🚿', '🛁'] :
                            businessType === 'beauty' ? ['✂️', '💅', '✨'] :
                            businessType === 'auto' ? ['🛢️', '🔧', '💻'] :
                            businessType === 'cleaning' ? ['🏠', '✨', '🪟'] :
                            ['⭐', '📞', '✅'];
              const emoji = emojis[Math.floor(Math.random() * emojis.length)];
              return `${emoji} ${s}`;
            }
            return s;
          }
          return typeof s === 'object' && s !== null && 'name' in s ? (s as { name: string }).name : 'Premium Service';
        })
      : generateServices(businessType);
    
    // Ensure testimonials have proper structure
    const testimonials = Array.isArray(content.testimonials) 
      ? content.testimonials.map((t: unknown) => {
          const testimonial = t as { name?: string; text?: string; review?: string; rating?: number };
          return {
            name: testimonial.name || 'Satisfied Customer',
            text: testimonial.text || testimonial.review || 'Excellent service!',
            rating: testimonial.rating || 5
          };
        })
      : generateTestimonials(businessType);
    
    return {
      tagline: content.tagline || generateTagline(businessType, businessData.business_name),
      description: content.about || generateDescription(businessType, business),
      services,
      testimonials,
      hours: generateBusinessHours(businessType),
      theme: getThemeForType(businessType),
      businessType,
      logo,
      videoBackground: videoBackground || undefined
    };
  } catch (error) {
    console.error('  ✗ Claude generation failed:', error);
    // Return fallback content on error
    return generateBusinessContent(business);
  }
}

async function generateContentWithTogether(business: unknown): Promise<BusinessContent> {
  const businessData = business as { business_name: string; city?: string };
  
  try {
    const businessType = detectBusinessType(businessData.business_name);
    const keywords = getIndustryKeywords(businessType);
    
    const prompt = `Generate premium website content for ${businessData.business_name}, a high-end ${businessType} business in ${businessData.city || 'the area'}.

Create compelling, sophisticated content that positions this as a premium $2000+ value business.

Format your response as JSON with these fields:
{
  "tagline": "Powerful tagline (8-12 words)",
  "description": "Compelling about section (80-100 words)",
  "services": ["Service 1 with icon emoji", "Service 2 with icon emoji", "Service 3 with icon emoji"],
  "testimonials": [
    {"name": "Customer Name", "text": "Review text", "rating": 5}
  ]
}`;

    console.log('🚀 Calling Together AI API...');
    const completion = await together.chat.completions.create({
      model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
      messages: [
        {
          role: 'system',
          content: 'You are a premium website copywriter. Create compelling, SEO-optimized content. Return valid JSON only.'
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

    console.log('  ✓ Together AI content generated successfully');

    try {
      const content = JSON.parse(response) as { tagline?: string; description?: string; services?: unknown[]; testimonials?: unknown[] };
      
      // Generate logo and video background
      const logo = await generateBusinessLogo(businessData.business_name, businessType);
      const videoBackground = await generateVideoBackground(businessType);
      
      // Ensure services are strings
      const services = Array.isArray(content.services) 
        ? content.services.map((s: unknown) => typeof s === 'string' ? s : 'Premium Service')
        : generateServices(businessType);
      
      // Ensure testimonials have proper structure
      const testimonials = Array.isArray(content.testimonials) 
        ? content.testimonials.map((t: unknown) => {
            const testimonial = t as { name?: string; text?: string; rating?: number };
            return {
              name: testimonial.name || 'Satisfied Customer',
              text: testimonial.text || 'Excellent service!',
              rating: testimonial.rating || 5
            };
          })
        : generateTestimonials(businessType);
      
      return {
        tagline: content.tagline || generateTagline(businessType, businessData.business_name),
        description: content.description || generateDescription(businessType, business),
        services,
        testimonials,
        hours: generateBusinessHours(businessType),
        theme: getThemeForType(businessType),
        businessType,
        logo,
        videoBackground: videoBackground || undefined
      };
    } catch (parseError) {
      console.error('  ✗ Failed to parse AI response:', parseError);
      // Return fallback content on parse error
      return generateBusinessContent(business);
    }
  } catch (error) {
    console.error('  ✗ Together AI generation failed:', error);
    // Return fallback content on error
    return generateBusinessContent(business);
  }
}

// AI Logo Generation
async function generateBusinessLogo(businessName: string, businessType: string): Promise<BusinessLogo> {
  console.log('  🎨 Generating logo...');
  
  // Option A: Try AI-generated logo first
  try {
    console.log('    → Using Replicate for logo generation...');
    
    const logoPrompts: { [key: string]: string } = {
      restaurant: 'minimalist pizza slice icon, simple geometric logo, flat design, svg style',
      plumbing: 'water drop with wrench icon, minimalist plumbing logo, blue, simple svg',
      beauty: 'scissors and comb icon, elegant beauty logo, minimalist, pink, svg style',
      auto: 'wrench and gear icon, automotive logo, minimalist, professional, svg',
      cleaning: 'sparkle and broom icon, cleaning service logo, fresh, minimalist, svg'
    };

    console.log('🚀 Calling Replicate API...');
    const output = await replicate.run(
      "stability-ai/stable-diffusion:db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf",
      {
        input: {
          prompt: logoPrompts[businessType] || 'minimalist business logo, simple, professional',
          width: 256,
          height: 256,
          num_outputs: 1
        }
      }
    );
    
    if (Array.isArray(output) && output.length > 0) {
      console.log('    ✓ Logo generated with Replicate');
      
      // Try to compress with TinyPNG
      if (tinify && process.env.TINYPNG_API_KEY) {
        try {
          console.log('    → Using TinyPNG to compress logo...');
          const source = (tinify as any).fromUrl(output[0]);
          const compressed = await source.toBuffer();
          console.log('    ✓ Logo compressed with TinyPNG');
        } catch (e) {
          console.log('    ⚠️ TinyPNG compression failed, using original');
        }
      }
      
      return {
        type: 'image',
        url: output[0]
      };
    }
    throw new Error('No logo generated');
  } catch (error) {
    // Option B: Fallback to premium typography logo
    console.log('    ⚠️ AI logo generation failed, using typography logo fallback');
    return {
      type: 'text',
      html: generateTypographyLogo(businessName, businessType)
    };
  }
}

function generateTypographyLogo(name: string, type: string): string {
  const fonts: { [key: string]: string } = {
    restaurant: 'Playfair Display',
    plumbing: 'Oswald',
    beauty: 'Dancing Script',
    auto: 'Russo One',
    cleaning: 'Comfortaa'
  };
  
  const firstLetter = name.charAt(0);
  const restOfName = name.slice(1);
  
  return `
    <div class="premium-logo">
      <span class="logo-first">${firstLetter}</span>
      <span class="logo-rest">${restOfName}</span>
    </div>
  `;
}

// Video Background Generation
async function generateVideoBackground(businessType: string): Promise<string | null> {
  console.log('  🎬 Generating video background...');
  
  try {
    console.log('    → Using Replicate for video generation...');
    
    const videoPrompts: { [key: string]: string } = {
      restaurant: 'chef cooking pasta, steam rising, kitchen, professional cooking, cinematic',
      plumbing: 'water flowing through modern faucet, slow motion, crystal clear',
      beauty: 'hair styling in salon, professional stylist, elegant movements',
      auto: 'mechanic working on car engine, professional garage, tools',
      cleaning: 'sparkling clean surfaces being wiped, satisfying cleaning, fresh'
    };

    // Generate short video clip
    console.log('🚀 Calling Replicate API...');
    const output = await replicate.run(
      "stability-ai/stable-video-diffusion:3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438",
      {
        input: {
          cond_aug: 0.02,
          decoding_t: 7,
          input_image: videoPrompts[businessType] || videoPrompts.cleaning,
          video_length: "14_frames_with_svd",
          sizing_strategy: "maintain_aspect_ratio",
          motion_bucket_id: 127,
          frames_per_second: 6
        }
      }
    );
    
    console.log('    ✓ Video background generated with Replicate');
    return (output as unknown as string) || null;
  } catch (error) {
    console.log('    ⚠️ Video generation failed, using static image');
    return null;
  }
}

// Trust Signals Generation
export function generateTrustSignals(businessType: string, businessName: string): string {
  const yearFounded = 2015 + Math.floor(Math.random() * 5); // Random year 2015-2019
  const customerCount = 300 + Math.floor(Math.random() * 700); // 300-1000 customers
  
  return `
    <section class="trust-signals">
      <div class="container">
        <div class="trust-container">
          <div class="trust-badge animate-on-scroll" style="--delay: 1">
            <div class="badge-icon">🛡️</div>
            <div class="badge-text">
              <strong>Licensed & Insured</strong>
              <span>Fully Certified</span>
            </div>
          </div>
          <div class="trust-badge animate-on-scroll" style="--delay: 2">
            <div class="badge-icon">👨‍👩‍👧‍👦</div>
            <div class="badge-text">
              <strong>Family Owned</strong>
              <span>Since ${yearFounded}</span>
            </div>
          </div>
          <div class="trust-badge animate-on-scroll" style="--delay: 3">
            <div class="badge-icon">⭐</div>
            <div class="badge-text">
              <strong>${customerCount}+</strong>
              <span>Happy Customers</span>
            </div>
          </div>
          <div class="trust-badge animate-on-scroll" style="--delay: 4">
            <div class="badge-icon">⚡</div>
            <div class="badge-text">
              <strong>Same Day Service</strong>
              <span>Available 24/7</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

// Social Proof Ticker
export function generateSocialProofTicker(city: string): string {
  const names = ['John', 'Maria', 'David', 'Sarah', 'Michael', 'Jennifer', 'Robert', 'Lisa'];
  const areas = city ? [`${city} Downtown`, `North ${city}`, `${city} Heights`, `West ${city}`, `${city} Park`] : 
                      ['Downtown', 'Northside', 'Westside', 'Eastside', 'Central'];
  const actions = ['just requested a quote', 'booked a service', 'left a 5-star review', 'scheduled an appointment'];
  
  return `
    <div class="social-proof-ticker">
      <div class="ticker-content">
        <span class="ticker-item">🔥 ${names[0]} from ${areas[0]} ${actions[0]} 2 minutes ago</span>
        <span class="ticker-item">⭐ ${names[1]} from ${areas[1]} ${actions[1]} 5 minutes ago</span>
        <span class="ticker-item">✅ ${names[2]} from ${areas[2]} ${actions[2]} 12 minutes ago</span>
        <span class="ticker-item">🎉 ${names[3]} from ${areas[3]} ${actions[3]} 18 minutes ago</span>
        <span class="ticker-item">💯 ${names[4]} from ${areas[4]} ${actions[0]} 25 minutes ago</span>
      </div>
    </div>
  `;
}

// Interactive Elements
export function generateInteractiveElements(businessType: string): string {
  const calculators: { [key: string]: string } = {
    restaurant: `
      <div class="quote-calculator premium-card">
        <h3>Party Size Calculator</h3>
        <input type="range" min="2" max="50" value="10" id="party-size" class="premium-slider">
        <p>Guests: <span id="guest-count">10</span></p>
        <p class="estimate-text">Estimated Cost: $<span id="cost-estimate">250</span></p>
        <button class="btn-premium pulse">Reserve Now</button>
      </div>
    `,
    auto: `
      <div class="service-estimator premium-card">
        <h3>Instant Service Estimate</h3>
        <select class="premium-select">
          <option>Oil Change - $39</option>
          <option>Brake Service - $199</option>
          <option>Tire Rotation - $29</option>
          <option>Full Inspection - $89</option>
        </select>
        <button class="btn-premium pulse">Book This Service</button>
      </div>
    `,
    beauty: `
      <div class="booking-widget premium-card">
        <h3>Book Your Appointment</h3>
        <input type="date" min="${new Date().toISOString().split('T')[0]}" class="premium-input">
        <select class="premium-select">
          <option>Haircut - $45</option>
          <option>Color - $120</option>
          <option>Manicure - $35</option>
        </select>
        <button class="btn-premium pulse">Check Availability</button>
      </div>
    `,
    plumbing: `
      <div class="service-estimator premium-card">
        <h3>Emergency Service Calculator</h3>
        <select class="premium-select">
          <option>Burst Pipe - $150-300</option>
          <option>Clogged Drain - $100-200</option>
          <option>Water Heater - $800-2000</option>
          <option>Leak Repair - $200-500</option>
        </select>
        <button class="btn-premium pulse">Get Emergency Help</button>
      </div>
    `,
    cleaning: `
      <div class="quote-calculator premium-card">
        <h3>Instant Quote Calculator</h3>
        <select class="premium-select">
          <option>Studio/1BR - $80-120</option>
          <option>2BR - $120-180</option>
          <option>3BR - $180-250</option>
          <option>4BR+ - $250+</option>
        </select>
        <select class="premium-select">
          <option>One Time</option>
          <option>Weekly (20% off)</option>
          <option>Bi-Weekly (15% off)</option>
          <option>Monthly (10% off)</option>
        </select>
        <button class="btn-premium pulse">Get Your Quote</button>
      </div>
    `
  };
  
  return calculators[businessType] || calculators.auto;
}

// Google Reviews Widget
export function generateReviewsWidget(): string {
  const rating = (4.7 + Math.random() * 0.3).toFixed(1); // 4.7-5.0 rating
  const reviewCount = 80 + Math.floor(Math.random() * 150); // 80-230 reviews
  
  return `
    <div class="google-reviews-widget premium-card">
      <div class="reviews-header">
        <svg class="google-logo" width="74" height="24" viewBox="0 0 74 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M9.24 8.19v2.46h5.88c-.18 1.38-.64 2.39-1.34 3.1-.86.86-2.2 1.8-4.54 1.8-3.62 0-6.45-2.92-6.45-6.54s2.83-6.54 6.45-6.54c1.95 0 3.38.77 4.43 1.76L15.4 2.5C13.94 1.08 11.98 0 9.24 0 4.28 0 .11 4.04.11 9s4.17 9 9.13 9c2.68 0 4.7-.88 6.28-2.52 1.62-1.62 2.13-3.91 2.13-5.75 0-.57-.04-1.1-.13-1.54H9.24z" fill="#4285F4"/>
          <path d="M25 6.19c-3.21 0-5.83 2.44-5.83 5.81 0 3.34 2.62 5.81 5.83 5.81s5.83-2.46 5.83-5.81c0-3.37-2.62-5.81-5.83-5.81zm0 9.33c-1.76 0-3.28-1.45-3.28-3.52 0-2.09 1.52-3.52 3.28-3.52s3.28 1.43 3.28 3.52c0 2.07-1.52 3.52-3.28 3.52z" fill="#EA4335"/>
          <path d="M53.58 7.49h-.09c-.57-.68-1.67-1.3-3.06-1.3C47.53 6.19 45 8.72 45 12c0 3.26 2.53 5.81 5.43 5.81 1.39 0 2.49-.62 3.06-1.32h.09v.81c0 2.22-1.19 3.41-3.1 3.41-1.56 0-2.53-1.12-2.93-2.07l-2.22.92c.64 1.54 2.33 3.43 5.15 3.43 2.99 0 5.52-1.76 5.52-6.05V6.49h-2.42v1zm-2.93 8.03c-1.76 0-3.1-1.5-3.1-3.52 0-2.05 1.34-3.52 3.1-3.52 1.74 0 3.1 1.5 3.1 3.54.01 2.03-1.36 3.5-3.1 3.5z" fill="#FBBC05"/>
          <path d="M38 6.19c-3.21 0-5.83 2.44-5.83 5.81 0 3.34 2.62 5.81 5.83 5.81s5.83-2.46 5.83-5.81c0-3.37-2.62-5.81-5.83-5.81zm0 9.33c-1.76 0-3.28-1.45-3.28-3.52 0-2.09 1.52-3.52 3.28-3.52s3.28 1.43 3.28 3.52c0 2.07-1.52 3.52-3.28 3.52z" fill="#34A853"/>
          <path d="M58 .24h2.51v17.57H58z" fill="#4285F4"/>
          <path d="M68.26 15.52c-1.3 0-2.22-.59-2.82-1.76l7.77-3.21-.26-.66c-.48-1.3-1.96-3.7-4.97-3.7-2.99 0-5.48 2.35-5.48 5.81 0 3.26 2.46 5.81 5.76 5.81 2.66 0 4.2-1.63 4.84-2.57l-1.98-1.32c-.66.96-1.56 1.6-2.86 1.6zm-.18-7.15c1.03 0 1.91.53 2.2 1.28l-5.25 2.17c0-2.44 1.73-3.45 3.05-3.45z" fill="#EA4335"/>
        </svg>
        <div class="rating-info">
          <div class="stars">
            ${'★'.repeat(Math.floor(parseFloat(rating)))}${'☆'.repeat(5 - Math.floor(parseFloat(rating)))}
          </div>
          <span>${rating} stars · ${reviewCount} reviews</span>
        </div>
      </div>
      <div class="recent-reviews">
        <div class="review-card">
          <strong>John D.</strong> <span class="stars">★★★★★</span>
          <p>"Absolutely incredible service! They went above and beyond my expectations. Highly recommend to anyone looking for quality work."</p>
          <span class="review-date">2 days ago</span>
        </div>
        <div class="review-card">
          <strong>Sarah M.</strong> <span class="stars">★★★★★</span>
          <p>"Best experience I've had. Professional, punctual, and the results speak for themselves. Will definitely return!"</p>
          <span class="review-date">1 week ago</span>
        </div>
      </div>
      <button class="btn-secondary">See All Reviews on Google</button>
    </div>
  `;
}

// Live Chat Bubble
export function generateLiveChatBubble(phone: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  return `
    <div class="live-chat-bubble" id="chatBubble">
      <div class="chat-icon">💬</div>
      <span>Chat Now</span>
      <div class="chat-popup" id="chatPopup">
        <a href="tel:${phone}" class="chat-option">📞 Call Us</a>
        <a href="https://wa.me/1${cleanPhone}" target="_blank" class="chat-option">💬 WhatsApp</a>
        <a href="sms:${phone}" class="chat-option">📱 Text Us</a>
      </div>
    </div>
  `;
}

// Exit Intent Popup
export function generateExitIntentPopup(businessName: string): string {
  return `
    <div class="exit-popup" id="exitPopup">
      <div class="popup-content">
        <button class="close-popup" onclick="document.getElementById('exitPopup').style.display='none'">×</button>
        <h2>Wait! Special Offer 🎉</h2>
        <p class="offer-text">Get 20% OFF your first service!</p>
        <p>This offer expires in:</p>
        <div class="countdown" id="countdown">48:00:00</div>
        <button class="btn-premium pulse" onclick="document.getElementById('exitPopup').style.display='none'">Claim Your Discount</button>
        <p class="disclaimer">*Limited time offer for new customers only</p>
      </div>
    </div>
  `;
}

// AI Image Generation with Replicate
export async function generateBusinessImages(businessType: string, businessName: string): Promise<BusinessImages> {
  console.log('🚀 API CALL: Starting image generation for:', businessType);
  console.log(`📸 Generating images for ${businessName}...`);
  
  try {
    console.log('  → Using Replicate for image generation...');
    const prompts = getImagePrompts(businessType, businessName);
    
    const images = await Promise.all([
      generateImage(prompts.hero, 'hero'),
      generateImage(prompts.service, 'service'),
      generateImage(prompts.team, 'team')
    ]);

    console.log(`  ✓ Generated ${images.filter(img => img).length} images with Replicate`);

    // Try to compress images with TinyPNG
    if (tinify && process.env.TINYPNG_API_KEY) {
      console.log('  → Using TinyPNG to compress images...');
      let compressedCount = 0;
      for (let i = 0; i < images.length; i++) {
        if (images[i]) {
          try {
            const source = (tinify as any).fromUrl(images[i]);
            await source.toBuffer();
            compressedCount++;
          } catch (e) {
            // Keep original if compression fails
          }
        }
      }
      if (compressedCount > 0)  {
        console.log(`  ✓ Compressed ${compressedCount} images with TinyPNG`);
      }
    }

    return {
      hero: images[0],
      service: images[1],
      team: images[2],
      gallery: images
    };
  } catch (error) {
    console.error('  ✗ Image generation failed, using premium stock photos:', error);
    return getPremiumStockImages(businessType);
  }
}

async function generateImage(prompt: string, type: string): Promise<string> {
  try {
    console.log(`    - Generating ${type} image...`);
    console.log('🚀 Calling Replicate API...');
    const output = await replicate.run(
      "bytedance/sdxl-lightning-4step:5599ed30703defd1d160a25a63321b4dec97101d98b4674bcc56e41f62f35637",
      {
        input: {
          prompt: prompt + ", high quality, professional photography, 8k, ultra detailed, no text, no watermarks",
          width: 1024,
          height: 768,
          num_outputs: 1,
          scheduler: "K_EULER",
          guidance_scale: 0,
          negative_prompt: "worst quality, low quality, text, watermark, logo, banner, extra digits, cropped, jpeg artifacts, signature, username, error, sketch, duplicate, ugly, monochrome, geometry, mutation, disgusting"
        }
      }
    );
    
    if (Array.isArray(output) && output.length > 0) {
      console.log(`    ✓ ${type} image generated`);
      return output[0];
    }
    throw new Error('No image generated');
  } catch (error) {
    console.error(`    ✗ Failed to generate ${type} image:`, error);
    // Return a high-quality placeholder
    return `https://picsum.photos/1024/768?random=${Math.random()}`;
  }
}

function getImagePrompts(businessType: string, businessName: string): { hero: string; service: string; team: string } {
  const prompts: { [key: string]: { hero: string; service: string; team: string } } = {
    restaurant: {
      hero: `modern upscale restaurant interior, ${businessName}, warm ambient lighting, elegant dining room with mahogany furniture, crystal chandeliers, wine cellar, professional architectural photography, golden hour`,
      service: 'gourmet chef plating exquisite dish in professional kitchen, molecular gastronomy, truffle shavings, artistic food presentation, steam rising, macro food photography, michelin star quality',
      team: 'professional chef team in pristine commercial kitchen, white chef uniforms, stainless steel appliances, coordinated cooking, teamwork, smiling faces, restaurant staff'
    },
    plumbing: {
      hero: 'ultra modern luxury bathroom with rainfall shower, freestanding bathtub, gold fixtures, marble surfaces, perfect plumbing installation, spa atmosphere, natural lighting, high-end',
      service: 'professional plumber in uniform installing high-end bathroom fixtures, precision work with copper pipes, modern tools, clean workspace, detailed craftsmanship',
      team: 'professional plumbing service team with branded van, uniformed technicians, modern equipment, friendly faces, fleet vehicles, trustworthy appearance'
    },
    beauty: {
      hero: `luxury beauty salon interior, ${businessName}, pink and gold decor, velvet chairs, illuminated mirrors, crystal chandeliers, marble stations, fresh flowers, instagram worthy`,
      service: 'professional hairstylist creating elegant hairstyle, luxury hair treatment, balayage technique, salon lighting, premium hair products, transformation in progress',
      team: 'team of beauty professionals, stylists and makeup artists, designer uniforms, warm smiles, diverse team, modern salon, professional appearance'
    },
    auto: {
      hero: 'state-of-the-art auto repair facility, luxury car service center, spotless garage with lifts, high-tech diagnostic equipment, organized tool walls, professional atmosphere',
      service: 'certified mechanic performing diagnostics on luxury vehicle, computer analysis, professional tools, clean uniform, precision work, modern auto shop',
      team: 'ASE certified mechanics team in professional uniforms, modern auto facility, diagnostic equipment, friendly service advisors, trustworthy appearance'
    },
    cleaning: {
      hero: 'sparkling clean luxury home interior, sunlight through spotless windows, pristine white surfaces, fresh flowers, organized spaces, magazine worthy, immaculate',
      service: 'professional cleaners in uniform using eco-friendly products, detailed cleaning, modern equipment, systematic approach, attention to detail, sparkling results',
      team: 'professional cleaning crew in matching uniforms, eco-friendly supplies, diverse team, smiling faces, modern equipment, trustworthy appearance'
    },
    general: {
      hero: 'modern professional business office, impressive architecture, corporate building exterior, landscaped entrance, sunset lighting, high-end commercial property',
      service: 'professional team providing excellent service, modern workspace, client meeting, quality work, attention to detail, business professionals',
      team: 'professional business team in corporate attire, diverse group, modern office, teamwork, friendly faces, successful company'
    }
  };
  
  return prompts[businessType] || prompts.general;
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

export class ContentGenerator {
  private together: Together;
  private replicate: Replicate;
  private anthropic: unknown;
  private serpApiAvailable: boolean = false;
  private tinifyAvailable: boolean = false;

  constructor(togetherKey?: string, replicateToken?: string) {
    this.together = new Together({
      apiKey: togetherKey || process.env.TOGETHER_API_KEY || '',
    });
    
    this.replicate = new Replicate({
      auth: replicateToken || process.env.REPLICATE_API_TOKEN || '',
    });

    console.log('🚀 ContentGenerator initialized with:');
    console.log('  - Together AI:', !!process.env.TOGETHER_API_KEY);
    console.log('  - Replicate:', !!process.env.REPLICATE_API_TOKEN);
    console.log('  - Anthropic:', !!process.env.ANTHROPIC_API_KEY);
    console.log('  - TinyPNG:', !!process.env.TINYPNG_API_KEY);
    console.log('  - SerpAPI:', !!process.env.SERPAPI_KEY);
    
    this.initializeOptionalServices();
  }

  private async initializeOptionalServices() {
    // Initialize Anthropic if available
    if (process.env.ANTHROPIC_API_KEY && Anthropic) {
      this.anthropic = new (Anthropic as any)({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
    
    // Check SerpAPI availability
    this.serpApiAvailable = !!process.env.SERPAPI_KEY && !!getJson;
    
    // Check TinyPNG availability
    this.tinifyAvailable = !!process.env.TINYPNG_API_KEY && !!tinify;
  }

  async generateContent(businessInfo: BusinessInfo): Promise<GeneratedContent> {
    console.log(`🎨 Generating content for ${businessInfo.businessName}...`);
    
    try {
      const businessType = this.inferBusinessType(businessInfo);
      const industryKeywords = this.getIndustryKeywords(businessType);
      
      const prompt = this.buildPrompt(businessInfo, businessType, industryKeywords);
      
      // Use Together AI with Mixtral for better quality and cost efficiency
      console.log('  → Using Together AI...');
      console.log('🚀 Calling Together AI API...');
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

      console.log('  ✓ Together AI content generated successfully');
      return this.parseResponse(response);
    } catch (error) {
      console.error('  ✗ Error generating content:', error);
      // Fallback to default content if AI fails
      return this.getDefaultContent(businessInfo);
    }
  }

  async checkWebsite(business: unknown): Promise<boolean> {
    if (!this.serpApiAvailable) {
      console.log('⚠️ SerpAPI not available for website check');
      return false;
    }
    
    return await checkExistingWebsite(business);
  }

  async generateImages(businessType: string, businessName: string): Promise<BusinessImages> {
    return await generateBusinessImages(businessType, businessName);
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
    // Check the business name FIRST (this is the main fix)
    const businessName = businessInfo.businessName.toLowerCase();
    
    // Also check businessType field if provided
    const businessTypeField = (businessInfo.businessType || '').toLowerCase();
    
    // Combine both for better detection
    const combined = `${businessName} ${businessTypeField}`;
    
    let detectedType = 'general'; // Default
    
    // Restaurant keywords - check name patterns
    if (/restaurant|pizza|burger|cafe|coffee|bakery|deli|grill|kitchen|food|eat|dining|bistro|bar|pub|cuisine|taco|sushi|bbq|steakhouse/.test(combined)) {
      detectedType = 'restaurant';
    }
    // Plumbing keywords
    else if (/plumb|pipe|drain|water|leak|sewer|faucet|toilet|sink|rooter|hydro/.test(combined)) {
      detectedType = 'plumbing';
    }
    // Beauty keywords
    else if (/salon|beauty|hair|nail|spa|barber|styling|cuts|color|makeup|cosmetic|lash|brow|wax/.test(combined)) {
      detectedType = 'beauty';
    }
    // Auto keywords
    else if (/auto|car|mechanic|repair|tire|brake|oil|transmission|automotive|garage|motor|vehicle|muffler/.test(combined)) {
      detectedType = 'auto';
    }
    // Cleaning keywords
    else if (/clean|maid|janitorial|housekeeping|sanitiz|wash|spotless|sparkle|dust/.test(combined)) {
      detectedType = 'cleaning';
    }
    // Electrical keywords
    else if (/electric|electrical|wire|wiring|power|voltage|outlet|circuit|electrician/.test(combined)) {
      detectedType = 'electrical';
    }
    // Construction keywords
    else if (/construct|build|contractor|remodel|renovation|carpenter|roofing/.test(combined)) {
      detectedType = 'construction';
    }
    // Retail keywords
    else if (/store|shop|mart|market|boutique|retail|mall/.test(combined)) {
      detectedType = 'retail';
    }
    // Dental keywords
    else if (/dental|dentist|teeth|orthodont|oral/.test(combined)) {
      detectedType = 'dental';
    }
    // Medical keywords
    else if (/medical|clinic|doctor|health|care|wellness|hospital|physician/.test(combined)) {
      detectedType = 'medical';
    }
    // HVAC keywords
    else if (/hvac|heating|cooling|air condition|ac |furnace/.test(combined)) {
      detectedType = 'hvac';
    }
    // Landscaping keywords
    else if (/landscap|lawn|garden|tree|grass|yard/.test(combined)) {
      detectedType = 'landscaping';
    }
    // Moving keywords
    else if (/moving|movers|relocation|hauling/.test(combined)) {
      detectedType = 'moving';
    }
    // Legal keywords
    else if (/law|legal|attorney|lawyer/.test(combined)) {
      detectedType = 'legal';
    }
    // Real Estate keywords
    else if (/real estate|realty|property|homes/.test(combined)) {
      detectedType = 'realestate';
    }
    
    // Log the detection result
    console.log('Detected type:', detectedType, 'for', businessInfo.businessName);
    
    // Map some detected types to our supported categories
    if (['electrical', 'construction', 'hvac', 'landscaping', 'moving'].includes(detectedType)) {
      detectedType = 'service'; // Group these as general service
    }
    if (['retail', 'dental', 'medical', 'legal', 'realestate'].includes(detectedType)) {
      detectedType = 'general'; // Group these as general business
    }
    
    return detectedType;
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
        'award-winning', 'celebrity stylist',  'organic products'
      ],
      auto: [
        'certified mechanics', 'diagnostic', 'warranty', 'genuine parts',
        '  preventive maintenance', 'ASE certified', 'state-of-the-art',
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

// Enhanced Category Theme Functions - FIXED to return correct colors for each type
export function getCategoryTheme(type: string): CategoryTheme {
  // First detect the business type to ensure we're using the right category
  const businessType = type.toLowerCase();
  
  // Define themes with DISTINCT colors for each business type
  const themes: { [key: string]: CategoryTheme } = {
    restaurant: {
      colors: {
        primary: '#D2691E',  // Warm brown/orange
        secondary: '#FF6347', // Tomato red
        accent: '#FFD700',    // Gold
        hero: 'linear-gradient(135deg, #8B4513 0%, #D2691E 50%, #FF6347 100%)', // Brown to orange gradient
        text: '#2C1810',      // Dark brown
        light: '#FFF8DC',     // Cornsilk
        dark: '#4A2C17'       // Very dark brown
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
        primary: '#0066CC',   // Blue (as specified)
        secondary: '#00AA44', // Green
        accent: '#FF9900',    // Orange
        hero: 'linear-gradient(135deg, #003D7A 0%, #0066CC 50%, #0099FF 100%)', // Blue gradient
        text: '#333333',      // Dark gray
        light: '#E6F2FF',     // Light blue
        dark: '#002244'       // Dark blue
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
        primary: '#FF1493',   // Deep pink (as specified)
        secondary: '#DDA0DD', // Plum
        accent: '#FFB6C1',    // Light pink
        hero: 'linear-gradient(135deg, #FF69B4 0%, #FF1493 50%, #C71585 100%)', // Pink gradient
        text: '#4A0E2E',      // Dark purple
        light: '#FFF0F5',     // Lavender blush
        dark: '#8B008B'       // Dark magenta
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
        primary: '#2C3E50',   // Dark gray (as specified)
        secondary: '#E74C3C', // Red
        accent: '#F39C12',    // Orange
        hero: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%)', // Dark gradient
        text: '#333333',      // Dark gray
        light: '#ECF0F1',     // Light gray
        dark: '#0C0C1E'       // Very dark blue
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
        primary: '#00CED1',   // Cyan/turquoise (as specified)
        secondary: '#40E0D0', // Turquoise
        accent: '#AFEEEE',    // Pale turquoise
        hero: 'linear-gradient(135deg, #00CED1 0%, #40E0D0 50%, #7FFFD4 100%)', // Cyan gradient
        text: '#0C4A4D',      // Dark teal
        light: '#F0FFFF',     // Azure
        dark: '#008B8B'       // Dark cyan
      },
      fonts: {
        heading: '"Comfortaa", cursive',
        body: '"Open Sans", sans-serif',
        accent: '"Pacifico", cursive'
      },
      style: 'fresh'
    },
    service: {
      colors: {
        primary: '#667EEA',   // Purple-blue
        secondary: '#764BA2', // Purple
        accent: '#F093FB',    // Light purple
        hero: 'linear-gradient(135deg, #667EEA 0%, #764BA2 50%, #F093FB 100%)', // Purple gradient
        text: '#333333',      // Dark gray
        light: '#F3E5F5',     // Light purple
        dark: '#4A148C'       // Dark purple
      },
      fonts: {
        heading: '"Rubik", sans-serif',
        body: '"Karla", sans-serif',
        accent: '"Righteous", cursive'
      },
      style: 'modern'
    },
    general: {
      colors: {
        primary: '#667EEA',   // Purple-blue (default/fallback)
        secondary: '#764BA2', // Purple
        accent: '#F093FB',    // Light purple
        hero: 'linear-gradient(135deg, #667EEA 0%, #764BA2 50%, #F093FB 100%)', // Purple gradient
        text: '#333333',      // Dark gray
        light: '#F3E5F5',     // Light purple
        dark: '#4A148C'       // Dark purple
      },
      fonts: {
        heading: '"Rubik", sans-serif',
        body: '"Karla", sans-serif',
        accent: '"Righteous", cursive'
      },
      style: 'modern'
    }
  };
  
  // Return the specific theme or fall back to general (not service)
  const selectedTheme = themes[businessType] || themes.general;
  
  // Log which theme is being returned for debugging
  console.log(`getCategoryTheme: Returning '${businessType}' theme with primary color: ${selectedTheme.colors.primary}`);
  
  return selectedTheme;
}

// New functions for enhanced content generation
export async function generateBusinessContent(business: unknown): Promise<BusinessContent> {
  const businessData = business as { business_name?: string; businessName?: string; city?: string };
  const businessName = businessData.business_name || businessData.businessName || '';
  const businessType = detectBusinessType(businessName);
  
  console.log(`  📝 Generating fallback content for ${businessType} business...`);
  
  // Generate logo
  const logo = await generateBusinessLogo(businessName, businessType);
  
  // Try to generate video background
  const videoBackground = await generateVideoBackground(businessType);
  
  return {
    tagline: generateTagline(businessType, businessName),
    description: generateDescription(businessType, business),
    services: generateServices(businessType),
    testimonials: generateTestimonials(businessType),
    hours: generateBusinessHours(businessType),
    theme: getThemeForType(businessType),
    businessType,
    logo,
    videoBackground: videoBackground || undefined
  };
}

export function detectBusinessType(businessName: string): string {
  const name = businessName.toLowerCase();
  
  let detectedType = 'general'; // Default
  
  // Restaurant keywords - more comprehensive
  if (/restaurant|pizza|burger|cafe|coffee|bakery|deli|grill|kitchen|food|eat|dining|bistro|bar|pub|cuisine|taco|sushi|bbq|steakhouse|sandwich|bagel|donut|ice cream/.test(name)) {
    detectedType = 'restaurant';
  }
  // Plumbing keywords
  else if (/plumb|pipe|drain|water|leak|sewer|faucet|toilet|sink|rooter|hydro|septic/.test(name)) {
    detectedType = 'plumbing';
  }
  // Beauty keywords
  else if (/salon|beauty|hair|nail|spa|barber|styling|cuts|color|makeup|cosmetic|lash|brow|wax|aesthet/.test(name)) {
    detectedType = 'beauty';
  }
  // Auto keywords
  else if (/auto|car|mechanic|repair|tire|brake|oil|transmission|automotive|garage|motor|vehicle|muffler|body shop|detail/.test(name)) {
    detectedType = 'auto';
  }
  // Cleaning keywords
  else if (/clean|maid|janitorial|housekeeping|sanitiz|wash|spotless|sparkle|dust|sweep/.test(name)) {
    detectedType = 'cleaning';
  }
  // Electrical keywords
  else if (/electric|electrical|wire|wiring|power|voltage|outlet|circuit|electrician/.test(name)) {
    detectedType = 'electrical';
  }
  // Construction keywords
  else if (/construct|build|contractor|remodel|renovation|carpenter|roofing/.test(name)) {
    detectedType = 'construction';
  }
  // Retail keywords
  else if (/store|shop|mart|market|boutique|retail|mall/.test(name)) {
    detectedType = 'retail';
  }
  // Dental keywords
  else if (/dental|dentist|teeth|orthodont|oral/.test(name)) {
    detectedType = 'dental';
  }
  // Medical keywords
  else if (/medical|clinic|doctor|health|care|wellness|hospital|physician/.test(name)) {
    detectedType = 'medical';
  }
  
  // Log the detection
  console.log('Detected type:', detectedType, 'for', businessName);
  
  // Map some types to our main categories
  if (['electrical', 'construction'].includes(detectedType)) {
    return 'service';
  }
  if (['retail', 'dental', 'medical'].includes(detectedType)) {
    return 'general';
  }
  
  return detectedType;
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

export function generateDescription(type: string, business: unknown): string {
  const businessData = business as { city?: string; business_name?: string; businessName?: string };
  const city = businessData.city || 'the area';
  const businessName = businessData.business_name || businessData.businessName || 'Our business';
  
  const descriptions: { [key: string]: string } = {
    restaurant: `Welcome to ${businessName}, where culinary excellence meets warm hospitality in the heart of ${city}. Our award-winning chefs prepare every dish with fresh, locally-sourced ingredients, creating unforgettable flavors that keep our guests coming back. From our signature dishes to daily specials, every meal is a celebration of taste and tradition. Whether you're joining us for a romantic dinner, family gathering, or quick lunch, we promise an exceptional dining experience that delights all your senses.`,
    
    plumbing: `${businessName} is ${city}'s most trusted plumbing service, available 24/7 for all your plumbing emergencies. With over 15 years of experience, our licensed master plumbers handle everything from simple repairs to complete system overhauls. We pride ourselves on transparent pricing, rapid response times, and guaranteed workmanship. Our team uses the latest technology including video pipe inspection and hydro-jetting to diagnose and fix problems quickly, saving you time and money.`,
    
    beauty: `At ${businessName}, we believe beauty is an art form that enhances your natural radiance. Our award-winning stylists and aestheticians are dedicated to helping you look and feel your absolute best. Using premium products from leading brands and the latest techniques including balayage, keratin treatments, and microblading, we create personalized beauty experiences tailored to your unique style. Step into our luxurious salon and leave feeling refreshed, renewed, and absolutely beautiful.`,
    
    auto: `${businessName} is your premier destination for all automotive needs in ${city}. Our ASE-certified master mechanics use state-of-the-art diagnostic equipment to keep your vehicle running at peak performance. From routine maintenance to major repairs, we treat every car like our own, ensuring safety and reliability on every drive. With factory-trained technicians, genuine OEM parts, and comprehensive warranties, we've earned the trust of thousands of satisfied customers.`,
    
    cleaning: `${businessName} delivers spotless results for homes and businesses throughout ${city}. Our professionally trained and background-checked team uses eco-friendly, EPA-approved products and HEPA-filtered equipment to create healthier, more beautiful spaces. Whether you need regular maintenance, deep cleaning, or specialized services, we customize our approach to exceed your expectations. With flexible scheduling, competitive rates, and a 200% satisfaction guarantee, we make it easy to maintain a pristine environment.`,
    
    general: `${businessName} has been proudly serving ${city} with dedication and excellence for over a decade. Our commitment to quality service and customer satisfaction has made us a trusted name in the community. We go above and beyond to ensure every client receives personalized attention and outstanding results. With competitive pricing, professional expertise, and genuine care for our customers' needs, we've built lasting relationships based on trust and exceptional service.`
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
      { name: 'Sarah Mitchell', text: 'Absolutely incredible! The tasting menu was a journey through flavors I\'ve never experienced. The ambiance is perfect for special occasions, and the service is impeccable.', rating: 5 },
      { name: 'Dr. James Chen', text: 'As a food critic, I\'m rarely impressed, but this restaurant exceeded every expectation. The chef\'s attention to detail and use of local ingredients creates magic on every plate.', rating: 5 },
      { name: 'Maria Rodriguez', text: 'We\'ve hosted three corporate events here and each one has been flawless. The private dining room, custom menus, and professional staff make this our go-to venue.', rating: 5 }
    ],
    plumbing: [
      { name: 'Robert Thompson', text: 'They saved our home from major water damage! Responded within 20 minutes at 2 AM, fixed the burst pipe professionally, and helped with insurance documentation.', rating: 5 },
      { name: 'Linda Foster', text: 'Complete bathroom remodel was stunning! They handled everything from design to permits to installation. Finished ahead of schedule and the quality is exceptional.', rating: 5 },
      { name: 'Mike Sullivan', text: 'Been using them for 10 years for our commercial properties. Always professional, reliable, and their preventive maintenance program has saved us thousands.', rating: 5 }
    ],
    beauty: [
      { name: 'Jennifer Laurent', text: 'My colorist is an absolute artist! She transformed my damaged hair into a gorgeous balayage that looks natural and healthy. The salon experience is luxurious and relaxing.', rating: 5 },
      { name: 'Ashley Kim', text: 'The bridal package was perfection! Hair, makeup, nails - everything was flawless and lasted all day. The team made me feel like a princess.', rating: 5 },
      { name: 'Nicole Patterson', text: 'Their spa services are next level! The hydrafacial and lash extensions have transformed my look. The staff is professional and the results speak for themselves.', rating: 5 }
    ],
    auto: [
      { name: 'David Harrison', text: 'Most honest mechanics I\'ve ever dealt with! They showed me exactly what needed fixing with video inspection, gave options, and never pushed unnecessary services.', rating: 5 },
      { name: 'Susan Bradley', text: 'They diagnosed an issue three dealerships couldn\'t find! Saved me from buying a new car. Their expertise with European vehicles is unmatched.', rating: 5 },
      { name: '  Tom Williams', text: 'Fleet maintenance for our 20 company vehicles. They keep detailed records, remind us of service schedules, and their preventive maintenance has reduced our downtime by 60%.', rating: 5 }
    ],
    cleaning: [
      { name: 'Emily Richardson', text: 'The deep clean service is incredible! They cleaned places I didn\'t know existed. Eco-friendly products, professional team, and my home has never looked better.', rating: 5 },
      { name: 'James Cooper', text: 'Our office has never been cleaner! They work around our schedule, use hospital-grade disinfectants, and the staff is trustworthy and efficient.', rating: 5 },
      { name: 'Patricia Martinez', text: 'Post-construction cleanup was a miracle! They transformed our renovation chaos into a spotless home in one day. Professional, thorough, and reasonably priced.', rating: 5 }
    ],
    general: [
      { name: 'Alex Johnson', text: 'Exceeded every expectation! Professional, reliable, and the quality of work is outstanding. They went above and beyond to ensure our satisfaction.', rating: 5 },
      { name: 'Chris Miller', text: 'Been a customer for 5 years and they never disappoint! Consistent quality, fair pricing, and they stand behind their work. Simply the best!', rating: 5 },
      { name: 'Taylor Smith', text: 'Absolutely fantastic experience from start to finish! They listened to our needs, provided expert advice, and delivered exceptional results.', rating: 5 }
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
      text: '#333333',
      isDark: false
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
      text: '#333333',
      isDark: false
    },
    cleaning: {
      primary: 'linear-gradient(135deg, #00CED1, #40E0D0)',
      accent: '#7FFFD4',
      background: 'linear-gradient(-45deg, #00CED1, #40E0D0, #7FFFD4, #AFEEEE)',
      text: '#0C4A4D',
      isDark: false
    },
    general: {
      primary: 'linear-gradient(135deg, #667eea, #764ba2)',
      accent: '#667eea',
      background: 'linear-gradient(-45deg, #667eea, #764ba2, #f093fb, #f5576c)',
      text: '#333333',
      isDark: false
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

// Helper function to get industry keywords
function getIndustryKeywords(businessType: string): string[] {
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
