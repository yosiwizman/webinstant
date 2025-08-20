const { createClient } = require('@supabase/supabase-js')

// Update all businesses that have previews to has_website = true

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'your-supabase-url'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-supabase-anon-key'

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixHasWebsite() {
  console.log('🔧 Starting has_website fix process')
  console.log('================================================')
  
  try {
    // Step 1: Find all businesses that have a preview in website_previews table
    console.log('\n📋 Fetching businesses with website previews...')
    
    const { data: businessesWithPreviews, error: fetchError } = await supabase
      .from('website_previews')
      .select('business_id')
      .not('business_id', 'is', null)
    
    if (fetchError) {
      console.error('❌ Error fetching website previews:', fetchError)
      return
    }
    
    if (!businessesWithPreviews || businessesWithPreviews.length === 0) {
      console.log('ℹ️ No businesses with website previews found')
      return
    }
    
    // Get unique business IDs
    const uniqueBusinessIds = [...new Set(businessesWithPreviews.map(p => p.business_id))]
    console.log(`✅ Found ${uniqueBusinessIds.length} unique businesses with website previews`)
    
    // Step 2: Update businesses to set has_website = true
    console.log('\n🔄 Updating businesses...')
    
    const updateResults = []
    let successCount = 0
    let errorCount = 0
    
    for (const businessId of uniqueBusinessIds) {
      const { data: business, error: updateError } = await supabase
        .from('businesses')
        .update({ has_website: true })
        .eq('id', businessId)
        .select('id, business_name, has_website')
        .single()
      
      if (updateError) {
        console.error(`❌ Failed to update business ${businessId}:`, updateError.message)
        errorCount++
        updateResults.push({
          businessId,
          success: false,
          error: updateError.message
        })
      } else {
        console.log(`✅ Updated: ${business.business_name} (ID: ${business.id})`)
        successCount++
        updateResults.push({
          businessId: business.id,
          businessName: business.business_name,
          success: true,
          has_website: business.has_website
        })
      }
    }
    
    // Step 3: Summary report
    console.log('\n================================================')
    console.log('📊 UPDATE SUMMARY')
    console.log('================================================')
    console.log(`Total businesses with previews: ${uniqueBusinessIds.length}`)
    console.log(`Successfully updated: ${successCount}`)
    console.log(`Failed updates: ${errorCount}`)
    
    // List successful updates
    if (successCount > 0) {
      console.log('\n✅ Successfully updated businesses:')
      updateResults
        .filter(r => r.success)
        .forEach(r => {
          console.log(`   - ${r.businessName} (ID: ${r.businessId})`)
        })
    }
    
    // List failed updates
    if (errorCount > 0) {
      console.log('\n❌ Failed updates:')
      updateResults
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`   - Business ID ${r.businessId}: ${r.error}`)
        })
    }
    
    console.log('\n✨ Fix process completed!')
    
  } catch (error) {
    console.error('❌ Unexpected error during fix process:', error)
  }
}

// Run the fix
fixHasWebsite()
  .then(() => {
    console.log('\n👋 Script finished')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
