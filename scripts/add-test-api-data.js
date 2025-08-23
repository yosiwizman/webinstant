const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function addTestData() {
  const testData = [
    {
      service: 'openai',
      endpoint: '/v1/chat/completions',
      calls: 1,
      tokens: 150,
      cost: 0.003,
      created_at: new Date().toISOString()
    },
    {
      service: 'openai',
      endpoint: '/v1/embeddings',
      calls: 1,
      tokens: 50,
      cost: 0.001,
      created_at: new Date(Date.now() - 86400000).toISOString() // Yesterday
    },
    {
      service: 'anthropic',
      endpoint: '/v1/messages',
      calls: 1,
      tokens: 200,
      cost: 0.004,
      created_at: new Date(Date.now() - 172800000).toISOString() // 2 days ago
    }
  ]
  
  const { data, error } = await supabase
    .from('api_usage')
    .insert(testData)
  
  if (error) {
    console.error('Error adding test data:', error)
  } else {
    console.log('Test data added successfully!')
  }
}

addTestData()
