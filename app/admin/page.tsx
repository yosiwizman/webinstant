'use client'
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, ReactElement } from 'react'
import { getBrowserSupabase } from '@/lib/supabaseClient'
import dynamic from 'next/dynamic'
import ThemeToggle from '@/components/admin/ThemeToggle'
import CsvUpload from './components/CsvUpload'

// Dynamic imports for better code splitting
const RevenueDashboard = dynamic(() => import('@/components/admin/RevenueDashboard'), {
  loading: () => <LoadingComponent />
})
const ApiUsageMonitor = dynamic(() => import('@/components/admin/ApiUsageMonitor'), {
  loading: () => <LoadingComponent />
})
const WebsiteGallery = dynamic(() => import('@/components/admin/WebsiteGallery'), {
  loading: () => <LoadingComponent />
})
const EmailCampaignCenter = dynamic(() => import('@/components/admin/EmailCampaignCenter'), {
  loading: () => <LoadingComponent />
})
const BulkCampaignPanel = dynamic(() => import('@/components/admin/BulkCampaignPanel'), {
  loading: () => <LoadingComponent />
})
const CustomerPipeline = dynamic(() => import('@/components/admin/CustomerPipeline'), {
  loading: () => <LoadingComponent />
})
const OperationsLog = dynamic(() => import('@/components/admin/OperationsLog'), {
  loading: () => <LoadingComponent />
})

interface QuickStats {
  revenueToday: number
  emailsSentToday: number
  newCustomersToday: number
  activeWebsites: number
}

interface SystemStatus {
  database: 'operational' | 'degraded' | 'down'
  email: 'operational' | 'degraded' | 'down'
  api: 'operational' | 'degraded' | 'down'
}

type ActiveSection = 'revenue' | 'pipeline' | 'campaigns' | 'websites' | 'api' | 'operations'

const LoadingComponent = () => (
  <div className="flex items-center justify-center h-96">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto"></div>
      <p className="mt-4 text-gray-700 dark:text-gray-300 font-medium">Loading...</p>
    </div>
  </div>
)

export default function AdminPage() {
  const supabase: any = getBrowserSupabase()
  const [activeSection, setActiveSection] = useState<ActiveSection>('revenue')
  const [quickStats, setQuickStats] = useState<QuickStats>({
    revenueToday: 0,
    emailsSentToday: 0,
    newCustomersToday: 0,
    activeWebsites: 0
  })
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    database: 'operational',
    email: 'operational',
    api: 'operational'
  })
  const [currentTime, setCurrentTime] = useState(new Date())
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Fetch quick stats with error handling
  const fetchQuickStats = useCallback(async () => {
    try {
      setError(null)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayISO = today.toISOString()

      // Fetch revenue today
      const { data: revenueData, error: revenueError } = await supabase
        .from('subscriptions')
        .select('amount')
        .gte('created_at', todayISO)
        .eq('status', 'active')

      if (revenueError) throw revenueError

      const revArray = (revenueData as Array<{ amount?: number }> | null) || []
      const revenueToday = revArray.reduce((sum: number, sub: { amount?: number }) => sum + (sub.amount || 0), 0)

      // Fetch emails sent today
      const { count: emailCount, error: emailError } = await supabase
        .from('email_logs')
        .select('id', { count: 'exact' })
        .gte('created_at', todayISO)

      if (emailError) throw emailError

      // Fetch new customers today
      const { count: customerCount, error: customerError } = await supabase
        .from('businesses')
        .select('id', { count: 'exact' })
        .gte('created_at', todayISO)
        .not('claimed_at', 'is', null)

      if (customerError) throw customerError

      // Fetch active websites
      const { count: websiteCount, error: websiteError } = await supabase
        .from('website_previews')
        .select('id', { count: 'exact' })

      if (websiteError) throw websiteError

      setQuickStats({
        revenueToday,
        emailsSentToday: emailCount || 0,
        newCustomersToday: customerCount || 0,
        activeWebsites: websiteCount || 0
      })
    } catch (error) {
      console.error('Error fetching quick stats:', error)
      setError('Failed to fetch statistics. Please try refreshing.')
    }
  }, [])

  // Check system status with error handling
  const checkSystemStatus = useCallback(async () => {
    try {
      // Check database
      const { error: dbError } = await supabase
        .from('businesses')
        .select('id')
        .limit(1)
        .single()
      
      // Check email service by checking if we have email logs
      const { error: emailCheckError } = await supabase
        .from('email_logs')
        .select('id')
        .limit(1)
        .single()
      
      // Check API usage logs
      const { error: apiCheckError } = await supabase
        .from('api_usage')
        .select('id')
        .limit(1)
        .single()

      setSystemStatus({
        database: dbError ? (dbError.code === 'PGRST116' ? 'operational' : 'down') : 'operational',
        email: emailCheckError ? (emailCheckError.code === 'PGRST116' ? 'operational' : 'degraded') : 'operational',
        api: apiCheckError ? (apiCheckError.code === 'PGRST116' ? 'operational' : 'degraded') : 'operational'
      })
    } catch (error) {
      console.error('Error checking system status:', error)
      setSystemStatus({
        database: 'down',
        email: 'degraded',
        api: 'degraded'
      })
    }
  }, [])

  // Handle refresh all data
  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([
        fetchQuickStats(),
        checkSystemStatus()
      ])
      setLastRefresh(new Date())
      // Increment refresh key to force child components to refresh
      setRefreshKey(prev => prev + 1)
    } catch (error) {
      console.error('Error refreshing data:', error)
      setError('Failed to refresh data. Please try again.')
    } finally {
      setIsRefreshing(false)
    }
  }, [fetchQuickStats, checkSystemStatus])

  // Initial load
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true)
      try {
        await Promise.all([
          fetchQuickStats(),
          checkSystemStatus()
        ])
      } finally {
        setIsLoading(false)
      }
    }
    loadInitialData()
  }, [fetchQuickStats, checkSystemStatus])

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      fetchQuickStats()
      checkSystemStatus()
      setLastRefresh(new Date())
    }, 60 * 1000) // 60 seconds

    return () => clearInterval(refreshInterval)
  }, [fetchQuickStats, checkSystemStatus])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getStatusColor = (status: 'operational' | 'degraded' | 'down') => {
    switch (status) {
      case 'operational':
        return 'bg-green-500'
      case 'degraded':
        return 'bg-yellow-500'
      case 'down':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const sections: { id: ActiveSection; label: string; icon: ReactElement }[] = [
    {
      id: 'revenue',
      label: 'Revenue',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      id: 'pipeline',
      label: 'Pipeline',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      id: 'campaigns',
      label: 'Campaigns',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      id: 'websites',
      label: 'Websites',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      )
    },
    {
      id: 'api',
      label: 'API Usage',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      )
    },
    {
      id: 'operations',
      label: 'Operations',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    }
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-lg text-gray-700 dark:text-gray-300 font-medium">Loading Dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Theme Toggle - positioned in top right */}
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 p-4 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setError(null)}
                  className="inline-flex text-red-400 hover:text-red-500 focus:outline-none"
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header Section */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Admin Dashboard</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formatDate(currentTime)} • {formatTime(currentTime)}
              </p>
            </div>
            <button
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white transition-all duration-200 ${
                isRefreshing
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg transform hover:scale-105'
              }`}
            >
              {isRefreshing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Refreshing...
                </>
              ) : (
                <>
                  <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh Data
                </>
              )}
            </button>
          </div>
        </div>

        {/* CSV Import Card */}
        <div className="mb-8">
          <CsvUpload />
        </div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">Revenue Today</p>
                <p className="text-3xl font-bold text-white mt-1">${quickStats.revenueToday.toFixed(2)}</p>
              </div>
              <div className="bg-green-400/20 p-3 rounded-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Emails Sent Today</p>
                <p className="text-3xl font-bold text-white mt-1">{quickStats.emailsSentToday}</p>
              </div>
              <div className="bg-blue-400/20 p-3 rounded-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">New Customers</p>
                <p className="text-3xl font-bold text-white mt-1">{quickStats.newCustomersToday}</p>
              </div>
              <div className="bg-purple-400/20 p-3 rounded-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium">Active Websites</p>
                <p className="text-3xl font-bold text-white mt-1">{quickStats.activeWebsites}</p>
              </div>
              <div className="bg-orange-400/20 p-3 rounded-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6">
          <nav className="flex space-x-1 p-1" aria-label="Tabs">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`
                  flex items-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 flex-1 justify-center
                  ${activeSection === section.id
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700'
                  }
                `}
              >
                {section.icon}
                <span className="hidden sm:inline">{section.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Main Content Area */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="transition-all duration-300 ease-in-out">
            {activeSection === 'revenue' && <RevenueDashboard key={`revenue-${refreshKey}`} />}
            {activeSection === 'pipeline' && <CustomerPipeline key={`pipeline-${refreshKey}`} />}
{activeSection === 'campaigns' && (
  <div className="space-y-6">
    <EmailCampaignCenter key={`campaigns-${refreshKey}`} />
    <BulkCampaignPanel />
  </div>
)}
            {activeSection === 'websites' && <WebsiteGallery key={`websites-${refreshKey}`} />}
            {activeSection === 'api' && <ApiUsageMonitor key={`api-${refreshKey}`} />}
            {activeSection === 'operations' && <OperationsLog key={`operations-${refreshKey}`} />}
          </div>
        </div>

        {/* Footer with System Status */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Last refresh: {formatTime(lastRefresh)}
              </div>
              
              {/* System Status Indicators */}
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Database:</span>
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(systemStatus.database)} animate-pulse`}></div>
                    <span className="ml-1 text-xs text-gray-700 dark:text-gray-300 capitalize">
                      {systemStatus.database}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Email:</span>
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(systemStatus.email)} animate-pulse`}></div>
                    <span className="ml-1 text-xs text-gray-700 dark:text-gray-300 capitalize">
                      {systemStatus.email}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">API:</span>
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(systemStatus.api)} animate-pulse`}></div>
                    <span className="ml-1 text-xs text-gray-700 dark:text-gray-300 capitalize">
                      {systemStatus.api}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Auto-refresh: 60s
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Version 2.0.0
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
