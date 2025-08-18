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
  
  console.log('Fetching preview for ID/slug:', id)
  
  // First try to find by slug (SEO-friendly URL)
  let { data: preview, error } = await supabase
    .from('website_previews')
    .select('id, business_id, preview_url, html_content, template_used, slug')
    .eq('slug', id)
    .single()

  // If not found by slug, try by business_id (for backwards compatibility)
  if (error || !preview) {
    console.log('Not found by slug, trying by business_id...')
    
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
    console.log('Not found by business_id, trying by preview ID...')
    
    const result = await supabase
      .from('website_previews')
      .select('id, business_id, preview_url, html_content, template_used, slug')
      .eq('id', id)
      .single()
    
    preview = result.data
    error = result.error
  }

  // Log for debugging
  if (error) {
    console.error('Error fetching preview:', error)
  }
  
  console.log('Preview data:', preview ? `Found (template: ${preview.template_used})` : 'Not found')

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
    </style>
  `;

  // Create the inline edit script
  const editScript = `
    <script>
      window.PREVIEW_ID = '${preview.id}';
      window.BUSINESS_ID = '${preview.business_id}';
      
      (function() {
        // Fix SVG inherit values on page load
        function fixSVGAttributes() {
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
          console.log('Initializing editor...');
          
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
                      <select id="hours-mon-close" style="flex: 1; min-width: 0; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px;">
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

          // Find and extract current values
          function findPhoneNumber() {
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
            return null;
          }

          function findEmail() {
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
            return null;
          }

          function findHours() {
            const hours = {};
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
            
            return hours;
          }

          function findServices() {
            const services = [];
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
            
            return services;
          }

          function findSocialLinks() {
            const links = {};
            
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
            
            return links;
          }

          // Function to create a service field
          function createServiceField(name = '', price = '', serviceId = null) {
            if (!serviceId) {
              serviceId = 'service-' + (++serviceCounter);
            }
            
            const serviceDiv = document.createElement('div');
            serviceDiv.id = serviceId + '-container';
            serviceDiv.style.cssText = 'margin-bottom: 10px; position: relative;';
            
            serviceDiv.innerHTML = \`
              <div style="display: flex; gap: 8px; align-items: flex-start;">
                <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
                  <input type="text" id="\${serviceId}-name" placeholder="Service name" value="\${name}" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px; box-sizing: border-box;">
                  <input type="text" id="\${serviceId}-price" placeholder="Price (e.g., $45)" value="\${price}" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px; box-sizing: border-box;">
                </div>
                <button onclick="this.parentElement.parentElement.remove()" style="background: #dc3545; color: white;  border: none; border-radius: 3px; width: 24px; height: 24px; cursor: pointer; font-size: 16px; line-height: 1; padding: 0; margin-top: 6px;">×</button>
              </div>
            \`;
            
            return serviceDiv;
          }

          // Function to show panel
          function showPanel() {
            console.log('Showing panel...');
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
            console.log('Hiding panel...');
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
            console.log('Edit button clicked');
            
            // Fix SVGs when panel opens
            fixSVGAttributes();
            
            showPanel();
            
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
              const parsed = parseHours(data.value);
              
              const openSelect = document.getElementById('hours-' + shortDay + '-open');
              const closeSelect = document.getElementById('hours-' + shortDay + '-close');
              
              if (openSelect) {
                openSelect.value = parsed.open || 'Closed';
                originalValues['hours-' + shortDay + '-open'] = parsed.open || 'Closed';
              }
              if (closeSelect) {
                closeSelect.value = parsed.close || 'Closed';
                originalValues['hours-' + shortDay + '-close'] = parsed.close || 'Closed';
              }
              
              // Store the original combined value
              originalValues['hours-' + shortDay] = data.value;
            }
            
            // Find and populate services
            const services = findServices();
            servicesElements = services;
            originalValues.services = [];
            
            if (services.length > 0) {
              services.forEach((service, index) => {
                const serviceField = createServiceField(service.name, service.price, 'service-' + (index + 1));
                servicesContainer.appendChild(serviceField);
                serviceCounter = index + 1;
                originalValues.services.push({
                  name: service.name,
                  price: service.price,
                  element: service.element,
                  node: service.node,
                  fullText: service.fullText
                });
              });
            } else {
              // Add at least one empty service field
              const serviceField = createServiceField();
              servicesContainer.appendChild(serviceField);
            }
            
            // Find and populate social links
            const socialLinks = findSocialLinks();
            socialElements = socialLinks;
            originalValues.social = {};
            
            ['facebook', 'instagram', 'twitter', 'linkedin'].forEach(platform => {
              const input = document.getElementById('social-' + platform);
              if (input) {
                if (socialLinks[platform] && socialLinks[platform].value) {
                  input.value = socialLinks[platform].value;
                  originalValues.social[platform] = socialLinks[platform].value;
                } else {
                  input.value = '';
                  originalValues.social[platform] = '';
                }
              }
            });
          });

          // Also add touch event for mobile
          editBtn.addEventListener('touchend', function(e) {
            if (e.cancelable) {
              e.preventDefault();
              e.stopPropagation();
              this.click();
            }
          });

          // Close panel handlers
          document.getElementById('close-panel').addEventListener('click', function(e) {
            e.preventDefault();
            hidePanel();
          });

          document.getElementById('cancel-edit').addEventListener('click', function(e) {
            e.preventDefault();
            hidePanel();
          });

          // Save changes
          document.getElementById('save-changes').addEventListener('click', async function(e) {
            e.preventDefault();
            console.log('Save button clicked');
            
            const statusDiv = document.getElementById('save-status');
            statusDiv.style.display = 'block';
            statusDiv.style.background = '#ffc107';
            statusDiv.style.color = '#000';
            statusDiv.textContent = 'Saving changes...';
            
            // Prepare updates object for API
            const updates = {};
            
            // Store the old and new values for DOM updates
            const domUpdates = {
              phone: null,
              email: null,
              hours: {},
              services: [],
              social: {}
            };
            
            // Check phone changes
            const newPhone = document.getElementById('edit-phone').value;
            if (newPhone && newPhone !== originalValues.phone) {
              updates.phone = newPhone;
              domUpdates.phone = { old: originalValues.phone, new: newPhone };
            }
            
            // Check email changes
            const newEmail = document.getElementById('edit-email').value;
            if (newEmail && newEmail !== originalValues.email) {
              updates.email = newEmail;
              domUpdates.email = { old: originalValues.email, new: newEmail };
            }
            
            // Check hours changes
            const dayMap = {
              'mon': 'monday',
              'tue': 'tuesday',
              'wed': 'wednesday',
              'thu': 'thursday',
              'fri': 'friday',
              'sat': 'saturday',
              'sun': 'sunday'
            };
            
            const hoursUpdates = {};
            for (const [shortDay, fullDay] of Object.entries(dayMap)) {
              const openSelect = document.getElementById('hours-' + shortDay + '-open');
              const closeSelect = document.getElementById('hours-' + shortDay + '-close');
              
              if (openSelect && closeSelect) {
                const newHours = combineHours(openSelect.value, closeSelect.value);
                const originalHours = originalValues['hours-' + shortDay];
                
                if (newHours !== originalHours && originalHours) {
                  hoursUpdates[fullDay] = newHours;
                  domUpdates.hours[fullDay] = { 
                    old: originalHours, 
                    new: newHours,
                    element: hoursElements[fullDay]
                  };
                }
              }
            }
            
            if (Object.keys(hoursUpdates).length > 0) {
              updates.hours = hoursUpdates;
            }
            
            // Collect all services from the form
            const servicesContainer = document.getElementById('services-container');
            const serviceFields = servicesContainer.querySelectorAll('[id$="-container"]');
            const newServices = [];
            
            serviceFields.forEach((field) => {
              const nameInput = field.querySelector('[id$="-name"]');
              const priceInput = field.querySelector('[id$="-price"]');
              
              if (nameInput && priceInput) {
                const name = nameInput.value.trim();
                const price = priceInput.value.trim();
                
                if (name || price) {
                  newServices.push({ name, price });
                }
              }
            });
            
            // Always update services if there are any changes
            updates.services = newServices;
            domUpdates.services = {
              old: originalValues.services || [],
              new: newServices
            };
            
            // Check social media changes
            const socialUpdates = {};
            ['facebook', 'instagram', 'twitter', 'linkedin'].forEach(platform => {
              const input = document.getElementById('social-' + platform);
              const newValue = input ? input.value.trim() : '';
              const oldValue = originalValues.social[platform] || '';
              
              // Always include the social value (even if empty) to handle removals
              socialUpdates[platform] = newValue;
              
              if (newValue !== oldValue) {
                domUpdates.social[platform] = { old: oldValue, new: newValue };
              }
            });
            
            updates.social = socialUpdates;

            // Save to database
            try {
              console.log('Sending update request:', { 
                previewId: window.PREVIEW_ID, 
                businessId: window.BUSINESS_ID,
                updates: updates 
              });
              
              const response = await fetch('/api/preview/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  previewId: window.PREVIEW_ID,
                  businessId: window.BUSINESS_ID,
                  updates: updates
                })
              });
              
              const data = await response.json();
              console.log('Response:', data);
              
              if (response.ok && data.success) {
                console.log('Save successful, updating DOM...');
                
                // Fix SVGs after save
                fixSVGAttributes();
                
                // Update phone number in the DOM
                if (domUpdates.phone) {
                  console.log('Updating phone from', domUpdates.phone.old, 'to', domUpdates.phone.new);
                  const walker = document.createTreeWalker(
                    document.body,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                  );
                  
                  let node;
                  let phoneUpdated = false;
                  while (node = walker.nextNode()) {
                    if (node.textContent.includes(domUpdates.phone.old) && !node.parentElement.closest('.edit-panel')) {
                      node.textContent = node.textContent.replace(domUpdates.phone.old, domUpdates.phone.new);
                      phoneUpdated = true;
                    }
                  }
                  
                  if (phoneUpdated) {
                    // Update the stored original value
                    originalValues.phone = domUpdates.phone.new;
                    console.log('Phone number updated in DOM');
                  }
                }
                
                // Update email in the DOM
                if (domUpdates.email) {
                  console.log('Updating email from', domUpdates.email.old, 'to', domUpdates.email.new);
                  const walker = document.createTreeWalker(
                    document.body,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                  );
                  
                  let node;
                  let emailUpdated = false;
                  while (node = walker.nextNode()) {
                    if (node.textContent.includes(domUpdates.email.old) && !node.parentElement.closest('.edit-panel')) {
                      node.textContent = node.textContent.replace(domUpdates.email.old, domUpdates.email.new);
                      emailUpdated = true;
                    }
                  }
                  
                  if (emailUpdated) {
                    // Update the stored original value
                    originalValues.email = domUpdates.email.new;
                    console.log('Email updated in DOM');
                  }
                }
                
                // Update hours in the DOM
                if (Object.keys(domUpdates.hours).length > 0) {
                  console.log('Updating hours independently for each day:', domUpdates.hours);
                  
                  for (const [fullDay, hourUpdate] of Object.entries(domUpdates.hours)) {
                    if (!hourUpdate.element || !hourUpdate.element.node) continue;
                    
                    console.log(\`Updating \${fullDay}: "\${hourUpdate.old}" -> "\${hourUpdate.new}"\`);
                    
                    // Update the specific text node for this day's hours
                    const targetNode = hourUpdate.element.node;
                    if (targetNode && targetNode.nodeType === Node.TEXT_NODE) {
                      // Replace only this specific day's hours
                      if (targetNode.textContent.includes(hourUpdate.old)) {
                        targetNode.textContent = targetNode.textContent.replace(hourUpdate.old, hourUpdate.new);
                        console.log(\`Successfully updated \${fullDay} hours\`);
                        
                        // Update stored values
                        const shortDay = Object.keys(dayMap).find(key => dayMap[key] === fullDay);
                        if (shortDay) {
                          originalValues['hours-' + shortDay] = hourUpdate.new;
                          const parsed = parseHours(hourUpdate.new);
                          originalValues['hours-' + shortDay + '-open'] = parsed.open;
                          originalValues['hours-' + shortDay + '-close'] = parsed.close;
                        }
                      } else {
                        // Try to find and update in the container
                        const container = hourUpdate.element.container;
                        if (container) {
                          const walker = document.createTreeWalker(
                            container,
                            NodeFilter.SHOW_TEXT,
                            null,
                            false
                          );
                          
                          let textNode;
                          while (textNode = walker.nextNode()) {
                            if (textNode.textContent.includes(hourUpdate.old)) {
                              textNode.textContent = textNode.textContent.replace(hourUpdate.old, hourUpdate.new);
                              console.log(\`Successfully updated \${fullDay} hours in container\`);
                              
                              // Update stored values
                              const shortDay = Object.keys(dayMap).find(key => dayMap[key] === fullDay);
                              if (shortDay) {
                                originalValues['hours-' + shortDay] = hourUpdate.new;
                                const parsed = parseHours(hourUpdate.new);
                                originalValues['hours-' + shortDay + '-open'] = parsed.open;
                                originalValues['hours-' + shortDay + '-close'] = parsed.close;
                              }
                              break;
                            }
                          }
                        }
                      }
                    }
                  }
                }
                
                // Update services in the DOM
                if (domUpdates.services) {
                  console.log('Updating services:', domUpdates.services);
                  
                  // For services, we need a more complex update since they can be added/removed
                  // Try to update existing service elements
                  const oldServices = domUpdates.services.old;
                  const newServices = domUpdates.services.new;
                  
                  // Update existing services
                  oldServices.forEach((oldService, index) => {
                    if (oldService.element && newServices[index]) {
                      const newService = newServices[index];
                      const element = oldService.element;
                      
                      // Try to update the element's text content
                      if (element.textContent.includes(oldService.price)) {
                        let newText = element.textContent;
                        
                        // Update price
                        if (newService.price && oldService.price) {
                          newText = newText.replace(oldService.price, newService.price);
                        }
                        
                        // Update name if it exists
                        if (newService.name && oldService.name) {
                          newText = newText.replace(oldService.name, newService.name);
                        }
                        
                        element.textContent = newText;
                      }
                    }
                  });
                  
                  // Update stored services
                  originalValues.services = newServices.map(s => ({
                    name: s.name,
                    price: s.price,
                    fullText: \`\${s.name} \${s.price}\`
                  }));
                  
                  console.log('Services updated');
                }
                
                // Update social links in the DOM
                if (Object.keys(domUpdates.social).length > 0) {
                  console.log('Updating social links:', domUpdates.social);
                  
                  for (const [platform, socialUpdate] of Object.entries(domUpdates.social)) {
                    const socialElement = socialElements[platform];
                    
                    if (socialElement && socialElement.element) {
                      const link = socialElement.element;
                      
                      if (socialUpdate.new) {
                        // Update the href
                        link.href = socialUpdate.new;
                        link.setAttribute('target', '_blank');
                        link.setAttribute('rel', 'noopener noreferrer');
                        
                        // Make sure the link is visible
                        link.style.display = '';
                        if (socialElement.container) {
                          socialElement.container.style.display = '';
                        }
                        
                        console.log(\`Updated \${platform} link to: \${socialUpdate.new}\`);
                      } else {
                        // Hide the link if no URL provided
                        link.style.display = 'none';
                        if (socialElement.container) {
                          socialElement.container.style.display = 'none';
                        }
                        
                        console.log(\`Hidden \${platform} link (no URL)\`);
                      }
                    } else if (socialUpdate.new) {
                      // Try to find a social links container to add new links
                      const socialContainers = document.querySelectorAll('[class*="social"], [id*="social"]');
                      
                      if (socialContainers.length > 0) {
                        const container = socialContainers[0];
                        
                        // Create a new link element
                        const newLink = document.createElement('a');
                        newLink.href = socialUpdate.new;
                        newLink.target = '_blank';
                        newLink.rel = 'noopener noreferrer';
                        
                        // Add appropriate icon or text based on platform
                        const iconMap = {
                          facebook: '📘',
                          instagram: '📷',
                          twitter: '🐦',
                          linkedin: '💼'
                        };
                        
                        newLink.textContent = iconMap[platform] || platform;
                        newLink.style.marginRight = '10px';
                        
                        container.appendChild(newLink);
                        console.log(\`Added new \${platform} link\`);
                      }
                    }
                    
                    // Update stored value
                    originalValues.social[platform] = socialUpdate.new;
                  }
                }
                
                // Show success message
                statusDiv.style.background = '#28a745';
                statusDiv.style.color = '#fff';
                statusDiv.textContent = '✓ Changes saved and applied!';
                
                // Re-find elements with new values for future edits
                phoneElement = findPhoneNumber();
                emailElement = findEmail();
                hoursElements = findHours();
                servicesElements = findServices();
                socialElements = findSocialLinks();
                
                console.log('DOM updates complete');
                
                setTimeout(() => {
                  hidePanel();
                  statusDiv.style.display = 'none';
                }, 2000);
              } else {
                throw new Error(data.error || 'Failed to save changes');
              }
            } catch (error) {
              console.error('Save failed:', error);
              statusDiv.style.background = '#dc3545';
              statusDiv.style.color = '#fff';
              statusDiv.textContent = '✗ ' + (error.message || 'Failed to save changes. Please try again.');
              
              setTimeout(() => {
                statusDiv.style.display = 'none';
              }, 5000);
            }
          });

          // Handle window resize
          let resizeTimeout;
          window.addEventListener('resize', function() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(function() {
              const isMobile = window.innerWidth <= 768;
              
              // Update panel max-width based on screen size
              if (isMobile) {
                panel.style.maxWidth = '100%';
              } else {
                panel.style.maxWidth = '400px';
              }
            }, 250);
          });
        }
        
        // Run SVG fix periodically to catch dynamically added content
        setInterval(fixSVGAttributes, 2000);
      })();
    </script>
  `;

  // Process HTML to ensure proper structure
  let processedHtml = preview.html_content;
  
  // Fix SVG attributes in the HTML content before rendering
  processedHtml = processedHtml.replace(/width="inherit"/gi, 'width="24"');
  processedHtml = processedHtml.replace(/height="inherit"/gi, 'height="24"');
  
  // Ensure DOCTYPE is at the beginning
  if (!processedHtml.trim().toLowerCase().startsWith('<!doctype')) {
    processedHtml = '<!DOCTYPE html>\n' + processedHtml;
  }
  
  // Add viewport and responsive styles in the head
  if (processedHtml.includes('</head>')) {
    processedHtml = processedHtml.replace('</head>', mobileStyles + '</head>');
  } else if (processedHtml.includes('<body')) {
    // If no head tag, add it before body
    processedHtml = processedHtml.replace('<body', '<head>' + mobileStyles + '</head><body');
  }
  
  // Add the edit script before closing body tag
  processedHtml = processedHtml.replace('</body>', editScript + '</body>');

  // Return the processed HTML as a complete HTML document
  return (
    <iframe
      srcDoc={processedHtml}
      style={{
        width: '100%',
        height: '100vh',
        border: 'none',
        margin: 0,
        padding: 0,
        display: 'block'
      }}
      title="Website Preview"
    />
  )
}
