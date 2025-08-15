import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { 
  generateBusinessContent, 
  detectBusinessType, 
  getCategoryTheme,
  generateBusinessImages,
  getImagePrompt
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

export async function POST(request: NextRequest) {
  try {
    let businessId: string | undefined;
    try {
      const body = await request.json();
      businessId = body.businessId;
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

    for (const business of businessesToProcess) {
      try {
        // Generate premium content
        const content = generateBusinessContent(business);
        
        // Generate AI images for the business
        const images = await generateBusinessImages(content.businessType, business.business_name);
        content.images = images;
        
        // Get category-specific theme
        const theme = getCategoryTheme(content.businessType);
        
        // Generate unique slug
        const slug = await generateUniqueSlug(business.business_name);
        const previewUrl = `/preview/${slug}`;
        
        // Detect business type if not set
        const businessType = business.industry_type || detectBusinessType(business.business_name);
        
        // Generate premium HTML with category-specific design
        const htmlContent = generatePremiumHTML(business, content, theme);
        
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
              template_used: `premium-${content.businessType}`,
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
              template_used: `premium-${content.businessType}`,
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
        console.log(`Premium preview generated for ${business.business_name} (${business.id})`);
        console.log(`  - Slug: ${slug}`);
        console.log(`  - URL: ${previewUrl}`);
        console.log(`  - Theme: ${content.businessType}`);
        console.log(`  - Images: ${images ? 'AI Generated' : 'Stock Photos'}`);
        
      } catch (error) {
        console.error(`Error processing business ${business.id}:`, error);
        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      generated: generatedCount,
      failed: failedCount,
      total: businessesToProcess.length
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

function generatePremiumHTML(business: any, content: any, theme: any): string {
  const businessName = business.business_name || 'Business';
  const address = business.address || '';
  const city = business.city || '';
  const state = business.state || '';
  const phone = business.phone || '';
  const email = business.email || '';
  const zip = business.zip_code || '';
  
  // Get images (AI generated or stock)
  const images = content.images || {
    hero: 'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=1920&h=1080&fit=crop',
    service: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=600&fit=crop',
    team: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=600&fit=crop'
  };
  
  // Generate star rating HTML
  const generateStars = (rating: number) => {
    return Array(5).fill(0).map((_, i) => 
      i < rating ? '★' : '☆'
    ).join('');
  };
  
  // Generate category-specific sections
  const getCategorySpecificSections = () => {
    switch(content.businessType) {
      case 'restaurant':
        return `
          <!-- Menu Preview Section -->
          <section class="menu-section">
            <div class="container">
              <h2 class="section-title">Our Signature Menu</h2>
              <div class="menu-grid">
                <div class="menu-card premium-card">
                  <h3>Appetizers</h3>
                  <div class="menu-item">
                    <span>Truffle Arancini</span>
                    <span class="price">$18</span>
                  </div>
                  <div class="menu-item">
                    <span>Oysters Rockefeller</span>
                    <span class="price">$24</span>
                  </div>
                  <div class="menu-item">
                    <span>Wagyu Beef Carpaccio</span>
                    <span class="price">$32</span>
                  </div>
                </div>
                <div class="menu-card premium-card">
                  <h3>Main Courses</h3>
                  <div class="menu-item">
                    <span>Pan-Seared Duck Breast</span>
                    <span class="price">$48</span>
                  </div>
                  <div class="menu-item">
                    <span>Lobster Thermidor</span>
                    <span class="price">$65</span>
                  </div>
                  <div class="menu-item">
                    <span>Prime Ribeye (16oz)</span>
                    <span class="price">$72</span>
                  </div>
                </div>
              </div>
              <button class="btn-premium">View Full Menu</button>
            </div>
          </section>
          
          <!-- Reservation Widget -->
          <section class="reservation-section">
            <div class="container">
              <h2 class="section-title">Make a Reservation</h2>
              <div class="reservation-widget premium-card">
                <form class="reservation-form">
                  <input type="date" placeholder="Select Date" />
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
              <a href="tel:${phone}" class="btn-emergency">Call Now: ${phone}</a>
            </div>
          </div>
          
          <!-- Service Calculator -->
          <section class="calculator-section">
            <div class="container">
              <h2 class="section-title">Instant Quote Calculator</h2>
              <div class="calculator-widget premium-card">
                <select id="service-type">
                  <option>Select Service Type</option>
                  <option value="drain">Drain Cleaning ($150-300)</option>
                  <option value="leak">Leak Repair ($200-500)</option>
                  <option value="water-heater">Water Heater ($800-2000)</option>
                  <option value="repipe">Repiping ($3000-8000)</option>
                </select>
                <button class="btn-premium">Get Instant Quote</button>
              </div>
            </div>
          </section>
          
          <!-- Trust Badges -->
          <section class="trust-section">
            <div class="container">
              <div class="trust-badges">
                <div class="badge">
                  <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='45' fill='%230066CC'/%3E%3Ctext x='50' y='55' text-anchor='middle' fill='white' font-size='12'%3ELICENSED%3C/text%3E%3C/svg%3E" alt="Licensed" />
                  <p>Fully Licensed</p>
                </div>
                <div class="badge">
                  <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='45' fill='%2300AA44'/%3E%3Ctext x='50' y='55' text-anchor='middle' fill='white' font-size='12'%3EINSURED%3C/text%3E%3C/svg%3E" alt="Insured" />
                  <p>Fully Insured</p>
                </div>
                <div class="badge">
                  <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='45' fill='%23FFD700'/%3E%3Ctext x='50' y='55' text-anchor='middle' fill='black' font-size='12'%3EA+ BBB%3C/text%3E%3C/svg%3E" alt="BBB" />
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
              <h2 class="section-title">Follow Our Transformations</h2>
              <div class="instagram-grid">
                ${[1,2,3,4,5,6].map(i => `
                  <div class="instagram-post premium-card">
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
              <h2 class="section-title">Book Your Appointment</h2>
              <div class="booking-widget premium-card">
                <div class="service-selector">
                  <button class="service-btn active">Hair</button>
                  <button class="service-btn">Nails</button>
                  <button class="service-btn">Makeup</button>
                  <button class="service-btn">Spa</button>
                </div>
                <div class="stylist-selector">
                  <h4>Choose Your Stylist</h4>
                  <div class="stylist-grid">
                    <div class="stylist-card">
                      <img src="${images.team}" alt="Stylist" />
                      <p>Sarah</p>
                    </div>
                    <div class="stylist-card">
                      <img src="${images.team}" alt="Stylist" />
                      <p>Jessica</p>
                    </div>
                    <div class="stylist-card">
                      <img src="${images.team}" alt="Stylist" />
                      <p>Michelle</p>
                    </div>
                  </div>
                </div>
                <button class="btn-premium">Book Now</button>
              </div>
            </div>
          </section>
          
          <!-- Before/After Gallery -->
          <section class="before-after-section">
            <div class="container">
              <h2 class="section-title">Amazing Transformations</h2>
              <div class="before-after-slider">
                <div class="ba-slide premium-card">
                  <div class="ba-container">
                    <div class="ba-before">
                      <img src="${images.service}" alt="Before" />
                      <span class="ba-label">Before</span>
                    </div>
                    <div class="ba-after">
                      <img src="${images.service}" alt="After" />
                      <span class="ba-label">After</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>`;
          
      case 'auto':
        return `
          <!-- Service Estimator -->
          <section class="estimator-section">
            <div class="container">
              <h2 class="section-title">Service Cost Estimator</h2>
              <div class="estimator-widget premium-card">
                <select id="vehicle-make">
                  <option>Select Make</option>
                  <option>Toyota</option>
                  <option>Honda</option>
                  <option>Ford</option>
                  <option>BMW</option>
                  <option>Mercedes</option>
                </select>
                <select id="vehicle-model">
                  <option>Select Model</option>
                </select>
                <select id="service-needed">
                  <option>Select Service</option>
                  <option>Oil Change</option>
                  <option>Brake Service</option>
                  <option>Transmission</option>
                  <option>Engine Diagnostic</option>
                </select>
                <button class="btn-premium">Get Estimate</button>
              </div>
            </div>
          </section>
          
          <!-- Certifications -->
          <section class="certifications-section">
            <div class="container">
              <h2 class="section-title">Our Certifications</h2>
              <div class="cert-grid">
                <div class="cert-card premium-card">
                  <h3>ASE Certified</h3>
                  <p>Master Technicians</p>
                </div>
                <div class="cert-card premium-card">
                  <h3>AAA Approved</h3>
                  <p>Auto Repair Facility</p>
                </div>
                <div class="cert-card premium-card">
                  <h3>NAPA AutoCare</h3>
                  <p>Nationwide Warranty</p>
                </div>
              </div>
            </div>
          </section>`;
          
      case 'cleaning':
        return `
          <!-- Pricing Tables -->
          <section class="pricing-section">
            <div class="container">
              <h2 class="section-title">Transparent Pricing</h2>
              <div class="pricing-grid">
                <div class="pricing-card premium-card">
                  <h3>Basic Clean</h3>
                  <div class="price">$99</div>
                  <ul>
                    <li>✓ 2 Bedrooms</li>
                    <li>✓ 1 Bathroom</li>
                    <li>✓ Kitchen & Living</li>
                    <li>✓ Eco Products</li>
                  </ul>
                  <button class="btn-premium">Book Now</button>
                </div>
                <div class="pricing-card featured premium-card">
                  <div class="badge">Most Popular</div>
                  <h3>Deep Clean</h3>
                  <div class="price">$199</div>
                  <ul>
                    <li>✓ All Rooms</li>
                    <li>✓ All Bathrooms</li>
                    <li>✓ Inside Appliances</li>
                    <li>✓ Windows & Baseboards</li>
                  </ul>
                  <button class="btn-premium">Book Now</button>
                </div>
                <div class="pricing-card premium-card">
                  <h3>Move In/Out</h3>
                  <div class="price">$299</div>
                  <ul>
                    <li>✓ Complete Deep Clean</li>
                    <li>✓ Inside Cabinets</li>
                    <li>✓ Garage Cleaning</li>
                    <li>✓ Satisfaction Guarantee</li>
                  </ul>
                  <button class="btn-premium">Book Now</button>
                </div>
              </div>
            </div>
          </section>
          
          <!-- Booking Calendar -->
          <section class="calendar-section">
            <div class="container">
              <h2 class="section-title">Schedule Your Cleaning</h2>
              <div class="calendar-widget premium-card">
                <div class="calendar-header">
                  <button>&lt;</button>
                  <h3>January 2025</h3>
                  <button>&gt;</button>
                </div>
                <div class="calendar-grid">
                  ${Array(31).fill(0).map((_, i) => `
                    <div class="calendar-day ${Math.random() > 0.7 ? 'available' : 'booked'}">
                      ${i + 1}
                    </div>
                  `).join('')}
                </div>
                <button class="btn-premium">Confirm Date</button>
              </div>
            </div>
          </section>`;
          
      default:
        return '';
    }
  };
  
  // Generate testimonials HTML
  const testimonialsHTML = content.testimonials.map((t: any) => `
    <div class="testimonial-card premium-card">
      <div class="testimonial-header">
        <div class="customer-info">
          <div class="avatar">${t.name.charAt(0)}</div>
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
  const servicesHTML = content.services.map((service: string) => `
    <div class="service-item premium-card">
      <div class="service-icon">${service.substring(0, 2)}</div>
      <h4>${service.substring(2)}</h4>
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
  
  // Build the premium HTML template
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
      font-family: var(--heading-font);
      font-size: 2rem;
      font-weight: 900;
      background: var(--hero-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .logo-icon {
      width: 40px;
      height: 40px;
      background: var(--hero-gradient);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 1.5rem;
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
      border-radius: 50px;
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
    }

    .mobile-menu-toggle span {
      width: 25px;
      height: 3px;
      background: var(--text);
      transition: all 0.3s ease;
    }

    /* Hero Section with Parallax */
    .hero {
      min-height: 100vh;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      margin-top: 80px;
    }

    .hero-background {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: -2;
    }

    .hero-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      filter: brightness(0.7);
    }

    .hero-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: var(--hero-gradient);
      opacity: 0.8;
      z-index: -1;
    }

    .hero-content {
      max-width: 1200px;
      padding: 2rem;
      text-align: center;
      color: white;
      z-index: 1;
      animation: fadeInUp 1s ease;
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .hero h1 {
      font-family: var(--heading-font);
      font-size: clamp(3rem, 8vw, 6rem);
      font-weight: 900;
      margin-bottom: 1rem;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
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
      justify-content: center;
      flex-wrap: wrap;
      margin-top: 3rem;
    }

    .btn-premium {
      padding: 1.2rem 3rem;
      font-size: 1.1rem;
      font-weight: 600;
      border: none;
      border-radius: 50px;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 1px;
      background: white;
      color: var(--primary);
      transition: all 0.3s ease;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      text-decoration: none;
      display: inline-block;
    }

    .btn-premium:hover {
      transform: translateY(-3px);
      box-shadow: 0 15px 40px rgba(0,0,0,0.3);
    }

    .btn-secondary {
      padding: 1.2rem 3rem;
      font-size: 1.1rem;
      font-weight: 600;
      border: 2px solid white;
      border-radius: 50px;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 1px;
      background: transparent;
      color: white;
      transition: all 0.3s ease;
      text-decoration: none;
      display: inline-block;
    }

    .btn-secondary:hover {
      background: white;
      color: var(--primary);
    }

    /* Premium Cards */
    .premium-card {
      background: white;
      border-radius: 20px;
      padding: 2.5rem;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
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
      transform: translateY(-10px);
      box-shadow: 0 20px 60px rgba(0,0,0,0.15);
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

    /* About Section with Image */
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

    .about-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2rem;
      margin-top: 3rem;
    }

    .stat-card {
      text-align: center;
    }

    .stat-number {
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
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
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

    .stars {
      color: #FFD700;
      font-size: 1.2rem;
      margin-top: 0.25rem;
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

    .before-after-slider {
      max-width: 800px;
      margin: 0 auto;
    }

    .ba-container {
      position: relative;
      padding-top: 60%;
      overflow: hidden;
    }

    .ba-before,
    .ba-after {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }

    .ba-after {
      clip-path: polygon(50% 0, 100% 0, 100% 100%, 50% 100%);
    }

    .ba-label {
      position: absolute;
      bottom: 20px;
      padding: 0.5rem 1rem;
      background: rgba(0,0,0,0.7);
      color: white;
      border-radius: 5px;
      font-weight: bold;
    }

    .ba-before .ba-label {
      left: 20px;
    }

    .ba-after .ba-label {
      right: 20px;
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

    .badge img {
      width: 100px;
      height: 100px;
      margin-bottom: 1rem;
    }

    .cert-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 2rem;
      margin: 3rem 0;
    }

    .cert-card {
      text-align: center;
      padding: 2rem;
    }

    .cert-card h3 {
      color: var(--primary);
      margin-bottom: 1rem;
    }

    .pricing-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
      margin: 3rem 0;
    }

    .pricing-card {
      text-align: center;
      position: relative;
      padding: 3rem 2rem;
    }

    .pricing-card.featured {
      transform: scale(1.05);
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }

    .pricing-card .badge {
      position: absolute;
      top: -15px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--accent);
      color: white;
      padding: 0.5rem 1.5rem;
      border-radius: 20px;
      font-size: 0.9rem;
      font-weight: bold;
    }

    .pricing-card h3 {
      font-family: var(--heading-font);
      font-size: 1.8rem;
      margin-bottom: 1rem;
      color: var(--primary);
    }

    .pricing-card .price {
      font-size: 3rem;
      font-weight: bold;
      color: var(--accent);
      margin: 1rem 0;
    }

    .pricing-card ul {
      list-style: none;
      margin: 2rem 0;
    }

    .pricing-card li {
      padding: 0.5rem 0;
      color: var(--text);
    }

    .calendar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }

    .calendar-header button {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: var(--primary);
    }

    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 0.5rem;
      margin-bottom: 2rem;
    }

    .calendar-day {
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.3s ease;
      font-weight: 500;
    }

    .calendar-day.available {
      background: var(--light);
      color: var(--primary);
    }

    .calendar-day.available:hover {
      background: var(--accent);
      color: white;
    }

    .calendar-day.booked {
      background: #f0f0f0;
      color: #999;
      cursor: not-allowed;
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
        display: none;
      }

      .mobile-menu-toggle {
        display: flex;
      }

      .hero h1 {
        font-size: 2.5rem;
      }

      .about-content {
        grid-template-columns: 1fr;
      }

      .services-grid,
      .testimonials-container,
      .gallery-grid,
      .contact-grid {
        grid-template-columns: 1fr;
      }

      .pricing-card.featured {
        transform: scale(1);
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

      .calendar-grid {
        gap: 0.25rem;
      }

      .calendar-day {
        font-size: 0.9rem;
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

    /* Scroll Animations */
    .fade-in {
      opacity: 0;
      transform: translateY(30px);
      transition: all 0.8s ease;
    }

    .fade-in.visible {
      opacity: 1;
      transform: translateY(0);
    }

    /* Floating Elements */
    .floating {
      animation: float 6s ease-in-out infinite;
    }

    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-20px); }
    }
  </style>
</head>
<body>
  <!-- Loading Screen -->
  <div class="loading" id="loading">
    <div class="spinner"></div>
  </div>

  <!-- Premium Navigation -->
  <nav class="premium-nav" id="navbar">
    <div class="nav-container">
      <a href="#home" class="logo">
        <div class="logo-icon">${businessName.charAt(0)}</div>
        ${businessName}
      </a>
      <ul class="nav-menu">
        <li><a href="#about">About</a></li>
        <li><a href="#services">Services</a></li>
        <li><a href="#gallery">Gallery</a></li>
        <li><a href="#testimonials">Reviews</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
      <a href="tel:${phone}" class="nav-cta">Call Now</a>
      <div class="mobile-menu-toggle" id="mobile-toggle">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  </nav>

  <!-- Hero Section with Parallax -->
  <section id="home" class="hero">
    <div class="hero-background">
      <img src="${images.hero}" alt="${businessName}" class="hero-image" />
    </div>
    <div class="hero-overlay"></div>
    <div class="hero-content">
      <h1 class="floating">${businessName}</h1>
      <div class="tagline">${content.tagline}</div>
      <div class="hero-cta">
        <a href="tel:${phone}" class="btn-premium">Call Now</a>
        <a href="#contact" class="btn-secondary">Get Directions</a>
      </div>
    </div>
  </section>

  ${getCategorySpecificSections()}

  <!-- About Section with Image -->
  <section id="about" class="about-section">
    <div class="container">
      <h2 class="section-title fade-in">About Us</h2>
      <p class="section-subtitle fade-in">Discover Our Story</p>
      <div class="about-content fade-in">
        <div class="about-text">
          <p>${content.description}</p>
          <div class="about-stats">
            <div class="stat-card">
              <div class="stat-number">${Math.floor(Math.random() * 15) + 5}+</div>
              <div class="stat-label">Years Experience</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${Math.floor(Math.random() * 9000) + 1000}+</div>
              <div class="stat-label">Happy Customers</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">100%</div>
              <div class="stat-label">Satisfaction</div>
            </div>
          </div>
        </div>
        <div class="about-image">
          <img src="${images.service}" alt="About ${businessName}" />
        </div>
      </div>
    </div>
  </section>

  <!-- Services Section -->
  <section id="services" class="services-section">
    <div class="container">
      <h2 class="section-title fade-in">Our Services</h2>
      <p class="section-subtitle fade-in">Excellence in Every Detail</p>
      <div class="services-grid fade-in">
        ${servicesHTML}
      </div>
    </div>
  </section>

  <!-- Gallery Section -->
  <section id="gallery" class="gallery-section">
    <div class="container">
      <h2 class="section-title fade-in">Our Work</h2>
      <p class="section-subtitle fade-in">See What We Can Do</p>
      <div class="gallery-grid fade-in">
        <div class="gallery-item">
          <img src="${images.hero}" alt="Gallery 1" />
          <div class="gallery-overlay">
            <h4>Premium Quality</h4>
            <p>Excellence in every project</p>
          </div>
        </div>
        <div class="gallery-item">
          <img src="${images.service}" alt="Gallery 2" />
          <div class="gallery-overlay">
            <h4>Professional Service</h4>
            <p>Attention to detail</p>
          </div>
        </div>
        <div class="gallery-item">
          <img src="${images.team}" alt="Gallery 3" />
          <div class="gallery-overlay">
            <h4>Expert Team</h4>
            <p>Skilled professionals</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Testimonials Section -->
  <section id="testimonials" class="testimonials-section">
    <div class="container">
      <h2 class="section-title fade-in">What Our Customers Say</h2>
      <p class="section-subtitle fade-in">Real Reviews from Real People</p>
      <div class="testimonials-container fade-in">
        ${testimonialsHTML}
      </div>
    </div>
  </section>

  <!-- Contact Section -->
  <section id="contact" class="contact-section">
    <div class="container">
      <h2 class="section-title">Get In Touch</h2>
      <p class="section-subtitle">We're Here to Help</p>
      <div class="contact-grid">
        <div class="contact-card premium-card">
          <h3>📍 Visit Us</h3>
          <p>${address}</p>
          <p>${city}, ${state} ${zip}</p>
          <a href="https://maps.google.com/?q=${encodeURI(address + ' ' + city + ' ' + state)}" target="_blank">Get Directions</a>
        </div>
        <div class="contact-card premium-card">
          <h3>📞 Contact</h3>
          <p><a href="tel:${phone}">${phone}</a></p>
          ${email ? `<p><a href="mailto:${email}">${email}</a></p>` : ''}
          <div class="social-links">
            <a href="#" aria-label="Facebook">f</a>
            <a href="#" aria-label="Instagram">i</a>
            <a href="#" aria-label="Twitter">t</a>
          </div>
        </div>
        <div class="contact-card premium-card">
          <h3>🕒 Business Hours</h3>
          <div class="hours-container">
            ${hoursHTML}
          </div>
        </div>
      </div>
      
      <!-- Google Maps -->
      <div class="map-container fade-in">
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
            ${content.services.slice(0, 5).map(s => `<li><a href="#services">${s.substring(2)}</a></li>`).join('')}
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

    // Scroll animations
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, observerOptions);

    document.querySelectorAll('.fade-in').forEach(el => {
      observer.observe(el);
    });

    // Mobile menu toggle
    document.getElementById('mobile-toggle').addEventListener('click', function() {
      this.classList.toggle('active');
      document.querySelector('.nav-menu').classList.toggle('active');
    });

    // Parallax effect for hero image
    window.addEventListener('scroll', () => {
      const scrolled = window.pageYOffset;
      const heroImage = document.querySelector('.hero-image');
      if (heroImage) {
        heroImage.style.transform = \`translateY(\${scrolled * 0.5}px)\`;
      }
    });

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

    ${content.businessType === 'cleaning' ? `
      // Calendar day selection
      document.querySelectorAll('.calendar-day.available').forEach(day => {
        day.addEventListener('click', function() {
          document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'));
          this.classList.add('selected');
          this.style.background = 'var(--accent)';
          this.style.color = 'white';
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
      const elements = document.querySelectorAll('.hero-content > *');
      elements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        setTimeout(() => {
          el.style.transition = 'all 0.8s ease';
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
        }, index * 200);
      });
    });
  </script>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Premium website preview generator endpoint',
    method: 'POST',
    features: [
      'AI-powered content generation with Together AI',
      'AI-generated images with Replicate',
      'Category-specific themes and layouts',
      'Premium $2000-quality designs',
      'Distinct templates for each business type'
    ],
    body: {
      businessId: 'string (optional) - The ID of a specific business to generate preview for. If omitted, generates for all businesses without previews.'
    },
    response: {
      success: 'boolean - Whether the operation was successful',
      generated: 'number - Number of previews successfully generated',
      failed: 'number - Number of previews that failed to generate',
      total: 'number - Total number of businesses processed'
    }
  });
}
