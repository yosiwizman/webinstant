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
  // Fetch the preview from the database
  const { data: preview, error } = await supabase
    .from('website_previews')
    .select('html_content')
    .eq('id', params.id)
    .single()

  // If there's an error or no preview found, show not found message
  if (error || !preview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Preview not found</h1>
          <p className="text-gray-600">The preview you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    )
  }

  // Render the HTML content
  return (
    <div 
      dangerouslySetInnerHTML={{ __html: preview.html_content }}
      className="min-h-screen"
    />
  )
}
