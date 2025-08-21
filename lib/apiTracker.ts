import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export interface APIUsageData {
  api_name: string;
  endpoint: string;
  tokens_used: number;
  cost: number;
  business_id?: string;
  timestamp?: string;
  success?: boolean;
  error_message?: string;
}

/**
 * Track API usage and costs in the database
 * @param apiName - Name of the API provider (together_ai, openai, anthropic, replicate, serpapi, resend)
 * @param endpoint - Specific endpoint or model used
 * @param tokens - Number of tokens used (or 1 for non-token based APIs)
 * @param businessId - Optional business ID for tracking per-business costs
 * @param success - Whether the API call was successful
 * @param errorMessage - Optional error message if the call failed
 */
export async function trackAPIUsage(
  apiName: string,
  endpoint: string,
  tokens: number,
  businessId?: string,
  success: boolean = true,
  errorMessage?: string
): Promise<number> {
  // Calculate actual cost based on provider
  const costs: { [key: string]: number } = {
    'together_ai': tokens * 0.0001,  // Actual Together AI pricing ($0.0001 per token)
    'openai': tokens * 0.002 / 1000,  // GPT-4 pricing ($0.002 per 1K tokens)
    'anthropic': tokens * 0.015 / 1000,  // Claude pricing ($0.015 per 1K tokens)
    'replicate': 0.01,  // Per image generation
    'serpapi': 0.01,  // Per search query
    'resend': 0.001,  // Per email sent
    'tinypng': 0.009  // Per image compression
  };
  
  const cost = costs[apiName] || 0;
  
  // Prepare usage data
  const usageData: APIUsageData = {
    api_name: apiName,
    endpoint,
    tokens_used: tokens,
    cost,
    business_id: businessId,
    timestamp: new Date().toISOString(),
    success,
    error_message: errorMessage
  };
  
  try {
    // Log to database
    const { error } = await supabase.from('api_usage').insert(usageData);
    
    if (error) {
      console.error('Failed to log API usage to database:', error);
    } else {
      // Log to console with color coding
      const statusIcon = success ? '✅' : '❌';
      const costColor = cost > 0.1 ? '\x1b[31m' : cost > 0.01 ? '\x1b[33m' : '\x1b[32m'; // Red for high, yellow for medium, green for low
      const resetColor = '\x1b[0m';
      
      console.log(`${statusIcon} API Usage: ${apiName}/${endpoint} - ${costColor}$${cost.toFixed(4)}${resetColor} (${tokens} tokens)${businessId ? ` [${businessId}]` : ''}`);
    }
  } catch (error) {
    console.error('Error tracking API usage:', error);
  }
  
  return cost;
}

/**
 * Get API usage statistics for a specific time period
 */
export async function getAPIUsageStats(
  startDate?: Date,
  endDate?: Date,
  apiName?: string,
  businessId?: string
) {
  let query = supabase
    .from('api_usage')
    .select('*');
  
  if (startDate) {
    query = query.gte('timestamp', startDate.toISOString());
  }
  
  if (endDate) {
    query = query.lte('timestamp', endDate.toISOString());
  }
  
  if (apiName) {
    query = query.eq('api_name', apiName);
  }
  
  if (businessId) {
    query = query.eq('business_id', businessId);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Failed to fetch API usage stats:', error);
    return null;
  }
  
  // Calculate totals
  const stats = {
    total_calls: data?.length || 0,
    total_cost: data?.reduce((sum, record) => sum + (record.cost || 0), 0) || 0,
    total_tokens: data?.reduce((sum, record) => sum + (record.tokens_used || 0), 0) || 0,
    by_api: {} as { [key: string]: { calls: number; cost: number; tokens: number } },
    success_rate: 0
  };
  
  // Group by API
  data?.forEach(record => {
    if (!stats.by_api[record.api_name]) {
      stats.by_api[record.api_name] = { calls: 0, cost: 0, tokens: 0 };
    }
    stats.by_api[record.api_name].calls++;
    stats.by_api[record.api_name].cost += record.cost || 0;
    stats.by_api[record.api_name].tokens += record.tokens_used || 0;
  });
  
  // Calculate success rate
  const successfulCalls = data?.filter(record => record.success !== false).length || 0;
  stats.success_rate = stats.total_calls > 0 ? (successfulCalls / stats.total_calls) * 100 : 0;
  
  return stats;
}

/**
 * Get daily API usage for dashboard charts
 */
export async function getDailyAPIUsage(days: number = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const { data, error } = await supabase
    .from('api_usage')
    .select('*')
    .gte('timestamp', startDate.toISOString())
    .order('timestamp', { ascending: true });
  
  if (error) {
    console.error('Failed to fetch daily API usage:', error);
    return null;
  }
  
  // Group by day
  const dailyUsage: { [key: string]: { date: string; cost: number; calls: number } } = {};
  
  data?.forEach(record => {
    const date = new Date(record.timestamp).toISOString().split('T')[0];
    if (!dailyUsage[date]) {
      dailyUsage[date] = { date, cost: 0, calls: 0 };
    }
    dailyUsage[date].cost += record.cost || 0;
    dailyUsage[date].calls++;
  });
  
  return Object.values(dailyUsage);
}

/**
 * Estimate tokens for text (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}
