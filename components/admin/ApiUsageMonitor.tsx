'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
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

interface ApiBalance {
  provider: string
  initialBalance: number
  totalUsed: number
  balance: number
  usedToday: number
  usedThisMonth: number
  callsToday: number
  callsThisMonth: number
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

export default function ApiUsageMonitor() {
  const [apiBalances, setApiBalances] = useState<ApiBalance[]>([])
  const [usageHistory, setUsageHistory] = useState<ApiUsageData[]>([])
  const [dailyTrend, setDailyTrend] = useState<DailyUsage[]>([])
  const [pieChartData, setPieChartData] = useState<PieChartData[]>([])
  const [loading, setLoading] = useState(true)
  const [totalSpentToday, setTotalSpentToday] = useState(0)
  const [totalSpentMonth, setTotalSpentMonth] = useState(0)
  const [hasData, setHasData] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const fetchApiUsageData = useCallback(async () => {
    try {
      setError(null)
      
      // Get today's date and start of month
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      const startOfMonthISO = startOfMonth.toISOString()

      // Fetch all usage data for the month - simple query without retry
      const { data: monthlyUsage, error: monthlyError } = await supabase
        .from('api_usage')
        .select('*')
        .gte('created_at', startOfMonthISO)
        .order('created_at', { ascending: false })

      let currentHasData = false

      if (monthlyError) {
        console.error('Error fetching monthly usage:', monthlyError)
        // Don't throw, just use empty data
        currentHasData = false
      } else {
        // Check if we have any data
        currentHasData = monthlyUsage && monthlyUsage.length > 0
        setHasData(currentHasData)

        if (currentHasData) {
          // Calculate usage by provider for today and month
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

          // Process monthly usage
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

          // Calculate totals
          let todayTotal = 0
          let monthTotal = 0

          Object.values(providerStats).forEach(stats => {
            todayTotal += stats.today
            monthTotal += stats.month
          })

          setTotalSpentToday(todayTotal)
          setTotalSpentMonth(monthTotal)

          // Get initial balances from environment or use defaults
          const initialBalances: Record<ProviderKey, number> = {
            'together_ai': parseFloat(process.env.NEXT_PUBLIC_TOGETHER_AI_BALANCE || '100'),
            'openai': parseFloat(process.env.NEXT_PUBLIC_OPENAI_BALANCE || '100'),
            'replicate': parseFloat(process.env.NEXT_PUBLIC_REPLICATE_BALANCE || '100'),
            'anthropic': parseFloat(process.env.NEXT_PUBLIC_ANTHROPIC_BALANCE || '100')
          }

          // Update API balances with real data
          const balances = (Object.entries(providerStats) as [ProviderKey, ProviderStats][]).map(([key, stats]) => ({
            provider: stats.displayName,
            initialBalance: initialBalances[key],
            totalUsed: stats.month,
            balance: initialBalances[key] - stats.month,
            usedToday: stats.today,
            usedThisMonth: stats.month,
            callsToday: stats.callsToday,
            callsThisMonth: stats.callsMonth,
            color: stats.color,
            bgColor: stats.bgColor
          }))

          setApiBalances(balances)

          // Calculate pie chart data for today's usage
          const pieData = (Object.entries(providerStats) as [ProviderKey, ProviderStats][])
            .filter(([, stats]) => stats.today > 0)
            .map(([, stats]) => ({
              name: stats.displayName,
              value: parseFloat(stats.today.toFixe d(4)),
              color: stats.color
            }))

          setPieChartData(pieData)

          // Calculate daily trend (last 7 days)
          const last7Days = []
          for (let i = 6; i >= 0; i--) {
            const date = new Date()
            date.setDate(date.getDate() - i)
            date.setHours(0, 0, 0, 0)
            last7Days.push(date)
          }

          // Fetch usage for last 7 days - simple query without retry
          const sevenDaysAgo = last7Days[0].toISOString()
          const { data: weeklyUsage, error: weeklyError } = await supabase
            .from('api_usage')
            .select('*')
            .gte('created_at', sevenDaysAgo)
            .order('created_at', { ascending: true })

          if (weeklyError) {
            console.error('Error fetching weekly usage:', weeklyError)
            // Use empty array if error
            setDailyTrend([])
          } else if (weeklyUsage) {
            // Group by day and provider
            const dailyData = last7Days.map(date => {
              const nextDay = new Date(date)
              nextDay.setDate(nextDay.getDate() + 1)

              const dayUsage = weeklyUsage?.filter(item => {
                const itemDate = new Date(item.created_at)
                return itemDate >= date && itemDate < nextDay
              }) || []

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

            setDailyTrend(dailyData)
          }
        }
      }

      // Set default empty state if no data
      if (!currentHasData) {
        setApiBalances([
          {
            provider: 'Together AI',
            initialBalance: 100,
            totalUsed: 0,
            balance: 100,
            usedToday: 0,
            usedThisMonth: 0,
            callsToday: 0,
            callsThisMonth: 0,
            color: '#8B5CF6',
            bgColor: 'bg-purple-500'
          },
          {
            provider: 'OpenAI',
            initialBalance: 100,
            totalUsed: 0,
            balance: 100,
            usedToday: 0,
            usedThisMonth: 0,
            callsToday: 0,
            callsThisMonth: 0,
            color: '#10B981',
            bgColor: 'bg-green-500'
          },
          {
            provider: 'Replicate',
            initialBalance: 100,
            totalUsed: 0,
            balance: 100,
            usedToday: 0,
            usedThisMonth: 0,
            callsToday: 0,
            callsThisMonth: 0,
            color: '#3B82F6',
            bgColor: 'bg-blue-500'
          },
          {
            provider: 'Anthropic',
            initialBalance: 100,
            totalUsed: 0,
            balance: 100,
            usedToday: 0,
            usedThisMonth: 0,
            callsToday: 0,
            callsThisMonth: 0,
            color: '#F59E0B',
            bgColor: 'bg-amber-500'
          }
        ])
        setUsageHistory([])
        setDailyTrend([])
        setPieChartData([])
        setTotalSpentToday(0)
        setTotalSpentMonth(0)
      }

      // Fetch usage history - simple query without joins or retry
      const { data: historyData, error: historyError } = await supabase
        .from('api_usage')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (historyError) {
        console.error('Error fetching usage history:', historyError)
        setUsageHistory([])
      } else if (historyData) {
        // Process usage history without business names
        const processedHistory = historyData.map(item => ({
          ...item,
          business_name: 'Business ' + (item.business_id ? item.business_id.substring(0, 8) : 'Unknown')
        }))

        setUsageHistory(processedHistory)
      }

      setLoading(false)
    } catch (error) {
      console.error('Error in fetchApiUsageData:', error)
      setError('Unable to load API usage data')
      setHasData(false)
      setLoading(false)
      
      // Set default empty state on error
      setApiBalances([
        {
          provider: 'Together AI',
          initialBalance: 100,
          totalUsed: 0,
          balance: 100,
          usedToday: 0,
          usedThisMonth: 0,
          callsToday: 0,
          callsThisMonth: 0,
          color: '#8B5CF6',
          bgColor: 'bg-purple-500'
        },
        {
          provider: 'OpenAI',
          initialBalance: 100,
          totalUsed: 0,
          balance: 100,
          usedToday: 0,
          usedThisMonth: 0,
          callsToday: 0,
          callsThisMonth: 0,
          color: '#10B981',
          bgColor: 'bg-green-500'
        },
        {
          provider: 'Replicate',
          initialBalance: 100,
          totalUsed: 0,
          balance: 100,
          usedToday: 0,
          usedThisMonth: 0,
          callsToday: 0,
          callsThisMonth: 0,
          color: '#3B82F6',
          bgColor: 'bg-blue-500'
        },
        {
          provider: 'Anthropic',
          initialBalance: 100,
          totalUsed: 0,
          balance: 100,
          usedToday: 0,
          usedThisMonth: 0,
          callsToday: 0,
          callsThisMonth: 0,
          color: '#F59E0B',
          bgColor: 'bg-amber-500'
        }
      ])
      setUsageHistory([])
      setDailyTrend([])
      setPieChartData([])
      setTotalSpentToday(0)
      setTotalSpentMonth(0)
    }
  }, [supabase])

  useEffect(() => {
    fetchApiUsageData()
    // Don't auto-refresh to prevent retry loops
  }, [fetchApiUsageData])

  const getProviderBgClass = (provider: string) => {
    const classes: Record<string, string> = {
      'together_ai': 'bg-purple-100',
      'openai': 'bg-green-100',
      'replicate': 'bg-blue-100',
      'anthropic': 'bg-amber-100'
    }
    return classes[provider?.toLowerCase()] || 'bg-gray-100'
  }

  const getProviderTextClass = (provider: string) => {
    const classes: Record<string, string> = {
      'together_ai': 'text-purple-700',
      'openai': 'text-green-700',
      'replicate': 'text-blue-700',
      'anthropic': 'text-amber-700'
    }
    return classes[provider?.toLowerCase()] || 'text-gray-700'
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

  const hasLowBalance = apiBalances.some(api => api.balance < 5)
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
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">Error Loading API Usage</h3>
          <p className="mt-2 text-sm text-gray-500">{error}</p>
          <button
            onClick={fetchApiUsageData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
        <div className="text-center">
          <Activity className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No API Usage Recorded Yet</h3>
          <p className="mt-2 text-sm text-gray-500">
            API usage data will appear here once you start generating websites and sending emails.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 max-w-md mx-auto">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Today&apos;s Cost</p>
              <p className="text-2xl font-bold text-gray-900">$0.00</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Month&apos;s Cost</p>
              <p className="text-2xl font-bold text-gray-900">$0.00</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Alerts Section */}
      {(hasLowBalance || hasHighDailySpend) && (
        <div className="space-y-3">
          {hasLowBalance && (
            <div className="border border-red-200 bg-red-50 rounded-lg p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-red-800">Low Balance Alert</h3>
                  <p className="mt-1 text-sm text-red-700">
                    One or more API providers have a balance below $5. Please add funds to avoid service interruption.
                  </p>
                </div>
              </div>
            </div>
          )}
          {hasHighDailySpend && (
            <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-yellow-800">High Usage Warning</h3>
                  <p className="mt-1 text-sm text-yellow-700">
                    Daily API spend has exceeded $50 (${totalSpentToday.toFixed(2)}). Monitor usage to control costs.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Today&apos;s Total Cost</h3>
          <p className="text-3xl font-bold text-gray-900">${totalSpentToday.toFixed(4)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Month&apos;s Total Cost</h3>
          <p className="text-3xl font-bold text-gray-900">${totalSpentMonth.toFixed(4)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total API Calls Today</h3>
          <p className="text-3xl font-bold text-gray-900">
            {apiBalances.reduce((sum, api) => sum + api.callsToday, 0)}
          </p>
        </div>
      </div>

      {/* API Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {apiBalances.map((api) => (
          <div key={api.provider} className="bg-white rounded-lg shadow-sm border border-gray-200 relative overflow-hidden">
            <div className="p-6">
              <h3 className="text-sm font-medium text-gray-600 mb-2">
                {api.provider}
              </h3>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold">${api.balance.toFixed(2)}</span>
                <span className="text-sm text-gray-500">Balance</span>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Used Today</span>
                  <span className="font-medium">${api.usedToday.toFixed(4)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Used This Month</span>
                  <span className="font-medium">${api.usedThisMonth.toFixed(4)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Calls Today</span>
                  <span className="font-medium">{api.callsToday}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className="h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min((api.totalUsed / api.initialBalance) * 100, 100)}%`,
                      backgroundColor: api.color
                    }}
                  />
                </div>
              </div>
              <div className={`absolute top-0 right-0 w-24 h-24 ${api.bgColor} opacity-10 rounded-full -mr-8 -mt-8`}></div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Breakdown Pie Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <DollarSign className="h-5 w-5" />
              Today&apos;s Cost Breakdown by API
            </h3>
          </div>
          <div className="p-6">
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
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                No API usage recorded today
              </div>
            )}
          </div>
        </div>

        {/* Daily Cost Trend */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <TrendingUp className="h-5 w-5" />
              Daily Cost Trend (7 Days)
            </h3>
          </div>
          <div className="p-6">
            {dailyTrend.some(day => day.total > 0) ? (
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
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                No usage data for the past 7 days
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Usage History Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Activity className="h-5 w-5" />
            Recent API Calls (Last 50)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-medium text-gray-900">API</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Endpoint</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Tokens</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Cost</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Business</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {usageHistory.map((usage) => (
                <tr key={usage.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getProviderBgClass(usage.api_name)} ${getProviderTextClass(usage.api_name)}`}>
                      {getProviderDisplayName(usage.api_name)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-700">{usage.endpoint || 'N/A'}</td>
                  <td className="py-3 px-4 text-gray-700">{usage.tokens_used?.toLocaleString() || 0}</td>
                  <td className="py-3 px-4 font-medium">${usage.cost?.toFixed(6) || '0.000000'}</td>
                  <td className="py-3 px-4 text-gray-700">{usage.business_name || 'N/A'}</td>
                  <td className="py-3 px-4 text-gray-500">
                    {new Date(usage.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {usageHistory.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No API usage history available
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
