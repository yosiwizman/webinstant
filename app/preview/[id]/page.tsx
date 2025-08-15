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
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', initEditor);
        } else {
          setTimeout(initEditor, 100);
        }

        function initEditor() {
          console.log('Initializing editor...');
          
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

          // Create edit panel
          const panel = document.createElement('div');
          panel.className = 'edit-panel';
          panel.id = 'edit-panel';
          
          // Set initial styles based on screen size
          const isMobile = window.innerWidth <= 768;
          
          if (isMobile) {
            panel.style.cssText = \`
              position: fixed;
              bottom: -100%;
              left: 0;
              right: 0;
              background: white;
              box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
              padding: 20px;
              transition: bottom 0.3s ease;
              z-index: 10000;
              max-height: 70vh;
              overflow-y: auto;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            \`;
          } else {
            panel.style.cssText = \`
              position: fixed;
              right: -400px;
              top: 0;
              bottom: 0;
              width: 400px;
              background: white;
              box-shadow: -2px 0 10px rgba(0,0,0,0.1);
              padding: 20px;
              transition: right 0.3s ease;
              z-index: 10000;
              overflow-y: auto;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            \`;
          }
          
          panel.innerHTML = \`
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
              <h3 style="margin: 0; color: #333; font-size: 20px;">Edit Business Info</h3>
              <button id="close-panel" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666; padding: 5px; touch-action: manipulation;">×</button>
            </div>
            
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 5px; color: #555; font-size: 14px; font-weight: 500;">Phone Number:</label>
              <input type="tel" id="edit-phone" placeholder="(555) 123-4567" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
            </div>
            
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 10px; color: #555; font-size: 14px; font-weight: 500;">Business Hours:</label>
              <div id="hours-grid" style="background: #f9f9f9; padding: 15px; border-radius: 4px;">
                <div style="margin-bottom: 10px;">
                  <div style="display: flex; align-items: center; margin-bottom: 8px;">
                    <span style="width: 100px; font-size: 13px; color: #666;">Monday:</span>
                    <input type="text" id="hours-mon" placeholder="9:00 AM - 5:00 PM" style="flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px;">
                  </div>
                  <div style="display: flex; align-items: center; margin-bottom: 8px;">
                    <span style="width: 100px; font-size: 13px; color: #666;">Tuesday:</span>
                    <input type="text" id="hours-tue" placeholder="9:00 AM - 5:00 PM" style="flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px;">
                  </div>
                  <div style="display: flex; align-items: center; margin-bottom: 8px;">
                    <span style="width: 100px; font-size: 13px; color: #666;">Wednesday:</span>
                    <input type="text" id="hours-wed" placeholder="9:00 AM - 5:00 PM" style="flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px;">
                  </div>
                  <div style="display: flex; align-items: center; margin-bottom: 8px;">
                    <span style="width: 100px; font-size: 13px; color: #666;">Thursday:</span>
                    <input type="text" id="hours-thu" placeholder="9:00 AM - 5:00 PM" style="flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px;">
                  </div>
                  <div style="display: flex; align-items: center; margin-bottom: 8px;">
                    <span style="width: 100px; font-size: 13px; color: #666;">Friday:</span>
                    <input type="text" id="hours-fri" placeholder="9:00 AM - 5:00 PM" style="flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px;">
                  </div>
                  <div style="display: flex; align-items: center; margin-bottom: 8px;">
                    <span style="width: 100px; font-size: 13px; color: #666;">Saturday:</span>
                    <input type="text" id="hours-sat" placeholder="10:00 AM - 3:00 PM" style="flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px;">
                  </div>
                  <div style="display: flex; align-items: center;">
                    <span style="width: 100px; font-size: 13px; color: #666;">Sunday:</span>
                    <input type="text" id="hours-sun" placeholder="Closed" style="flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px;">
                  </div>
                </div>
              </div>
            </div>
            
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 10px; color: #555; font-size: 14px; font-weight: 500;">Common Prices:</label>
              <div style="background: #f9f9f9; padding: 15px; border-radius: 4px;">
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                  <span style="width: 120px; font-size: 13px; color: #666;">Service 1:</span>
                  <input type="text" id="price-1" placeholder="$45" style="flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px;">
                </div>
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                  <span style="width: 120px; font-size: 13px; color: #666;">Service 2:</span>
                  <input type="text" id="price-2" placeholder="$120" style="flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px;">
                </div>
                <div style="display: flex; align-items: center;">
                  <span style="width: 120px; font-size: 13px; color: #666;">Service 3:</span>
                  <input type="text" id="price-3" placeholder="$200" style="flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px;">
                </div>
              </div>
            </div>
            
            <div style="display: flex; gap: 10px;">
              <button id="save-changes" style="flex: 1; padding: 12px; background: #28a745; color: white; border: none; border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer; touch-action: manipulation;">Save Changes</button>
              <button id="cancel-edit" style="flex: 1;padding: 12px; background: #6c757d; color: white; border: none; border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer; touch-action: manipulation;">Cancel</button>
            </div>
            
            <div id="save-status" style="margin-top: 15px; padding: 10px; border-radius: 4px; display: none; text-align: center; font-size: 14px;"></div>
          \`;
          document.body.appendChild(panel);

          // Store original values
          let originalValues = {};
          let phoneElement = null;
          let hoursElements = {};
          let priceElements = [];

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

          function findHours() {
            const hours = {};
            const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            const hoursRegex = /\\d{1,2}:\\d{2}\\s*(AM|PM|am|pm)?\\s*[-–]\\s*\\d{1,2}:\\d{2}\\s*(AM|PM|am|pm)?|Closed|closed/i;
            
            const walker = document.createTreeWalker(
              document.body,
              NodeFilter.SHOW_TEXT,
              null,
              false
            );
            
            let node;
            while (node = walker.nextNode()) {
              const text = node.textContent.toLowerCase();
              for (const day of daysOfWeek) {
                if (text.includes(day) && !node.parentElement.closest('.edit-panel')) {
                  // Look for hours in the same element or next sibling
                  let hoursText = node.textContent;
                  if (node.nextSibling && node.nextSibling.textContent) {
                    hoursText += ' ' + node.nextSibling.textContent;
                  }
                  const hoursMatch = hoursText.match(hoursRegex);
                  if (hoursMatch) {
                    hours[day] = { node, value: hoursMatch[0] };
                  }
                }
              }
            }
            
            return hours;
          }

          function findPrices() {
            const priceRegex = /\\$\\d+(\\.\\d{2})?/g;
            const prices = [];
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
                  prices.push({ node, value: price });
                });
              }
            }
            
            return prices.slice(0, 3); // Return first 3 prices found
          }

          // Function to show panel
          function showPanel() {
            console.log('Showing panel...');
            const isMobile = window.innerWidth <= 768;
            
            if (isMobile) {
              panel.style.bottom = '0';
              panel.style.right = '0';
              panel.style.left = '0';
              // Prevent body scroll when panel is open on mobile
              document.body.style.overflow = 'hidden';
            } else {
              panel.style.right = '0';
            }
          }

          // Function to hide panel
          function hidePanel() {
            console.log('Hiding panel...');
            const isMobile = window.innerWidth <= 768;
            
            if (isMobile) {
              panel.style.bottom = '-100%';
              // Restore body scroll
              document.body.style.overflow = '';
            } else {
              panel.style.right = '-400px';
            }
          }

          // Toggle panel - use both click and touch events
          editBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Edit button clicked');
            
            showPanel();
            
            // Find and populate current values
            const phone = findPhoneNumber();
            if (phone) {
              phoneElement = phone;
              originalValues.phone = phone.value;
              document.getElementById('edit-phone').value = phone.value;
            }
            
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
              const inputId = 'hours-' + dayMap[day];
              const input = document.getElementById(inputId);
              if (input) {
                input.value = data.value;
                originalValues[inputId] = data.value;
              }
            }
            
            const prices = findPrices();
            priceElements = prices;
            prices.forEach((price, index) => {
              const input = document.getElementById('price-' + (index + 1));
              if (input) {
                input.value = price.value;
                originalValues['price-' + (index + 1)] = price.value;
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
              hours: {},
              prices: []
            };
            
            // Check phone changes
            const newPhone = document.getElementById('edit-phone').value;
            if (newPhone && newPhone !== originalValues.phone) {
              updates.phone = newPhone;
              domUpdates.phone = { old: originalValues.phone, new: newPhone };
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
              const input = document.getElementById('hours-' + shortDay);
              const originalValue = originalValues['hours-' + shortDay];
              if (input && input.value && input.value !== originalValue) {
                hoursUpdates[fullDay] = input.value;
                domUpdates.hours[shortDay] = { old: originalValue, new: input.value };
              }
            }
            
            if (Object.keys(hoursUpdates).length > 0) {
              updates.hours = hoursUpdates;
            }
            
            // Check price changes
            const priceUpdates = [];
            priceElements.forEach((price, index) => {
              const input = document.getElementById('price-' + (index + 1));
              const originalValue = originalValues['price-' + (index + 1)];
              if (input && input.value && input.value !== originalValue) {
                const update = { old: originalValue, new: input.value };
                priceUpdates.push(update);
                domUpdates.prices.push(update);
              }
            });
            
            if (priceUpdates.length > 0) {
              updates.prices = priceUpdates;
            }

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
                
                // Update hours in the DOM
                if (Object.keys(domUpdates.hours).length > 0) {
                  console.log('Updating hours:', domUpdates.hours);
                  for (const [shortDay, hourUpdate] of Object.entries(domUpdates.hours)) {
                    if (hourUpdate.old) {
                      const walker = document.createTreeWalker(
                        document.body,
                        NodeFilter.SHOW_TEXT,
                        null,
                        false
                      );
                      
                      let node;
                      let hoursUpdated = false;
                      while (node = walker.nextNode()) {
                        if (node.textContent.includes(hourUpdate.old) && !node.parentElement.closest('.edit-panel')) {
                          node.textContent = node.textContent.replace(hourUpdate.old, hourUpdate.new);
                          hoursUpdated = true;
                        }
                      }
                      
                      if (hoursUpdated) {
                        // Update stored value
                        originalValues['hours-' + shortDay] = hourUpdate.new;
                        console.log('Hours updated for', shortDay);
                      }
                    }
                  }
                }
                
                // Update prices in the DOM
                if (domUpdates.prices.length > 0) {
                  console.log('Updating prices:', domUpdates.prices);
                  domUpdates.prices.forEach((priceUpdate, index) => {
                    if (priceUpdate.old) {
                      const walker = document.createTreeWalker(
                        document.body,
                        NodeFilter.SHOW_TEXT,
                        null,
                        false
                      );
                      
                      let node;
                      let priceUpdated = false;
                      while (node = walker.nextNode()) {
                        if (node.textContent.includes(priceUpdate.old) && !node.parentElement.closest('.edit-panel')) {
                          node.textContent = node.textContent.replace(priceUpdate.old, priceUpdate.new);
                          priceUpdated = true;
                        }
                      }
                      
                      if (priceUpdated) {
                        // Update stored value
                        originalValues['price-' + (index + 1)] = priceUpdate.new;
                        console.log('Price', index + 1, 'updated');
                      }
                    }
                  });
                }
                
                // Show success message
                statusDiv.style.background = '#28a745';
                statusDiv.style.color = '#fff';
                statusDiv.textContent = '✓ Changes saved and applied!';
                
                // Re-find elements with new values for future edits
                phoneElement = findPhoneNumber();
                hoursElements = findHours();
                priceElements = findPrices();
                
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
              const isVisible = isMobile ? 
                (panel.style.bottom === '0px' || panel.style.bottom === '0') : 
                (panel.style.right === '0px' || panel.style.right === '0');
              
              // Update panel styles based on new screen size
              if (isMobile) {
                panel.style.cssText = \`
                  position: fixed;
                  bottom: \${isVisible ? '0' : '-100%'};
                  left: 0;
                  right: 0;
                  background: white;
                  box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
                  padding: 20px;
                  transition: bottom 0.3s ease;
                  z-index: 10000;
                  max-height: 70vh;
                  overflow-y: auto;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                \`;
              } else {
                panel.style.cssText = \`
                  position: fixed;
                  right: \${isVisible ? '0' : '-400px'};
                  top: 0;
                  bottom: 0;
                  width: 400px;
                  background: white;
                  box-shadow: -2px 0 10px rgba(0,0,0,0.1);
                  padding: 20px;
                  transition: right 0.3s ease;
                  z-index: 10000;
                  overflow-y: auto;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                \`;
              }
            }, 250);
          });
        }
      })();
    </script>
  `;

  // Process HTML to ensure proper structure
  let processedHtml = preview.html_content;
  
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
