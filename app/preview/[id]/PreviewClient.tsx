'use client'

import { useState } from 'react'

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
  const [showEditModal, setShowEditModal] = useState(false)

  // Strip DOCTYPE and html tags to fix hydration error
  const cleanHtml = preview.html_content
    .replace(/<!DOCTYPE.*?>/gi, '')
    .replace(/<html.*?>/gi, '')
    .replace(/<\/html>/gi, '')
    .replace(/<head.*?>/gi, '<div style="display:none">')
    .replace(/<\/head>/gi, '</div>')
    .replace(/<body.*?>/gi, '<div>')
    .replace(/<\/body>/gi, '</div>')
    .replace(/\s+charset=/g, ' data-charset=')
    .replace(/\s+http-equiv=/g, ' data-http-equiv=')

  // Fix broken images with placeholders
  const htmlWithFixedImages = cleanHtml.replace(
    /<img([^>]*?)src=["']([^"']*?)["']/gi,
    (match, attrs, src) => {
      if (!src || src.includes('undefined') || src.includes('null') || !src.startsWith('http')) {
        return `<img${attrs}src="https://via.placeholder.com/800x600/cccccc/666666?text=Image+Coming+Soon"`;
      }
      return match;
    }
  );

  return (
    <>
      <div 
        dangerouslySetInnerHTML={{ __html: htmlWithFixedImages }}
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
        onClick={() => setShowEditModal(true)}
      >
        ✏️
      </button>
      {showEditModal && (
        <>
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 9999
          }} onClick={() => setShowEditModal(false)} />
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
            zIndex: 10000,
            minWidth: '400px',
            maxWidth: '90vw'
          }}>
            <h2 style={{ margin: '0 0 20px 0', color: '#333' }}>Edit Options</h2>
            <p style={{ color: '#666', marginBottom: '20px' }}>Choose what you'd like to edit:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button style={{ padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                📞 Update Phone Number
              </button>
              <button style={{ padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                🕐 Update Business Hours
              </button>
              <button style={{ padding: '10px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                💰 Update Prices
              </button>
            </div>
            <button 
              onClick={() => setShowEditModal(false)}
              style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </>
      )}
    </>
  )
}
