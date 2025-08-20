'use client'

import { useEffect, useState } from 'react'

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
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Only render HTML on client side to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Loading preview...</h1>
          <p className="text-gray-600">Please wait while we prepare your content.</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      dangerouslySetInnerHTML={{ __html: preview.html_content }}
      style={{ width: '100%', minHeight: '100vh' }}
    />
  )
}
