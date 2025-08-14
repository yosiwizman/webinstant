import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateBusinessContent, detectBusinessType } from '@/lib/contentGenerator';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function generateUniqueSlug(baseName: string): Promise<string> {
  let slug = generateSlug(baseName);
  let counter = 1;
  
  // Check if slug exists
  while (true) {
    const { data: existing } = await supabase
      .from('website_previews')
      .select('slug')
      .eq('slug', slug)
      .single();
    
    if (!existing) {
      return slug;
    }
    
    // Add counter to make it unique
    slug = `${generateSlug(baseName)}-${counter}`;
    counter++;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body - it might be empty
    let businessId: string | undefined;
    try {
      const body = await request.json();
      businessId = body.businessId;
    } catch {
      // No body provided, will generate for all
      businessId = undefined;
    }

    let businessesToProcess = [];
    
    if (businessId) {
      // Generate preview for specific business
      console.log('Generating preview for business:', businessId);
      
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
      // Generate previews for all businesses without previews
      console.log('Finding businesses without previews');
      
      // Get all businesses
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

      // Get existing previews to filter out businesses that already have them
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

      // Filter out businesses that already have previews
      const existingBusinessIds = new Set(existingPreviews?.map(p => p.business_id) || []);
      businessesToProcess = (allBusinesses || []).filter(b => !existingBusinessIds.has(b.id));

      console.log(`Found ${businessesToProcess.length} businesses without previews`);
    }

    // Generate previews for each business
    let generatedCount = 0;
    let failedCount = 0;

    for (const business of businessesToProcess) {
      try {
        // Generate content based on business type
        const content = generateBusinessContent(business);
        
        // Generate unique slug
        const slug = await generateUniqueSlug(business.business_name);
        const previewUrl = `/preview/${slug}`;
        
        // Detect business type if not set
        const businessType = business.industry_type || detectBusinessType(business.business_name);
        
        // Generate HTML using the themed template
        const htmlContent = generateThemedHTML(business, content);
        
        // Check if preview already exists for this business
        const { data: existingPreview } = await supabase
          .from('website_previews')
          .select('id')
          .eq('business_id', business.id)
          .single();
        
        if (existingPreview) {
          // Update existing preview
          const { error: updateError } = await supabase
            .from('website_previews')
            .update({
              html_content: htmlContent,
              preview_url: previewUrl,
              template_used: `themed-${content.businessType}`,
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
          // Insert new preview
          const { error: insertError } = await supabase
            .from('website_previews')
            .insert({
              business_id: business.id,
              html_content: htmlContent,
              preview_url: previewUrl,
              template_used: `themed-${content.businessType}`,
              slug: slug
            });

          if (insertError) {
            console.error(`Error creating preview for business ${business.id}:`, insertError);
            failedCount++;
            continue;
          }
        }
        
        // Update the businesses table with preview URL and industry type
        const updateData: any = {
          website_url: previewUrl,
          updated_at: new Date().toISOString()
        };
        
        // Only update industry_type if it's not already set
        if (!business.industry_type) {
          updateData.industry_type = businessType;
        }
        
        const { error: businessUpdateError } = await supabase
          .from('businesses')
          .update(updateData)
          .eq('id', business.id);
        
        if (businessUpdateError) {
          console.error(`Error updating business ${business.id}:`, businessUpdateError);
          // Don't count as failed since preview was created
        }

        generatedCount++;
        console.log(`Preview generated for ${business.business_name} (${business.id})`);
        console.log(`  - Slug: ${slug}`);
        console.log(`  - URL: ${previewUrl}`);
        console.log(`  - Theme: ${content.businessType}`);
        
      } catch (error) {
        console.error(`Error processing business ${business.id}:`, error);
        failedCount++;
      }
    }

    // Return success response
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

function generateThemedHTML(business: any, content: any): string {
  // Safely get values with fallbacks
  const businessName = business.business_name || 'Business';
  const address = business.address || '';
  const city = business.city || '';
  const state = business.state || '';
  const phone = business.phone || '';
  const email = business.email || '';
  const zip = business.zip_code || '';
  
  // Get theme colors from content
  const theme = content.theme;
  
  // Generate star rating HTML
  const generateStars = (rating: number) => {
    return Array(5).fill(0).map((_, i) => 
      i < rating ? '⭐' : '☆'
    ).join('');
  };
  
  // Generate testimonials HTML
  const testimonialsHTML = content.testimonials.map((t: any) => `
    <div class="testimonial-card glass-card">
      <div class="testimonial-header">
        <h4>${t.name}</h4>
        <div class="stars">${generateStars(t.rating)}</div>
      </div>
      <p>"${t.text}"</p>
    </div>
  `).join('');
  
  // Generate services HTML
  const servicesHTML = content.services.map((service: string) => `
    <div class="service-item glass-card">
      <h4>${service}</h4>
    </div>
  `).join('');
  
  // Generate hours HTML
  const hoursHTML = Object.entries(content.hours).map(([day, hours]) => `
    <div class="hours-row">
      <span class="day">${day}</span>
      <span class="time">${hours}</span>
    </div>
  `).join('');
  
  // Generate Google Maps URL
  const mapsQuery = encodeURIComponent(`${address}, ${city}, ${state} ${zip}`);
  const mapsEmbedUrl = `https://maps.google.com/maps?q=${mapsQuery}&output=embed`;
  
  // Build the themed HTML template
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${businessName} - ${content.tagline}</title>
  <meta name="description" content="${content.description.substring(0, 160)}">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :root {
      --primary-gradient: ${theme.primary};
      --accent-color: ${theme.accent};
      --background-gradient: ${theme.background};
      --text-color: ${theme.text};
      --glass-bg: ${theme.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.9)'};
      --glass-border: ${theme.isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.5)'};
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${theme.isDark ? '#0a0a0a' : '#f8f9fa'};
      color: ${theme.isDark ? '#fff' : '#2d3436'};
      overflow-x: hidden;
      position: relative;
    }

    /* Animated Background */
    .animated-bg {
      position: fixed;
      width: 200%;
      height: 200%;
      top: -50%;
      left: -50%;
      z-index: -1;
      background: var(--background-gradient);
      background-size: 400% 400%;
      animation: gradientShift 15s ease infinite;
      opacity: ${theme.isDark ? '1' : '0.3'};
    }

    @keyframes gradientShift {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    /* Navigation */
    nav {
      position: fixed;
      width: 100%;
      top: 0;
      z-index: 1000;
      background: var(--glass-bg);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--glass-border);
      padding: 1rem 0;
    }

    .nav-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .logo {
      font-size: 1.8rem;
      font-weight: bold;
      background: var(--primary-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
    }

    .nav-links {
      display: flex;
      gap: 2rem;
      list-style: none;
    }

    .nav-links a {
      color: var(--text-color);
      text-decoration: none;
      transition: color 0.3s ease;
      font-weight: 500;
    }

    .nav-links a:hover {
      color: var(--accent-color);
    }

    /* Hero Section */
    .hero {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 2rem;
      position: relative;
      margin-top: 80px;
      background: var(--primary-gradient);
      color: white;
    }

    .hero-content {
      max-width: 900px;
      z-index: 10;
    }

    .hero h1 {
      font-size: clamp(3rem, 8vw, 5rem);
      margin-bottom: 1rem;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }

    .tagline {
      font-size: 1.5rem;
      margin: 2rem 0;
      opacity: 0.95;
    }

    .cta-buttons {
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
      margin-top: 3rem;
    }

    .btn-primary {
      padding: 1.2rem 3rem;
      font-size: 1.1rem;
      font-weight: 600;
      border: none;
      border-radius: 50px;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 1px;
      background: white;
      color: var(--accent-color);
      transition: all 0.3s ease;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      text-decoration: none;
      display: inline-block;
    }

    .btn-primary:hover {
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
      color: var(--accent-color);
    }

    /* Glass Cards */
    .glass-card {
      background: var(--glass-bg);
      backdrop-filter: blur(10px);
      border: 1px solid var(--glass-border);
      border-radius: 20px;
      padding: 2rem;
      box-shadow: 0 8px 32px rgba(31, 38, 135, 0.1);
      transition: all 0.3s ease;
    }

    .glass-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 12px 40px rgba(31, 38, 135, 0.2);
    }

    /* Sections */
    .section {
      max-width: 1200px;
      margin: 0 auto;
      padding: 5rem 2rem;
      position: relative;
    }

    .section-title {
      font-size: 3rem;
      text-align: center;
      margin-bottom: 3rem;
      background: var(--primary-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
    }

    /* About Section */
    .about-content {
      font-size: 1.2rem;
      line-height: 1.8;
      text-align: center;
      max-width: 800px;
      margin: 0 auto;
      color: var(--text-color);
    }

    /* Services Grid */
    .services-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
      margin: 3rem 0;
    }

    .service-item {
      text-align: center;
      padding: 2.5rem 2rem;
    }

    .service-item h4 {
      font-size: 1.3rem;
      margin-bottom: 1rem;
      color: var(--accent-color);
    }

    /* Testimonials */
    .testimonials-container {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 2rem;
      margin: 3rem 0;
    }

    .testimonial-card {
      padding: 2rem;
    }

    .testimonial-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .testimonial-header h4 {
      color: var(--accent-color);
      font-size: 1.2rem;
    }

    .stars {
      color: #ffd700;
      font-size: 1.2rem;
    }

    .testimonial-card p {
      font-style: italic;
      line-height: 1.6;
      color: var(--text-color);
      opacity: 0.9;
    }

    /* Contact Section */
    .contact-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
      margin: 3rem 0;
    }

    .contact-card h3 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
      color: var(--accent-color);
    }

    .contact-card p {
      line-height: 1.6;
      margin: 0.5rem 0;
    }

    .contact-card a {
      color: var(--accent-color);
      text-decoration: none;
      font-weight: 500;
    }

    .contact-card a:hover {
      text-decoration: underline;
    }

    /* Hours Table */
    .hours-container {
      max-width: 400px;
      margin: 0 auto;
    }

    .hours-row {
      display: flex;
      justify-content: space-between;
      padding: 0.75rem 0;
      border-bottom: 1px solid var(--glass-border);
    }

    .hours-row:last-child {
      border-bottom: none;
    }

    .day {
      font-weight: 600;
      color: var(--accent-color);
    }

    .time {
      color: var(--text-color);
      opacity: 0.9;
    }

    /* Map Section */
    .map-container {
      width: 100%;
      height: 400px;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
      margin: 3rem 0;
    }

    .map-container iframe {
      width: 100%;
      height: 100%;
      border: none;
    }

    /* Social Proof */
    .social-proof {
      display: flex;
      justify-content: center;
      gap: 3rem;
      margin: 3rem 0;
      flex-wrap: wrap;
    }

    .proof-item {
      text-align: center;
    }

    .proof-number {
      font-size: 2.5rem;
      font-weight: bold;
      background: var(--primary-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .proof-label {
      font-size: 1rem;
      color: var(--text-color);
      opacity: 0.8;
      margin-top: 0.5rem;
    }

    /* FAQ Section */
    .faq-container {
      max-width: 800px;
      margin: 0 auto;
    }

    .faq-item {
      margin-bottom: 1.5rem;
    }

    .faq-question {
      font-size: 1.2rem;
      font-weight: 600;
      color: var(--accent-color);
      margin-bottom: 0.5rem;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      background: var(--glass-bg);
      border-radius: 10px;
      transition: all 0.3s ease;
    }

    .faq-question:hover {
      background: var(--glass-border);
    }

    .faq-answer {
      padding: 0 1rem;
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s ease;
      color: var(--text-color);
      line-height: 1.6;
    }

    .faq-answer.active {
      max-height: 200px;
      padding: 1rem;
    }

    /* Footer */
    footer {
      background: var(--primary-gradient);
      color: white;
      padding: 3rem 2rem;
      text-align: center;
    }

    .footer-content {
      max-width: 1200px;
      margin: 0 auto;
    }

    .footer-links {
      display: flex;
      justify-content: center;
      gap: 2rem;
      margin: 2rem 0;
      flex-wrap: wrap;
    }

    .footer-links a {
      color: white;
      text-decoration: none;
      opacity: 0.9;
      transition: opacity 0.3s ease;
    }

    .footer-links a:hover {
      opacity: 1;
      text-decoration: underline;
    }

    /* Mobile Responsive */
    @media (max-width: 768px) {
      .nav-links {
        display: none;
      }

      .hero h1 {
        font-size: 2.5rem;
      }

      .tagline {
        font-size: 1.2rem;
      }

      .section-title {
        font-size: 2rem;
      }

      .cta-buttons {
        flex-direction: column;
        align-items: center;
      }

      .btn-primary, .btn-secondary {
        width: 100%;
        max-width: 300px;
      }

      .services-grid {
        grid-template-columns: 1fr;
      }

      .testimonials-container {
        grid-template-columns: 1fr;
      }

      .contact-grid {
        grid-template-columns: 1fr;
      }

      .social-proof {
        flex-direction: column;
        gap: 2rem;
      }

      .map-container {
        height: 300px;
      }
    }
  </style>
</head>
<body>
  <div class="animated-bg"></div>

  <!-- Navigation -->
  <nav>
    <div class="nav-container">
      <div class="logo">${businessName}</div>
      <ul class="nav-links">
        <li><a href="#home">Home</a></li>
        <li><a href="#about">About</a></li>
        <li><a href="#services">Services</a></li>
        <li><a href="#testimonials">Reviews</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
    </div>
  </nav>

  <!-- Hero Section -->
  <section id="home" class="hero">
    <div class="hero-content">
      <h1>${businessName}</h1>
      <div class="tagline">${content.tagline}</div>
      <div class="cta-buttons">
        <a href="tel:${phone}" class="btn-primary">Call Now</a>
        <a href="#contact" class="btn-secondary">Get Directions</a>
      </div>
    </div>
  </section>

  <!-- About Section -->
  <section id="about" class="section">
    <h2 class="section-title">About Us</h2>
    <div class="about-content">
      <p>${content.description}</p>
    </div>
    <div class="social-proof">
      <div class="proof-item">
        <div class="proof-number">${Math.floor(Math.random() * 10) + 5}+</div>
        <div class="proof-label">Years in Business</div>
      </div>
      <div class="proof-item">
        <div class="proof-number">${Math.floor(Math.random() * 900) + 100}+</div>
        <div class="proof-label">Happy Customers</div>
      </div>
      <div class="proof-item">
        <div class="proof-number">100%</div>
        <div class="proof-label">Satisfaction Rate</div>
      </div>
    </div>
  </section>

  <!-- Services Section -->
  <section id="services" class="section">
    <h2 class="section-title">Our Services</h2>
    <div class="services-grid">
      ${servicesHTML}
    </div>
  </section>

  <!-- Testimonials Section -->
  <section id="testimonials" class="section">
    <h2 class="section-title">What Our Customers Say</h2>
    <div class="testimonials-container">
      ${testimonialsHTML}
    </div>
  </section>

  <!-- Contact Section -->
  <section id="contact" class="section">
    <h2 class="section-title">Get In Touch</h2>
    <div class="contact-grid">
      <div class="glass-card contact-card">
        <h3>📍 Visit Us</h3>
        <p>${address}</p>
        <p>${city}, ${state} ${zip}</p>
      </div>
      <div class="glass-card contact-card">
        <h3>📞 Contact</h3>
        <p><a href="tel:${phone}">${phone}</a></p>
        ${email ? `<p><a href="mailto:${email}">${email}</a></p>` : ''}
      </div>
      <div class="glass-card contact-card">
        <h3>🕒 Business Hours</h3>
        <div class="hours-container">
          ${hoursHTML}
        </div>
      </div>
    </div>
    
    <!-- Google Maps -->
    <div class="map-container">
      <iframe 
        src="${mapsEmbedUrl}"
        allowfullscreen=""
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade">
      </iframe>
    </div>
  </section>

  <!-- FAQ Section -->
  <section id="faq" class="section">
    <h2 class="section-title">Frequently Asked Questions</h2>
    <div class="faq-container">
      <div class="faq-item">
        <div class="faq-question">
          Do you offer free estimates?
          <span>+</span>
        </div>
        <div class="faq-answer">
          Yes! We provide free, no-obligation estimates for all our services. Contact us today to schedule yours.
        </div>
      </div>
      <div class="faq-item">
        <div class="faq-question">
          Are you licensed and insured?
          <span>+</span>
        </div>
        <div class="faq-answer">
          Absolutely! We are fully licensed, bonded, and insured for your peace of mind and protection.
        </div>
      </div>
      <div class="faq-item">
        <div class="faq-question">
          What areas do you serve?
          <span>+</span>
        </div>
        <div class="faq-answer">
          We proudly serve ${city} and surrounding areas within a 25-mile radius. Contact us to confirm service to your location.
        </div>
      </div>
      <div class="faq-item">
        <div class="faq-question">
          Do you offer emergency services?
          <span>+</span>
        </div>
        <div class="faq-answer">
          ${content.businessType === 'plumbing' || content.businessType === 'electrical' ? 'Yes, we offer 24/7 emergency services. Call us anytime for urgent needs.' : 'We offer priority scheduling for urgent needs. Contact us for immediate assistance.'}
        </div>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer>
    <div class="footer-content">
      <h3>${businessName}</h3>
      <div class="footer-links">
        <a href="#about">About Us</a>
        <a href="#services">Services</a>
        <a href="#contact">Contact</a>
        <a href="tel:${phone}">Call: ${phone}</a>
      </div>
      <p style="margin-top: 2rem; opacity: 0.8;">
        &copy; 2025 ${businessName}. All rights reserved. | Powered by WebInstant
      </p>
    </div>
  </footer>

  <script>
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

    // FAQ Toggle
    document.querySelectorAll('.faq-question').forEach(question => {
      question.addEventListener('click', function() {
        const answer = this.nextElementSibling;
        const icon = this.querySelector('span');
        
        answer.classList.toggle('active');
        icon.textContent = answer.classList.contains('active') ? '−' : '+';
        
        // Close other FAQs
        document.querySelectorAll('.faq-answer').forEach(otherAnswer => {
          if (otherAnswer !== answer && otherAnswer.classList.contains('active')) {
            otherAnswer.classList.remove('active');
            otherAnswer.previousElementSibling.querySelector('span').textContent = '+';
          }
        });
      });
    });

    // Add scroll animations
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '0';
          entry.target.style.transform = 'translateY(30px)';
          setTimeout(() => {
            entry.target.style.transition = 'all 0.6s ease';
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
          }, 100);
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    // Observe all sections
    document.querySelectorAll('.section').forEach(section => {
      observer.observe(section);
    });
  </script>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Website preview generator endpoint',
    method: 'POST',
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
