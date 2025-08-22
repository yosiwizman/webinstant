'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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

// Initialize cache
const dataCache = new DataCache<{
  apiBalances: ApiBalance[]
  usageHistory: ApiUsageData[]
  dailyTrend: DailyUsage[]
  pieChartData: PieChartData[]
  totalSpentToday: number
  totalSpentMonth: number
  hasData: boolean
}>(5) // 5 minute cache

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
  const hasFetched = useRef(false)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Real API balances from environment or placeholders
  const getRealApiBalances = (): Record<ProviderKey, number> => ({
    'together_ai': 100.00,
    'openai': 100.00,
    'anthropic': 98.89,
    'replicate': 98.85
  })

  const fetchApiUsageData = useCallback(async () => {
    // Check cache first
    const cached = dataCache.get('api-usage')
    if (cached) {
      setApiBalances(cached.apiBalances)
      setUsageHistory(cached.usageHistory)
      setDailyTrend(cached.dailyTrend)
      setPieChartData(cached.pieChartData)
      setTotalSpentToday(cached.totalSpentToday)
      setTotalSpentMonth(cached.totalSpentMonth)
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

      // Fetch all usage data for the month
      const { data: monthlyUsage, error: monthlyError } = await supabase
        .from('api_usage')
        .select('*')
        .gte('created_at', startOfMonthISO)
        .order('created_at', { ascending: false })

      let currentHasData = false

      if (monthlyError) {
        console.error('Error fetching monthly usage:', monthlyError)
        currentHasData = false
      } else {
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

          // Get real API balances
          const initialBalances = getRealApiBalances()

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
              value: parseFloat(stats.today.toFixed(4)),
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

          // Fetch usage for last 7 days
          const sevenDaysAgo = last7Days[0].toISOString()
          const { data: weeklyUsage, error: weeklyError } = await supabase
            .from('api_usage')
            .select('*')
            .gte('created_at', sevenDaysAgo)
            .order('created_at', { ascending: true })

          if (weeklyError) {
            console.error('Error fetching weekly usage:', weeklyError)
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

      // Set default state with real balances if no data
      if (!currentHasData) {
        const initialBalances = getRealApiBalances()
        const defaultBalances = [
          {
            provider: 'Together AI',
            initialBalance: initialBalances['together_ai'],
            totalUsed: 0,
            balance: initialBalances['together_ai'],
            usedToday: 0,
            usedThisMonth: 0,
            callsToday: 0,
            callsThisMonth: 0,
            color: '#8B5CF6',
            bgColor: 'bg-purple-500'
          },
          {
            provider: 'OpenAI',
            initialBalance: initialBalances['openai'],
            totalUsed: 0,
            balance: initialBalances['openai'],
            usedToday: 0,
            usedThisMonth: 0,
            callsToday: 0,
            callsThisMonth: 0,
            color: '#10B981',
            bgColor: 'bg-green-500'
          },
          {
            provider: 'Replicate',
            initialBalance: initialBalances['replicate'],
            totalUsed: 0,
            balance: initialBalances['replicate'],
            usedToday: 0,
            usedThisMonth: 0,
            callsToday: 0,
            callsThisMonth: 0,
            color: '#3B82F6',
            bgColor: 'bg-blue-500'
          },
          {
            provider: 'Anthropic',
            initialBalance: initialBalances['anthropic'],
            totalUsed: 0,
            balance: initialBalances['anthropic'],
            usedToday: 0,
            usedThisMonth: 0,
            callsToday: 0,
            callsThisMonth: 0,
            color: '#F59E0B',
            bgColor: 'bg-amber-500'
          }
        ]
        setApiBalances(defaultBalances)
        setUsageHistory([])
        setDailyTrend([])
        setPieChartData([])
        setTotalSpentToday(0)
        setTotalSpentMonth(0)
      }

      // Fetch usage history
      const { data: historyData, error: historyError } = await supabase
        .from('api_usage')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (historyError) {
        console.error('Error fetching usage history:', historyError)
        setUsageHistory([])
      } else if (historyData) {
        // Process usage history
        const processedHistory = historyData.map(item => ({
          ...item,
          business_name: 'Business ' + (item.business_id ? item.business_id.substring(0, 8) : 'Unknown')
        }))

        setUsageHistory(processedHistory)
      }

      // Cache the data
      dataCache.set('api-usage', {
        apiBalances,
        usageHistory,
        dailyTrend,
        pieChartData,
        totalSpentToday,
        totalSpentMonth,
        hasData: currentHasData
      })

      setLoading(false)
    } catch (error) {
      console.error('Error in fetchApiUsageData:', error)
      setError('Unable to load API usage data')
      setHasData(false)
      
      // Set default state with real balances on error
      const initialBalances = getRealApiBalances()
      setApiBalances([
        {
          provider: 'Together AI',
          initialBalance: initialBalances['together_ai'],
          totalUsed: 0,
          balance: initialBalances['together_ai'],
          usedToday: 0,
          usedThisMonth: 0,
          callsToday: 0,
          callsThisMonth: 0,
          color: '#8B5CF6',
          bgColor: 'bg-purple-500'
        },
        {
          provider: 'OpenAI',
          initialBalance: initialBalances['openai'],
          totalUsed: 0,
          balance: initialBalances['openai'],
          usedToday: 0,
          usedThisMonth: 0,
          callsToday: 0,
          callsThisMonth: 0,
          color: '#10B981',
          bgColor: 'bg-green-500'
        },
        {
          provider: 'Replicate',
          initialBalance: initialBalances['replicate'],
          totalUsed: 0,
          balance: initialBalances['replicate'],
          usedToday: 0,
          usedThisMonth: 0,
          callsToday: 0,
          callsThisMonth: 0,
          color: '#3B82F6',
          bgColor: 'bg-blue-500'
        },
        {
          provider: 'Anthropic',
          initialBalance: initialBalances['anthropic'],
          totalUsed: 0,
          balance: initialBalances['anthropic'],
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
      setLoading(false)
    }
  }, [supabase])

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
    const initialBalances = getRealApiBalances()
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
          
          {/* Show current balances even with no usage */}
          <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className={adminStyles.label}>Together AI</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">${initialBalances['together_ai'].toFixed(2)}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className={adminStyles.label}>OpenAI</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">${initialBalances['openai'].toFixed(2)}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className={adminStyles.label}>Anthropic</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">${initialBalances['anthropic'].toFixed(2)}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className={adminStyles.label}>Replicate</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">${initialBalances['replicate'].toFixed(2)}</p>
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
            <div className={adminStyles.alertError}>
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Low Balance Alert</h3>
                  <p className="mt-1 text-sm text-red-700 dark:text-red-400">
                    One or more API providers have a balance below $5. Please add funds to avoid service interruption.
                  </p>
                </div>
              </div>
            </div>
          )}
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
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={adminStyles.card}>
          <h3 className={adminStyles.label + " mb-2"}>Today&apos;s Total Cost</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">${totalSpentToday.toFixed(4)}</p>
        </div>
        <div className={adminStyles.card}>
          <h3 className={adminStyles.label + " mb-2"}>Month&apos;s Total Cost</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">${totalSpentMonth.toFixed(4)}</p>
        </div>
        <div className={adminStyles.card}>
          <h3 className={adminStyles.label + " mb-2"}>Total API Calls Today</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {apiBalances.reduce((sum, api) => sum + api.callsToday, 0)}
          </p>
        </div>
      </div>

      {/* API Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {apiBalances.map((api) => (
          <div key={api.provider} className={adminStyles.card + " relative overflow-hidden"}>
            <h3 className={adminStyles.label + " mb-2"}>
              {api.provider}
            </h3>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">${api.balance.toFixed(2)}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">Balance</span>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className={adminStyles.label}>Used Today</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">${api.usedToday.toFixed(4)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={adminStyles.label}>Used This Month</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">${api.usedThisMonth.toFixed(4)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={adminStyles.label}>Calls Today</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">{api.callsToday}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min((api.totalUsed / api.initialBalance) * 100, 100)}%`,
                    backgroundColor: api.color
                  }}
                />
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
