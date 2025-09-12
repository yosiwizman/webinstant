'use client'

import { useEffect, useMemo, useState } from 'react'
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

export default function PreviewClient({ preview }: PreviewClientProps) {
  const [showEditModal, setShowEditModal] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [savedEdits, setSavedEdits] = useState<any>({})

  useEffect(() => { setMounted(true) }, [])

  const claimHref = useMemo(() => {
    const payLink = process.env.NEXT_PUBLIC_REVENUE_FIRST_PAYMENT_LINK_URL
    const useLink = !!process.env.NEXT_PUBLIC_REVENUE_FIRST_MODE || !!payLink
    if (useLink && payLink) return payLink
    return `/api/create-checkout-session?businessId=${preview.business_id}&previewId=${preview.id}`
  }, [preview.business_id, preview.id])

  const fixBrokenImages = (html: string) => {
    const placeholders = {
      hero: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&h=600&fit=crop',
      gallery: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=600&fit=crop',
      default: 'https://via.placeholder.com/800x600/0066cc/ffffff?text=Coming+Soon'
    };
    let fixedHtml = html.replace(
      /<img([^>]*?)src=["']([^"']*?)["']([^>]*?)>/gi,
      (match, before, src, after) => {
        if (!src || src === 'undefined' || src === 'null' || src.includes('undefined') || src.includes('null') || src.startsWith('/') || src.startsWith('../') || src.startsWith('./') || !src.startsWith('http')) {
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

  const cleanHtml = (preview.html_content || '')
    .replace(/<!DOCTYPE.*?>/gi, '')
    .replace(/<html.*?>/gi, '')
    .replace(/<\/html>/gi, '')
    .replace(/<head.*?>/gi, '<div style="display:none">')
    .replace(/<\/head>/gi, '</div>')
    .replace(/<body.*?>/gi, '<div>')
    .replace(/<\/body>/gi, '</div>')
    .replace(/\s+charset=/g, ' data-charset=')
    .replace(/\s+http-equiv=/g, ' data-http-equiv=')

  const htmlWithFixedImages = fixBrokenImages(cleanHtml)

  const safeStyle = { backgroundColor:'#fff', color:'#111' } as React.CSSProperties

  return (
    <div suppressHydrationWarning data-cta-href={claimHref}>
      {/* TOP BANNER - Claim Your Website */}
      {mounted && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, backgroundColor: '#28a745', color: 'white', padding: '15px', textAlign: 'center', zIndex: 1001, boxShadow: '0 2px 10px rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
            🎉 This is YOUR website! Ready to go live in 24 hours!
          </span>
          <a 
            href={claimHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{ backgroundColor: 'white', color: '#28a745', padding: '10px 30px', borderRadius: '25px', fontSize: '16px', fontWeight: 'bold', textDecoration: 'none', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', transition: 'transform 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            Claim Now - Only $150/year
          </a>
        </div>
      )}

      {/* Add padding to account for fixed banner */}
      <div style={{ paddingTop: '70px' }}>
        {/* Prefer iframe srcDoc if full HTML detected */}
        {/(<html[\s\S]*?>|<head[\s\S]*?>)/i.test(preview.html_content || '') ? (
          <iframe
            srcDoc={preview.html_content}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            className="w-full min-h-[1500px] bg-white"
          />
        ) : (
          <div
            dangerouslySetInnerHTML={{ __html: htmlWithFixedImages }}
            style={{ width: '100%', minHeight: '100vh', ...safeStyle }}
          />
        )}
      </div>

      {/* CLAIM YOUR WEBSITE BUTTON */}
      {mounted && (
        <a 
          href={claimHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#28a745', color: 'white', padding: '20px 40px', borderRadius: '50px', fontSize: '20px', fontWeight: 'bold', textDecoration: 'none', cursor: 'pointer', zIndex: 1000, boxShadow: '0 4px 20px rgba(40, 167, 69, 0.4)', animation: 'pulse 2s infinite', display: 'flex', alignItems: 'center', gap: '10px' }}
        >
          💰 Claim Your Website - Only $150
        </a>
      )}

      {/* Pulse animation */}
      <style jsx>{`
        @keyframes pulse {
          0% { box-shadow: 0 4px 20px rgba(40, 167, 69, 0.4); }
          50% { box-shadow: 0 4px 30px rgba(40, 167, 69, 0.6); }
          100% { box-shadow: 0 4px 20px rgba(40, 167, 69, 0.4); }
        }
      `}</style>

      {mounted && (
        <button 
          style={{ position: 'fixed', bottom: '20px', right: '20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '50%', width: '60px', height: '60px', fontSize: '24px', cursor: 'pointer', zIndex: 1000, boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}
          onClick={() => setShowEditModal(true)}
        >
          ✏️
        </button>
      )}

      {mounted && showEditModal && (
        <EditPanel
          businessName={document?.title || 'Business'}
          businessType={'general'}
          initialData={savedEdits}
          onClose={() => setShowEditModal(false)}
          onSave={async (updates) => {
            try {
              const res = await fetch('/api/preview/update', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ previewId: preview.id, businessId: preview.business_id, updates })
              })
              if (res.ok) {
                alert('Saved')
                // Merge into local saved edits so the modal reopens with current values
                setSavedEdits((prev: any) => ({ ...prev, ...updates }))
                setShowEditModal(false)
              }
            } catch (e) {}
          }}
        />
      )}
    </div>
  )
}
