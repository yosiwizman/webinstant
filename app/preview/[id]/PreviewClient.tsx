'use client'

import { useState } from 'react'
import EditPanel from './EditPanel'

interface PreviewClientProps {
  preview: {
    id: string
    business_id: string
    preview_url: string
    html_content: string
    template_used: string
    slug: string
  }
  id: string
}

export default function PreviewClient({ preview, id }: PreviewClientProps) {
  // Strip DOCTYPE and html tags to fix hydration error
  const cleanHtml = preview.html_content
    .replace(/<!DOCTYPE.*?>/i, '')
    .replace(/<html.*?>/, '')
    .replace(/<\/html>/, '')

  const [showEditPanel, setShowEditPanel] = useState(false)

  // Extract business info from the HTML content
  const extractBusinessInfo = () => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(preview.html_content, 'text/html')
    
    // Try to extract business name from various possible locations
    const businessName = doc.querySelector('h1')?.textContent || 
                        doc.querySelector('.business-name')?.textContent || 
                        doc.querySelector('[data-field="businessName"]')?.textContent ||
                        'Business'
    
    // Try to extract business type from meta tags or content
    const businessType = doc.querySelector('meta[name="business-type"]')?.getAttribute('content') ||
                        doc.querySelector('[data-business-type]')?.getAttribute('data-business-type') ||
                        preview.template_used || 
                        'general'
    
    return { businessName, businessType }
  }

  const { businessName, businessType } = extractBusinessInfo()

  const handleSave = async (updates: any) => {
    try {
      const response = await fetch('/api/preview/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          previewId: id,
          businessId: preview.business_id,
          updates
        })
      })

      if (response.ok) {
        // Optionally reload the page to show updated content
        window.location.reload()
      }
    } catch (error) {
      console.error('Failed to save updates:', error)
    }
  }

  return (
    <>
      <div 
        dangerouslySetInnerHTML={{ __html: cleanHtml }}
        style={{ width: '100%', minHeight: '100vh' }}
      />
      <button 
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '60px',
          height: '60px',
          fontSize: '24px',
          cursor: 'pointer',
          zIndex: 1000,
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
        }}
        onClick={() => setShowEditPanel(true)}
      >
        ✏️
      </button>
      {showEditPanel && (
        <EditPanel 
          previewId={id}
          businessName={businessName}
          businessType={businessType}
          onClose={() => setShowEditPanel(false)}
          onSave={handleSave}
        />
      )}
    </>
  )
}
