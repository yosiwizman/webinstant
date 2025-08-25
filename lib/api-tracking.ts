import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

interface ApiUsageData {
  service: string
  endpoint: string
  calls: number
  tokens: number
  cost: number
  metadata?: Record<string, unknown>
}

export async function trackApiUsage(data: ApiUsageData) {
  try {
    const { error } = await supabase
      .from('api_usage')
      .insert([{
        ...data,
        created_at: new Date().toISOString()
      }])
    
    if (error) {
      console.error('Failed to track API usage:', error)
    }
  } catch (err) {
    console.error('Error tracking API usage:', err)
  }
}

// Helper to calculate OpenAI costs
export function calculateOpenAICost(model: string, tokens: number): number {
  const rates: Record<string, number> = {
    'gpt-4': 0.03 / 1000,  // $0.03 per 1K tokens
    'gpt-3.5-turbo': 0.002 / 1000,  // $0.002 per 1K tokens
    'text-embedding-ada-002': 0.0001 / 1000  // $0.0001 per 1K tokens
  }
  
  return (rates[model] || 0) * tokens
}

// Helper to calculate Together AI costs
export function calculateTogetherAICost(model: string, tokens: number): number {
  const rates: Record<string, number> = {
    'meta-llama/Llama-3-70b-chat-hf': 0.0009 / 1000,  // $0.0009 per 1K tokens
    'meta-llama/Llama-3-8b-chat-hf': 0.0002 / 1000,   // $0.0002 per 1K tokens
    'mistralai/Mixtral-8x7B-Instruct-v0.1': 0.0006 / 1000,  // $0.0006 per 1K tokens
  }
  
  return (rates[model] || 0) * tokens
}

// Helper to calculate Anthropic costs
export function calculateAnthropicCost(model: string, tokens: number): number {
  const rates: Record<string, number> = {
    'claude-3-opus': 0.015 / 1000,     // $0.015 per 1K input tokens
    'claude-3-sonnet': 0.003 / 1000,   // $0.003 per 1K input tokens
    'claude-3-haiku': 0.00025 / 1000,  // $0.00025 per 1K input tokens
    'claude-2.1': 0.008 / 1000,        // $0.008 per 1K tokens
    'claude-2': 0.008 / 1000,          // $0.008 per 1K tokens
  }
  
  return (rates[model] || 0) * tokens
}

// Helper to calculate Replicate costs (per second of compute)
export function calculateReplicateCost(seconds: number): number {
  // Replicate charges approximately $0.0002 per second of compute
  const ratePerSecond = 0.0002
  return ratePerSecond * seconds
}

// Get usage statistics for a date range
export async function getApiUsageStats(startDate: Date, endDate: Date) {
  try {
    const { data, error } = await supabase
      .from('api_usage')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Failed to fetch API usage stats:', error)
      return null
    }
    
    return data
  } catch (err) {
    console.error('Error fetching API usage stats:', err)
    return null
  }
}

// Get aggregated usage by service
export async function getAggregatedUsageByService(startDate: Date, endDate: Date) {
  try {
    const data = await getApiUsageStats(startDate, endDate)
    
    if (!data) return null
    
    interface ServiceAggregation {
      service: string
      totalCalls: number
      totalTokens: number
      totalCost: number
      endpoints: Set<string>
    }
    
    const aggregated = data.reduce((acc: Record<string, ServiceAggregation>, item) => {
      if (!acc[item.service]) {
        acc[item.service] = {
          service: item.service,
          totalCalls: 0,
          totalTokens: 0,
          totalCost: 0,
          endpoints: new Set()
        }
      }
      
      acc[item.service].totalCalls += item.calls || 0
      acc[item.service].totalTokens += item.tokens || 0
      acc[item.service].totalCost += item.cost || 0
      acc[item.service].endpoints.add(item.endpoint)
      
      return acc
    }, {})
    
    // Convert Sets to arrays for the final output
    const result: Record<string, {
      service: string
      totalCalls: number
      totalTokens: number
      totalCost: number
      endpoints: string[]
    }> = {}
    
    Object.keys(aggregated).forEach(service => {
      result[service] = {
        ...aggregated[service],
        endpoints: Array.from(aggregated[service].endpoints)
      }
    })
    
    return result
  } catch (err) {
    console.error('Error aggregating usage by service:', err)
    return null
  }
}

// Get total costs for a date range
export async function getTotalCosts(startDate: Date, endDate: Date) {
  try {
    const data = await getApiUsageStats(startDate, endDate)
    
    if (!data) return 0
    
    return data.reduce((total, item) => total + (item.cost || 0), 0)
  } catch (err) {
    console.error('Error calculating total costs:', err)
    return 0
  }
}
