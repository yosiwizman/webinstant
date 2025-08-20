'use client'

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
        onClick={() => console.log('Edit clicked for preview:', id)}
      >
        ✏️
      </button>
    </>
  )
}
