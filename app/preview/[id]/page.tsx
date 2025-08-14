import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface PageProps {
  params: {
    id: string
  }
}

export default async function PreviewPage({ params }: PageProps) {
  console.log('Fetching preview with ID:', params.id)
  
  // Fetch the preview from the database
  const { data: preview, error } = await supabase
    .from('website_previews')
    .select('id, business_id, preview_url, html_content, template_used')
    .eq('id', params.id)
    .single()

  // Log for debugging
  if (error) {
    console.error('Error fetching preview:', error)
  }
  
  console.log('Preview data:', preview ? 'Found' : 'Not found')

  // If there's an error or no preview found, show not found message
  if (error || !preview || !preview.html_content) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Preview not found</h1>
          <p className="text-gray-600">The preview you're looking for doesn't exist or has been removed.</p>
          <p className="text-sm text-gray-500 mt-4">Preview ID: {params.id}</p>
        </div>
      </div>
    )
  }

  // Render the HTML content in an iframe-like container for better isolation
  return (
    <div style={{ width: '100%', height: '100vh', margin: 0, padding: 0 }}>
      <div 
        dangerouslySetInnerHTML={{ __html: preview.html_content }}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
