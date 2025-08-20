import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client with service role for write operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
      .select('html_content, custom_edits')
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
        // More sophisticated replacement for hours
        const dayCapitalized = day.charAt(0).toUpperCase() + day.slice(1)
        // Match various formats: "Monday: 9-5", "Monday 9-5", etc.
        const dayPatterns = [
          new RegExp(`${dayCapitalized}[:\\s]+[^<\\n]*`, 'g'),
          new RegExp(`${day}[:\\s]+[^<\\n]*`, 'gi')
        ]
        
        for (const pattern of dayPatterns) {
          updatedHtml = updatedHtml.replace(pattern, (match: string) => {
            // Preserve any HTML tags in the match
            if (match.includes('<')) {
              const beforeTag = match.substring(0, match.indexOf('<'))
              const afterTag = match.substring(match.indexOf('<'))
              return `${dayCapitalized}: ${hours}${afterTag}`
            }
            return `${dayCapitalized}: ${hours}`
          })
        }
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

    // Merge existing custom_edits with new updates
    const existingEdits = preview.custom_edits || {}
    const mergedEdits = {
      ...existingEdits,
      ...updates,
      last_modified: new Date().toISOString()
    }

    // Log what we're about to save for debugging
    console.log('Updating preview with ID:', previewId)
    console.log('Updates to save:', mergedEdits)

    // Save the updated HTML and custom_edits back to the database
    const { error: updateError } = await supabase
      .from('website_previews')
      .update({ 
        html_content: updatedHtml,
        custom_edits: mergedEdits,
        last_edited_at: new Date().toISOString()
      })
      .eq('id', previewId)

    if (updateError) {
      console.error('Error updating preview:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update preview: ' + updateError.message },
        { status: 500 }
      )
    }

    // Try to log the update (non-critical, so we don't fail if this errors)
    try {
      // Check if preview_edits table exists before inserting
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
    } catch (logError) {
      console.log('Note: preview_edits table may not exist, skipping edit log:', logError)
    }

    return NextResponse.json({
      success: true,
      message: 'Preview updated successfully',
      updates: mergedEdits
    })

  } catch (error) {
    console.error('Error in preview update:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Preview update endpoint',
    method: 'POST',
    requiredFields: ['previewId', 'updates'],
    supportedUpdates: ['phone', 'hours', 'prices'],
    status: 'ready'
  })
}
