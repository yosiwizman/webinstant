import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import PreviewClient from './PreviewClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PreviewPage({ params }: PageProps) {
  // Await params for Next.js 15
  const resolvedParams = await params
  const paramId = resolvedParams.id
  
  // First try to find by preview ID (UUID)
  let { data: previewData, error: fetchError } = await supabase
    .from('website_previews')
    .select('id, business_id, preview_url, html_content, template_used, slug')
    .eq('id', paramId)
    .single()

  // If not found by id, try by business_id (for backwards compatibility)
  if (fetchError || !previewData) {
    const result = await supabase
      .from('website_previews')
      .select('id, business_id, preview_url, html_content, template_used, slug')
      .eq('business_id', paramId)
      .single()
    
    previewData = result.data
    fetchError = result.error
  }

  if (fetchError || !previewData || !previewData.html_content) {
    notFound()
  }

  return <PreviewClient preview={previewData} id={paramId} />
}
