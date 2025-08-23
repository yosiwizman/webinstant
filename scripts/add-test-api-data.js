const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function addTestData() {
  const testData = [
    {
      api_name: 'openai',
      endpoint: '/v1/chat/completions',
      tokens_used: 150,
      cost: 0.003,
      created_at: new Date().toISOString()
    },
    {
      api_name: 'openai',
      endpoint: '/v1/embeddings',
      tokens_used: 50,
      cost: 0.001,
      created_at: new Date(Date.now() - 86400000).toISOString() // Yesterday
    },
    {
      api_name: 'anthropic',
      endpoint: '/v1/messages',
      tokens_used: 200,
      cost: 0.004,
      created_at: new Date(Date.now() - 172800000).toISOString() // 2 days ago
    },
    {
      api_name: 'together_ai',
      endpoint: '/v1/chat/completions',
      tokens_used: 300,
      cost: 0.006,
      created_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
    },
    {
      api_name: 'replicate',
      endpoint: '/v1/predictions',
      tokens_used: 0,
      cost: 0.015,
      created_at: new Date(Date.now() - 7200000).toISOString() // 2 hours ago
    },
    {
      api_name: 'together_ai',
      endpoint: '/v1/chat/completions',
      tokens_used: 250,
      cost: 0.005,
      created_at: new Date(Date.now() - 259200000).toISOString() // 3 days ago
    },
    {
      api_name: 'openai',
      endpoint: '/v1/chat/completions',
      tokens_used: 180,
      cost: 0.0036,
      created_at: new Date(Date.now() - 345600000).toISOString() // 4 days ago
    },
    {
      api_name: 'anthropic',
      endpoint: '/v1/messages',
      tokens_used: 350,
      cost: 0.007,
      created_at: new Date(Date.now() - 432000000).toISOString() // 5 days ago
    },
    {
      api_name: 'replicate',
      endpoint: '/v1/predictions',
      tokens_used: 0,
      cost: 0.025,
      created_at: new Date(Date.now() - 518400000).toISOString() // 6 days ago
    },
    {
      api_name: 'together_ai',
      endpoint: '/v1/chat/completions',
      tokens_used: 400,
      cost: 0.008,
      created_at: new Date(Date.now() - 604800000).toISOString() // 7 days ago
    }
  ]
  
  console.log('Adding test data to api_usage table...')
  
  const { data, error } = await supabase
    .from('api_usage')
    .insert(testData)
  
  if (error) {
    console.error('Error adding test data:', error)
  } else {
    console.log('Test data added successfully!')
    console.log(`Added ${testData.length} records to api_usage table`)
    
    // Display summary
    const totalCost = testData.reduce((sum, item) => sum + item.cost, 0)
    const totalTokens = testData.reduce((sum, item) => sum + item.tokens_used, 0)
    console.log(`Total cost: $${totalCost.toFixed(4)}`)
    console.log(`Total tokens: ${totalTokens}`)
  }
  
  process.exit(0)
}

addTestData().catch(error => {
  console.error('Failed to add test data:', error)
  process.exit(1)
})
