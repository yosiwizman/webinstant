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
            template_used: 'ultra-modern-2025'
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
                template_used: 'ultra-modern-2025'
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
  
  // Generate particle elements
  const particles = Array(20).fill(0).map((_, i) => 
    `<div class="particle" style="left: ${Math.random() * 100}%; animation-delay: ${Math.random() * 10}s;"></div>`
  ).join('');

  // Build the ultra-modern HTML template
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${businessName} - Premium Digital Experience</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :root {
      --primary-gradient: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
      --glass-bg: rgba(255, 255, 255, 0.1);
      --glass-border: rgba(255, 255, 255, 0.2);
      --neon-glow: #e73c7e;
      --text-shadow-neon: 0 0 10px rgba(231, 60, 126, 0.5);
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #fff;
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
      background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
      background-size: 400% 400%;
      animation: gradientShift 15s ease infinite;
    }

    @keyframes gradientShift {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    /* Particle Effect */
    .particles {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: -1;
      pointer-events: none;
    }

    .particle {
      position: absolute;
      width: 4px;
      height: 4px;
      background: rgba(255, 255, 255, 0.5);
      border-radius: 50%;
      animation: float 10s infinite;
    }

    @keyframes float {
      0%, 100% { transform: translateY(0) translateX(0); opacity: 0; }
      10% { opacity: 1; }
      90% { opacity: 1; }
      100% { transform: translateY(-100vh) translateX(100px); opacity: 0; }
    }

    /* Navigation with Glassmorphism */
    nav {
      position: fixed;
      width: 100%;
      top: 0;
      z-index: 1000;
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding: 1rem 0;
      animation: slideDown 0.5s ease;
    }

    @keyframes slideDown {
      from { transform: translateY(-100%); }
      to { transform: translateY(0); }
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
      background: linear-gradient(45deg, #fff, #e73c7e);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-shadow: var(--text-shadow-neon);
      animation: glow 2s ease-in-out infinite alternate;
    }

    @keyframes glow {
      from { filter: drop-shadow(0 0 10px rgba(231, 60, 126, 0.5)); }
      to { filter: drop-shadow(0 0 20px rgba(231, 60, 126, 0.8)); }
    }

    .nav-links {
      display: flex;
      gap: 2rem;
      list-style: none;
    }

    .nav-links a {
      color: #fff;
      text-decoration: none;
      transition: color 0.3s ease;
    }

    .nav-links a:hover {
      color: #e73c7e;
    }

    /* Mobile Navigation */
    .mobile-menu-btn {
      display: none;
      background: none;
      border: none;
      color: white;
      font-size: 2rem;
      cursor: pointer;
      z-index: 1001;
    }

    /* Hero Section with Typing Effect */
    .hero {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 2rem;
      position: relative;
      margin-top: 80px;
    }

    .hero-content {
      max-width: 900px;
      animation: fadeInUp 1s ease;
      z-index: 10;
    }

    .hero h1 {
      font-size: clamp(3rem, 8vw, 5rem);
      margin-bottom: 1rem;
      background: linear-gradient(45deg, #fff, #e73c7e, #23a6d5);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: textGradient 3s ease infinite;
      filter: drop-shadow(0 4px 20px rgba(231, 60, 126, 0.3));
      background-size: 200% 200%;
    }

    @keyframes textGradient {
      0%, 100% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
    }

    .typing-text {
      font-size: 1.5rem;
      margin: 2rem 0;
      min-height: 2em;
    }

    .typing-text::after {
      content: '|';
      animation: blink 1s infinite;
    }

    @keyframes blink {
      50% { opacity: 0; }
    }

    .cta-buttons {
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
      margin-top: 3rem;
    }

    /* Glassmorphism Cards */
    .glass-card {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 2rem;
      box-shadow: 
        0 8px 32px rgba(31, 38, 135, 0.2),
        inset 0 1px 1px rgba(255, 255, 255, 0.1);
      transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      position: relative;
      overflow: hidden;
    }

    .glass-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      animation: shimmer 3s infinite;
    }

    @keyframes shimmer {
      100% { left: 100%; }
    }

    .glass-card:hover {
      transform: translateY(-10px) rotateX(5deg) rotateY(5deg);
      box-shadow: 
        0 20px 40px rgba(231, 60, 126, 0.3),
        inset 0 1px 1px rgba(255, 255, 255, 0.2);
    }

    .glass-card h3 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
      color: #fff;
    }

    .glass-card p {
      opacity: 0.8;
      line-height: 1.6;
    }

    /* 3D Buttons */
    .btn-3d {
      padding: 1.2rem 3rem;
      font-size: 1.1rem;
      font-weight: 600;
      border: none;
      border-radius: 50px;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 2px;
      position: relative;
      overflow: hidden;
      background: linear-gradient(45deg, #e73c7e, #23a6d5);
      color: white;
      transition: all 0.3s ease;
      transform-style: preserve-3d;
      box-shadow: 
        0 10px 30px rgba(231, 60, 126, 0.3),
        inset 0 1px 1px rgba(255, 255, 255, 0.3);
      text-decoration: none;
      display: inline-block;
    }

    .btn-3d::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: rgba(255, 255, 255, 0.3);
      transition: left 0.5s ease;
    }

    .btn-3d: {
      transform: translateY(-3px) scale(1.05);
      box-shadow: 
        0 15px 40px rgba(231, 60, 126, 0.4),
        inset 0 1px 1px rgba(255, 255, 255, 0.4);
    }

    .btn-3d:hover::before {
      left: 100%;
    }

    /* Feature Grid with Floating Animation */
    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
      margin: 4rem 0;
      padding: 0 2rem;
    }

    .feature-card {
      animation: float-card 6s ease-in-out infinite;
      animation-delay: calc(var(--i) * 0.5s);
    }

    @keyframes float-card {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-20px); }
    }

    .feature-icon {
      font-size: 2rem;
      margin-bottom: 1rem;
    }

    /* Neon Text Effects */
    .neon-text {
      font-size: 2rem;
      text-align: center;
      color: #fff;
      text-shadow: 
        0 0 10px #fff,
        0 0 20px #fff,
        0 0 30px var(--neon-glow),
        0 0 40px var(--neon-glow),
        0 0 50px var(--neon-glow);
      animation: neon-flicker 1.5s infinite alternate;
    }

    @keyframes neon-flicker {
      0%, 100% { opacity: 1; }
      40% { opacity: 0.9; }
      60% { opacity: 0.7; }
      80% { opacity: 0.95; }
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
      background: linear-gradient(45deg, #fff, #e73c7e);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      filter: drop-shadow(0 2px 10px rgba(231, 60, 126, 0.3));
    }

    /* Contact Section */
    .contact-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 2rem;
      margin: 3rem 0;
    }

    /* Footer */
    footer {
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(10px);
      padding: 3rem 2rem;
      text-align: center;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    /* Fade In Animation for Scroll */
    .fade-in {
      opacity: 0;
      transform: translateY(30px);
      animation: fadeInUp 1s ease forwards;
    }

    @keyframes fadeInUp {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Mobile Responsive Styles */
    @media (max-width: 768px) {
      .mobile-menu-btn {
        display: block;
      }

      .nav-links {
        position: fixed;
        top: 0;
        right: -100%;
        width: 70%;
        height: 100vh;
        background: rgba(0, 0, 0, 0.95);
        backdrop-filter: blur(20px);
        flex-direction: column;
        padding: 5rem 2rem;
        transition: right 0.3s ease;
      }

      .nav-links.active {
        right: 0;
      }

      /* Mobile Typography */
      .hero h1 {
        font-size: clamp(2rem, 10vw, 3rem);
        line-height: 1.2;
      }

      .typing-text {
        font-size: clamp(1rem, 4vw, 1.5rem);
      }

      .section-title {
        font-size: clamp(1.8rem, 8vw, 3rem);
      }

      /* Mobile Spacing */
      .section {
        padding: 3rem 1rem;
      }

      .hero {
        min-height: 100vh;
        padding: 1rem;
      }

      /* Mobile Cards */
      .features-grid {
        grid-template-columns: 1fr;
        gap: 1.5rem;
      }

      .glass-card {
        padding: 1.5rem;
        border-radius: 15px;
      }

      /* Mobile Buttons - Touch Friendly */
      .btn-3d {
        width: 100%;
        padding: 1rem 2rem;
        font-size: 1rem;
        min-height: 48px;
      }

      .cta-buttons {
        flex-direction: column;
        width: 100%;
        max-width: 300px;
        margin: 2rem auto 0;
      }

      /* Mobile Contact Grid */
      .contact-grid {
        grid-template-columns: 1fr;
        gap: 1.5rem;
      }

      /* Reduce animations on mobile for performance */
      .particle {
        display: none;
      }

      @media (prefers-reduced-motion: reduce) {
        * {
          animation: none !important;
          transition: none !important;
        }
      }

      /* Mobile Landscape Adjustments */
      @media (max-height: 500px) and (orientation: landscape) {
        .hero {
          min-height: auto;
          padding: 2rem 1rem;
        }
        
        .hero h1 {
          font-size: 2rem;
        }
      }
    }

    /* Tablet Specific */
    @media (min-width: 769px) and (max-width: 1024px) {
      .features-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      
      .contact-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    /* Touch Device Optimizations */
    @media (hover: none) and (pointer: coarse) {
      .glass-card:hover {
        transform: none;
      }
      
      button, a {
        min-height: 44px;
        min-width: 44px;
      }
    }

    /* iPhone Notch Safe Areas */
    @supports (padding: max(0px)) {
      .nav-container {
        padding-left: max(2rem, env(safe-area-inset-left));
        padding-right: max(2rem, env(safe-area-inset-right));
      }
      
      footer {
        padding-bottom: max(3rem, env(safe-area-inset-bottom));
      }
    }
  </style>
</head>
<body>
  <div class="animated-bg"></div>
  
  <!-- Particles -->
  <div class="particles">
    ${particles}
  </div>

  <!-- Navigation -->
  <nav>
    <div class="nav-container">
      <div class="logo">${businessName}</div>
      <ul class="nav-links" id="navLinks">
        <li><a href="#home">Home</a></li>
        <li><a href="#features">Features</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
    </div>
  </nav>

  <!-- Hero Section -->
  <section id="home" class="hero">
    <div class="hero-content">
      <h1>${businessName}</h1>
      <div class="typing-text">${tagline}</div>
      <div class="cta-buttons">
        <a href="tel:${phone}" class="btn-3d">Call Now</a>
        <a href="#contact" class="btn-3d">Get Directions</a>
      </div>
    </div>
  </section>

  <!-- Features Section -->
  <section id="features" class="section">
    <h2 class="section-title">Why Choose Us</h2>
    <div class="features-grid">
      <div class="glass-card feature-card" style="--i: 0;">
        <div class="feature-icon">✨</div>
        <h3>Premium Quality</h3>
        <p>Excellence in every detail, guaranteed satisfaction with every service.</p>
      </div>
      <div class="glass-card feature-card" style="--i: 1;">
        <div class="feature-icon">⚡</div>
        <h3>Lightning Fast</h3>
        <p>Quick response times and efficient service when you need it most.</p>
      </div>
      <div class="glass-card feature-card" style="--i: 2;">
        <div class="feature-icon">💎</div>
        <h3>Best Value</h3>
        <p>Competitive pricing with no hidden fees. Quality you can afford.</p>
      </div>
    </div>
  </section>

  <!-- Contact Section -->
  <section id="contact" class="section">
    <h2 class="section-title neon-text">Get In Touch</h2>
    <div class="contact-grid">
      <div class="glass-card">
        <h3>📍 Location</h3>
        <p>${address}</p>
        <p>${city}, ${state} ${zip}</p>
      </div>
      <div class="glass-card">
        <h3>📞 Contact</h3>
        <p><a href="tel:${phone}" style="color: #e73c7e; text-decoration: none;">${phone}</a></p>
        <p><a href="mailto:${email}" style="color: #23a6d5; text-decoration: none;">${email}</a></p>
      </div>
      <div class="glass-card">
        <h3>🕒 Hours</h3>
        <p>Mon-Fri: 9AM - 6PM</p>
        <p>Sat-Sun: 10AM - 4PM</p>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer>
    <p>&copy; 2025 ${businessName}. Powered by WebInstant</p>
    <p style="margin-top: 1rem; opacity: 0.7;">Creating stunning digital experiences</p>
  </footer>

  <script>
    // Mobile menu toggle
    const mobileBtn = document.createElement('button');
    mobileBtn.className = 'mobile-menu-btn';
    mobileBtn.innerHTML = '☰';
    mobileBtn.onclick = () => {
      const navLinks = document.getElementById('navLinks');
      navLinks.classList.toggle('active');
      mobileBtn.innerHTML = navLinks.classList.contains('active') ? '✕' : '☰';
    };
    document.querySelector('.nav-container').appendChild(mobileBtn);

    // Close menu on link click
    document.querySelectorAll('.nav-links a').forEach(link => {
      link.onclick = () => {
        document.getElementById('navLinks').classList.remove('active');
        mobileBtn.innerHTML = '☰';
      };
    });

    // Smooth scroll for anchors
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        if (targetId && targetId !== '#') {
          const target = document.querySelector(targetId);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    });

    // Typing effect
    const taglines = [
      '${tagline}',
      'Excellence in Every Detail',
      'Your Trusted Local Partner',
      'Quality Service Guaranteed'
    ];
    let taglineIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    function typeEffect() {
      const element = document.querySelector('.typing-text');
      if (!element) return;
      
      const currentText = taglines[taglineIndex];
      
      if (isDeleting) {
        element.textContent = currentText.substring(0, charIndex - 1);
        charIndex--;
      } else {
        element.textContent = currentText.substring(0, charIndex + 1);
        charIndex++;
      }

      if (!isDeleting && charIndex === currentText.length) {
        setTimeout(() => { isDeleting = true; }, 2000);
      } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        taglineIndex = (taglineIndex + 1) % taglines.length;
      }

      setTimeout(typeEffect, isDeleting ? 50 : 100);
    }

    // Start typing effect
    setTimeout(typeEffect, 1000);

    // Parallax effect on mouse move (desktop only)
    if (window.matchMedia('(hover: hover)').matches) {
      document.addEventListener('mousemove', (e) => {
        const cards = document.querySelectorAll('.glass-card');
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;
        
        cards.forEach((card, index) => {
          const speed = 5 + index;
          const xMove = (x - 0.5) * speed;
          const yMove = (y - 0.5) * speed;
          card.style.transform = \`translateX(\${xMove}px) translateY(\${yMove}px)\`;
        });
      });
    }
  </script>
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
      'Building Dreams,ering Quality',
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
