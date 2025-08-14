import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

    for (const business of businessesToProcess) {
      try {
        // Generate HTML using the simple template
        const htmlContent = generateHTML(business);
        
        // Insert preview into database
        const { data: insertedPreview, error: insertError } = await supabase
          .from('website_previews')
          .insert({
            business_id: business.id,
            html_content: htmlContent,
            preview_url: `/preview/${business.id}`,
            template_used: 'professional'
          })
          .select()
          .single();

        if (insertError) {
          // Check if it's a duplicate key error
          if (insertError.code === '23505') {
            // Update existing preview instead
            const { error: updateError } = await supabase
              .from('website_previews')
              .update({
                html_content: htmlContent,
                preview_url: `/preview/${business.id}`,
                template_used: 'professional'
              })
              .eq('business_id', business.id);

            if (updateError) {
              console.error(`Error updating preview for business ${business.id}:`, updateError);
              continue;
            }
          } else {
            console.error(`Error creating preview for business ${business.id}:`, insertError);
            continue;
          }
        }

        generatedCount++;
        console.log(`Preview generated for ${business.business_name} (${business.id})`);
        
      } catch (error) {
        console.error(`Error processing business ${business.id}:`, error);
      }
    }

    // Return success response
    return NextResponse.json({
      success: true,
      count: generatedCount
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

function generateHTML(business: any): string {
  // Safely get values with fallbacks
  const businessName = business.business_name || 'Business';
  const address = business.address || '';
  const city = business.city || '';
  const state = business.state || '';
  const phone = business.phone || '';
  const email = business.email || '';
  const zip = business.zip_code || '';

  // Generate a tagline based on business type (inferred from name)
  const tagline = generateTagline(businessName);
  
  // Generate business hours
  const hours = generateBusinessHours();

  // Build the HTML template with modern, professional design
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${businessName} - ${tagline}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      overflow-x: hidden;
    }

    /* Navigation */
    nav {
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      position: fixed;
      width: 100%;
      top: 0;
      z-index: 1000;
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
      font-size: 1.5rem;
      font-weight: bold;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .nav-links {
      display: flex;
      gap: 2rem;
      list-style: none;
    }

    .nav-links a {
      text-decoration: none;
      color: #555;
      font-weight: 500;
      transition: color 0.3s ease;
    }

    .nav-links a:hover {
      color: #667eea;
    }

    /* Hero Section */
    .hero {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      color: white;
      padding: 2rem;
      margin-top: 60px;
      position: relative;
      overflow: hidden;
    }

    .hero::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: url('data:image/svg+xml,<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M 100 0 L 0 0 0 100" fill="none" stroke="white" stroke-width="0.5" opacity="0.1"/></pattern></defs><rect width="100%" height="100%" fill="url(%23grid)"/></svg>');
      opacity: 0.3;
    }

    .hero-content {
      max-width: 800px;
      position: relative;
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
      font-size: 3.5rem;
      margin-bottom: 1rem;
      font-weight: 700;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }

    .tagline {
      font-size: 1.5rem;
      margin-bottom: 2rem;
      opacity: 0.95;
      font-weight: 300;
    }

    .cta-buttons {
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
    }

    .btn {
      padding: 1rem 2.5rem;
      font-size: 1.1rem;
      border: none;
      border-radius: 50px;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
      transition: all 0.3s ease;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .btn-primary {
      background: white;
      color: #667eea;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    }

    .btn-secondary {
      background: transparent;
      color: white;
      border: 2px solid white;
    }

    .btn-secondary:hover {
      background: white;
      color: #667eea;
      transform: translateY(-2px);
    }

    /* About Section */
    .section {
      padding: 5rem 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    .section-title {
      font-size: 2.5rem;
      text-align: center;
      margin-bottom: 3rem;
      color: #333;
      position: relative;
    }

    .section-title::after {
      content: '';
      display: block;
      width: 60px;
      height: 4px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      margin: 1rem auto;
      border-radius: 2px;
    }

    .about-content {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 3rem;
      margin-top: 3rem;
    }

    .feature-card {
      text-align: center;
      padding: 2rem;
      border-radius: 10px;
      background: white;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .feature-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
    }

    .feature-icon {
      width: 60px;
      height: 60px;
      margin: 0 auto 1rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      color: white;
    }

    .feature-card h3 {
      font-size: 1.3rem;
      margin-bottom: 1rem;
      color: #333;
    }

    .feature-card p {
      color: #666;
      line-height: 1.8;
    }

    /* Contact Section */
    .contact {
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    }

    .contact-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 2rem;
      margin-top: 3rem;
    }

    .contact-card {
      background: white;
      padding: 2rem;
      border-radius: 10px;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
      text-align: center;
    }

    .contact-card h3 {
      color: #667eea;
      margin-bottom: 1rem;
      font-size: 1.2rem;
    }

    .contact-card p {
      color: #666;
      margin-bottom: 0.5rem;
    }

    .contact-card a {
      color: #667eea;
      text-decoration: none;
      font-weight: 500;
      transition: color 0.3s ease;
    }

    .contact-card a:hover {
      color: #764ba2;
      text-decoration: underline;
    }

    /* Hours Section */
    .hours-table {
      max-width: 500px;
      margin: 2rem auto;
      background: white;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
    }

    .hours-table table {
      width: 100%;
      border-collapse: collapse;
    }

    .hours-table th,
    .hours-table td {
      padding: 1rem;
      text-align: left;
      border-bottom: 1px solid #eee;
    }

    .hours-table th {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-weight: 600;
    }

    .hours-table tr:last-child td {
      border-bottom: none;
    }

    .hours-table tr:hover {
      background: #f8f9fa;
    }

    /* Trust Badges */
    .trust-badges {
      display: flex;
      justify-content: center;
      gap: 3rem;
      margin-top: 3rem;
      flex-wrap: wrap;
    }

    .badge {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
    }

    .badge-icon {
      width: 50px;
      height: 50px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 1.5rem;
    }

    .badge-text {
      font-size: 0.9rem;
      color: #666;
      font-weight: 500;
    }

    /* Footer */
    footer {
      background: #2d3748;
      color: white;
      text-align: center;
      padding: 3rem 2rem;
    }

    .footer-content {
      max-width: 1200px;
      margin: 0 auto;
    }

    .social-links {
      display: flex;
      justify-content: center;
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .social-links a {
      width: 40px;
      height: 40px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      text-decoration: none;
      transition: all 0.3s ease;
    }

    .social-links a:hover {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      transform: translateY(-3px);
    }

    .footer-text {
      color: #a0aec0;
      margin-bottom: 0.5rem;
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .hero h1 {
        font-size: 2.5rem;
      }

      .tagline {
        font-size: 1.2rem;
      }

      .nav-links {
        display: none;
      }

      .section {
        padding: 3rem 1rem;
      }

      .section-title {
        font-size: 2rem;
      }

      .cta-buttons {
        flex-direction: column;
        align-items: center;
      }

      .btn {
        width: 100%;
        max-width: 300px;
      }
    }

    /* Animations */
    .fade-in {
      animation: fadeIn 1s ease;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .slide-in {
      animation: slideIn 1s ease;
    }

    @keyframes slideIn {
      from {
        transform: translateX(-50px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  </style>
</head>
<body>
  <!-- Navigation -->
  <nav>
    <div class="nav-container">
      <div class="logo">${businessName}</div>
      <ul class="nav-links">
        <li><a href="#home">Home</a></li>
        <li><a href="#about">About</a></li>
        <li><a href="#services">Services</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
    </div>
  </nav>

  <!-- Hero Section -->
  <section id="home" class="hero">
    <div class="hero-content">
      <h1>${businessName}</h1>
      <p class="tagline">${tagline}</p>
      <div class="cta-buttons">
        <a href="tel:${phone}" class="btn btn-primary">Call Now</a>
        <a href="#contact" class="btn btn-secondary">Get Directions</a>
      </div>
    </div>
  </section>

  <!-- About Section -->
  <section id="about" class="section">
    <h2 class="section-title">Why Choose Us</h2>
    <div class="about-content">
      <div class="feature-card">
        <div class="feature-icon">⭐</div>
        <h3>Excellence</h3>
        <p>We're committed to delivering exceptional quality and service that exceeds your expectations every time.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">🏆</div>
        <h3>Experience</h3>
        <p>Years of expertise in our field means you can trust us to handle your needs with professionalism and care.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">💝</div>
        <h3>Customer First</h3>
        <p>Your satisfaction is our top priority. We go above and beyond to ensure you have a great experience.</p>
      </div>
    </div>
  </section>

  <!-- Services Section -->
  <section id="services" class="section">
    <h2 class="section-title">Our Services</h2>
    <div class="about-content">
      <div class="feature-card">
        <div class="feature-icon">✨</div>
        <h3>Premium Quality</h3>
        <p>We use only the finest materials and latest techniques to deliver outstanding results.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">⚡</div>
        <h3>Fast Service</h3>
        <p>Quick turnaround times without compromising on quality. We value your time.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">💰</div>
        <h3>Fair Pricing</h3>
        <p>Competitive rates with transparent pricing. No hidden fees or surprises.</p>
      </div>
    </div>
    
    <!-- Trust Badges -->
    <div class="trust-badges">
      <div class="badge">
        <div class="badge-icon">✓</div>
        <span class="badge-text">Licensed & Insured</span>
      </div>
      <div class="badge">
        <div class="badge-icon">🛡️</div>
        <span class="badge-text">100% Guarantee</span>
      </div>
      <div class="badge">
        <div class="badge-icon">👥</div>
        <span class="badge-text">Locally Owned</span>
      </div>
    </div>
  </section>

  <!-- Contact Section -->
  <section id="contact" class="section contact">
    <h2 class="section-title">Get In Touch</h2>
    <div class="contact-grid">
      <div class="contact-card">
        <h3>📍 Location</h3>
        <p>${address}</p>
        <p>${city}, ${state} ${zip}</p>
      </div>
      <div class="contact-card">
        <h3>📞 Phone</h3>
        <p><a href="tel:${phone}">${phone}</a></p>
        <p>Call us anytime!</p>
      </div>
      <div class="contact-card">
        <h3>✉️ Email</h3>
        <p><a href="mailto:${email}">${email}</a></p>
        <p>We'll respond quickly</p>
      </div>
    </div>
    
    <!-- Business Hours -->
    <div class="hours-table">
      <table>
        <thead>
          <tr>
            <th colspan="2">Business Hours</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(hours).map(([day, time]) => `
          <tr>
            <td>${day}</td>
            <td>${time}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </section>

  <!-- Footer -->
  <footer>
    <div class="footer-content">
      <div class="social-links">
        <a href="#" aria-label="Facebook">f</a>
        <a href="#" aria-label="Twitter">𝕏</a>
        <a href="#" aria-label="Instagram">📷</a>
        <a href="#" aria-label="LinkedIn">in</a>
      </div>
      <p class="footer-text">© 2024 ${businessName}. All rights reserved.</p>
      <p class="footer-text">${address}, ${city}, ${state} ${zip}</p>
    </div>
  </footer>
</body>
</html>`;
}

function generateTagline(businessName: string): string {
  const name = businessName.toLowerCase();
  
  // Restaurant/Food related
  if (/restaurant|pizza|burger|cafe|coffee|bakery|deli|grill|kitchen|food|eat|dining|bistro/.test(name)) {
    const taglines = [
      'Delicious Food, Memorable Moments',
      'Where Great Food Meets Great People',
      'Taste the Difference',
      'Fresh Ingredients, Amazing Flavors',
      'Your Neighborhood Favorite'
    ];
    return taglines[Math.floor(Math.random() * taglines.length)];
  }
  
  // Auto/Mechanic related
  if (/auto|car|mechanic|repair|tire|oil|brake|transmission|automotive/.test(name)) {
    const taglines = [
      'Your Trusted Auto Care Experts',
      'Keeping You Safe on the Road',
      'Quality Service You Can Trust',
      'Expert Care for Your Vehicle',
      'Drive with Confidence'
    ];
    return taglines[Math.floor(Math.random() * taglines.length)];
  }
  
  // Salon/Beauty related
  if (/salon|beauty|hair|nail|spa|barber|styling|cuts/.test(name)) {
    const taglines = [
      'Where Beauty Meets Excellence',
      'Your Style, Perfected',
      'Look Good, Feel Amazing',
      'Transforming Beauty Daily',
      'Experience the Difference'
    ];
    return taglines[Math.floor(Math.random() * taglines.length)];
  }
  
  // Construction/Home Services
  if (/construction|plumb|electric|hvac|roof|contractor|build|remodel/.test(name)) {
    const taglines = [
      'Building Dreams, Delivering Quality',
      'Your Trusted Home Experts',
      'Quality Work, Every Time',
      'Professional Service You Can Trust',
      'Excellence in Every Project'
    ];
    return taglines[Math.floor(Math.random() * taglines.length)];
  }
  
  // Medical/Health
  if (/clinic|medical|doctor|dental|health|care|wellness|therapy/.test(name)) {
    const taglines = [
      'Caring for Your Health and Wellness',
      'Your Health is Our Priority',
      'Compassionate Care, Expert Treatment',
      'Where Health Comes First',
      'Dedicated to Your Well-being'
    ];
    return taglines[Math.floor(Math.random() * taglines.length)];
  }
  
  // Retail/Shopping
  if (/store|shop|mart|market|boutique|retail/.test(name)) {
    const taglines = [
      'Quality Products, Great Prices',
      'Your One-Stop Shop',
      'Where Shopping is a Pleasure',
      'Discover Something Special',
      'Everything You Need, All in One Place'
    ];
    return taglines[Math.floor(Math.random() * taglines.length)];
  }
  
  // Default professional taglines
  const defaultTaglines = [
    'Excellence in Every Detail',
    'Your Trusted Local Business',
    'Quality Service, Guaranteed',
    'Where Quality Meets Service',
    'Committed to Your Satisfaction'
  ];
  return defaultTaglines[Math.floor(Math.random() * defaultTaglines.length)];
}

function generateBusinessHours(): { [key: string]: string } {
  return {
    'Monday': '9:00 AM - 6:00 PM',
    'Tuesday': '9:00 AM - 6:00 PM',
    'Wednesday': '9:00 AM - 6:00 PM',
    'Thursday': '9:00 AM - 6:00 PM',
    'Friday': '9:00 AM - 6:00 PM',
    'Saturday': '10:00 AM - 4:00 PM',
    'Sunday': 'Closed'
  };
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
      count: 'number - Number of previews generated'
    }
  });
}
