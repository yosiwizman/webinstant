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
  return (
    <div 
      dangerouslySetInnerHTML={{ __html: preview.html_content }}
      style={{ width: '100%', minHeight: '100vh' }}
    />
  )
}
