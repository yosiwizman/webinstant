import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getJson } from 'serpapi';
import { 
  generateBusinessContent, 
  detectBusinessType, 
  getCategoryTheme,
  generateBusinessImages,
  getImagePrompt,
  getLayoutVariation,
  generatePremiumContent,
  generateTrustSignals,
  generateSocialProofTicker,
  generateInteractiveElements,
  generateReviewsWidget,
  generateLiveChatBubble,
  generateExitIntentPopup
} from '@/lib/contentGenerator';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function generateUniqueSlug(baseName: string): Promise<string> {
  let slug = generateSlug(baseName);
  let counter = 1;
  
  while (true) {
    const { data: existing } = await supabase
      .from('website_previews')
      .select('slug')
      .eq('slug', slug)
      .single();
    
    if (!existing) {
      return slug;
    }
    
    slug = `${generateSlug(baseName)}-${counter}`;
    counter++;
  }
}

// Add this function to check if business has website
async function checkExistingWebsite(businessName: string, city: string, state: string): Promise<boolean> {
  try {
    // Skip check if no API key
    if (!process.env.SERPAPI_KEY) {
      console.log('  ⚠️ SerpAPI key not configured, skipping website check');
      return false;
    }

    console.log(`  🔍 Checking if ${businessName} already has a website...`);
    
    const results = await getJson({
      api_key: process.env.SERPAPI_KEY,
      engine: "google",
      q: `${businessName} ${city} ${state} official website`,
      location: `${city}, ${state}`,
      num: 10
    });
    
    // Check if any results look like the business's official website
    const businessNameLower = businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const businessNameWords = businessName.toLowerCase().split(/\s+/).filter(word => word.length > 3);
    
    const hasWebsite = results.organic_results?.some((result: any) => {
      const url = result.link?.toLowerCase() || '';
      const title = result.title?.toLowerCase() || '';
      const snippet = result.snippet?.toLowerCase() || '';
      
      // Skip social media and directory sites
      const isDirectory = /yelp|yellowpages|facebook|instagram|twitter|linkedin|tripadvisor|foursquare|google\.com\/maps/i.test(url);
      if (isDirectory) return false;
      
      // Check if URL contains business name (strong indicator)
      if (url.includes(businessNameLower)) {
        console.log(`    ✓ Found likely website: ${result.link}`);
        return true;
      }
      
      // Check if most business name words appear in title
      const titleMatches = businessNameWords.filter(word => title.includes(word)).length;
      if (titleMatches >= Math.max(2, businessNameWords.length * 0.7)) {
        // Also check if it's a .com, .net, .org, etc (not a directory)
        if (/\.(com|net|org|biz|info|us|co)/.test(url) && !isDirectory) {
          console.log(`    ✓ Found likely website: ${result.link}`);
          return true;
        }
      }
      
      return false;
    });
    
    if (hasWebsite) {
      console.log(`  ❌ ${businessName} appears to already have a website`);
      
      // Update database to mark business as having website
      await supabase
        .from('businesses')
        .update({ 
          has_existing_website: true,
          website_check_date: new Date().toISOString()
        })
        .eq('business_name', businessName)
        .eq('city', city);
        
    } else {
      console.log(`  ✅ ${businessName} needs a website - perfect candidate!`);
      
      // Update database to mark as checked
      await supabase
        .from('businesses')
        .update({ 
          has_existing_website: false,
          website_check_date: new Date().toISOString()
        })
        .eq('business_name', businessName)
        .eq('city', city);
    }
    
    return hasWebsite;
  } catch (error) {
    console.error('  ⚠️ SerpAPI error:', error);
    // If API fails, assume they don't have a website to be safe
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    let businessId: string | undefined;
    let skipWebsiteCheck = false;
    
    try {
      const body = await request.json();
      businessId = body.businessId;
      skipWebsiteCheck = body.skipWebsiteCheck || false;
    } catch {
      businessId = undefined;
    }

    let businessesToProcess = [];
    
    if (businessId) {
      console.log('Generating premium preview for business:', businessId);
      
      const { data: business, error: fetchError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();

      if (fetchError || !business) {
        console.error('Error fetching business:', fetchError);
        return NextResponse.json(
          { success: false, error: 'Business not found' },
          { status: 404 }
        );
      }
      
      businessesToProcess = [business];
    } else {
      console.log('Finding businesses without previews');
      
      const { data: allBusinesses, error: fetchError } = await supabase
        .from('businesses')
        .select('*');

      if (fetchError) {
        console.error('Error fetching businesses:', fetchError);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch businesses' },
          { status: 500 }
        );
      }

      const { data: existingPreviews, error: previewError } = await supabase
        .from('website_previews')
        .select('business_id');

      if (previewError) {
        console.error('Error fetching existing previews:', previewError);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch existing previews' },
          { status: 500 }
        );
      }

      const existingBusinessIds = new Set(existingPreviews?.map(p => p.business_id) || []);
      businessesToProcess = (allBusinesses || []).filter(b => !existingBusinessIds.has(b.id));

      console.log(`Found ${businessesToProcess.length} businesses without previews`);
    }

    let generatedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const skippedBusinesses: string[] = [];

    for (const business of businessesToProcess) {
      try {
        console.log(`\nProcessing: ${business.business_name}`);
        
        // Check if business already has a website (unless explicitly skipped)
        if (!skipWebsiteCheck && business.city && business.state) {
          // Check if we've already verified this recently (within 30 days)
          if (business.website_check_date) {
            const lastCheck = new Date(business.website_check_date);
            const daysSinceCheck = (Date.now() - lastCheck.getTime()) / (1000 * 60 * 60 * 24);
            
            if (daysSinceCheck < 30) {
              if (business.has_existing_website) {
                console.log(`  ⏭️ Skipping - already verified to have website (checked ${Math.floor(daysSinceCheck)} days ago)`);
                skippedCount++;
                skippedBusinesses.push(business.business_name);
                continue;
              } else {
                console.log(`  ✓ Previously verified as needing website (${Math.floor(daysSinceCheck)} days ago)`);
              }
            }
          }
          
          // Perform fresh check
          const hasWebsite = await checkExistingWebsite(
            business.business_name, 
            business.city, 
            business.state
          );
          
          if (hasWebsite) {
            console.log(`  ⏭️ Skipping - business already has website`);
            skippedCount++;
            skippedBusinesses.push(business.business_name);
            continue;
          }
        }
        
        // Generate premium AI content
        const content = await generatePremiumContent(business);
        
        // Generate AI images for the business
        const images = await generateBusinessImages(content.businessType, business.business_name);
        content.images = images;
        
        // Get category-specific theme
        const theme = getCategoryTheme(content.businessType);
        
        // Get layout variation based on business name
        const layoutVariation = getLayoutVariation(business.business_name);
        
        // Generate unique slug
        const slug = await generateUniqueSlug(business.business_name);
        const previewUrl = `/preview/${slug}`;
        
        // Detect business type if not set
        const businessType = business.industry_type || detectBusinessType(business.business_name);
        
        // Generate premium HTML with all new features
        const htmlContent = generatePremiumHTML(business, content, theme, layoutVariation);
        
        const { data: existingPreview } = await supabase
          .from('website_previews')
          .select('id')
          .eq('business_id', business.id)
          .single();
        
        if (existingPreview) {
          const { error: updateError } = await supabase
            .from('website_previews')
            .update({
              html_content: htmlContent,
              preview_url: previewUrl,
              template_used: `premium-${content.businessType}-v${layoutVariation}`,
              slug: slug,
              updated_at: new Date().toISOString()
            })
            .eq('business_id', business.id);

          if (updateError) {
            console.error(`Error updating preview for business ${business.id}:`, updateError);
            failedCount++;
            continue;
          }
        } else {
          const { error: insertError } = await supabase
            .from('website_previews')
            .insert({
              business_id: business.id,
              html_content: htmlContent,
              preview_url: previewUrl,
              template_used: `premium-${content.businessType}-v${layoutVariation}`,
              slug: slug
            });

          if (insertError) {
            console.error(`Error creating preview for business ${business.id}:`, insertError);
            failedCount++;
            continue;
          }
        }
        
        const updateData: any = {
          website_url: previewUrl,
          updated_at: new Date().toISOString()
        };
        
        if (!business.industry_type) {
          updateData.industry_type = businessType;
        }
        
        const { error: businessUpdateError } = await supabase
          .from('businesses')
          .update(updateData)
          .eq('id', business.id);
        
        if (businessUpdateError) {
          console.error(`Error updating business ${business.id}:`, businessUpdateError);
        }

        generatedCount++;
        console.log(`  ✨ Premium preview generated for ${business.business_name} (${business.id})`);
        console.log(`    - Slug: ${slug}`);
        console.log(`    - URL: ${previewUrl}`);
        console.log(`    - Theme: ${content.businessType}`);
        console.log(`    - Layout: Variation ${layoutVariation}`);
        console.log(`    - Images: ${images ? 'AI Generated' : 'Stock Photos'}`);
        console.log(`    - Logo: ${content.logo?.type === 'image' ? 'AI Generated' : 'Typography'}`);
        console.log(`    - Video Background: ${content.videoBackground ? 'Yes' : 'No'}`);
        
      } catch (error) {
        console.error(`  ❌ Error processing business ${business.id}:`, error);
        failedCount++;
      }
    }

    console.log('\n=== Generation Summary ===');
    console.log(`Total processed: ${businessesToProcess.length}`);
    console.log(`Generated: ${generatedCount}`);
    console.log(`Skipped (have website): ${skippedCount}`);
    console.log(`Failed: ${failedCount}`);
    
    if (skippedBusinesses.length > 0) {
      console.log('\nBusinesses skipped (already have websites):');
      skippedBusinesses.forEach(name => console.log(`  - ${name}`));
    }

    return NextResponse.json({
      success: true,
      generated: generatedCount,
      skipped: skippedCount,
      skippedBusinesses,
      failed: failedCount,
      total: businessesToProcess.length,
      message: `Generated ${generatedCount} previews, skipped ${skippedCount} businesses with existing websites`
    });

  } catch (error) {
    console.error('Error in generate-preview endpoint:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

function generatePremiumHTML(business: any, content: any, theme: any, layoutVariation: number): string {
  const businessName = business.business_name || 'Business';
  const address = business.address || '';
  const city = business.city || '';
  const state = business.state || '';
  const phone = business.phone || '';
  const email = business.email || '';
  const zip = business.zip_code || '';
  
  // Add random variations for unique generations
  const randomSeed = Math.random();
  const layoutVersion = Math.floor(randomSeed * 3) + 1; // 1, 2, or 3
  
  // Vary hero alignment based on layoutVersion
  const heroAlignment = layoutVersion === 1 ? 'left' : layoutVersion === 2 ? 'center' : 'right';
  const heroTextAlign = layoutVersion === 1 ? 'text-align: left;' : layoutVersion === 2 ? 'text-align: center;' : 'text-align: right;';
  
  // Vary button styles
  const buttonRadius = layoutVersion === 1 ? '50px' : layoutVersion === 2 ? '10px' : '0px';
  
  // Vary animation speeds
  const animationSpeed = layoutVersion === 1 ? '0.8s' : layoutVersion === 2 ? '1s' : '1.2s';
  
  // Vary grid layouts
  const gridColumns = layoutVersion === 1 ? 'repeat(auto-fit, minmax(350px, 1fr))' : 
                      layoutVersion === 2 ? 'repeat(3, 1fr)' : 
                      'repeat(auto-fit, minmax(300px, 1fr))';
  
  // Get images (AI generated or stock)
  const images = content.images || {
    hero: `https://picsum.photos/1920/1080?random=${Math.random()}`,
    service: `https://picsum.photos/800/600?random=${Math.random()}`,
    team: `https://picsum.photos/800/600?random=${Math.random()}`
  };
  
  // Generate star rating HTML
  const generateStars = (rating: number) => {
    return Array(5).fill(0).map((_, i) => 
      i < rating ? '★' : '☆'
    ).join('');
  };
  
  // Get logo HTML - FIXED with text-based logo
  const getLogoHTML = () => {
    return `
      <div class="logo-container" style="display: flex; align-items: center; gap: 15px;">
        <div class="logo-icon" style="width: 50px; height: 50px; background: linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent}); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold;">
          ${businessName.charAt(0)}
        </div>
        <div class="logo-text" style="font-size: 24px; font-weight: bold; color: ${theme.colors.primary};">
          ${businessName}
        </div>
      </div>
    `;
  };
  
  // FIXED: Always use white text with strong shadows for hero sections
  const heroTextColor = '#FFFFFF';
  const heroTextShadow = '2px 2px 10px rgba(0,0,0,0.8)';
  
  // Get layout-specific hero section with FIXED text colors
  const getHeroSection = () => {
    const videoBackground = content.videoBackground ? `
      <video class="video-bg" autoplay muted loop playsinline>
        <source src="${content.videoBackground}" type="video/mp4">
      </video>
    ` : '';
    
    switch(layoutVariation) {
      case 0: // Classic centered hero
        return `
          <section id="home" class="hero hero-classic">
            <div class="hero-background">
              ${videoBackground || `<img src="${images.hero}" alt="${businessName}" class="hero-image parallax" />`}
            </div>
            <div class="hero-overlay"></div>
            <div class="hero-content animate-on-scroll" style="--delay: 0; ${heroTextAlign}">
              <h1 class="hero-title" style="color: ${heroTextColor} !important; text-shadow: ${heroTextShadow} !important;">${businessName}</h1>
              <div class="tagline" style="color: ${heroTextColor} !important; text-shadow: ${heroTextShadow} !important; --delay: 1">${content.tagline}</div>
              <div class="hero-cta" style="--delay: 2">
                <a href="tel:${phone}" class="btn-premium pulse">Call Now</a>
                <a href="#contact" class="btn-secondary" style="border-color: ${heroTextColor}; color: ${heroTextColor} !important;">Get Directions</a>
              </div>
            </div>
          </section>`;
          
      case 1: // Split hero with image on right
        return `
          <section id="home" class="hero hero-split">
            <div class="hero-split-content">
              <div class="hero-text-side animate-on-scroll" style="--delay: 0">
                <h1 class="hero-title gradient-text">${businessName}</h1>
                <div class="tagline">${content.tagline}</div>
                <p class="hero-description">${content.description.substring(0, 150)}...</p>
                <div class="hero-cta">
                  <a href="tel:${phone}" class="btn-premium pulse">Call Now</a>
                  <a href="#services" class="btn-secondary-alt">Our Services</a>
                </div>
                <div class="hero-stats">
                  <div class="stat">
                    <span class="counter" data-target="${Math.floor(Math.random() * 15) + 5}">0</span>+
                    <span>Years Experience</span>
                  </div>
                  <div class="stat">
                    <span class="counter" data-target="${Math.floor(Math.random() * 9000) + 1000}">0</span>+
                    <span>Happy Customers</span>
                  </div>
                </div>
              </div>
              <div class="hero-image-side">
                ${videoBackground || `<img src="${images.hero}" alt="${businessName}" class="hero-split-image animate-on-scroll" style="--delay: 1" />`}
                <div class="image-overlay"></div>
              </div>
            </div>
          </section>`;
          
      case 2: // Full-screen video-style hero
        return `
          <section id="home" class="hero hero-fullscreen">
            <div class="hero-video-container">
              ${videoBackground || `<img src="${images.hero}" alt="${businessName}" class="hero-video parallax" />`}
              <div class="hero-gradient-overlay"></div>
            </div>
            <div class="hero-fullscreen-content" style="${heroTextAlign}">
              <div class="hero-badge animate-on-scroll" style="--delay: 0; color: ${heroTextColor} !important; border-color: ${heroTextColor} !important;">⭐ Top Rated ${content.businessType}</div>
              <h1 class="hero-massive-title animate-on-scroll" style="--delay: 1; color: ${heroTextColor} !important; text-shadow: ${heroTextShadow} !important;">
                ${businessName}
              </h1>
              <div class="hero-subtitle animate-on-scroll" style="--delay: 2; color: ${heroTextColor} !important; text-shadow: ${heroTextShadow} !important;">${content.tagline}</div>
              <div class="hero-features animate-on-scroll" style="--delay: 3">
                ${content.services.slice(0, 3).map((s: string) => `<span class="feature-badge" style="color: ${heroTextColor} !important; border-color: ${heroTextColor} !important;">${s.substring(2, 20)}...</span>`).join('')}
              </div>
              <div class="hero-cta animate-on-scroll" style="--delay: 4">
                <a href="tel:${phone}" class="btn-premium btn-large pulse">
                  <span class="btn-icon">📞</span> ${phone}
                </a>
              </div>
            </div>
            <div class="scroll-indicator" style="color: ${heroTextColor} !important;">
              <span>Scroll</span>
              <div class="scroll-arrow" style="border-color: ${heroTextColor} !important;"></div>
            </div>
          </section>`;
    }
  };
  
  // Get layout-specific about section
  const getAboutSection = () => {
    switch(layoutVariation) {
      case 0: // Image on left
        return `
          <section id="about" class="about-section">
            <div class="container">
              <h2 class="section-title animate-on-scroll">About Us</h2>
              <p class="section-subtitle animate-on-scroll">Discover Our Story</p>
              <div class="about-content about-left">
                <div class="about-image animate-on-scroll" style="--delay: 1">
                  <img src="${images.service}" alt="About ${businessName}" />
                  <div class="image-decoration"></div>
                </div>
                <div class="about-text animate-on-scroll" style="--delay: 2">
                  <p>${content.description}</p>
                  <div class="about-stats">
                    <div class="stat-card">
                      <div class="stat-number counter" data-target="${Math.floor(Math.random() * 15) + 5}">0</div>
                      <div class="stat-label">Years Experience</div>
                    </div>
                    <div class="stat-card">
                      <div class="stat-number counter" data-target="${Math.floor(Math.random() * 9000) + 1000}">0</div>
                      <div class="stat-label">Happy Customers</div>
                    </div>
                    <div class="stat-card">
                      <div class="stat-number">100%</div>
                      <div class="stat-label">Satisfaction</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>`;
          
      case 1: // Centered with background
        return `
          <section id="about" class="about-section about-centered">
            <div class="about-bg-pattern"></div>
            <div class="container">
              <h2 class="section-title animate-on-scroll">Our Story</h2>
              <div class="about-content-centered">
                <p class="about-lead animate-on-scroll" style="--delay: 1">${content.description}</p>
                <div class="about-features animate-on-scroll" style="--delay: 2">
                  <div class="feature-item">
                    <div class="feature-icon">✓</div>
                    <h4>Licensed & Insured</h4>
                    <p>Fully certified professionals</p>
                  </div>
                  <div class="feature-item">
                    <div class="feature-icon">⚡</div>
                    <h4>Fast Response</h4>
                    <p>Quick and reliable service</p>
                  </div>
                  <div class="feature-item">
                    <div class="feature-icon">💎</div>
                    <h4>Premium Quality</h4>
                    <p>Excellence in every detail</p>
                  </div>
                </div>
                <div class="about-image-strip animate-on-scroll" style="--delay: 3">
                  <img src="${images.hero}" alt="Our Work" />
                  <img src="${images.service}" alt="Our Service" />
                  <img src="${images.team}" alt="Our Team" />
                </div>
              </div>
            </div>
          </section>`;
          
      case 2: // Timeline style
        return `
          <section id="about" class="about-section about-timeline">
            <div class="container">
              <h2 class="section-title animate-on-scroll">Why Choose Us</h2>
              <p class="section-subtitle animate-on-scroll">Excellence Through Experience</p>
              <div class="timeline-container">
                <div class="timeline-line"></div>
                <div class="timeline-item animate-on-scroll" style="--delay: 1">
                  <div class="timeline-content">
                    <h3>Expert Team</h3>
                    <p>Certified professionals with years of experience</p>
                  </div>
                  <div class="timeline-image">
                    <img src="${images.team}" alt="Our Team" />
                  </div>
                </div>
                <div class="timeline-item reverse animate-on-scroll" style="--delay: 2">
                  <div class="timeline-content">
                    <h3>Quality Service</h3>
                    <p>Premium solutions that exceed expectations</p>
                  </div>
                  <div class="timeline-image">
                    <img src="${images.service}" alt="Our Service" />
                  </div>
                </div>
                <div class="timeline-item animate-on-scroll" style="--delay: 3">
                  <div class="timeline-content">
                    <h3>Customer First</h3>
                    <p>Your satisfaction is our top priority</p>
                  </div>
                  <div class="timeline-image">
                    <img src="${images.hero}" alt="Customer Service" />
                  </div>
                </div>
              </div>
              <div class="about-description animate-on-scroll" style="--delay: 4">
                <p>${content.description}</p>
              </div>
            </div>
          </section>`;
    }
  };
  
  // Get category-specific sections
  const getCategorySpecificSections = () => {
    switch(content.businessType) {
      case 'restaurant':
        return `
          <!-- Menu Preview Section -->
          <section class="menu-section">
            <div class="container">
              <h2 class="section-title animate-on-scroll">Our Signature Menu</h2>
              <div class="menu-grid">
                <div class="menu-card premium-card animate-on-scroll" style="--delay: 1">
                  <h3 data-editable="text" data-field="menu-category-1">Appetizers</h3>
                  <div class="menu-item">
                    <span data-editable="text" data-field="menu-item-1">Truffle Arancini</span>
                    <span class="price" data-editable="price" data-field="price-1">$18</span>
                  </div>
                  <div class="menu-item">
                    <span data-editable="text" data-field="menu-item-2">Oysters Rockefeller</span>
                    <span class="price" data-editable="price" data-field="price-2">$24</span>
                  </div>
                  <div class="menu-item">
                    <span data-editable="text" data-field="menu-item-3">Wagyu Beef Carpaccio</span>
                    <span class="price" data-editable="price" data-field="price-3">$32</span>
                  </div>
                </div>
                <div class="menu-card premium-card animate-on-scroll" style="--delay: 2">
                  <h3 data-editable="text" data-field="menu-category-2">Main Courses</h3>
                  <div class="menu-item">
                    <span data-editable="text" data-field="menu-item-4">Pan-Seared Duck Breast</span>
                    <span class="price" data-editable="price" data-field="price-4">$48</span>
                  </div>
                  <div class="menu-item">
                    <span data-editable="text" data-field="menu-item-5">Lobster Thermidor</span>
                    <span class="price" data-editable="price" data-field="price-5">$65</span>
                  </div>
                  <div class="menu-item">
                    <span data-editable="text" data-field="menu-item-6">Prime Ribeye (16oz)</span>
                    <span class="price" data-editable="price" data-field="price-6">$72</span>
                  </div>
                </div>
              </div>
              <button class="btn-premium">View Full Menu</button>
            </div>
          </section>
          
          <!-- Reservation Widget -->
          <section class="reservation-section">
            <div class="container">
              <h2 class="section-title animate-on-scroll">Make a Reservation</h2>
              <div class="reservation-widget premium-card animate-on-scroll">
                <form class="reservation-form">
                  <input type="date" placeholder="Select Date" min="2025-01-01" />
                  <input type="time" placeholder="Select Time" />
                  <input type="number" placeholder="Number of Guests" min="1" max="20" />
                  <button type="submit" class="btn-premium">Reserve Table</button>
                </form>
              </div>
            </div>
          </section>`;
          
      case 'plumbing':
        return `
          <!-- Emergency Banner -->
          <div class="emergency-banner">
            <div class="container">
              <h3>🚨 24/7 Emergency Service Available</h3>
              <p>Burst pipe? Major leak? We're here to help!</p>
              <a href="tel:${phone}" class="btn-emergency pulse">Call Now: ${phone}</a>
            </div>
          </div>
          
          <!-- Service Calculator -->
          <section class="calculator-section">
            <div class="container">
              <h2 class="section-title animate-on-scroll">Instant Quote Calculator</h2>
              <div class="calculator-widget premium-card animate-on-scroll">
                <select id="service-type">
                  <option>Select Service Type</option>
                  <option value="drain" data-editable="text" data-field="service-option-1">Drain Cleaning ($150-300)</option>
                  <option value="leak" data-editable="text" data-field="service-option-2">Leak Repair ($200-500)</option>
                  <option value="water-heater" data-editable="text" data-field="service-option-3">Water Heater ($800-2000)</option>
                  <option value="repipe" data-editable="text" data-field="service-option-4">Repiping ($3000-8000)</option>
                </select>
                <button class="btn-premium">Get Instant Quote</button>
              </div>
            </div>
          </section>
          
          <!-- Trust Badges -->
          <section class="trust-section">
            <div class="container">
              <div class="trust-badges animate-on-scroll">
                <div class="badge">
                  <div class="badge-icon">✓</div>
                  <p>Fully Licensed</p>
                </div>
                <div class="badge">
                  <div class="badge-icon">🛡️</div>
                  <p>Fully Insured</p>
                </div>
                <div class="badge">
                  <div class="badge-icon">⭐</div>
                  <p>A+ BBB Rating</p>
                </div>
              </div>
            </div>
          </section>`;
          
      case 'beauty':
        return `
          <!-- Instagram Gallery -->
          <section class="instagram-section">
            <div class="container">
              <h2 class="section-title animate-on-scroll">Follow Our Transformations</h2>
              <div class="instagram-grid">
                ${[1,2,3,4,5,6].map(i => `
                  <div class="instagram-post premium-card animate-on-scroll" style="--delay: ${i}">
                    <img src="${images.service}" alt="Beauty transformation ${i}" />
                    <div class="instagram-overlay">
                      <span>❤️ ${Math.floor(Math.random() * 500) + 100}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
              <button class="btn-premium">@${businessName.toLowerCase().replace(/\s+/g, '')}</button>
            </div>
          </section>
          
          <!-- Booking Widget -->
          <section class="booking-section">
            <div class="container">
              <h2 class="section-title animate-on-scroll">Book Your Appointment</h2>
              <div class="booking-widget premium-card animate-on-scroll">
                <div class="service-selector">
                  <button class="service-btn active" data-editable="text" data-field="beauty-service-1">Hair</button>
                  <button class="service-btn" data-editable="text" data-field="beauty-service-2">Nails</button>
                  <button class="service-btn" data-editable="text" data-field="beauty-service-3">Makeup</button>
                  <button class="service-btn" data-editable="text" data-field="beauty-service-4">Spa</button>
                </div>
                <div class="stylist-selector">
                  <h4>Choose Your Stylist</h4>
                  <div class="stylist-grid">
                    <div class="stylist-card">
                      <img src="${images.team}" alt="Stylist" />
                      <p data-editable="text" data-field="stylist-name-1">Sarah</p>
                    </div>
                    <div class="stylist-card">
                      <img src="${images.team}" alt="Stylist" />
                      <p data-editable="text" data-field="stylist-name-2">Jessica</p>
                    </div>
                    <div class="stylist-card">
                      <img src="${images.team}" alt="Stylist" />
                      <p data-editable="text" data-field="stylist-name-3">Michelle</p>
                    </div>
                  </div>
                </div>
                <button class="btn-premium">Book Now</button>
              </div>
            </div>
          </section>`;
          
      default:
        return '';
    }
  };
  
  // Generate testimonials HTML
  const testimonialsHTML = content.testimonials.map((t: any, i: number) => `
    <div class="testimonial-card premium-card animate-on-scroll" style="--delay: ${i + 1}">
      <div class="testimonial-header">
        <div class="customer-info">
          <div class="avatar gradient-bg">${t.name.charAt(0)}</div>
          <div>
            <h4>${t.name}</h4>
            <div class="stars">${generateStars(t.rating)}</div>
          </div>
        </div>
        <div class="verified">✓ Verified</div>
      </div>
      <p>"${t.text}"</p>
    </div>
  `).join('');
  
  // Generate services HTML with icons
  const servicesHTML = content.services.map((service: string, i: number) => `
    <div class="service-item premium-card animate-on-scroll" style="--delay: ${i + 1}">
      <div class="service-icon gradient-bg">${service.substring(0, 2)}</div>
      <h4 data-editable="text" data-field="service-name-${i + 1}">${service.substring(2)}</h4>
      <p>Professional service with guaranteed satisfaction</p>
      <button class="btn-secondary">Learn More</button>
    </div>
  `).join('');
  
  // Generate hours HTML
  const hoursHTML = Object.entries(content.hours).map(([day, hours]) => `
    <div class="hours-row">
      <span class="day">${day}</span>
      <span class="time">${hours}</span>
    </div>
  `).join('');
  
  // Google Maps embed
  const mapsQuery = encodeURIComponent(`${address}, ${city}, ${state} ${zip}`);
  const mapsEmbedUrl = `https://maps.google.com/maps?q=${mapsQuery}&output=embed`;
  
  // Build the premium HTML template with all new features
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${businessName} - ${content.tagline}</title>
  <meta name="description" content="${content.description.substring(0, 160)}">
  
  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=${theme.fonts.heading.replace(/"/g, '').replace(/ /g, '+')}:wght@400;700;900&family=${theme.fonts.body.replace(/"/g, '').replace(/ /g, '+')}:wght@300;400;500;700&display=swap" rel="stylesheet">
  ${theme.fonts.accent ? `<link href="https://fonts.googleapis.com/css2?family=${theme.fonts.accent.replace(/"/g, '').replace(/ /g, '+')}:wght@400;700&display=swap" rel="stylesheet">` : ''}
  
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :root {
      --primary: ${theme.colors.primary};
      --secondary: ${theme.colors.secondary};
      --accent: ${theme.colors.accent};
      --hero-gradient: ${theme.colors.hero};
      --text: ${theme.colors.text};
      --light: ${theme.colors.light};
      --dark: ${theme.colors.dark};
      --heading-font: ${theme.fonts.heading};
      --body-font: ${theme.fonts.body};
      --accent-font: ${theme.fonts.accent || theme.fonts.heading};
      --button-radius: ${buttonRadius};
      --animation-speed: ${animationSpeed};
      --grid-columns: ${gridColumns};
    }

    body {
      font-family: var(--body-font);
      color: var(--text);
      line-height: 1.6;
      overflow-x: hidden;
      background: ${theme.style === 'elegant' ? '#FFF8F0' : 
                   theme.style === 'professional' ? '#F0F4F8' :
                   theme.style === 'glamorous' ? '#FFF0F5' :
                   theme.style === 'industrial' ? '#1A1A1A' :
                   theme.style === 'fresh' ? '#F0FFFF' : '#FFFFFF'};
    }

    /* Premium animations */
    @keyframes fadeInUp {
      from { 
        opacity: 0; 
        transform: translateY(40px); 
      }
      to { 
        opacity: 1; 
        transform: translateY(0); 
      }
    }

    .animate-on-scroll {
      opacity: 0;
      animation: fadeInUp var(--animation-speed) ease forwards;
      animation-delay: calc(var(--delay) * 0.1s);
    }

    .animate-on-scroll.visible {
      opacity: 1;
    }

    /* Premium Navigation */
    .premium-nav {
      position: fixed;
      width: 100%;
      top: 0;
      z-index: 1000;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      box-shadow: 0 2px 20px rgba(0,0,0,0.1);
      transition: all 0.3s ease;
    }

    .premium-nav.scrolled {
      background: rgba(255, 255, 255, 0.98);
      box-shadow: 0 5px 30px rgba(0,0,0,0.15);
    }

    .nav-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .logo {
      text-decoration: none;
      display: flex;
      align-items: center;
    }

    .nav-menu {
      display: flex;
      list-style: none;
      gap: 2.5rem;
      align-items: center;
    }

    .nav-menu a {
      color: var(--text);
      text-decoration: none;
      font-weight: 500;
      transition: all 0.3s ease;
      position: relative;
    }

    .nav-menu a::after {
      content: '';
      position: absolute;
      bottom: -5px;
      left: 0;
      width: 0;
      height: 2px;
      background: var(--accent);
      transition: width 0.3s ease;
    }

    .nav-menu a:hover::after {
      width: 100%;
    }

    .nav-cta {
      background: var(--hero-gradient);
      color: white;
      padding: 0.75rem 2rem;
      border-radius: var(--button-radius);
      text-decoration: none;
      font-weight: 600;
      transition: all 0.3s ease;
      box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    }

    .nav-cta:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0,0,0,0.3);
    }

    .mobile-menu-toggle {
      display: none;
      flex-direction: column;
      gap: 4px;
      cursor: pointer;
      background: none;
      border: none;
      padding: 5px;
    }

    .mobile-menu-toggle span {
      width: 25px;
      height: 3px;
      background: var(--text);
      transition: all 0.3s ease;
      border-radius: 3px;
    }

    .mobile-menu-toggle.active span:nth-child(1) {
      transform: rotate(45deg) translate(5px, 5px);
    }

    .mobile-menu-toggle.active span:nth-child(2) {
      opacity: 0;
    }

    .mobile-menu-toggle.active span:nth-child(3) {
      transform: rotate(-45deg) translate(7px, -6px);
    }

    /* Video Background */
    .video-bg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      z-index: -1;
    }

    /* Hero Variations */
    .hero {
      min-height: 100vh;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      margin-top: 80px;
    }

    /* Classic Hero */
    .hero-classic .hero-background {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: -2;
    }

    .hero-classic .hero-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      filter: brightness(0.8);
    }

    .hero-classic .hero-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.6) 100%);
      z-index: -1;
    }

    .hero-classic .hero-content {
      max-width: 1200px;
      padding: 2rem;
      z-index: 1;
    }

    /* Split Hero */
    .hero-split {
      padding: 0;
      margin-top: 80px;
    }

    .hero-split-content {
      display: grid;
      grid-template-columns: 1fr 1fr;
      width: 100%;
      min-height: calc(100vh - 80px);
    }

    .hero-text-side {
      padding: 4rem;
      display: flex;
      flex-direction: column;
      justify-content: center;
      background: linear-gradient(135deg, var(--light) 0%, white 100%);
    }

    .hero-image-side {
      position: relative;
      overflow: hidden;
    }

    .hero-split-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .hero-stats {
      display: flex;
      gap: 3rem;
      margin-top: 3rem;
    }

    .hero-stats .stat {
      text-align: center;
    }

    .hero-stats .counter {
      font-size: 2.5rem;
      font-weight: bold;
      color: var(--primary);
    }

    /* Fullscreen Hero */
    .hero-fullscreen {
      position: relative;
      width: 100%;
      height: 100vh;
      margin-top: 0;
    }

    .hero-video-container {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    .hero-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .hero-gradient-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.5) 100%);
    }

    .hero-fullscreen-content {
      position: relative;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 2rem;
      z-index: 1;
    }

    .hero-badge {
      background: rgba(255,255,255,0.2);
      backdrop-filter: blur(10px);
      padding: 0.5rem 1.5rem;
      border-radius: 50px;
      margin-bottom: 2rem;
      font-weight: 600;
      border: 1px solid rgba(255,255,255,0.3);
    }

    .hero-massive-title {
      font-size: clamp(3rem, 10vw, 7rem);
      font-weight: 900;
      line-height: 1;
      margin-bottom: 1rem;
    }

    .hero-subtitle {
      font-size: clamp(1.2rem, 3vw, 2rem);
      opacity: 0.95;
      margin-bottom: 2rem;
    }

    .hero-features {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      justify-content: center;
      margin-bottom: 3rem;
    }

    .feature-badge {
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      padding: 0.5rem 1rem;
      border-radius: 25px;
      border: 1px solid rgba(255,255,255,0.2);
      font-size: 0.9rem;
    }

    .scroll-indicator {
      position: absolute;
      bottom: 2rem;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      animation: bounce 2s infinite;
    }

    .scroll-arrow {
      width: 20px;
      height: 20px;
      border-right: 2px solid;
      border-bottom: 2px solid;
      transform: rotate(45deg);
    }

    @keyframes bounce {
      0%, 100% { transform: translateX(-50%) translateY(0); }
      50% { transform: translateX(-50%) translateY(10px); }
    }

    .hero h1, .hero-title {
      font-family: var(--heading-font);
      font-size: clamp(3rem, 8vw, 6rem);
      font-weight: 900;
      margin-bottom: 1rem;
      line-height: 1.1;
    }

    .tagline {
      font-family: var(--accent-font);
      font-size: clamp(1.5rem, 3vw, 2rem);
      margin: 2rem 0;
      opacity: 0.95;
      font-weight: 300;
    }

    .hero-cta {
      display: flex;
      gap: 1.5rem;
      justify-content: ${heroAlignment};
      flex-wrap: wrap;
      margin-top: 3rem;
    }

    .btn-premium {
      padding: 1.2rem 3rem;
      font-size: 1.1rem;
      font-weight: 600;
      border: none;
      border-radius: var(--button-radius);
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 1px;
      background: white;
      color: var(--primary);
      transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      text-decoration: none;
      display: inline-block;
      position: relative;
      overflow: hidden;
    }

    .btn-premium::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0;
      height: 0;
      border-radius: 50%;
      background: var(--accent);
      transform: translate(-50%, -50%);
      transition: width 0.6s, height 0.6s;
    }

    .btn-premium:hover::before {
      width: 300px;
      height: 300px;
    }

    .btn-premium:hover {
      transform: translateY(-3px);
      box-shadow: 0 15px 40px rgba(0,0,0,0.3);
      color: white;
    }

    .btn-premium span {
      position: relative;
      z-index: 1;
    }

    .btn-large {
      padding: 1.5rem 4rem;
      font-size: 1.3rem;
    }

    .btn-secondary {
      padding: 1.2rem 3rem;
      font-size: 1.1rem;
      font-weight: 600;
      border: 2px solid white;
      border-radius: var(--button-radius);
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 1px;
      background: transparent;
      transition: all 0.3s ease;
      text-decoration: none;
      display: inline-block;
    }

    .btn-secondary:hover {
      background: white;
      color: var(--primary) !important;
    }

    .btn-secondary-alt {
      padding: 1.2rem 3rem;
      font-size: 1.1rem;
      font-weight: 600;
      border: 2px solid var(--primary);
      border-radius: var(--button-radius);
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 1px;
      background: transparent;
      color: var(--primary);
      transition: all 0.3s ease;
      text-decoration: none;
      display: inline-block;
    }

    .btn-secondary-alt:hover {
      background: var(--primary);
      color: white;
    }

    /* Pulse animation */
    .pulse {
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0% {
        box-shadow: 0 0 0 0 rgba(255,255, 255, 0.7);
      }
      70% {
        box-shadow: 0 0 0 20px rgba(255, 255, 255, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(255, 255, 255, 0);
      }
    }

    /* Premium Cards */
    .premium-card {
      background: white;
      border-radius: 20px;
      padding: 2.5rem;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
      transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      position: relative;
      overflow: hidden;
      transform-style: preserve-3d;
    }

    .premium-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 5px;
      background: var(--hero-gradient);
    }

    .premium-card:hover {
      transform: translateY(-15px) rotateX(7deg);
      box-shadow: 
        0 50px 100px -20px rgba(50,50,93,.25),
        0 30px 60px -30px rgba(0,0,0,.3);
    }

    /* Gradient text effect */
    .gradient-text {
      background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.1));
    }

    .gradient-bg {
      background: var(--hero-gradient);
      color: white;
    }

    /* Trust Signals */
    .trust-signals {
      background: linear-gradient(135deg, #f5f5f5, #ffffff);
      padding: 3rem 0;
      border-top: 3px solid var(--primary);
    }

    .trust-container {
      display: flex;
      justify-content: space-around;
      flex-wrap: wrap;
      gap: 2rem;
    }

    .trust-badge {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.5rem;
      background: white;
      border-radius: 15px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.1);
      transition: transform 0.3s ease;
    }

    .trust-badge:hover {
      transform: translateY(-5px);
      box-shadow: 0 15px 40px rgba(0,0,0,0.15);
    }

    .badge-icon {
      font-size: 2rem;
      width: 60px;
      height: 60px;
      background: var(--hero-gradient);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }

    .badge-text strong {
      display: block;
      font-size: 1.1rem;
      color: var(--primary);
    }

    .badge-text span {
      color: var(--text);
      opacity: 0.8;
    }

    /* Social Proof Ticker */
    .social-proof-ticker {
      background: var(--primary);
      color: white;
      padding: 0.8rem;
      overflow: hidden;
      position: sticky;
      top: 80px;
      z-index: 900;
    }

    .ticker-content {
      display: flex;
      animation: ticker 30s linear infinite;
      gap: 4rem;
    }

    .ticker-item {
      white-space: nowrap;
      padding: 0 2rem;
    }

    @keyframes ticker {
      0% { transform: translateX(100%); }
      100% { transform: translateX(-100%); }
    }

    /* Interactive Elements */
    .quote-calculator, .service-estimator, .booking-widget {
      background: white;
      padding: 2rem;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.1);
      max-width: 400px;
      margin: 2rem auto;
    }

    .premium-slider {
      width: 100%;
      margin: 1rem 0;
    }

    .premium-select, .premium-input {
      width: 100%;
      padding: 1rem;
      border: 2px solid var(--light);
      border-radius: 10px;
      margin: 0.5rem 0;
      font-size: 1rem;
    }

    .estimate-text {
      font-size: 1.2rem;
      font-weight: bold;
      color: var(--accent);
    }

    /* Google Reviews Widget */
    .google-reviews-widget {
      max-width: 600px;
      margin: 2rem auto;
    }

    .reviews-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .google-logo {
      height: 24px;
    }

    .rating-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .stars {
      color: #FFD700;
      font-size: 1.2rem;
    }

    .recent-reviews {
      margin: 2rem 0;
    }

    .review-card {
      padding: 1.5rem;
      border-bottom: 1px solid var(--light);
    }

    .review-card:last-child {
      border-bottom: none;
    }

    .review-date {
      color: var(--text);
      opacity: 0.6;
      font-size: 0.9rem;
    }

    /* Live Chat Bubble */
    .live-chat-bubble {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: var(--primary);
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 50px;
      cursor: pointer;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      animation: bounce 2s infinite;
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .chat-icon {
      font-size: 1.5rem;
    }

    .chat-popup {
      position: absolute;
      bottom: 70px;
      right: 0;
      background: white;
      border-radius: 15px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      padding: 1rem;
      display: none;
      min-width: 200px;
    }

    .live-chat-bubble:hover .chat-popup {
      display: block;
    }

    .chat-option {
      display: block;
      padding: 0.75rem;
      color: var(--text);
      text-decoration: none;
      border-radius: 10px;
      transition: background 0.3s ease;
    }

    .chat-option:hover {
      background: var(--light);
    }

    /* Exit Intent Popup */
    .exit-popup {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    }

    .popup-content {
      background: white;
      padding: 3rem;
      border-radius: 20px;
      max-width: 500px;
      text-align: center;
      position: relative;
    }

    .close-popup {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: none;
      border: none;
      font-size: 2rem;
      cursor: pointer;
      color: var(--text);
    }

    .offer-text {
      font-size: 2rem;
      color: var(--accent);
      font-weight: bold;
      margin: 1rem 0;
    }

    .countdown {
      font-size: 2.5rem;
      font-weight: bold;
      color: var(--primary);
      margin: 1rem 0;
    }

    .disclaimer {
      font-size: 0.9rem;
      color: var(--text);
      opacity: 0.7;
      margin-top: 1rem;
    }

    /* Sections */
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 2rem;
    }

    section {
      padding: 5rem 0;
      position: relative;
    }

    .section-title {
      font-family: var(--heading-font);
      font-size: clamp(2.5rem, 5vw, 4rem);
      text-align: center;
      margin-bottom: 1rem;
      background: var(--hero-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      font-weight: 900;
    }

    .section-subtitle {
      text-align: center;
      font-size: 1.2rem;
      color: var(--text);
      opacity: 0.8;
      margin-bottom: 3rem;
      max-width: 600px;
      margin-left: auto;
      margin-right: auto;
    }

    /* About Section Variations */
    .about-section {
      background: linear-gradient(135deg, var(--light) 0%, white 100%);
    }

    .about-content {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4rem;
      align-items: center;
      margin-top: 3rem;
    }

    .about-left {
      grid-template-columns: 1fr 1fr;
    }

    .about-centered {
      background: white;
      position: relative;
      overflow: hidden;
    }

    .about-bg-pattern {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0.05;
      background-image: repeating-linear-gradient(45deg, var(--primary) 0, var(--primary) 1px, transparent 1px, transparent 15px);
    }

    .about-content-centered {
      max-width: 1000px;
      margin: 0 auto;
      text-align: center;
    }

    .about-lead {
      font-size: 1.3rem;
      line-height: 1.8;
      margin-bottom: 3rem;
    }

    .about-features {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2rem;
      margin: 3rem 0;
    }

    .feature-item {
      padding: 2rem;
    }

    .feature-icon {
      width: 60px;
      height: 60px;
      margin: 0 auto 1rem;
      background: var(--hero-gradient);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      color: white;
    }

    .about-image-strip {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin-top: 3rem;
    }

    .about-image-strip img {
      width: 100%;
      height: 200px;
      object-fit: cover;
      border-radius: 10px;
    }

    /* Timeline About */
    .about-timeline {
      background: white;
    }

    .timeline-container {
      position: relative;
      max-width: 1000px;
      margin: 3rem auto;
    }

    .timeline-line {
      position: absolute;
      left: 50%;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--hero-gradient);
      transform: translateX(-50%);
    }

    .timeline-item {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4rem;
      margin-bottom: 4rem;
      align-items: center;
    }

    .timeline-item.reverse {
      direction: rtl;
    }

    .timeline-item.reverse > * {
      direction: ltr;
    }

    .timeline-content {
      padding: 2rem;
      background: var(--light);
      border-radius: 20px;
    }

    .timeline-image img {
      width: 100%;
      height: 250px;
      object-fit: cover;
      border-radius: 20px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.1);
    }

    .about-description {
      max-width: 800px;
      margin: 3rem auto 0;
      text-align: center;
      font-size: 1.1rem;
      line-height: 1.8;
    }

    .about-text {
      font-size: 1.1rem;
      line-height: 1.8;
    }

    .about-image {
      position: relative;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }

    .about-image img {
      width: 100%;
      height: auto;
      display: block;
    }

    .image-decoration {
      position: absolute;
      top: -20px;
      right: -20px;
      width: 100px;
      height: 100px;
      background: var(--hero-gradient);
      border-radius: 50%;
      opacity: 0.3;
    }

    .about-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2rem;
      margin-top: 3rem;
    }

    .stat-card {
      text-align: center;
    }

    .stat-number, .counter {
      font-family: var(--heading-font);
      font-size: 3rem;
      font-weight: 900;
      background: var(--hero-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .stat-label {
      font-size: 1rem;
      color: var(--text);
      opacity: 0.8;
      margin-top: 0.5rem;
    }

    /* Services Grid */
    .services-grid {
      display: grid;
      grid-template-columns: var(--grid-columns);
      gap: 2rem;
      margin-top: 3rem;
    }

    .service-item {
      text-align: center;
      padding: 2rem;
    }

    .service-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 1.5rem;
      background: var(--hero-gradient);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      color: white;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }

    .service-item h4 {
      font-family: var(--heading-font);
      font-size: 1.5rem;
      margin-bottom: 1rem;
      color: var(--primary);
    }

    /* Testimonials */
    .testimonials-section {
      background: linear-gradient(135deg, white 0%, var(--light) 100%);
    }

    .testimonials-container {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 2rem;
      margin-top: 3rem;
    }

    .testimonial-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.5rem;
    }

    .customer-info {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .avatar {
      width: 50px;
      height: 50px;
      background: var(--hero-gradient);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 1.5rem;
    }

    .verified {
      color: var(--accent);
      font-weight: 600;
      font-size: 0.9rem;
    }

    .testimonial-card p {
      font-style: italic;
      line-height: 1.8;
      color: var(--text);
      font-size: 1.05rem;
    }

    /* Gallery Section */
    .gallery-section {
      padding: 5rem 0;
    }

    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
      margin-top: 3rem;
    }

    .gallery-item {
      position: relative;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
      transition: all 0.3s ease;
      cursor: pointer;
    }

    .gallery-item:hover {
      transform: scale(1.05);
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }

    .gallery-item img {
      width: 100%;
      height: 300px;
      object-fit: cover;
    }

    .gallery-overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
      color: white;
      padding: 2rem 1.5rem 1.5rem;
      transform: translateY(100%);
      transition: transform 0.3s ease;
    }

    .gallery-item:hover .gallery-overlay {
      transform: translateY(0);
    }

    /* Contact Section */
    .contact-section {
      background: var(--hero-gradient);
      color: white;
      position: relative;
      overflow: hidden;
    }

    .contact-section .section-title {
      color: #FFFFFF !important;
      text-shadow: 2px 2px 8px rgba(0,0,0,0.7) !important;
      -webkit-text-fill-color: #FFFFFF !important;
    }

    .contact-section .section-subtitle {
      color: #FFFFFF !important;
      text-shadow: 1px 1px 4px rgba(0,0,0,0.5) !important;
    }

    .contact-section::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
      animation: rotate 30s linear infinite;
    }

    @keyframes rotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .contact-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 3rem;
      margin-top: 3rem;
      position: relative;
      z-index: 1;
    }

    .contact-card {
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.2);
      color: white;
    }

    .contact-card h3 {
      font-family: var(--heading-font);
      font-size: 1.8rem;
      margin-bottom: 1.5rem;
    }

    .contact-card a {
      color: white;
      text-decoration: none;
      font-weight: 500;
      transition: all 0.3s ease;
    }

    .contact-card a:hover {
      text-decoration: underline;
    }

    /* Interactive Section */
    .interactive-section .section-title {
      color: #FFFFFF !important;
      text-shadow: 2px 2px 8px rgba(0,0,0,0.7) !important;
      -webkit-text-fill-color: #FFFFFF !important;
    }

    /* Hours */
    .hours-container {
      margin-top: 1rem;
    }

    .hours-row {
      display: flex;
      justify-content: space-between;
      padding: 0.75rem 0;
      border-bottom: 1px solid rgba(255,255,255,0.2);
    }

    .hours-row:last-child {
      border-bottom: none;
    }

    .day {
      font-weight: 600;
    }

    /* Map */
    .map-container {
      width: 100%;
      height: 500px;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      margin-top: 3rem;
    }

    .map-container iframe {
      width: 100%;
      height: 100%;
      border: none;
    }

    /* Category Specific Styles */
    .emergency-banner {
      background: linear-gradient(135deg, #FF6B6B, #FF9900);
      color: white;
      padding: 2rem 0;
      text-align: center;
      position: sticky;
      top: 80px;
      z-index: 900;
      box-shadow: 0 5px 20px rgba(0,0,0,0.2);
    }

    .btn-emergency {
      background: white;
      color: #FF6B6B;
      padding: 1rem 2rem;
      border-radius: 50px;
      text-decoration: none;
      font-weight: bold;
      display: inline-block;
      margin-top: 1rem;
      transition: all 0.3s ease;
    }

    .btn-emergency:hover {
      transform: scale(1.05);
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }

    .menu-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
      margin: 3rem 0;
    }

    .menu-card {
      background: white;
    }

    .menu-card h3 {
      font-family: var(--heading-font);
      color: var(--primary);
      margin-bottom: 1.5rem;
      font-size: 1.8rem;
    }

    .menu-item {
      display: flex;
      justify-content: space-between;
      padding: 1rem 0;
      border-bottom: 1px dotted var(--light);
    }

    .menu-item:last-child {
      border-bottom: none;
    }

    .price {
      color: var(--accent);
      font-weight: bold;
      font-size: 1.1rem;
    }

    .reservation-widget,
    .calculator-widget,
    .booking-widget,
    .estimator-widget,
    .calendar-widget {
      max-width: 600px;
      margin: 0 auto;
      padding: 3rem;
    }

    .reservation-form,
    .booking-form {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .reservation-form input,
    .reservation-form select,
    .calculator-widget select,
    .estimator-widget select {
      padding: 1rem;
      border: 2px solid var(--light);
      border-radius: 10px;
      font-size: 1rem;
      transition: all 0.3s ease;
    }

    .reservation-form input:focus,
    .reservation-form select:focus {
      outline: none;
      border-color: var(--accent);
    }

    .instagram-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin: 3rem 0;
    }

    .instagram-post {
      position: relative;
      padding-top: 100%;
      overflow: hidden;
    }

    .instagram-post img {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .instagram-overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);
      color: white;
      padding: 1rem;
      transform: translateY(100%);
      transition: transform 0.3s ease;
    }

    .instagram-post:hover .instagram-overlay {
      transform: translateY(0);
    }

    .service-selector {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .service-btn {
      flex: 1;
      padding: 1rem;
      border: 2px solid var(--light);
      background: white;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .service-btn.active,
    .service-btn:hover {
      background: var(--hero-gradient);
      color: white;
      border-color: transparent;
    }

    .stylist-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin: 1rem 0 2rem;
    }

    .stylist-card {
      text-align: center;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .stylist-card:hover {
      transform: scale(1.05);
    }

    .stylist-card img {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      object-fit: cover;
      margin-bottom: 0.5rem;
    }

    .trust-badges {
      display: flex;
      justify-content: center;
      gap: 3rem;
      margin: 3rem 0;
    }

    .badge {
      text-align: center;
    }

    /* Parallax effect */
    .parallax {
      will-change: transform;
    }

    /* Floating animation */
    .floating {
      animation: float 6s ease-in-out infinite;
    }

    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-20px); }
    }

    /* Footer */
    footer {
      background: var(--dark);
      color: white;
      padding: 4rem 0 2rem;
      margin-top: 5rem;
    }

    .footer-content {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 3rem;
      margin-bottom: 3rem;
    }

    .footer-section h3 {
      font-family: var(--heading-font);
      margin-bottom: 1.5rem;
      font-size: 1.5rem;
    }

    .footer-section ul {
      list-style: none;
    }

    .footer-section li {
      margin-bottom: 0.75rem;
    }

    .footer-section a {
      color: rgba(255,255,255,0.8);
      text-decoration: none;
      transition: color 0.3s ease;
    }

    .footer-section a:hover {
      color: white;
    }

    .social-links {
      display: flex;
      gap: 1rem;
      margin-top: 1rem;
    }

    .social-links a {
      width: 40px;
      height: 40px;
      background: rgba(255,255,255,0.1);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
    }

    .social-links a:hover {
      background: var(--accent);
      transform: translateY(-3px);
    }

    .footer-bottom {
      text-align: center;
      padding-top: 2rem;
      border-top: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.6);
    }

    /* Mobile Responsive */
    @media (max-width: 768px) {
      .nav-menu {
        position: fixed;
        left: -100%;
        top: 80px;
        flex-direction: column;
        background: white;
        width: 100%;
        text-align: center;
        transition: 0.3s;
        box-shadow: 0 10px 27px rgba(0,0,0,0.05);
        padding: 2rem 0;
      }

      .nav-menu.active {
        left: 0;
      }

      .mobile-menu-toggle {
        display: flex;
      }

      .hero h1 {
        font-size: 2.5rem;
      }

      .hero-split-content {
        grid-template-columns: 1fr;
      }

      .hero-text-side {
        padding: 2rem;
      }

      .hero-image-side {
        height: 300px;
      }

      .hero-stats {
        flex-direction: column;
        gap: 1rem;
      }

      .about-content,
      .timeline-item {
        grid-template-columns: 1fr;
      }

      .timeline-line {
        display: none;
      }

      .about-features {
        grid-template-columns: 1fr;
      }

      .services-grid,
      .testimonials-container,
      .gallery-grid,
      .contact-grid {
        grid-template-columns: 1fr;
      }

      .instagram-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .stylist-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .about-stats {
        grid-template-columns: 1fr;
        gap: 1rem;
      }

      .trust-badges {
        flex-direction: column;
        gap: 2rem;
      }

      .trust-container {
        flex-direction: column;
      }
    }

    /* Loading Animation */
    .loading {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      transition: opacity 0.5s ease;
    }

    .loading.hidden {
      opacity: 0;
      pointer-events: none;
    }

    .spinner {
      width: 50px;
      height: 50px;
      border: 5px solid var(--light);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
  <script src="/edit-mode.js"></script>
</head>
<body data-preview-id="${business.id}">
  <!-- Loading Screen -->
  <div class="loading" id="loading">
    <div class="spinner"></div>
  </div>

  <!-- Social Proof Ticker -->
  ${generateSocialProofTicker(city)}

  <!-- Premium Navigation -->
  <nav class="premium-nav" id="navbar">
    <div class="nav-container">
      <a href="#home" class="logo">
        ${getLogoHTML()}
      </a>
      <ul class="nav-menu" id="nav-menu">
        <li><a href="#about">About</a></li>
        <li><a href="#services">Services</a></li>
        <li><a href="#gallery">Gallery</a></li>
        <li><a href="#testimonials">Reviews</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
      <a href="tel:${phone}" class="nav-cta">Call Now</a>
      <button class="mobile-menu-toggle" id="mobile-toggle" aria-label="Toggle menu">
        <span></span>
        <span></span>
        <span></span>
      </button>
    </div>
  </nav>

  ${getHeroSection()}

  ${getCategorySpecificSections()}

  <!-- Trust Signals -->
  ${generateTrustSignals(content.businessType, businessName)}

  ${getAboutSection()}

  <!-- Interactive Elements Section -->
  <section class="interactive-section">
    <div class="container">
      <h2 class="section-title animate-on-scroll" style="color: #FFFFFF !important; text-shadow: 2px 2px 8px rgba(0,0,0,0.7) !important;">Get Started Today</h2>
      ${generateInteractiveElements(content.businessType)}
    </div>
  </section>

  <!-- Services Section -->
  <section id="services" class="services-section">
    <div class="container">
      <h2 class="section-title animate-on-scroll">Our Services</h2>
      <p class="section-subtitle animate-on-scroll">Excellence in Every Detail</p>
      <div class="services-grid">
        ${servicesHTML}
      </div>
    </div>
  </section>

  <!-- Gallery Section -->
  <section id="gallery" class="gallery-section">
    <div class="container">
      <h2 class="section-title animate-on-scroll">Our Work</h2>
      <p class="section-subtitle animate-on-scroll">See What We Can Do</p>
      <div class="gallery-grid">
        <div class="gallery-item animate-on-scroll" style="--delay: 1">
          <img src="${images.hero}" alt="Gallery 1" />
          <div class="gallery-overlay">
            <h4>Premium Quality</h4>
            <p>Excellence in every project</p>
          </div>
        </div>
        <div class="gallery-item animate-on-scroll" style="--delay: 2">
          <img src="${images.service}" alt="Gallery 2" />
          <div class="gallery-overlay">
            <h4>Professional Service</h4>
            <p>Attention to detail</p>
          </div>
        </div>
        <div class="gallery-item animate-on-scroll" style="--delay: 3">
          <img src="${images.team}" alt="Gallery 3" />
          <div class="gallery-overlay">
            <h4>Expert Team</h4>
            <p>Skilled professionals</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Google Reviews Widget -->
  <section class="reviews-section">
    <div class="container">
      <h2 class="section-title animate-on-scroll">Customer Reviews</h2>
      ${generateReviewsWidget()}
    </div>
  </section>

  <!-- Testimonials Section -->
  <section id="testimonials" class="testimonials-section">
    <div class="container">
      <h2 class="section-title animate-on-scroll">What Our Customers Say</h2>
      <p class="section-subtitle animate-on-scroll">Real Reviews from Real People</p>
      <div class="testimonials-container">
        ${testimonialsHTML}
      </div>
    </div>
  </section>

  <!-- Contact Section -->
  <section id="contact" class="contact-section">
    <div class="container">
      <h2 class="section-title animate-on-scroll" style="color: #FFFFFF !important; text-shadow: 2px 2px 8px rgba(0,0,0,0.7) !important;">Get In Touch</h2>
      <p class="section-subtitle animate-on-scroll" style="color: #FFFFFF !important; text-shadow: 1px 1px 4px rgba(0,0,0,0.5) !important;">We're Here to Help</p>
      <div class="contact-grid">
        <div class="contact-card premium-card animate-on-scroll" style="--delay: 1">
          <h3>📍 Visit Us</h3>
          <p>${address}</p>
          <p>${city}, ${state} ${zip}</p>
          <a href="https://maps.google.com/?q=${encodeURI(address + ' ' + city + ' ' + state)}" target="_blank">Get Directions</a>
        </div>
        <div class="contact-card premium-card animate-on-scroll" style="--delay: 2">
          <h3>📞 Contact</h3>
          <p><a href="tel:${phone}">${phone}</a></p>
          ${email ? `<p><a href="mailto:${email}">${email}</a></p>` : ''}
          <div class="social-links">
            <a href="#" aria-label="Facebook">f</a>
            <a href="#" aria-label="Instagram">i</a>
            <a href="#" aria-label="Twitter">t</a>
          </div>
        </div>
        <div class="contact-card premium-card animate-on-scroll" style="--delay: 3">
          <h3>🕒 Business Hours</h3>
          <div class="hours-container">
            ${hoursHTML}
          </div>
        </div>
      </div>
      
      <!-- Google Maps -->
      <div class="map-container animate-on-scroll" style="--delay: 4">
        <iframe 
          src="${mapsEmbedUrl}"
          allowfullscreen=""
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade">
        </iframe>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer>
    <div class="container">
      <div class="footer-content">
        <div class="footer-section">
          <h3>${businessName}</h3>
          <p>${content.tagline}</p>
          <div class="social-links">
            <a href="#" aria-label="Facebook">f</a>
            <a href="#" aria-label="Instagram">i</a>
            <a href="#" aria-label="Twitter">t</a>
            <a href="#" aria-label="LinkedIn">in</a>
          </div>
        </div>
        <div class="footer-section">
          <h3>Quick Links</h3>
          <ul>
            <li><a href="#about">About Us</a></li>
            <li><a href="#services">Services</a></li>
            <li><a href="#gallery">Gallery</a></li>
            <li><a href="#testimonials">Reviews</a></li>
            <li><a href="#contact">Contact</a></li>
          </ul>
        </div>
        <div class="footer-section">
          <h3>Services</h3>
          <ul>
            ${content.services.slice(0, 5).map((s: string) => `<li><a href="#services">${s.substring(2)}</a></li>`).join('')}
          </ul>
        </div>
        <div class="footer-section">
          <h3>Contact Info</h3>
          <ul>
            <li>📍 ${address}</li>
            <li>${city}, ${state} ${zip}</li>
            <li>📞 <a href="tel:${phone}">${phone}</a></li>
            ${email ? `<li>✉️ <a href="mailto:${email}">${email}</a></li>` : ''}
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; 2025 ${businessName}. All rights reserved. | Powered by WebInstant Premium</p>
      </div>
    </div>
  </footer>

  <!-- Live Chat Bubble -->
  ${generateLiveChatBubble(phone)}

  <!-- Exit Intent Popup -->
  ${generateExitIntentPopup(businessName)}

  <script>
    // Hide loading screen
    window.addEventListener('load', () => {
      setTimeout(() => {
        document.getElementById('loading').classList.add('hidden');
      }, 500);
    });

    // Navbar scroll effect
    window.addEventListener('scroll', () => {
      const navbar = document.getElementById('navbar');
      if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    // Intersection Observer for animations
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          
          // Animate counters when visible
          const counters = entry.target.querySelectorAll('.counter');
          counters.forEach(counter => {
            const target = parseInt(counter.getAttribute('data-target'));
            if (target && !counter.classList.contains('counted')) {
              counter.classList.add('counted');
              animateCounter(counter, target);
            }
          });
        }
      });
    }, observerOptions);

    document.querySelectorAll('.animate-on-scroll').forEach(el => {
      observer.observe(el);
    });

    // Animated number counter
    function animateCounter(element, target) {
      let current = 0;
      const increment = target / 100;
      const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
          element.textContent = target.toLocaleString();
          clearInterval(timer);
        } else {
          element.textContent = Math.floor(current).toLocaleString();
        }
      }, 20);
    }

    // Mobile menu toggle
    document.getElementById('mobile-toggle').addEventListener('click', function() {
      this.classList.toggle('active');
      document.getElementById('nav-menu').classList.toggle('active');
    });

    // Close mobile menu when clicking a link
    document.querySelectorAll('.nav-menu a').forEach(link => {
      link.addEventListener('click', () => {
        document.getElementById('mobile-toggle').classList.remove('active');
        document.getElementById('nav-menu').classList.remove('active');
      });
    });

    // Parallax effect for hero image
    window.addEventListener('scroll', () => {
      const scrolled = window.pageYOffset;
      const parallaxElements = document.querySelectorAll('.parallax');
      parallaxElements.forEach(element => {
        const speed = 0.5;
        element.style.transform = \`translateY(\${scrolled * speed}px)\`;
      });
    });

    // Exit Intent Popup
    let exitIntent = false;
    document.addEventListener('mouseleave', (e) => {
      if (e.clientY <= 0 && !exitIntent) {
        document.getElementById('exitPopup').style.display = 'flex';
        exitIntent = true;
        startCountdown();
      }
    });

    // Countdown Timer
    function startCountdown() {
      let hours = 48;
      let minutes = 0;
      let seconds = 0;
      
      const countdownEl = document.getElementById('countdown');
      
      const timer = setInterval(() => {
        if (seconds > 0) {
          seconds--;
        } else if (minutes > 0) {
          minutes--;
          seconds = 59;
        } else if (hours > 0) {
          hours--;
          minutes = 59;
          seconds = 59;
        } else {
          clearInterval(timer);
        }
        
        if (countdownEl) {
          countdownEl.textContent =  \`\${hours.toString().padStart(2, '0')}:\${minutes.toString().padStart(2, '0')}:\${seconds.toString().padStart(2, '0')}\`;
        }
      }, 1000);
    }

    // Interactive Calculator for Restaurant
    ${content.businessType === 'restaurant' ? `
      document.getElementById('party-size')?.addEventListener('input', function() {
        const size = this.value;
        document.getElementById('guest-count').textContent = size;
        document.getElementById('cost-estimate').textContent = (size * 25).toFixed(0);
      });
    ` : ''}

    // Category-specific interactions
    ${content.businessType === 'restaurant' ? `
      // Reservation form handler
      document.querySelector('.reservation-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Thank you for your reservation! We will confirm shortly.');
      });
    ` : ''}

    ${content.businessType === 'plumbing' ? `
      // Service calculator
      document.getElementById('service-type')?.addEventListener('change', function() {
        if (this.value) {
          const range = this.options[this.selectedIndex].text.match(/\\$([\\d,]+)-([\\d,]+)/);
          if (range) {
            alert(\`Estimated cost: \${range[0]}. Call us for an exact quote!\`);
          }
        }
      });
    ` : ''}

    ${content.businessType === 'beauty' ? `
      // Service selector
      document.querySelectorAll('.service-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          document.querySelectorAll('.service-btn').forEach(b => b.classList.remove('active'));
          this.classList.add('active');
        });
      });

      // Stylist selector
      document.querySelectorAll('.stylist-card').forEach(card => {
        card.addEventListener('click', function() {
          document.querySelectorAll('.stylist-card').forEach(c => c.style.border = 'none');
          this.style.border = '3px solid var(--accent)';
        });
      });
    ` : ''}

    // Add floating animation to elements
    const floatingElements = document.querySelectorAll('.floating');
    floatingElements.forEach((el, index) => {
      el.style.animationDelay = \`\${index * 0.2}s\`;
    });

    // Gallery lightbox effect
    document.querySelectorAll('.gallery-item').forEach(item => {
      item.addEventListener('click', function() {
        const img = this.querySelector('img');
        const lightbox = document.createElement('div');
        lightbox.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;z-index:9999;cursor:pointer';
        lightbox.innerHTML = \`<img src="\${img.src}" style="max-width:90%;max-height:90%;object-fit:contain">\`;
        lightbox.addEventListener('click', () => lightbox.remove());
        document.body.appendChild(lightbox);
      });
    });

    // Form validation
    document.querySelectorAll('form').forEach(form => {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        const inputs = this.querySelectorAll('input[required], select[required]');
        let valid = true;
        inputs.forEach(input => {
          if (!input.value) {
            input.style.borderColor = 'red';
            valid = false;
          } else {
            input.style.borderColor = '';
          }
        });
        if (valid) {
          alert('Thank you! We will contact you shortly.');
          this.reset();
        }
      });
    });

    // Add page load animations
    document.addEventListener('DOMContentLoaded', () => {
      const elements = document.querySelectorAll('.hero-content > *, .hero-fullscreen-content > *, .hero-text-side > *');
      elements.forEach((el, index) => {
        if (!el.style.animationDelay) {
          el.style.opacity = '0';
          el.style.transform = 'translateY(30px)';
          setTimeout(() => {
            el.style.transition = 'all 0.8s ease';
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
          }, index * 200);
        }
      });
    });
  </script>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Premium website preview generator endpoint with SerpAPI integration',
    method: 'POST',
    features: [
      'SerpAPI integration to check for existing websites',
      'Skips businesses that already have websites',
      'Caches website check results for 30 days',
      'AI-powered content generation with Together AI or Claude',
      'AI-generated images with Replicate',
      'AI-generated logos and video backgrounds',
      'Category-specific themes and layouts',
      'Premium $2000-quality designs',
      '3 distinct layout variations per business type',
      'Advanced animations and interactions',
      'Trust signals and social proof',
      'Interactive calculators and widgets',
      'Google Reviews integration',
      'Live chat bubble',
      'Exit intent popups',
      'Mobile-responsive design'
    ],
    body: {
      businessId: 'string (optional) - The ID of a specific business to generate preview for. If omitted, generates for all businesses without previews.',
      skipWebsiteCheck: 'boolean (optional) - Skip the SerpAPI website check. Default: false'
    },
    response: {
      success: 'boolean - Whether the operation was successful',
      generated: 'number - Number of previews successfully generated',
      skipped: 'number - Number of businesses skipped (already have websites)',
      skippedBusinesses: 'string[] - Names of businesses that were skipped',
      failed: 'number - Number of previews that failed to generate',
      total: 'number - Total number of businesses processed',
      message: 'string - Summary message'
    },
    environmentVariables: {
      SERPAPI_KEY: 'Your SerpAPI key for checking existing websites',
      TOGETHER_API_KEY: 'Together AI API key for content generation',
      REPLICATE_API_TOKEN: 'Replicate API token for image generation',
      ANTHROPIC_API_KEY: 'Optional Claude API key for premium content'
    }
  });
}
