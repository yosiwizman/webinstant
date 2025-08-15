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
          // Create floating edit button
          const editBtn = document.createElement('button');
          editBtn.innerHTML = '✏️ Edit Info';
          editBtn.className = 'floating-edit-btn';
          editBtn.style.cssText = \`
            position: fixed;
            bottom: 20px;
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
          \`;
          
          editBtn.onmouseover = () => {
            editBtn.style.transform = 'scale(1.05)';
            editBtn.style.boxShadow = '0 6px 12px rgba(0,0,0,0.15)';
          };
          
          editBtn.onmouseout = () => {
            editBtn.style.transform = 'scale(1)';
            editBtn.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
          };
          
          document.body.appendChild(editBtn);

          // Create edit panel
          const panel = document.createElement('div');
          panel.className = 'edit-panel';
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
          
          // Media query for desktop
          if (window.innerWidth > 768) {
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
              <button id="close-panel" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">×</button>
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
              <button id="save-changes" style="flex: 1; padding: 12px; background: #28a745; color: white; border: none; border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer;">Save Changes</button>
              <button id="cancel-edit" style="flex: 1; padding: 12px; background: #6c757d; color: white; border: none; border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer;">Cancel</button>
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

          // Toggle panel
          editBtn.onclick = () => {
            if (window.innerWidth > 768) {
              panel.style.right = '0';
            } else {
              panel.style.bottom = '0';
            }
            
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
          };

          // Close panel
          document.getElementById('close-panel').onclick = () => {
            if (window.innerWidth > 768) {
              panel.style.right = '-400px';
            } else {
              panel.style.bottom = '-100%';
            }
          };

          document.getElementById('cancel-edit').onclick = () => {
            if (window.innerWidth > 768) {
              panel.style.right = '-400px';
            } else {
              panel.style.bottom = '-100%';
            }
          };

          // Save changes
          document.getElementById('save-changes').onclick = async () => {
            const statusDiv = document.getElementById('save-status');
            statusDiv.style.display = 'block';
            statusDiv.style.background = '#ffc107';
            statusDiv.style.color = '#000';
            statusDiv.textContent = 'Saving changes...';
            
            const updates = {};
            
            // Update phone in DOM
            const newPhone = document.getElementById('edit-phone').value;
            if (phoneElement && newPhone && newPhone !== originalValues.phone) {
              phoneElement.node.textContent = phoneElement.node.textContent.replace(phoneElement.value, newPhone);
              updates.phone = newPhone;
            }
            
            // Update hours in DOM
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
              if (input && input.value && hoursElements[fullDay]) {
                const oldValue = hoursElements[fullDay].value;
                const newValue = input.value;
                if (newValue !== oldValue) {
                  hoursElements[fullDay].node.textContent = hoursElements[fullDay].node.textContent.replace(oldValue, newValue);
                  hoursUpdates[fullDay] = newValue;
                }
              }
            }
            
            if (Object.keys(hoursUpdates).length > 0) {
              updates.hours = hoursUpdates;
            }
            
            // Update prices in DOM
            const priceUpdates = [];
            priceElements.forEach((price, index) => {
              const input = document.getElementById('price-' + (index + 1));
              if (input && input.value && input.value !== price.value) {
                price.node.textContent = price.node.textContent.replace(price.value, input.value);
                priceUpdates.push({ old: price.value, new: input.value });
              }
            });
            
            if (priceUpdates.length > 0) {
              updates.prices = priceUpdates;
            }

            // Save to database
            try {
              const response = await fetch('/api/preview/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  previewId: window.PREVIEW_ID,
                  businessId: window.BUSINESS_ID,
                  updates: updates
                })
              });
              
              if (response.ok) {
                statusDiv.style.background = '#28a745';
                statusDiv.style.color = '#fff';
                statusDiv.textContent = '✓ Changes saved successfully!';
                
                // Update original values
                Object.assign(originalValues, updates);
                
                setTimeout(() => {
                  if (window.innerWidth > 768) {
                    panel.style.right = '-400px';
                  } else {
                    panel.style.bottom = '-100%';
                  }
                  statusDiv.style.display = 'none';
                }, 2000);
              } else {
                throw new Error('Failed to save');
              }
            } catch (error) {
              console.error('Save failed:', error);
              statusDiv.style.background = '#dc3545';
              statusDiv.style.color = '#fff';
              statusDiv.textContent = '✗ Failed to save changes. Please try again.';
            }
          };
        }
      })();
    </script>
  `;

  // Add the edit script to the HTML content
  const htmlWithEditScript = preview.html_content
    .replace('</body>', `${editScript}</body>`);

  // Render the HTML content with edit mode script
  return (
    <div style={{ width: '100%', height: '100vh', margin: 0, padding: 0 }}>
      <div 
        dangerouslySetInnerHTML={{ __html: htmlWithEditScript }}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
