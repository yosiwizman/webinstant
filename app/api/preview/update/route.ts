import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { previewId, businessId, updates } = body

    console.log('Updating preview:', { previewId, businessId, updates })

    if (!previewId || !updates) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get the current preview
    const { data: preview, error: fetchError } = await supabase
      .from('website_previews')
      .select('html_content')
      .eq('id', previewId)
      .single()

    if (fetchError || !preview) {
      console.error('Error fetching preview:', fetchError)
      return NextResponse.json(
        { success: false, error: 'Preview not found' },
        { status: 404 }
      )
    }

    // Apply updates to HTML content
    let updatedHtml = preview.html_content

    // Update phone number
    if (updates.phone) {
      const phoneRegex = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g
      updatedHtml = updatedHtml.replace(phoneRegex, updates.phone)
    }

    // Update hours
    if (updates.hours) {
      for (const [day, hours] of Object.entries(updates.hours)) {
        // This is a simplified approach - in production you'd want more sophisticated HTML parsing
        const dayRegex = new RegExp(`${day}[^<]*`, 'gi')
        updatedHtml = updatedHtml.replace(dayRegex, (match) => {
          // Try to preserve the day name and just update the hours
          return `${day.charAt(0).toUpperCase() + day.slice(1)}: ${hours}`
        })
      }
    }

    // Update prices
    if (updates.prices && Array.isArray(updates.prices)) {
      updates.prices.forEach((priceUpdate: any) => {
        if (priceUpdate.old && priceUpdate.new) {
          // Escape special regex characters in price
          const escapedOld = priceUpdate.old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const priceRegex = new RegExp(escapedOld, 'g')
          updatedHtml = updatedHtml.replace(priceRegex, priceUpdate.new)
        }
      })
    }

    // Save the updated HTML back to the database
    const { error: updateError } = await supabase
      .from('website_previews')
      .update({ 
        html_content: updatedHtml,
        updated_at: new Date().toISOString()
      })
      .eq('id', previewId)

    if (updateError) {
      console.error('Error updating preview:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update preview' },
        { status: 500 }
      )
    }

    // Log the update
    await supabase
      .from('preview_edits')
      .insert({
        preview_id: previewId,
        business_id: businessId,
        updates: updates,
        created_at: new Date().toISOString()
      })
      .select()
      .single()
      .catch(err => console.log('Failed to log edit:', err))

    return NextResponse.json({
      success: true,
      message: 'Preview updated successfully',
      updates: updates
    })

  } catch (error) {
    console.error('Error in preview update:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Preview update endpoint',
    method: 'POST',
    requiredFields: ['previewId', 'updates'],
    supportedUpdates: ['phone', 'hours', 'prices']
  })
}
