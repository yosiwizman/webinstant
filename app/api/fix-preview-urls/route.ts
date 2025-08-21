import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST() {
  console.log('🔧 Starting preview URL fix process')
  console.log('================================================')
  
  try {
    // Query all records from the website_previews table
    const { data: previews, error: fetchError } = await supabase
      .from('website_previews')
      .select('id, preview_url, business_id')
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error('❌ Error fetching previews:', fetchError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to fetch previews', 
          details: fetchError.message 
        },
        { status: 500 }
      )
    }

    if (!previews || previews.length === 0) {
      console.log('ℹ️ No previews found to update')
      return NextResponse.json({
        success: true,
        message: 'No previews found to update',
        updated: 0,
        total: 0
      })
    }

    console.log(`📊 Found ${previews.length} previews to process`)

    let updatedCount = 0
    let skippedCount = 0
    let errorCount = 0
    const errors: string[] = []

    // Process each preview
    for (const preview of previews) {
      const newUrl = `http://localhost:3000/preview/${preview.id}`
      
      // Check if URL already matches the correct format
      if (preview.preview_url === newUrl) {
        console.log(`⏭️ Skipping preview ${preview.id} - URL already correct`)
        skippedCount++
        continue
      }

      console.log(`🔄 Updating preview ${preview.id}`)
      console.log(`   Old URL: ${preview.preview_url}`)
      console.log(`   New URL: ${newUrl}`)

      // Update the preview_url in the database
      const { error: updateError } = await supabase
        .from('website_previews')
        .update({ preview_url: newUrl })
        .eq('id', preview.id)

      if (updateError) {
        console.error(`❌ Error updating preview ${preview.id}:`, updateError)
        errors.push(`Preview ${preview.id}: ${updateError.message}`)
        errorCount++
      } else {
        console.log(`✅ Successfully updated preview ${preview.id}`)
        updatedCount++
      }

      // Also update the businesses table if it has a preview_url field
      if (preview.business_id) {
        const { error: businessUpdateError } = await supabase
          .from('businesses')
          .update({ preview_url: newUrl })
          .eq('id', preview.business_id)

        if (businessUpdateError) {
          console.log(`⚠️ Could not update business ${preview.business_id} preview_url:`, businessUpdateError.message)
          // Don't count this as a critical error, just log it
        } else {
          console.log(`✅ Also updated business ${preview.business_id} preview_url`)
        }
      }
    }

    console.log('\n📊 Final Results:')
    console.log(`   Total previews: ${previews.length}`)
    console.log(`   Updated: ${updatedCount}`)
    console.log(`   Skipped (already correct): ${skippedCount}`)
    console.log(`   Errors: ${errorCount}`)

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${updatedCount} preview URLs`,
      stats: {
        total: previews.length,
        updated: updatedCount,
        skipped: skippedCount,
        errors: errorCount
      },
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Unexpected error occurred', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Preview URL fix endpoint',
    description: 'Updates all preview URLs to use localhost:3000 format',
    method: 'POST',
    endpoint: '/api/fix-preview-urls',
    action: 'Will update all preview_url fields from fake domains to http://localhost:3000/preview/{id}',
    usage: 'Send a POST request to execute the fix'
  })
}
