'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, TrendingUp, DollarSign, Activity } from 'lucide-react'
import {
  LineChart,
  Line,
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
  api_provider: string
  endpoint: string
  tokens_used: number
  cost: number
  business_id: string
  business_name?: string
  created_at: string
}

interface ApiBalance {
  provider: string
  balance: number
  usedToday: number
  color: string
  bgColor: string
}

interface DailyUsage {
  date: string
  together: number
  openai: number
  replicate: number
  anthropic: number
  total: number
}

export default function ApiUsageMonitor() {
  const [apiBalances, setApiBalances] = useState<ApiBalance[]>([
    { provider: 'Together AI', balance: 100, usedToday: 0, color: '#8B5CF6', bgColor: 'bg-purple-500' },
    { provider: 'OpenAI', balance: 100, usedToday: 0, color: '#10B981', bgColor: 'bg-green-500' },
    { provider: 'Replicate', balance: 100, usedToday: 0, color: '#3B82F6', bgColor: 'bg-blue-500' },
    { provider: 'Anthropic', balance: 100, usedToday: 0, color: '#F59E0B', bgColor: 'bg-amber-500' }
  ])
  
  const [usageHistory, setUsageHistory] = useState<ApiUsageData[]>([])
  const [dailyTrend, setDailyTrend] = useState<DailyUsage[]>([])
  const [pieChartData, setPieChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [totalSpentToday, setTotalSpentToday] = useState(0)
  
  const supabase = createClientComponentClient()

  useEffect(() => {
    fetchApiUsageData()
    // Refresh data every 30 seconds
    const interval = setInterval(fetchApiUsageData, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchApiUsageData = async () => {
    try {
      // Fetch usage history (last 50 calls)
      const { data: usage, error: usageError } = await supabase
        .from('api_usage')
        .select(`
          *,
          businesses (
            business_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      if (usageError) throw usageError

      // Process usage data
      const processedUsage = usage?.map(item => ({
        ...item,
        business_name: item.businesses?.business_name || 'Unknown'
      })) || []
      
      setUsageHistory(processedUsage)

      // Calculate today's usage by provider
      const today = new Date().toISOString().split('T')[0]
      const todayUsage = processedUsage.filter(item => 
        item.created_at.startsWith(today)
      )

      // Update balances with today's usage
      const providerTotals = {
        'together': 0,
        'openai': 0,
        'replicate': 0,
        'anthropic': 0
      }

      todayUsage.forEach(item => {
        const provider = item.api_provider.toLowerCase()
        if (provider in providerTotals) {
          providerTotals[provider] += item.cost || 0
        }
      })

      // Update API balances
      setApiBalances(prev => prev.map(api => {
        const providerKey = api.provider.toLowerCase().replace(' ai', '')
        const usedToday = providerTotals[providerKey] || 0
        return {
          ...api,
          usedToday,
          balance: 100 - usedToday // Assuming $100 starting balance
        }
      }))

      setTotalSpentToday(Object.values(providerTotals).reduce((a, b) => a + b, 0))

      // Calculate pie chart data
      const pieData = Object.entries(providerTotals)
        .filter(([_, value]) => value > 0)
        .map(([key, value]) => ({
          name: key.charAt(0).toUpperCase() + key.slice(1),
          value: parseFloat(value.toFixed(2)),
          color: getProviderColor(key)
        }))
      
      setPieChartData(pieData)

      // Calculate daily trend (last 7 days)
      const last7Days = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        last7Days.push(date.toISOString().split('T')[0])
      }

      const dailyData = last7Days.map(date => {
        const dayUsage = processedUsage.filter(item => 
          item.created_at.startsWith(date)
        )
        
        const dayTotals = {
          date: new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          together: 0,
          openai: 0,
          replicate: 0,
          anthropic: 0,
          total: 0
        }

        dayUsage.forEach(item => {
          const provider = item.api_provider.toLowerCase()
          if (provider in dayTotals) {
            dayTotals[provider] += item.cost || 0
          }
          dayTotals.total += item.cost || 0
        })

        return dayTotals
      })

      setDailyTrend(dailyData)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching API usage:', error)
      setLoading(false)
    }
  }

  const getProviderColor = (provider: string) => {
    const colors = {
      together: '#8B5CF6',
      openai: '#10B981',
      replicate: '#3B82F6',
      anthropic: '#F59E0B'
    }
    return colors[provider] || '#6B7280'
  }

  const getProviderBgClass = (provider: string) => {
    const classes = {
      together: 'bg-purple-100',
      openai: 'bg-green-100',
      replicate: 'bg-blue-100',
      anthropic: 'bg-amber-100'
    }
    return classes[provider.toLowerCase()] || 'bg-gray-100'
  }

  const getProviderTextClass = (provider: string) => {
    const classes = {
      together: 'text-purple-700',
      openai: 'text-green-700',
      replicate: 'text-blue-700',
      anthropic: 'text-amber-700'
    }
    return classes[provider.toLowerCase()] || 'text-gray-700'
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

  return (
    <div className="space-y-6">
      {/* Alerts Section */}
      {(hasLowBalance || hasHighDailySpend) && (
        <div className="space-y-3">
          {hasLowBalance && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertTitle className="text-red-800">Low Balance Alert</AlertTitle>
              <AlertDescription className="text-red-700">
                One or more API providers have a balance below $5. Please add funds to avoid service interruption.
              </AlertDescription>
            </Alert>
          )}
          {hasHighDailySpend && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-800">High Usage Warning</AlertTitle>
              <AlertDescription className="text-yellow-700">
                Daily API spend has exceeded $50 (${totalSpentToday.toFixed(2)}). Monitor usage to control costs.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* API Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {apiBalances.map((api) => (
          <Card key={api.provider} className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {api.provider}
              </CardTitle>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold">${api.balance.toFixed(2)}</span>
                <span className="text-sm text-gray-500">Balance</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Used Today</span>
                  <span className="font-medium">${api.usedToday.toFixed(2)}</span>
                </div>
                <Progress 
                  value={(api.usedToday / 100) * 100} 
                  className="h-2"
                  style={{
                    '--progress-background': api.color
                  } as any}
                />
              </div>
              <div className={`absolute top-0 right-0 w-24 h-24 ${api.bgColor} opacity-10 rounded-full -mr-8 -mt-8`}></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Breakdown Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Cost Breakdown by API
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                  <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                No usage data for today
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily Cost Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Daily Cost Trend (7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height="300">
              <AreaChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(value) => `$${value}`} />
                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                <Legend />
                <Area type="monotone" dataKey="together" stackId="1" stroke="#8B5CF6" fill="#8B5CF6" name="Together AI" />
                <Area type="monotone" dataKey="openai" stackId="1" stroke="#10B981" fill="#10B981" name="OpenAI" />
                <Area type="monotone" dataKey="replicate" stackId="1" stroke="#3B82F6" fill="#3B82F6" name="Replicate" />
                <Area type="monotone" dataKey="anthropic" stackId="1" stroke="#F59E0B" fill="#F59E0B" name="Anthropic" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Usage History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent API Calls (Last 50)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">API</th>
                  <th className="text-left py-2 px-3">Endpoint</th>
                  <th className="text-left py-2 px-3">Tokens</th>
                  <th className="text-left py-2 px-3">Cost</th>
                  <th className="text-left py-2 px-3">Business</th>
                  <th className="text-left py-2 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {usageHistory.map((usage) => (
                  <tr key={usage.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getProviderBgClass(usage.api_provider)} ${getProviderTextClass(usage.api_provider)}`}>
                        {usage.api_provider}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-700">{usage.endpoint}</td>
                    <td className="py-2 px-3 text-gray-700">{usage.tokens_used?.toLocaleString() || 0}</td>
                    <td className="py-2 px-3 font-medium">${usage.cost?.toFixed(4) || '0.0000'}</td>
                    <td className="py-2 px-3 text-gray-700">{usage.business_name}</td>
                    <td className="py-2 px-3 text-gray-500">
                      {new Date(usage.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {usageHistory.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No API usage data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
