import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PreviewPage({ params }: PageProps) {
  // Await params for Next.js 15
  const { id } = await params
  
  // First try to find by slug (SEO-friendly URL)
  let { data: preview, error } = await supabase
    .from('website_previews')
    .select('id, business_id, preview_url, html_content, template_used, slug')
    .eq('slug', id)
    .single()

  // If not found by slug, try by business_id (for backwards compatibility)
  if (error || !preview) {
    const result = await supabase
      .from('website_previews')
      .select('id, business_id, preview_url, html_content, template_used, slug')
      .eq('business_id', id)
      .single()
    
    preview = result.data
    error = result.error
  }

  // If still not found, try by preview ID (UUID)
  if (error || !preview) {
    const result = await supabase
      .from('website_previews')
      .select('id, business_id, preview_url, html_content, template_used, slug')
      .eq('id', id)
      .single()
    
    preview = result.data
    error = result.error
  }

  // If there's an error or no preview found, show not found message
  if (error || !preview || !preview.html_content) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Preview not found</h1>
          <p className="text-gray-600">The preview you're looking for doesn't exist or has been removed.</p>
          <p className="text-sm text-gray-500 mt-4">ID/Slug: {id}</p>
        </div>
      </div>
    )
  }

  // Process HTML content to remove external resources (but keep Supabase)
  let processedHtml = preview.html_content;
  
  // 1. Remove ALL script tags EXCEPT Supabase
  processedHtml = processedHtml.replace(/<script\b(?![^>]*supabase\.co)[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // 2. Remove external link tags except data URIs and Supabase
  processedHtml = processedHtml.replace(/<link[^>]*href=["'](?!data:)(?!.*supabase\.co)(?:https?:\/\/[^"']+)["'][^>]*>/gi, '');
  
  // 3. Remove references to CDNs (but not Supabase)
  processedHtml = processedHtml.replace(/https?:\/\/(?:react\.dev|unpkg\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|googleapis\.com|gstatic\.com)(?!.*supabase)[^"'\s<>]*/gi, '#');
  
  // 4. Remove console.log statements
  processedHtml = processedHtml.replace(/console\.\w+\([^)]*\);?/g, '');
  
  // 5. Remove external resource references in style attributes (but keep Supabase)
  processedHtml = processedHtml.replace(/style=["'][^"']*url\(["']?https?:\/\/(?!.*supabase\.co)[^)]+\)["']?[^"']*["']/gi, 'style=""');
  
  // 6. Remove @import statements in style tags (but keep Supabase)
  processedHtml = processedHtml.replace(/@import\s+["']https?:\/\/(?!.*supabase\.co)[^"']+["'];?/gi, '');
  processedHtml = processedHtml.replace(/@import\s+url\(["']?https?:\/\/(?!.*supabase\.co)[^)]+["']?\);?/gi, '');
  
  // 7. Remove meta tags that reference external resources (but keep Supabase)
  processedHtml = processedHtml.replace(/<meta[^>]*content=["'][^"']*https?:\/\/(?!.*supabase\.co)[^"']+[^>]*>/gi, '');
  
  // 8. Remove any object or embed tags
  processedHtml = processedHtml.replace(/<(object|embed)[^>]*>.*?<\/\1>/gis, '');
  
  // 9. Clean up iframe sources that aren't local or Supabase
  processedHtml = processedHtml.replace(/<iframe[^>]*src=["'](?!data:)(?!.*supabase\.co)(?:https?:\/\/[^"']+)["'][^>]*>.*?<\/iframe>/gis, '');

  // Debug logging
  console.log('=== PREVIEW HTML DEBUG ===');
  console.log('Original length:', preview.html_content.length);
  console.log('Processed length:', processedHtml.length);
  console.log('First 500 chars of processed:', processedHtml.substring(0, 500));
  console.log('HTML starts with scripts removed:', processedHtml.substring(0, 100));

  // Add mobile viewport and responsive CSS to the HTML
  const mobileStyles = `
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
    <style>
      * {
        box-sizing: border-box;
      }
      
      html, body {
        max-width: 100vw;
        overflow-x: hidden;
        margin: 0;
        padding: 0;
      }
      
      img {
        max-width: 100%;
        height: auto;
      }
      
      /* Responsive text */
      @media (max-width: 768px) {
        body {
          font-size: 16px;
        }
        
        h1 {
          font-size: 2rem;
        }
        
        h2 {
          font-size: 1.5rem;
        }
        
        h3 {
          font-size: 1.25rem;
        }
        
        /* Fix any fixed width containers */
        div, section, article, main, header, footer {
          max-width: 100vw !important;
        }
        
        /* Ensure tables are responsive */
        table {
          display: block;
          overflow-x: auto;
          max-width: 100%;
        }
      }
      
      /* Prevent horizontal scroll */
      .container, .wrapper, .content {
        max-width: 100vw !important;
        overflow-x: hidden !important;
      }
      
      /* Error handling for missing resources */
      img[src=""], img:not([src]), img[src*="undefined"], img[src="#"] {
        display: none !important;
      }
    </style>
  `;

  // Create the inline edit script
  const editScript = `
    <script>
      window.PREVIEW_ID = '${preview.id}';
      window.BUSINESS_ID = '${preview.business_id}';
      
      (function() {
        // Error handler to prevent console errors
        window.addEventListener('error', function(e) {
          if (e.target && e.target.tagName === 'IMG') {
            e.target.style.display = 'none';
            e.preventDefault();
          }
          // Block external resource errors (but not Supabase)
          if (e.message && e.message.includes('http') && !e.message.includes('supabase.co')) {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }
        }, true);
        
        // Fix SVG attributes on page load
        function fixSVGAttributes() {
          try {
            const svgs = document.querySelectorAll('svg');
            svgs.forEach(svg => {
              // Fix width attribute
              if (svg.getAttribute('width') === 'inherit' || svg.getAttribute('width') === '') {
                svg.setAttribute('width', '24');
              }
              // Fix height attribute
              if (svg.getAttribute('height') === 'inherit' || svg.getAttribute('height') === '') {
                svg.setAttribute('height', '24');
              }
              
              // Also check for viewBox if missing
              if (!svg.getAttribute('viewBox')) {
                const width = svg.getAttribute('width') || '24';
                const height = svg.getAttribute('height') || '24';
                svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
              }
            });
            
            // Also fix any rect, circle, or path elements with inherit
            const elements = document.querySelectorAll('rect[width="inherit"], rect[height="inherit"], circle[r="inherit"], path[d*="inherit"]');
            elements.forEach(el => {
              if (el.getAttribute('width') === 'inherit') {
                el.setAttribute('width', '24');
              }
              if (el.getAttribute('height') === 'inherit') {
                el.setAttribute('height', '24');
              }
            });
          } catch (err) {
            // Silently handle any errors
          }
        }
        
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', function() {
            fixSVGAttributes();
            initEditor();
          });
        } else {
          fixSVGAttributes();
          setTimeout(initEditor, 100);
        }

        function initEditor() {
          try {
            // Fix SVGs again after editor loads
            fixSVGAttributes();
            
            // Create floating edit button - positioned higher to avoid chat bubble
            const editBtn = document.createElement('button');
            editBtn.innerHTML = '✏️ Edit Info';
            editBtn.className = 'floating-edit-btn';
            editBtn.style.cssText = \`
              position: fixed;
              bottom: 80px;
              right: 20px;
              z-index: 9999;
              padding: 12px 20px;
              background: #007bff;
              color: white;
              border: none;
              border-radius: 25px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              cursor: pointer;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 14px;
              font-weight: 500;
              transition: transform 0.2s ease, box-shadow 0.2s ease;
              -webkit-tap-highlight-color: transparent;
              touch-action: manipulation;
            \`;
            
            editBtn.onmouseover = () => {
              editBtn.style.transform = 'scale(1.05)';
              editBtn.style.boxShadow = '0 6px 12px rgba(0,0,0,0.15)';
            };
            
            editBtn.onmouseout = () => {
              editBtn.style.transform = 'scale(1)';
              editBtn.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
            };
            
            // Add touch events for mobile
            editBtn.addEventListener('touchstart', function(e) {
              e.preventDefault();
              this.style.transform = 'scale(0.95)';
            });
            
            editBtn.addEventListener('touchend', function(e) {
              e.preventDefault();
              this.style.transform = 'scale(1)';
            });
            
            document.body.appendChild(editBtn);

            // Generate time options for dropdowns
            function generateTimeOptions(isClosing = false) {
              const options = ['<option value="Closed">Closed</option>'];
              const startHour = isClosing ? 12 : 5; // Start at noon for closing, 5 AM for opening
              const endHour = isClosing ? 23 : 12; // End at 11 PM for closing, noon for opening
              
              for (let hour = startHour; hour <= endHour; hour++) {
                for (let min = 0; min < 60; min += 30) {
                  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                  const ampm = hour < 12 ? 'AM' : 'PM';
                  const minStr = min.toString().padStart(2, '0');
                  const timeStr = \`\${h12}:\${minStr} \${ampm}\`;
                  options.push(\`<option value="\${timeStr}">\${timeStr}</option>\`);
                }
              }
              
              return options.join('');
            }

            // Create edit panel
            const panel = document.createElement('div');
            panel.className = 'edit-panel';
            panel.id = 'edit-panel';
            
            // Set panel styles - responsive and no horizontal scroll
            panel.style.cssText = \`
              position: fixed;
              top: 0;
              right: -100%;
              width: 100%;
              max-width: 400px;
              height: 100vh;
              background: white;
              box-shadow: -2px 0 10px rgba(0,0,0,0.1);
              padding: 20px;
              transition: right 0.3s ease;
              z-index: 10000;
              overflow-y: auto;
              overflow-x: hidden;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              box-sizing: border-box;
            \`;
            
            // Responsive panel width for mobile
            if (window.innerWidth <= 768) {
              panel.style.maxWidth = '100%';
            }
            
            panel.innerHTML = \`
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: #333; font-size: 18px;">Edit Business Info</h3>
                <button id="close-panel" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666; padding: 5px; min-width: 30px; touch-action: manipulation;">×</button>
              </div>
              
              <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; color: #555; font-size: 14px; font-weight: 500;">Business Logo:</label>
                <div style="background: #f9f9f9; padding: 15px; border-radius: 4px;">
                  <div id="logo-preview" style="margin-bottom: 10px; text-align: center;">
                    <div id="current-logo" style="width: 120px; height: 120px; margin: 0 auto;  background: #fff; border: 2px dashed #ddd; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #999; font-size: 12px;">
                      No logo
                    </div>
                  </div>
                  <input type="file" id="logo-upload" accept=".png,.jpg,.jpeg,.svg" style="display: none;">
                  <button id="upload-logo-btn" style="width: 100%; padding: 8px; background: #007bff; color: white; border: none; border-radius: 3px; font-size: 13px; cursor: pointer;">📤 Upload Logo</button>
                  <div id="logo-upload-status" style="margin-top: 8px; font-size: 12px; color: #666; text-align: center; display: none;"></div>
                  <div style="margin-top: 8px; font-size: 11px; color: #999; text-align: center;">Max 5MB • PNG, JPG, or SVG</div>
                </div>
              </div>
              
              <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; color: #555; font-size: 14px; font-weight: 500;">Phone Number:</label>
                <input type="tel" id="edit-phone" placeholder="(555) 123-4567" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
              </div>
              
              <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; color: #555; font-size: 14px; font-weight: 500;">Email:</label>
                <input type="email" id="edit-email" placeholder="business@example.com" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
              </div>
              
              <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 10px; color: #555; font-size: 14px; font-weight: 500;">Business Hours:</label>
                <div id="hours-grid" style="background: #f9f9f9; padding: 15px; border-radius: 4px;">
                  <div style="margin-bottom: 10px;">
                    <div style="margin-bottom: 12px;">
                      <span style="display: block; font-size: 13px; color: #666; margin-bottom: 4px;">Monday:</span>
                      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: nowrap;">
                        <select id="hours-mon-open" style="flex: 1; min-width: 0; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px;">
                          \${generateTimeOptions(false)}
                        </select>
                        <span style="color: #999; flex-shrink: 0;">to</span>
                        <select id="hours-mon-close" style="flex: 1; min-width: 0; padding: 6px;  border: 1px solid #ddd; border-radius: 3px; font-size: 13px;">
                          \${generateTimeOptions(true)}
                        </select>
                      </div>
                    </div>
                    <div style="margin-bottom: 12px;">
                      <span style="display: block; font-size: 13px; color: #666; margin-bottom: 4px;">Tuesday:</span>
                      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: nowrap;">
                        <select id="hours-tue-open" style="flex: 1; min-width: 0; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px;">
                          \${generateTimeOptions(false)}
                        </select>
                        <span style="color: #999; flex-shrink: 0;">to</span>
                        <select id="hours-tue-close" style="flex: 1; min-width: 0; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px;">
                          \${generateTimeOptions(true)}
                        </select>
                      </div>
                    </div>
                    <div style="margin-bottom: 12px;">
                      <span style="display: block; font-size: 13px; color: #666; margin-bottom: 4px;">Wednesday:</span>
                      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: nowrap;">
                        <select id="hours-wed-open" style="flex: 1; min-width: 0; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px;">
                          \${generateTimeOptions(false)}
                        </select>
                        <span style="color: #999; flex-shrink: 0;">to</span>
                        <select id="hours-wed-close" style="flex: 1; min-width: 0; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px;">
                          \${generateTimeOptions(true)}
                        </select>
                      </div>
                    </div>
                    <div style="margin-bottom: 12px;">
                      <span style="display: block; font-size: 13px; color: #666; margin-bottom: 4px;">Thursday:</span>
                      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: nowrap;">
                        <select id="hours-thu-open" style="flex: 1; min-width: 0; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px;">
                          \${generateTimeOptions(false)}
                        </select>
                        <span style="color: #999; flex-shrink: 0;">to</span>
                        <select id="hours-thu-close" style="flex: 1; min-width: 0; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px;">
                          \${generateTimeOptions(true)}
                        </select>
                      </div>
                    </div>
                    <div style="margin-bottom: 12px;">
                      <span style="display: block; font-size: 13px; color: #666; margin-bottom: 4px;">Friday: </span>
                      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: nowrap;">
                        <select id="hours-fri-open" style="flex: 1; min-width: 0; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px;">
                          \${generateTimeOptions(false)}
                        </select>
                        <span style="color: #999; flex-shrink: 0;">to</span>
                        <select id="hours-fri-close" style="flex: 1; min-width: 0; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px;">
                          \${generateTimeOptions(true)}
                        </select>
                      </div>
                    </div>
                    <div style="margin-bottom: 12px;">
                      <span style="display: block; font-size: 13px; color: #666; margin-bottom: 4px;">Saturday:</span>
                      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: nowrap;">
                        <select id="hours-sat-open" style="flex: 1; min-width: 0; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px;">
                          \${generateTimeOptions(false)}
                        </select>
                        <span style="color: #999; flex-shrink: 0;">to</span>
                        <select id="hours-sat-close" style="flex: 1; min-width: 0; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px;">
                          \${generateTimeOptions(true)}
                        </select>
                      </div>
                    </div>
                    <div style="margin-bottom: 12px;">
                      <span style="display: block; font-size: 13px; color: #666; margin-bottom: 4px;">Sunday:</span>
                      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: nowrap;">
                        <select id="hours-sun-open" style="flex: 1; min-width: 0; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px;">
                          \${generateTimeOptions(false)}
                        </select>
                        <span style="color: #999; flex-shrink: 0;">to</span>
                        <select id="hours-sun-close" style="flex: 1; min-width: 0; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px;">
                          \${generateTimeOptions(true)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 10px; color: #555; font-size: 14px; font-weight: 500;">Services & Pricing:</label>
                <div style="background: #f9f9f9; padding: 15px; border-radius: 4px;">
                  <div id="services-container">
                    <!-- Services will be dynamically added here -->
                  </div>
                  <button id="add-service-btn" style="width: 100%; padding: 8px; background: #007bff; color: white; border: none; border-radius: 3px; font-size: 13px; cursor: pointer; margin-top: 10px;">+ Add Service</button>
                </div>
              </div>
              
              <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 10px; color: #555; font-size: 14px; font-weight: 500;">Social Media Links:</label>
                <div style="background: #f9f9f9; padding: 15px; border-radius: 4px;">
                  <div style="margin-bottom: 12px;">
                    <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">Facebook:</label>
                    <input type="url" id="social-facebook" placeholder="https://facebook.com/yourbusiness" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px; box-sizing: border-box;">
                  </div>
                  <div style="margin-bottom: 12px;">
                    <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">Instagram:</label>
                    <input type="url" id="social-instagram" placeholder="https://instagram.com/yourbusiness" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px; box-sizing: border-box;">
                  </div>
                  <div style="margin-bottom: 12px;">
                    <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">Twitter/X:</label>
                    <input type="url" id="social-twitter" placeholder="https://twitter.com/yourbusiness" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px; box-sizing: border-box;">
                  </div>
                  <div>
                    <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">LinkedIn:</label>
                    <input type="url" id="social-linkedin" placeholder="https://linkedin.com/company/yourbusiness" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px; box-sizing: border-box;">
                  </div>
                </div>
              </div>
              
              <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                <button id="save-changes" style="flex: 1; padding: 12px; background: #28a745; color: white; border: none; border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer; touch-action: manipulation;">Save Changes</button>
                <button id="cancel-edit" style="flex: 1; padding: 12px; background: #6c757d; color: white; border: none; border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer; touch-action: manipulation;">Cancel</button>
              </div>
              
              <div id="save-status" style="margin-top: 15px; padding: 10px; border-radius: 4px; display: none; text-align: center; font-size: 14px;"></div>
            \`;
            document.body.appendChild(panel);

            // Store original values
            let originalValues = {};
            let phoneElement = null;
            let emailElement = null;
            let hoursElements = {};
            let servicesElements = [];
            let socialElements = {};
            let serviceCounter = 0;
            let currentLogoUrl = null;
            let logoElements = [];

            // Find logo elements in the page
            function findLogos() {
              const logos = [];
              
              try {
                // Find img elements that might be logos
                const images = document.querySelectorAll('img');
                images.forEach(img => {
                  if (img.closest('.edit-panel')) return;
                  
                  const src = img.src || '';
                  const alt = (img.alt || '').toLowerCase();
                  const className = (img.className || '').toLowerCase();
                  const id = (img.id || '').toLowerCase();
                  
                  // Check if this looks like a logo
                  if (alt.includes('logo') || className.includes('logo') || id.includes('logo') ||
                      src.includes('logo') || (img.parentElement && img.parentElement.className.includes('logo'))) {
                    logos.push(img);
                  }
                });
                
                // Also find SVG logos
                const svgs = document.querySelectorAll('svg');
                svgs.forEach(svg => {
                  if (svg.closest('.edit-panel')) return;
                  
                  const parent = svg.parentElement;
                  if (parent && (parent.className.includes('logo') || parent.id.includes('logo'))) {
                    logos.push(svg);
                  }
                });
                
                // Find text-based logos (h1, h2, etc. in header/nav)
                const headers = document.querySelectorAll('header h1, header h2, nav h1, nav h2,  .logo, #logo');
                headers.forEach(header => {
                  if (header.closest('.edit-panel')) return;
                  if (!logos.some(logo => logo === header || header.contains(logo))) {
                    logos.push(header);
                  }
                });
              } catch (err)  {
                // Silently handle errors
              }
              
              return logos;
            }

            //  Display current logo in preview
            function displayCurrentLogo() {
              try {
                const logoPreview = document.getElementById('current-logo');
                if (!logoPreview) return;
                
                if (currentLogoUrl) {
                  logoPreview.innerHTML = \`<img src="\${currentLogoUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;" alt="Current logo" onerror="this.style.display='none'">\`;
                } else if (logoElements.length > 0) {
                  const firstLogo = logoElements[0];
                  if (firstLogo.tagName === 'IMG') {
                    logoPreview.innerHTML = \`<img src="\${firstLogo.src}" style="max-width: 100%; max-height: 100%; object-fit: contain;" alt="Current logo" onerror="this.style.display='none'">\`;
                  } else if (firstLogo.tagName === 'SVG') {
                    logoPreview.innerHTML = firstLogo.outerHTML;
                    const svg = logoPreview.querySelector('svg');
                    if (svg) {
                      svg.style.maxWidth = '100%';
                      svg.style.maxHeight = '100%';
                    }
                  } else {
                    logoPreview.innerHTML = \`<div style="font-size: 14px; font-weight: bold;">\${firstLogo.textContent}</div>\`;
                  }
                } else {
                  logoPreview.innerHTML = 'No logo';
                }
              } catch (err) {
                // Silently handle errors
              }
            }

            // Handle logo upload button click
            document.getElementById('upload-logo-btn').addEventListener('click', function(e) {
              e.preventDefault();
              document.getElementById('logo-upload').click();
            });

            // Handle logo file selection
            document.getElementById('logo-upload').addEventListener('change', async function(e) {
              const file = e.target.files[0];
              if (!file) return;
              
              // Validate file size (5MB max)
              if (file.size > 5 * 1024 * 1024) {
                const statusDiv = document.getElementById('logo-upload-status');
                statusDiv.style.display = 'block';
                statusDiv.style.color = '#dc3545';
                statusDiv.textContent = 'File too large. Maximum size is 5MB.';
                setTimeout(() => {
                  statusDiv.style.display = 'none';
                }, 3000);
                return;
              }
              
              // Validate file type
              const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
              if (!validTypes.includes(file.type)) {
                const statusDiv = document.getElementById('logo-upload-status');
                statusDiv.style.display = 'block';
                statusDiv.style.color = '#dc3545';
                statusDiv.textContent = 'Invalid file type. Please upload PNG, JPG, or SVG.';
                setTimeout(()  => {
                  statusDiv.style.display = 'none';
                }, 3000);
                return;
              }
              
              // Show uploading status
              const statusDiv = document.getElementById('logo-upload-status');
              statusDiv.style.display = 'block';
              statusDiv.style.color = '#007bff';
              statusDiv.textContent = 'Uploading logo...';
              
              // Create FormData and upload
              const formData = new FormData();
              formData.append('logo', file);
              formData.append('previewId', window.PREVIEW_ID);
              formData.append('businessId', window.BUSINESS_ID);
              
              try {
                const response = await fetch('/api/upload-logo', {
                  method: 'POST',
                  body: formData
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                  currentLogoUrl = data.logoUrl;
                  
                  // Update preview
                  displayCurrentLogo();
                  
                  // Update all logo elements in the page
                  logoElements.forEach(logo => {
                    try {
                      if (logo.tagName === 'IMG') {
                        logo.src = currentLogoUrl;
                      } else if (logo.tagName === 'SVG') {
                        // Replace SVG with img
                        const img = document.createElement('img');
                        img.src = currentLogoUrl;
                        img.alt = 'Business Logo';
                        img.style.cssText = logo.style.cssText;
                        img.className = logo.className;
                        img.onerror = function() { this.style.display = 'none'; };
                        logo.parentElement.replaceChild(img, logo);
                      } else {
                        // Replace text logo with image
                        const img = document.createElement('img');
                        img.src = currentLogoUrl;
                        img.alt = 'Business Logo';
                        img.style.maxHeight = '60px';
                        img.style.width = 'auto';
                        img.onerror = function() { this.style.display = 'none'; };
                        logo.innerHTML = '';
                        logo.appendChild(img);
                      }
                    } catch (err) {
                      // Silently handle errors
                    }
                  });
                  
                  // Re-find logos after update
                  logoElements = findLogos();
                  
                  statusDiv.style.color = '#28a745';
                  statusDiv.textContent = '✓ Logo uploaded successfully!';
                  setTimeout(() => {
                    statusDiv.style.display = 'none';
                  }, 3000);
                } else {
                  throw new Error(data.error || 'Upload failed');
                }
              } catch (error) {
                statusDiv.style.color = '#dc3545';
                statusDiv.textContent = '✗ ' + (error.message || 'Upload failed. Please try again.');
                setTimeout(() => {
                  statusDiv.style.display = 'none';
                }, 5000);
              }
              
              // Reset file input
              e.target.value = '';
            });

            // Find and extract current values
            function findPhoneNumber() {
              try {
                const phoneRegex = /\\(?\\d{3}\\)?[-\\.\\s]?\\d{3}[-\\.\\s]?\\d{4}/;
                const walker = document.createTreeWalker(
                  document.body,
                  NodeFilter.SHOW_TEXT,
                  null,
                  false
                );
                
                let node;
                while (node = walker.nextNode()) {
                  if (phoneRegex.test(node.textContent) && !node.parentElement.closest('.edit-panel')) {
                    return { node, value: node.textContent.match(phoneRegex)[0] };
                  }
                }
              } catch (err) {
                // Silently handle errors
              }
              return null;
            }

            function findEmail() {
              try {
                const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/;
                const walker = document.createTreeWalker(
                  document.body,
                  NodeFilter.SHOW_TEXT,
                  null,
                  false
                );
                
                let node;
                while (node = walker.nextNode()) {
                  if (emailRegex.test(node.textContent) && !node.parentElement.closest('.edit-panel')) {
                    return { node, value: node.textContent.match(emailRegex)[0] };
                  }
                }
              } catch (err) {
                // Silently handle errors
              }
              return null;
            }

            function findHours() {
              const hours = {};
              try {
                const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                const hoursRegex = /\\d{1,2}:\\d{2}\\s*(AM|PM|am|pm)?\\s*[-–]\\s*\\d{1,2}:\\d{2}\\s*(AM|PM|am|pm)?|Closed|closed/i;
                
                // Find all elements that might contain hours
                const allElements = Array.from(document.querySelectorAll('*'));
                
                for (const day of daysOfWeek) {
                  for (const element of allElements) {
                    if (element.closest('.edit-panel')) continue;
                    
                    const text = element.textContent || '';
                    if (text.toLowerCase().includes(day)) {
                      // Check if this element or its parent contains hours
                      let container = element;
                      let maxLevels = 3; // Check up to 3 parent levels
                      
                      while (container && maxLevels > 0) {
                        const containerText = container.textContent || '';
                        const hoursMatch = containerText.match(hoursRegex);
                        
                        if (hoursMatch) {
                          // Find the specific text node containing the hours
                          const walker = document.createTreeWalker(
                            container,
                            NodeFilter.SHOW_TEXT,
                            null,
                            false
                          );
                          
                          let textNode;
                          while (textNode = walker.nextNode()) {
                            if (hoursRegex.test(textNode.textContent)) {
                              hours[day] = { 
                                node: textNode, 
                                value: textNode.textContent.match(hoursRegex)[0],
                                container: container
                              };
                              break;
                            }
                          }
                          break;
                        }
                        
                        container = container.parentElement;
                        maxLevels--;
                      }
                      
                      if (hours[day]) break;
                    }
                  }
                }
              } catch (err) {
                // Silently handle errors
              }
              
              return hours;
            }

            function findServices() {
              const services = [];
              try {
                const priceRegex = /\\$\\d+(\\.\\d{2})?/;
                
                // Look for elements that contain both text and a price
                const allElements = Array.from(document.querySelectorAll('*'));
                
                for (const element of allElements) {
                  if (element.closest('.edit-panel')) continue;
                  
                  const text = element.textContent || '';
                  if (priceRegex.test(text)) {
                    // Check if this element contains a service name and price
                    const priceMatch = text.match(priceRegex);
                    if (priceMatch) {
                      // Try to extract service name - it's usually the text before the price
                      const priceIndex = text.indexOf(priceMatch[0]);
                      let serviceName = text.substring(0, priceIndex).trim();
                      
                      // Clean up the service name
                      serviceName = serviceName.replace(/[:\\-–]\\s*$/, '').trim();
                      
                      // Skip if service name is too short or too long
                      if (serviceName.length > 2 && serviceName.length < 100) {
                        // Check if this looks like a service (not a sentence)
                        if (!serviceName.includes('.') || serviceName.split(' ').length < 10) {
                          services.push({
                            element: element,
                            name: serviceName,
                            price: priceMatch[0],
                            fullText: text
                          });
                        }
                      }
                    }
                  }
                }
                
                // If we didn't find services with names, just look for prices
                if (services.length === 0) {
                  const walker = document.createTreeWalker(
                    document.body,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                  );
                  
                  let node;
                  while (node = walker.nextNode()) {
                    const matches = node.textContent.match(priceRegex);
                    if (matches && !node.parentElement.closest('.edit-panel')) {
                      matches.forEach(price => {
                        services.push({
                          node: node,
                          element: node.parentElement,
                          name: '',
                          price: price,
                          fullText: node.textContent
                        });
                      });
                    }
                  }
                }
              } catch (err) {
                // Silently handle errors
              }
              
              return services;
            }

            function findSocialLinks() {
              const links = {};
              
              try {
                // Find all social media links/icons
                const allLinks = document.querySelectorAll('a[href*="facebook"], a[href*="instagram"], a[href*="twitter"], a[href*="linkedin"], a[href*="#"]');
                
                allLinks.forEach(link => {
                  if (link.closest('.edit-panel')) return;
                  
                  const href = link.getAttribute('href') || '';
                  const linkText = link.textContent.toLowerCase();
                  const hasIcon = link.querySelector('svg, i, img');
                  
                  // Determine platform based on href or content
                  let platform = null;
                  if (href.includes('facebook') || linkText.includes('facebook') || link.className.includes('facebook')) {
                    platform = 'facebook';
                  } else if (href.includes('instagram') || linkText.includes('instagram') || link.className.includes('instagram')) {
                    platform = 'instagram';
                  } else if (href.includes('twitter') || linkText.includes('twitter') || link.className.includes('twitter')) {
                    platform = 'twitter';
                  } else if (href.includes('linkedin') || linkText.includes('linkedin') || link.className.includes('linkedin')) {
                    platform = 'linkedin';
                  }
                  
                  if (platform && !links[platform]) {
                    links[platform] = { 
                      element: link, 
                      value: href.startsWith('#') ? '' : href,
                      container: link.parentElement 
                    };
                  }
                });
              } catch (err) {
                // Silently handle errors
              }
              
              return links;
            }

            // Function to create a service field
            function createServiceField(name = '', price = '', serviceId = null) {
              if (!serviceId) {
                serviceId = 'service-' + (++serviceCounter);
              }
              
              const serviceDiv = document.createElement('div');
              serviceDiv.id = serviceId + '-container';
              serviceDiv.style.cssText = '  margin-bottom: 10px; position: relative;';
              
              serviceDiv.innerHTML = \`
                <div style="display: flex; gap: 8px; align-items: flex-start;">
                  <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
                    <input type="text" id="\${serviceId}-name" placeholder="Service name" value="\${name}" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px; box-sizing: border-box;">
                    <input type="text" id="\${serviceId}-price" placeholder="Price (e.g., $45)" value="\${price}" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px; box-sizing: border-box;">
                  </div>
                  <button onclick="this.parentElement.parentElement.remove()" style="background: #dc3545; color: white; border: none; border-radius: 3px; width: 24px; height: 24px; cursor: pointer; font-size: 16px; line-height: 1; padding: 0; margin-top: 6px;">×</button>
                </div>
              \`;
              
              return serviceDiv;
            }

            // Function to show panel
            function showPanel() {
              panel.style.right = '0';
              // Prevent body scroll when panel is open on mobile
              if (window.innerWidth <= 768) {
                document.body.style.overflow = 'hidden';
                document.body.style.position = 'fixed';
                document.body.style.width = '100%';
              }
            }

            // Function to hide panel
            function hidePanel() {
              panel.style.right = '-100%';
              // Restore body scroll
              if (window.innerWidth <= 768) {
                document.body.style.overflow = '';
                document.body.style.position = '';
                document.body.style.width = '';
              }
            }

            // Helper function to parse hours string into open/close times
            function parseHours(hoursStr) {
              if (!hoursStr || hoursStr.toLowerCase().includes('closed')) {
                return { open: 'Closed', close: 'Closed' };
              }
              
              const match = hoursStr.match(/(\\d{1,2}:\\d{2}\\s*(?:AM|PM|am|pm)?)\\s*[-–]\\s*(\\d{1,2}:\\d{2}\\s*(?:AM|PM|am|pm)?)/);
              if (match) {
                return { open: match[1].trim(), close: match[2].trim() };
              }
              
              return { open: '', close: '' };
            }

            // Helper function to combine open/close times into hours string
            function combineHours(open, close) {
              if (open === 'Closed' || close === 'Closed') {
                return 'Closed';
              }
              return \`\${open} - \${close}\`;
            }

            // Add service button handler
            document.getElementById('add-service-btn').addEventListener('click', function(e) {
              e.preventDefault();
              const servicesContainer = document.getElementById('services-container');
              const newService = createServiceField();
              servicesContainer.appendChild(newService);
            });

            // Toggle panel - use both click and touch events
            editBtn.addEventListener('click', function(e) {
              e.preventDefault();
              e.stopPropagation();
              
              // Fix SVGs when panel opens
              fixSVGAttributes();
              
              showPanel();
              
              // Find logos
              logoElements = findLogos();
              displayCurrentLogo();
              
              // Clear services container
              const servicesContainer = document.getElementById('services-container');
              servicesContainer.innerHTML = '';
              serviceCounter = 0;
              
              // Find and populate current values
              const phone = findPhoneNumber();
              if (phone) {
                phoneElement = phone;
                originalValues.phone = phone.value;
                document.getElementById('edit-phone').value = phone.value;
              }
              
              // Find and populate email
              const email = findEmail();
              if (email) {
                emailElement = email;
                originalValues.email = email.value;
                document.getElementById('edit-email').value = email.value;
              }
              
              // Find and populate hours with dropdowns
              const hours = findHours();
              hoursElements = hours;
              const dayMap = {
                'monday': 'mon',
                'tuesday': 'tue',
                'wednesday': 'wed',
                'thursday': 'thu',
                'friday': 'fri',
                'saturday': 'sat',
                'sunday': 'sun'
              };
              
              for (const [day, data] of Object.entries(hours)) {
                const shortDay = dayMap[day];
                if (shortDay) {
                  const parsed = parseHours(data.value);
                  const openSelect = document.getElementById(\`hours-\${shortDay}-open\`);
                  const closeSelect = document.getElementById(\`hours-\${shortDay}-close\`);
                  
                  if (openSelect) openSelect.value = parsed.open || '';
                  if (closeSelect) closeSelect.value = parsed.close || '';
                }
              }
              
              // Find and populate services
              const services = findServices();
              servicesElements = services;
              
              // Add up to 5 services to the panel
              const maxServices = Math.min(services.length, 5);
              for (let i = 0; i < maxServices; i++) {
                const service = services[i];
                const serviceField = createServiceField(service.name, service.price);
                servicesContainer.appendChild(serviceField);
              }
              
              // Find and populate social links
              const socialLinks = findSocialLinks();
              socialElements = socialLinks;
              
              for (const [platform, data] of Object.entries(socialLinks)) {
                const input = document.getElementById(\`social-\${platform}\`);
                if (input) {
                  input.value = data.value || '';
                }
              }
            });

            // Close panel button
            document.getElementById('close-panel').addEventListener('click', function(e) {
              e.preventDefault();
              hidePanel();
            });

            // Cancel button
            document.getElementById('cancel-edit').addEventListener('click', function(e) {
              e.preventDefault();
              hidePanel();
            });

            // Save changes button
            document.getElementById('save-changes').addEventListener('click', async function(e) {
              e.preventDefault();
              
              const statusDiv = document.getElementById('save-status');
              statusDiv.style.display = 'block';
              statusDiv.style.background = '#d1ecf1';
              statusDiv.style.color = '#0c5460';
              statusDiv.textContent = 'Saving changes...';
              
              try {
                // Collect all the updated values
                const updates = {
                  phone: document.getElementById('edit-phone').value,
                  email: document.getElementById('edit-email').value,
                  hours: {},
                  services: [],
                  social: {}
                };
                
                // Collect hours
                const dayMap = {
                  'mon': 'Monday',
                  'tue': 'Tuesday',
                  'wed': 'Wednesday',
                  'thu': 'Thursday',
                  'fri': 'Friday',
                  'sat': 'Saturday',
                  'sun': 'Sunday'
                };
                
                for (const [short, full] of Object.entries(dayMap)) {
                  const openSelect = document.getElementById(\`hours-\${short}-open\`);
                  const closeSelect = document.getElementById(\`hours-\${short}-close\`);
                  
                  if (openSelect && closeSelect) {
                    updates.hours[full] = combineHours(openSelect.value, closeSelect.value);
                  }
                }
                
                // Collect services
                const serviceContainers = document.querySelectorAll('[id$="-container"]');
                serviceContainers.forEach(container => {
                  if (container.id.startsWith('service-')) {
                    const serviceId = container.id.replace('-container', '');
                    const nameInput = document.getElementById(\`\${serviceId}-name\`);
                    const priceInput = document.getElementById(\`\${serviceId}-price\`);
                    
                    if (nameInput && priceInput && (nameInput.value || priceInput.value)) {
                      updates.services.push({
                        name: nameInput.value,
                        price: priceInput.value
                      });
                    }
                  }
                });
                
                // Collect social links
                ['facebook', 'instagram', 'twitter', 'linkedin'].forEach(platform => {
                  const input = document.getElementById(\`social-\${platform}\`);
                  if (input && input.value) {
                    updates.social[platform] = input.value;
                  }
                });
                
                // Send update request
                const response = await fetch('/api/preview/update', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    previewId: window.PREVIEW_ID,
                    businessId: window.BUSINESS_ID,
                    updates: updates
                  })
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                  // Update the page content with new values
                  if (phoneElement && phoneElement.node) {
                    phoneElement.node.textContent = phoneElement.node.textContent.replace(originalValues.phone, updates.phone);
                    originalValues.phone = updates.phone;
                  }
                  
                  if (emailElement && emailElement.node) {
                    emailElement.node.textContent = emailElement.node.textContent.replace(originalValues.email, updates.email);
                    originalValues.email = updates.email;
                  }
                  
                  // Update hours in the page
                  for (const [day, data] of Object.entries(hoursElements)) {
                    if (data.node) {
                      const dayCapitalized = day.charAt(0).toUpperCase() + day.slice(1);
                      const newHours = updates.hours[dayCapitalized];
                      if (newHours) {
                        data.node.textContent = data.node.textContent.replace(data.value, newHours);
                        data.value = newHours;
                      }
                    }
                  }
                  
                  // Update social links
                  for (const [platform, data] of Object.entries(socialElements)) {
                    if (data.element && updates.social[platform]) {
                      data.element.setAttribute('href', updates.social[platform]);
                    }
                  }
                  
                  statusDiv.style.background = '#d4edda';
                  statusDiv.style.color = '#155724';
                  statusDiv.textContent = '✓ Changes saved successfully!';
                  
                  setTimeout(() => {
                    hidePanel();
                    statusDiv.style.display = 'none';
                  }, 2000);
                } else {
                  throw new Error(data.error || 'Failed to save changes');
                }
              } catch (error) {
                statusDiv.style.background = '#f8d7da';
                statusDiv.style.color = '#721c24';
                statusDiv.textContent = '✗ ' + (error.message || 'Failed to save changes. Please try again.');
                
                setTimeout(() => {
                  statusDiv.style.display = 'none';
                }, 5000);
              }
            });
          } catch (err) {
            // Silently handle any errors in editor initialization
          }
        }
      })();
    </script>
  `;

  // Inject the mobile styles and edit script into the HTML
  processedHtml = processedHtml.replace('</head>', `${mobileStyles}</head>`);
  processedHtml = processedHtml.replace('</body>', `${editScript}</body>`);

  // Check if processedHtml is empty and show fallback
  if (!processedHtml || processedHtml.trim() === '') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Loading content...</h1>
          <p className="text-gray-600">Please wait while we load the preview.</p>
        </div>
      </div>
    )
  }

  // Return the HTML rendered directly in a div
  return (
    <div 
      dangerouslySetInnerHTML={{ __html: processedHtml }}
      style={{
        width: '100%',
        minHeight: '100vh',
        display: 'block'
      }}
    />
  )
}
