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

  // Add the edit mode script properly to the HTML content
  const htmlWithEditScript = preview.html_content
    .replace('</head>', '<script src="/edit-mode.js"></script></head>')
    .replace('<body', `<body data-preview-id="${id}"`)

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
