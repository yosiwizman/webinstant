(function() {
  'use strict';

  // Check if edit mode should be activated
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('edit') !== 'true') {
    return;
  }

  // Get preview ID from the script tag
  const scriptTag = document.currentScript || document.querySelector('script[src="/edit-mode.js"]');
  const previewId = scriptTag ? scriptTag.getAttribute('data-preview-id') : null;

  if (!previewId) {
    console.error('Edit mode: No preview ID found');
    return;
  }

  // Create styles for edit mode
  const style = document.createElement('style');
  style.textContent = `
    [data-editable] {
      position: relative;
      transition: background-color 0.2s ease;
    }
    
    [data-editable]:hover {
      background-color: rgba(59, 130, 246, 0.1) !important;
      outline: 2px dashed rgba(59, 130, 246, 0.5);
      outline-offset: 2px;
      cursor: pointer;
    }
    
    .edit-icon {
      position: absolute;
      top: -8px;
      right: -8px;
      width: 24px;
      height: 24px;
      background: #3b82f6;
      border-radius: 50%;
      display: none;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 10000;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    
    [data-editable]:hover .edit-icon {
      display: flex;
    }
    
    .edit-input {
      font: inherit;
      color: inherit;
      background: rgba(255, 255, 255, 0.95);
      border: 2px solid #3b82f6;
      padding: 4px 8px;
      border-radius: 4px;
      width: 100%;
      box-sizing: border-box;
      outline: none;
    }
    
    .edit-textarea {
      font: inherit;
      color: inherit;
      background: rgba(255, 255, 255, 0.95);
      border: 2px solid #3b82f6;
      padding: 4px 8px;
      border-radius: 4px;
      width: 100%;
      box-sizing: border-box;
      outline: none;
      resize: vertical;
      min-height: 60px;
    }
    
    .save-indicator {
      position: fixed;
      top: 20px;
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
      padding: 8px;
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
  banner.innerHTML = '✏️ Edit Mode Active - Click any highlighted text to edit';
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
  async function saveContent(element, newContent) {
    const fieldName = element.getAttribute('data-editable');
    
    try {
      const response = await fetch('/api/update-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          previewId: previewId,
          field: fieldName,
          content: newContent
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save');
      }

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
    // Skip if already being edited
    if (element.querySelector('.edit-input, .edit-textarea')) {
      return;
    }

    const originalContent = element.textContent.trim();
    const computedStyle = window.getComputedStyle(element);
    const isMultiline = element.offsetHeight > parseInt(computedStyle.lineHeight) * 1.5;

    // Create input element
    const input = document.createElement(isMultiline ? 'textarea' : 'input');
    input.className = isMultiline ? 'edit-textarea' : 'edit-input';
    input.value = originalContent;
    
    if (!isMultiline) {
      input.type = 'text';
    }

    // Store original HTML
    const originalHTML = element.innerHTML;

    // Replace content with input
    element.innerHTML = '';
    element.appendChild(input);
    input.focus();
    input.select();

    // Handle save on blur or enter
    const saveAndRestore = async () => {
      const newContent = input.value.trim();
      
      if (newContent !== originalContent) {
        const saved = await saveContent(element, newContent);
        if (saved) {
          element.innerHTML = newContent;
        } else {
          element.innerHTML = originalHTML;
        }
      } else {
        element.innerHTML = originalHTML;
      }
      
      // Re-add edit icon
      addEditIcon(element);
    };

    input.addEventListener('blur', saveAndRestore);
    
    if (!isMultiline) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          input.blur();
        } else if (e.key === 'Escape') {
          input.value = originalContent;
          input.blur();
        }
      });
    } else {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          input.value = originalContent;
          input.blur();
        }
      });
    }
  }

  // Add edit icon to element
  function addEditIcon(element) {
    // Skip if icon already exists
    if (element.querySelector('.edit-icon')) {
      return;
    }

    const icon = document.createElement('div');
    icon.className = 'edit-icon';
    icon.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    `;
    
    element.style.position = 'relative';
    element.appendChild(icon);
  }

  // Initialize edit mode
  function initEditMode() {
    // Find all editable elements
    const editableElements = document.querySelectorAll('[data-editable]');
    
    editableElements.forEach(element => {
      // Add edit icon
      addEditIcon(element);
      
      // Add click handler
      element.addEventListener('click', (e) => {
        // Don't trigger if clicking on the icon itself
        if (!e.target.closest('.edit-icon') && !e.target.closest('.edit-input') && !e.target.closest('.edit-textarea')) {
          e.preventDefault();
          e.stopPropagation();
          makeEditable(element);
        }
      });
    });

    console.log(`Edit mode activated: ${editableElements.length} editable elements found`);
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEditMode);
  } else {
    // DOM is already ready
    setTimeout(initEditMode, 100);
  }
})();
