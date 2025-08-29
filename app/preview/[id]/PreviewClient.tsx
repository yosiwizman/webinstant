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

export default function PreviewClient({ preview }: PreviewClientProps) {
  const [showEditModal, setShowEditModal] = useState(false)

  const fixBrokenImages = (html: string) => {
    // Define placeholder images for different types
    const placeholders = {
      hero: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&h=600&fit=crop',
      gallery: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=600&fit=crop',
      default: 'https://via.placeholder.com/800x600/0066cc/ffffff?text=Coming+Soon'
    };
    
    // Fix all broken image sources
    let fixedHtml = html.replace(
      /<img([^>]*?)src=["']([^"']*?)["']([^>]*?)>/gi,
      (match, before, src, after) => {
        // Check if image URL is broken
        if (!src || 
            src === 'undefined' || 
            src === 'null' || 
            src.includes('undefined') ||
            src.includes('null') ||
            src.startsWith('/') ||
            src.startsWith('../') ||
            src.startsWith('./') ||
            !src.startsWith('http')) {
          
          // Determine which placeholder to use based on context
          let placeholder = placeholders.default;
          if (before.includes('hero') || after.includes('hero')) {
            placeholder = placeholders.hero;
          } else if (before.includes('gallery') || after.includes('gallery')) {
            placeholder = placeholders.gallery;
          }
          
          return `<img${before}src="${placeholder}"${after}>`;
        }
        return match;
      }
    );
    
    // Also fix background images in style attributes
    fixedHtml = fixedHtml.replace(
      /background-image:\s*url\(['"]?([^'")]+)['"]?\)/gi,
      (match, url) => {
        if (!url || url === 'undefined' || url === 'null' || !url.startsWith('http')) {
          return `background-image: url('${placeholders.hero}')`;
        }
        return match;
      }
    );
    
    return fixedHtml;
  };

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

  // Fix broken images with the improved function
  const htmlWithFixedImages = fixBrokenImages(cleanHtml);

  return (
    <>
      {/* TOP BANNER - Claim Your Website */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: '#28a745',
        color: 'white',
        padding: '15px',
        textAlign: 'center',
        zIndex: 1001,
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '20px',
        flexWrap: 'wrap'
      }}>
        <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
          🎉 This is YOUR website! Ready to go live in 24 hours!
        </span>
        <a 
          href={`/claim/${preview.business_id}`}
          style={{
            backgroundColor: 'white',
            color: '#28a745',
            padding: '10px 30px',
            borderRadius: '25px',
            fontSize: '16px',
            fontWeight: 'bold',
            textDecoration: 'none',
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            transition: 'transform 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          Claim Now - Only $150/year
        </a>
      </div>
      
      {/* Add padding to account for fixed banner */}
      <div style={{ paddingTop: '70px' }}>
        <div 
          dangerouslySetInnerHTML={{ __html: htmlWithFixedImages }}
          style={{ width: '100%', minHeight: '100vh' }}
          suppressHydrationWarning={true}
        />
      </div>
      
      {/* CLAIM YOUR WEBSITE BUTTON - This is what business owners see! */}
      <a 
        href={`/claim/${preview.business_id}`}
        style={{
          position: 'fixed',
          bottom: '30px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#28a745',
          color: 'white',
          padding: '20px 40px',
          borderRadius: '50px',
          fontSize: '20px',
          fontWeight: 'bold',
          textDecoration: 'none',
          cursor: 'pointer',
          zIndex: 1000,
          boxShadow: '0 4px 20px rgba(40, 167, 69, 0.4)',
          animation: 'pulse 2s infinite',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}
      >
        💰 Claim Your Website - Only $150
      </a>
      
      {/* Pulse animation */}
      <style jsx>{`
        @keyframes pulse {
          0% {
            box-shadow: 0 4px 20px rgba(40, 167, 69, 0.4);
          }
          50% {
            box-shadow: 0 4px 30px rgba(40, 167, 69, 0.6);
          }
          100% {
            box-shadow: 0 4px 20px rgba(40, 167, 69, 0.4);
          }
        }
      `}</style>
      
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
            <p style={{ color: '#666', marginBottom: '20px' }}>Choose what you&apos;d like to edit:</p>
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
