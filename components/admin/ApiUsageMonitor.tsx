'use client'
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getBrowserSupabase } from '@/lib/supabaseClient'
import { AlertCircle, TrendingUp, DollarSign, Activity } from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts'
import { adminStyles, DataCache, formatters } from '@/lib/admin-utils'

interface ApiUsageData {
  id: string
  api_name: string
  endpoint: string
  tokens_used: number
  cost: number
  business_id: string
  business_name?: string
  created_at: string
}

interface ApiUsageStats {
  provider: string
  totalSpentToday: number
  totalSpentMonth: number
  callsToday: number
  callsMonth: number
  color: string
  bgColor: string
}

interface DailyUsage {
  date: string
  together_ai: number
  openai: number
  replicate: number
  anthropic: number
  total: number
}

interface PieChartData {
  name: string
  value: number
  color: string
}

type ProviderKey = 'together_ai' | 'openai' | 'replicate' | 'anthropic'

interface ProviderStats {
  today: number
  month: number
  callsToday: number
  callsMonth: number
  color: string
  bgColor: string
  displayName: string
}

interface ApiUsageRecord {
  id: string
  api_name: string
  endpoint: string
  tokens_used: number
  cost: number
  business_id: string
  created_at: string
}

// Initialize cache
const dataCache = new DataCache<{
  apiUsageStats: ApiUsageStats[]
  usageHistory: ApiUsageData[]
  dailyTrend: DailyUsage[]
  pieChartData: PieChartData[]
  totalSpentToday: number
  totalSpentMonth: number
  totalCallsToday: number
  totalCallsMonth: number
  hasData: boolean
}>(5) // 5 minute cache

export default function ApiUsageMonitor() {
  const supabase: any = getBrowserSupabase()
  const [apiUsageStats, setApiUsageStats] = useState<ApiUsageStats[]>([])
  const [usageHistory, setUsageHistory] = useState<ApiUsageData[]>([])
  const [dailyTrend, setDailyTrend] = useState<DailyUsage[]>([])
  const [pieChartData, setPieChartData] = useState<PieChartData[]>([])
  const [loading, setLoading] = useState(true)
  const [totalSpentToday, setTotalSpentToday] = useState(0)
  const [totalSpentMonth, setTotalSpentMonth] = useState(0)
  const [totalCallsToday, setTotalCallsToday] = useState(0)
  const [totalCallsMonth, setTotalCallsMonth] = useState(0)
  const [hasData, setHasData] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasFetched = useRef(false)

  const fetchApiUsageData = useCallback(async () => {
    // Check cache first
    const cached = dataCache.get('api-usage')
    if (cached) {
      setApiUsageStats(cached.apiUsageStats)
      setUsageHistory(cached.usageHistory)
      setDailyTrend(cached.dailyTrend)
      setPieChartData(cached.pieChartData)
      setTotalSpentToday(cached.totalSpentToday)
      setTotalSpentMonth(cached.totalSpentMonth)
      setTotalCallsToday(cached.totalCallsToday)
      setTotalCallsMonth(cached.totalCallsMonth)
      setHasData(cached.hasData)
      setLoading(false)
      return
    }

    try {
      setError(null)
      
      // Get today's date and start of month
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      const startOfMonthISO = startOfMonth.toISOString()

      // First check if we have any data in the api_usage table
      const { count: totalCount, error: countError } = await supabase
        .from('api_usage')
        .select('*', { count: 'exact', head: true })

      if (countError) {
        console.error('Error checking api_usage table:', countError)
        throw countError
      }

      // If no data exists yet
      if (totalCount === 0) {
        setHasData(false)
        const defaultStats = createDefaultStats()
        setApiUsageStats(defaultStats)
        setUsageHistory([])
        setDailyTrend([])
        setPieChartData([])
        setTotalSpentToday(0)
        setTotalSpentMonth(0)
        setTotalCallsToday(0)
        setTotalCallsMonth(0)
        setLoading(false)
        return
      }

      // Fetch all usage data for the month from real api_usage table
      const { data: monthlyUsage, error: monthlyError } = await supabase
        .from('api_usage')
        .select('*')
        .gte('created_at', startOfMonthISO)
        .order('created_at', { ascending: false })

      if (monthlyError) {
        console.error('Error fetching monthly usage:', monthlyError)
        throw monthlyError
      }

      const currentHasData =monthlyUsage && monthlyUsage.length > 0
      setHasData(currentHasData)

      if (currentHasData) {
        // Process real data from api_usage table
        const providerStats = processProviderStats(monthlyUsage as ApiUsageRecord[], today)
        
        // Calculate totals from real data
        let todayTotal = 0
        let monthTotal = 0
        let callsTodayTotal = 0
        let callsMonthTotal = 0

        Object.values(providerStats).forEach(stats => {
          todayTotal += stats.today
          monthTotal += stats.month
          callsTodayTotal += stats.callsToday
          callsMonthTotal += stats.callsMonth
        })

        setTotalSpentToday(todayTotal)
        setTotalSpentMonth(monthTotal)
        setTotalCallsToday(callsTodayTotal)
        setTotalCallsMonth(callsMonthTotal)

        // Create usage stats from real data
        const usageStats = createUsageStats(providerStats)
        setApiUsageStats(usageStats)

        // Create pie chart data from real usage
        const pieData = createPieChartData(providerStats)
        setPieChartData(pieData)

        // Fetch and process daily trend data
        const dailyData = await fetchDailyTrend()
        setDailyTrend(dailyData)

        // Cache the processed data
        dataCache.set('api-usage', {
          apiUsageStats: usageStats,
          usageHistory: [],
          dailyTrend: dailyData,
          pieChartData: pieData,
          totalSpentToday: todayTotal,
          totalSpentMonth: monthTotal,
          totalCallsToday: callsTodayTotal,
          totalCallsMonth: callsMonthTotal,
          hasData: currentHasData
        })
      }

      // Fetch usage history from real api_usage table
      const { data: historyData, error: historyError } = await supabase
        .from('api_usage')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (historyError) {
        console.error('Error fetching usage history:', historyError)
        setUsageHistory([])
      } else if (historyData) {
        // Process real usage history
        const processedHistory = await processUsageHistory(historyData as ApiUsageRecord[])
        setUsageHistory(processedHistory)
        
        // Update cache with history data
        const currentCached = dataCache.get('api-usage')
        if (currentCached) {
          dataCache.set('api-usage', {
            ...currentCached,
            usageHistory: processedHistory
          })
        }
      }

      setLoading(false)
    } catch (error) {
      console.error('Error in fetchApiUsageData:', error)
      setError('Unable to load API usage data')
      setHasData(false)
      
      // Set default state on error
      const defaultStats = createDefaultStats()
      setApiUsageStats(defaultStats)
      setUsageHistory([])
      setDailyTrend([])
      setPieChartData([])
      setTotalSpentToday(0)
      setTotalSpentMonth(0)
      setTotalCallsToday(0)
      setTotalCallsMonth(0)
      setLoading(false)
    }
  }, [])

  // Helper function to create default stats
  const createDefaultStats = (): ApiUsageStats[] => {
    return [
      {
        provider: 'Together AI',
        totalSpentToday: 0,
        totalSpentMonth: 0,
        callsToday: 0,
        callsMonth: 0,
        color: '#8B5CF6',
        bgColor: 'bg-purple-500'
      },
      {
        provider: 'OpenAI',
        totalSpentToday: 0,
        totalSpentMonth: 0,
        callsToday: 0,
        callsMonth: 0,
        color: '#10B981',
        bgColor: 'bg-green-500'
      },
      {
        provider: 'Replicate',
        totalSpentToday: 0,
        totalSpentMonth: 0,
        callsToday: 0,
        callsMonth: 0,
        color: '#3B82F6',
        bgColor: 'bg-blue-500'
      },
      {
        provider: 'Anthropic',
        totalSpentToday: 0,
        totalSpentMonth: 0,
        callsToday: 0,
        callsMonth: 0,
        color: '#F59E0B',
        bgColor: 'bg-amber-500'
      }
    ]
  }

  // Helper function to process provider stats from real data
  const processProviderStats = (monthlyUsage: ApiUsageRecord[], today: Date): Record<ProviderKey, ProviderStats> => {
    const providerStats: Record<ProviderKey, ProviderStats> = {
      'together_ai': {
        today: 0,
        month: 0,
        callsToday: 0,
        callsMonth: 0,
        color: '#8B5CF6',
        bgColor: 'bg-purple-500',
        displayName: 'Together AI'
      },
      'openai': {
        today: 0,
        month: 0,
        callsToday: 0,
        callsMonth: 0,
        color: '#10B981',
        bgColor: 'bg-green-500',
        displayName: 'OpenAI'
      },
      'replicate': {
        today: 0,
        month: 0,
        callsToday: 0,
        callsMonth: 0,
        color: '#3B82F6',
        bgColor: 'bg-blue-500',
        displayName: 'Replicate'
      },
      'anthropic': {
        today: 0,
        month: 0,
        callsToday: 0,
        callsMonth: 0,
        color: '#F59E0B',
        bgColor: 'bg-amber-500',
        displayName: 'Anthropic'
      }
    }

    // Process real usage data
    monthlyUsage.forEach(item => {
      const provider = item.api_name?.toLowerCase() as ProviderKey | undefined
      const cost = item.cost || 0
      const itemDate = new Date(item.created_at)

      if (provider && provider in providerStats) {
        providerStats[provider].month += cost
        providerStats[provider].callsMonth += 1

        // Check if it's today's usage
        if (itemDate >= today) {
          providerStats[provider].today += cost
          providerStats[provider].callsToday += 1
        }
      }
    })

    return providerStats
  }

  // Helper function to create usage stats
  const createUsageStats = (
    providerStats: Record<ProviderKey, ProviderStats>
  ): ApiUsageStats[] => {
    return (Object.entries(providerStats) as [ProviderKey, ProviderStats][]).map(([, stats]) => ({
      provider: stats.displayName,
      totalSpentToday: stats.today,
      totalSpentMonth: stats.month,
      callsToday: stats.callsToday,
      callsMonth: stats.callsMonth,
      color: stats.color,
      bgColor: stats.bgColor
    }))
  }

  // Helper function to create pie chart data
  const createPieChartData = (providerStats: Record<ProviderKey, ProviderStats>): PieChartData[] => {
    return (Object.entries(providerStats) as [ProviderKey, ProviderStats][])
      .filter(([, stats]) => stats.today > 0)
      .map(([, stats]) => ({
        name: stats.displayName,
        value: parseFloat(stats.today.toFixed(4)),
        color: stats.color
      }))
  }

  // Helper function to fetch daily trend
  const fetchDailyTrend = async (): Promise<DailyUsage[]> => {
    const last7Days = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      last7Days.push(date)
    }

    const sevenDaysAgo = last7Days[0].toISOString()
    const { data: weeklyUsage, error: weeklyError } = await supabase
      .from('api_usage')
      .select('*')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: true })

    if (weeklyError || !weeklyUsage) {
      console.error('Error fetching weekly usage:', weeklyError)
      return []
    }

    // Group by day and provider
    return last7Days.map(date => {
      const nextDay = new Date(date)
      nextDay.setDate(nextDay.getDate() + 1)

      const dayUsage = (weeklyUsage as ApiUsageRecord[]).filter(item => {
        const itemDate = new Date(item.created_at)
        return itemDate >= date && itemDate < nextDay
      })

      const dayTotals: DailyUsage = {
        date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        together_ai: 0,
        openai: 0,
        replicate: 0,
        anthropic: 0,
        total: 0
      }

      dayUsage.forEach(item => {
        const provider = item.api_name?.toLowerCase() as ProviderKey | undefined
        const cost = item.cost || 0

        if (provider && provider in dayTotals) {
          dayTotals[provider] += cost
        }
        dayTotals.total += cost
      })

      // Round to 4 decimal places
      Object.keys(dayTotals).forEach(key => {
        if (key !== 'date') {
          const numKey = key as keyof Omit<DailyUsage, 'date'>
          dayTotals[numKey] = parseFloat(dayTotals[numKey].toFixed(4))
        }
      })

      return dayTotals
    })
  }

  // Helper function to process usage history
  const processUsageHistory = async (historyData: ApiUsageRecord[]): Promise<ApiUsageData[]> => {
    // Get business names if available
    const businessIds = [...new Set(historyData.map(item => item.business_id).filter(Boolean))]
    
    let businessMap: Record<string, string> = {}
    if (businessIds.length > 0) {
      const { data: businesses } = await supabase
        .from('businesses')
        .select('id, business_name')
        .in('id', businessIds)
      
      if (businesses) {
        businessMap = (businesses as any).reduce((acc: any, b: any) => {
          acc[b.id] = b.business_name
          return acc
        }, {} as Record<string, string>)
      }
    }

    return historyData.map(item => ({
      ...item,
      business_name: businessMap[item.business_id] || 'Business ' + (item.business_id ? item.business_id.substring(0, 8) : 'Unknown')
    }))
  }

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true
      fetchApiUsageData()
    }
  }, [fetchApiUsageData])

  const getProviderBgClass = (provider: string) => {
    const classes: Record<string, string> = {
      'together_ai': 'bg-purple-100 dark:bg-purple-900/30',
      'openai': 'bg-green-100 dark:bg-green-900/30',
      'replicate': 'bg-blue-100 dark:bg-blue-900/30',
      'anthropic': 'bg-amber-100 dark:bg-amber-900/30'
    }
    return classes[provider?.toLowerCase()] || 'bg-gray-100 dark:bg-gray-800'
  }

  const getProviderTextClass = (provider: string) => {
    const classes: Record<string, string> = {
      'together_ai': 'text-purple-700 dark:text-purple-400',
      'openai': 'text-green-700 dark:text-green-400',
      'replicate': 'text-blue-700 dark:text-blue-400',
      'anthropic': 'text-amber-700 dark:text-amber-400'
    }
    return classes[provider?.toLowerCase()] || 'text-gray-700 dark:text-gray-300'
  }

  const getProviderDisplayName = (provider: string) => {
    const names: Record<string, string> = {
      'together_ai': 'Together AI',
      'openai': 'OpenAI',
      'replicate': 'Replicate',
      'anthropic': 'Anthropic'
    }
    return names[provider?.toLowerCase()] || provider
  }

  const hasHighDailySpend = totalSpentToday > 50

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={adminStyles.card}>
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">Error Loading API Usage</h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{error}</p>
          <button
            onClick={fetchApiUsageData}
            className={`mt-4 ${adminStyles.buttonPrimary}`}
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className={adminStyles.card + " p-12"}>
        <div className="text-center">
          <Activity className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No API Usage Recorded Yet</h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            API usage data will appear here once you start generating websites and sending emails.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 max-w-md mx-auto">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className={adminStyles.label}>Today&apos;s Cost</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">$0.00</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className={adminStyles.label}>Month&apos;s Cost</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">$0.00</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Alerts Section */}
      {hasHighDailySpend && (
        <div className={adminStyles.alertWarning}>
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">High Usage Warning</h3>
              <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-400">
                Daily API spend has exceeded $50 (${totalSpentToday.toFixed(2)}). Monitor usage to control costs.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={adminStyles.card}>
          <h3 className={adminStyles.label + " mb-2"}>Today&apos;s Total Cost</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">${totalSpentToday.toFixed(4)}</p>
        </div>
        <div className={adminStyles.card}>
          <h3 className={adminStyles.label + " mb-2"}>Month&apos;s Total Cost</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">${totalSpentMonth.toFixed(4)}</p>
        </div>
        <div className={adminStyles.card}>
          <h3 className={adminStyles.label + " mb-2"}>API Calls Today</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalCallsToday}</p>
        </div>
        <div className={adminStyles.card}>
          <h3 className={adminStyles.label + " mb-2"}>API Calls This Month</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalCallsMonth}</p>
        </div>
      </div>

      {/* API Usage Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {apiUsageStats.map((api) => (
          <div key={api.provider} className={adminStyles.card + " relative overflow-hidden"}>
            <h3 className={adminStyles.label + " mb-2"}>
              {api.provider}
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Spent Today</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">${api.totalSpentToday.toFixed(4)}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className={adminStyles.label}>Month Total</p>
                  <p className="font-medium text-gray-700 dark:text-gray-300">${api.totalSpentMonth.toFixed(4)}</p>
                </div>
                <div>
                  <p className={adminStyles.label}>Calls Today</p>
                  <p className="font-medium text-gray-700 dark:text-gray-300">{api.callsToday}</p>
                </div>
              </div>
              <div className="pt-2 border-t dark:border-gray-700">
                <p className={adminStyles.label}>Total Calls This Month</p>
                <p className="font-medium text-gray-700 dark:text-gray-300">{api.callsMonth}</p>
              </div>
            </div>
            <div className={`absolute top-0 right-0 w-24 h-24 ${api.bgColor} opacity-10 dark:opacity-20 rounded-full -mr-8 -mt-8`}></div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Breakdown Pie Chart */}
        <div className={adminStyles.card}>
          <div className="border-b border-gray-200 dark:border-gray-700 -mx-6 -mt-6 px-6 py-4 mb-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
              <DollarSign className="h-5 w-5" />
              Today&apos;s Cost Breakdown by API
            </h3>
          </div>
          {pieChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="300">
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `$${value.toFixed(4)}`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500 dark:text-gray-400">
              No API usage recorded today
            </div>
          )}
        </div>

        {/* Daily Cost Trend */}
        <div className={adminStyles.card}>
          <div className="border-b border-gray-200 dark:border-gray-700 -mx-6 -mt-6 px-6 py-4 mb-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
              <TrendingUp className="h-5 w-5" />
              Daily Cost Trend (7 Days)
            </h3>
          </div>
          {dailyTrend.some(day => day.total > 0) ?  (
            <ResponsiveContainer width="100%" height="300">
              <AreaChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(value) => `$${value}`} />
                <Tooltip formatter={(value: number) => `$${value.toFixed(4)}`} />
                <Legend />
                <Area type="monotone" dataKey="together_ai" stackId="1" stroke="#8B5CF6" fill="#8B5CF6" name="Together AI" />
                <Area type="monotone" dataKey="openai" stackId="1" stroke="#10B981" fill="#10B981" name="OpenAI" />
                <Area type="monotone" dataKey="replicate" stackId="1" stroke="#3B82F6" fill="#3B82F6" name="Replicate" />
                <Area type="monotone" dataKey="anthropic" stackId="1" stroke="#F59E0B" fill="#F59E0B" name="Anthropic" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500 dark:text-gray-400">
              No usage data for the past 7 days
            </div>
          )}
        </div>
      </div>

      {/* Usage History Table */}
      <div className={adminStyles.card}>
        <div className="border-b border-gray-200 dark:border-gray-700 -mx-6 -mt-6 px-6 py-4 mb-6">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <Activity className="h-5 w-5" />
            Recent API Calls (Last 50)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b dark:border-gray-700">
                <th className={adminStyles.tableHeader}>API</th>
                <th className={adminStyles.tableHeader}>Endpoint</th>
                <th className={adminStyles.tableHeader}>Tokens</th>
                <th className={adminStyles.tableHeader}>Cost</th>
                <th className={adminStyles.tableHeader}>Business</th>
                <th className={adminStyles.tableHeader}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {usageHistory.map((usage) => (
                <tr key={usage.id} className={adminStyles.tableRow}>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getProviderBgClass(usage.api_name)} ${getProviderTextClass(usage.api_name)}`}>
                      {getProviderDisplayName(usage.api_name)}
                    </span>
                  </td>
                  <td className={adminStyles.tableCell}>{usage.endpoint || 'N/A'}</td>
                  <td className={adminStyles.tableCell}>{usage.tokens_used?.toLocaleString() || 0}</td>
                  <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">${usage.cost?.toFixed(6) || '0.000000'}</td>
                  <td className={adminStyles.tableCell}>{usage.business_name || 'N/A'}</td>
                  <td className="py-3 px-4 text-gray-500 dark:text-gray-400">
                    {formatters.dateTime(usage.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {usageHistory.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No API usage history available
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
