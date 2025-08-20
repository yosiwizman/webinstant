import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import PreviewClient from './PreviewClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PreviewPage({ params }: PageProps) {
  console.log('🔍 Preview page loading...')
  
  // Await params for Next.js 15
  const resolvedParams = await params
  const paramId = resolvedParams.id
  
  console.log('📋 Requested preview ID:', paramId)
  
  // First try to find by preview ID (UUID)
  console.log('🔎 Attempting to fetch by preview ID (UUID)...')
  console.log('   Query: website_previews.id =', paramId)
  
  let { data: previewData, error: fetchError } = await supabase
    .from('website_previews')
    .select('id, business_id, preview_url, html_content, template_used, slug')
    .eq('id', paramId)
    .single()

  console.log('   Result:', {
    found: !!previewData,
    error: fetchError?.message || 'none',
    dataKeys: previewData ? Object.keys(previewData) : []
  })

  // If not found by id, try by business_id (for backwards compatibility)
  if (fetchError || !previewData) {
    console.log('🔄 Not found by preview ID, trying by business_id...')
    console.log('   Query: website_previews.business_id =', paramId)
    
    const result = await supabase
      .from('website_previews')
      .select('id, business_id, preview_url, html_content, template_used, slug')
      .eq('business_id', paramId)
      .single()
    
    previewData = result.data
    fetchError = result.error
    
    console.log('   Result:', {
      found: !!previewData,
      error: fetchError?.message || 'none',
      dataKeys: previewData ? Object.keys(previewData) : []
    })
  }

  // Check for errors or missing data
  if (fetchError) {
    console.error('❌ Supabase error:', fetchError)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Database Error</h2>
            <p className="text-gray-600 mb-4">There was an error loading the preview:</p>
            <div className="bg-red-50 border border-red-200 rounded-md p-4 text-left">
              <p className="text-sm text-red-800 font-mono">{fetchError.message}</p>
            </div>
            <p className="text-sm text-gray-500 mt-4">Error Code: {fetchError.code || 'Unknown'}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!previewData) {
    console.warn('⚠️ No preview data found for ID:', paramId)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-yellow-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Preview Not Found</h2>
            <p className="text-gray-600 mb-4">No preview found for ID:</p>
            <div className="bg-gray-100 rounded-md px-4 py-2 mb-4">
              <code className="text-sm font-mono text-gray-800">{paramId}</code>
            </div>
            <p className="text-sm text-gray-500">This preview may have been deleted or the link may be incorrect.</p>
          </div>
        </div>
      </div>
    )
  }

  if (!previewData.html_content) {
    console.warn('⚠️ Preview found but has no HTML content:', {
      id: previewData.id,
      business_id: previewData.business_id,
      has_url: !!previewData.preview_url,
      template: previewData.template_used
    })
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-yellow-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Preview Incomplete</h2>
            <p className="text-gray-600 mb-4">This preview exists but has no content to display.</p>
            <div className="bg-gray-100 rounded-md p-4 text-left text-sm">
              <p><strong>Preview ID:</strong> {previewData.id}</p>
              <p><strong>Business ID:</strong> {previewData.business_id}</p>
              {previewData.template_used && <p><strong>Template:</strong> {previewData.template_used}</p>}
            </div>
            <p className="text-sm text-gray-500 mt-4">The preview may still be generating. Please try again later.</p>
          </div>
        </div>
      </div>
    )
  }

  console.log('✅ Preview loaded successfully:', {
    id: previewData.id,
    business_id: previewData.business_id,
    content_length: previewData.html_content.length,
    template: previewData.template_used,
    has_slug: !!previewData.slug
  })

  return <PreviewClient preview={previewData} id={paramId} />
}
