(function() {
  'use strict';

  // Check if edit mode should be activated
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('edit') !== 'true') {
    return;
  }

  // Get preview ID from body attribute or URL
  const previewId = document.body.getAttribute('data-preview-id') || 
                    window.location.pathname.split('/').pop();

  if (!previewId) {
    console.error('Edit mode: No preview ID found');
    return;
  }

  console.log('Edit mode activated for preview:', previewId);

  // Create styles for edit mode
  const style = document.createElement('style');
  style.textContent = `
    [data-editable] {
      position: relative;
      transition: all 0.2s ease;
      cursor: pointer !important;
    }
    
    [data-editable]:hover {
      background-color: rgba(59, 130, 246, 0.1) !important;
      outline: 2px dashed #3b82f6 !important;
      outline-offset: 2px;
    }
    
    .edit-mode-input {
      font: inherit;
      color: #000;
      background: #fff;
      border: 2px solid #3b82f6;
      padding: 4px 8px;
      border-radius: 4px;
      outline: none;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .save-indicator {
      position: fixed;
      top: 60px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      z-index: 10001;
      opacity: 0;
      transform: translateY(-10px);
      transition: all 0.3s ease;
    }
    
    .save-indicator.show {
      opacity: 1;
      transform: translateY(0);
    }
    
    .save-indicator.error {
      background: #ef4444;
    }
    
    .edit-mode-banner {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%);
      color: white;
      padding: 12px;
      text-align: center;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
  `;
  document.head.appendChild(style);

  // Create save indicator
  const saveIndicator = document.createElement('div');
  saveIndicator.className = 'save-indicator';
  saveIndicator.textContent = 'Saved!';
  document.body.appendChild(saveIndicator);

  // Create edit mode banner
  const banner = document.createElement('div');
  banner.className = 'edit-mode-banner';
  banner.innerHTML = '✏️ Edit Mode Active - Click any highlighted text to edit (prices, menu items, descriptions, etc.)';
  document.body.appendChild(banner);

  // Show save indicator
  function showSaveIndicator(success = true, message = null) {
    saveIndicator.textContent = message || (success ? '✓ Saved!' : '✗ Save failed');
    saveIndicator.className = success ? 'save-indicator show' : 'save-indicator show error';
    setTimeout(() => {
      saveIndicator.classList.remove('show');
    }, 2000);
  }

  // Save content to API
  async function saveContent(field, newContent) {
    try {
      const response = await fetch('/api/save-edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          previewId: previewId,
          field: field,
          value: newContent
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save');
      }

      const data = await response.json();
      console.log('Saved successfully:', field, newContent);
      showSaveIndicator(true);
      return true;
    } catch (error) {
      console.error('Error saving content:', error);
      showSaveIndicator(false);
      return false;
    }
  }

  // Make element editable
  function makeEditable(element) {
    // Prevent multiple edits at once
    if (element.querySelector('.edit-mode-input')) {
      return;
    }

    const originalContent = element.textContent.trim();
    const field = element.getAttribute('data-field') || element.getAttribute('data-editable');
    
    // Create input element
    const input = document.createElement('input');
    input.className = 'edit-mode-input';
    input.type = 'text';
    input.value = originalContent;
    
    // Match the width of the original element
    const elementWidth = element.offsetWidth;
    input.style.width = Math.max(elementWidth, 100) + 'px';
    
    // Store original HTML
    const originalHTML = element.innerHTML;

    // Replace content with input
    element.innerHTML = '';
    element.appendChild(input);
    input.focus();
    input.select();

    // Handle save
    const saveAndRestore = async () => {
      const newContent = input.value.trim();
      
      if (newContent !== originalContent && newContent !== '') {
        const saved = await saveContent(field, newContent);
        if (saved) {
          element.textContent = newContent;
        } else {
          element.innerHTML = originalHTML;
        }
      } else {
        element.innerHTML = originalHTML;
      }
    };

    // Save on blur
    input.addEventListener('blur', saveAndRestore);
    
    // Save on Enter, cancel on Escape
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      } else if (e.key === 'Escape') {
        input.value = originalContent;
        input.blur();
      }
    });
  }

  // Initialize edit mode
  function initEditMode() {
    // Find all editable elements
    let editableElements = document.querySelectorAll('[data-editable], [data-field]');
    
    console.log(`Found ${editableElements.length} editable elements`);
    
    // If no elements found, try searching for prices and menu items directly
    if (editableElements.length === 0) {
      console.log('No editable elements found, searching for price elements...');
      
      // Find all elements containing $ followed by numbers
      const priceElements = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent.match(/^\$\d+/) && el.children.length === 0
      );
      
      console.log(`Found ${priceElements.length} price elements`);
      
      priceElements.forEach((el, i) => {
        el.setAttribute('data-editable', 'price');
        el.setAttribute('data-field', `price-${i+1}`);
      });
      
      // Re-query for editable elements
      editableElements = document.querySelectorAll('[data-editable], [data-field]');
    }
    
    console.log(`Total editable elements after search: ${editableElements.length}`);
    
    editableElements.forEach(element => {
      // Remove any existing event listeners by cloning
      const newElement = element.cloneNode(true);
      element.parentNode.replaceChild(newElement, element);
      
      // Add click handler
      newElement.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        makeEditable(newElement);
      });
    });

    // Also add body padding to account for the banner
    document.body.style.paddingTop = '50px';
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEditMode);
  } else {
    // DOM is already ready, wait a bit for dynamic content
    setTimeout(initEditMode, 100);
  }
})();
