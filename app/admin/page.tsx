'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'

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

  useEffect(() => {
    // Update time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    fetchQuickStats()
    checkSystemStatus()
    
    // Refresh every 5 minutes
    const refreshInterval = setInterval(() => {
      fetchQuickStats()
      checkSystemStatus()
    }, 5 * 60 * 1000)

    return () => clearInterval(refreshInterval)
  }, [])

  const fetchQuickStats = async () => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayISO = today.toISOString()

      // Fetch revenue today
      const { data: revenueData } = await supabase
        .from('subscriptions')
        .select('amount')
        .gte('created_at', todayISO)
        .eq('status', 'active')

      const revenueToday = revenueData?.reduce((sum, sub) => sum + (sub.amount || 0), 0) || 0

      // Fetch emails sent today
      const { count: emailCount } = await supabase
        .from('email_logs')
        .select('id', { count: 'exact' })
        .gte('created_at', todayISO)

      // Fetch new customers today
      const { count: customerCount } = await supabase
        .from('businesses')
        .select('id', { count: 'exact' })
        .gte('created_at', todayISO)
        .not('claimed_at', 'is', null)

      // Fetch active websites
      const { count: websiteCount } = await supabase
        .from('website_previews')
        .select('id', { count: 'exact' })

      setQuickStats({
        revenueToday,
        emailsSentToday: emailCount || 0,
        newCustomersToday: customerCount || 0,
        activeWebsites: websiteCount || 0
      })
    } catch (error) {
      console.error('Error fetching quick stats:', error)
    }
  }

  const checkSystemStatus = async () => {
    try {
      // Check database
      const { error: dbError } = await supabase.from('businesses').select('id').limit(1)
      
      // Check email service (mock check - replace with actual email service check)
      const emailStatus = 'operational' // Replace with actual check
      
      // Check API services (mock check - replace with actual API check)
      const apiStatus = 'operational' // Replace with actual check

      setSystemStatus({
        database: dbError ? 'down' : 'operational',
        email: emailStatus as 'operational' | 'degraded' | 'down',
        api: apiStatus as 'operational' | 'degraded' | 'down'
      })
    } catch (error) {
      console.error('Error checking system status:', error)
      setSystemStatus({
        database: 'down',
        email: 'degraded',
        api: 'degraded'
      })
    }
  }

  const handleRefreshAll = async () => {
    setIsRefreshing(true)
    await Promise.all([
      fetchQuickStats(),
      checkSystemStatus()
    ])
    setLastRefresh(new Date())
    setIsRefreshing(false)
  }

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

  const sections: { id: ActiveSection; label: string; icon: JSX.Element }[] = [
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {formatDate(currentTime)} • {formatTime(currentTime)}
              </p>
            </div>
            <button
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white transition-colors ${
                isRefreshing
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
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
                  Refresh All
                </>
              )}
            </button>
          </div>

          {/* Quick Stats */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Revenue Today</p>
                  <p className="text-2xl font-bold">${quickStats.revenueToday.toFixed(2)}</p>
                </div>
                <svg className="w-8 h-8 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Emails Sent Today</p>
                  <p className="text-2xl font-bold">{quickStats.emailsSentToday}</p>
                </div>
                <svg className="w-8 h-8 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">New Customers</p>
                  <p className="text-2xl font-bold">{quickStats.newCustomersToday}</p>
                </div>
                <svg className="w-8 h-8 text-purple-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>

            <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm">Active Websites</p>
                  <p className="text-2xl font-bold">{quickStats.activeWebsites}</p>
                </div>
                <svg className="w-8 h-8 text-orange-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-6">
          <nav className="flex space-x-8" aria-label="Tabs">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`
                  flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeSection === section.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }
                `}
              >
                {section.icon}
                {section.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="transition-all duration-300 ease-in-out">
            {activeSection === 'revenue' && <RevenueDashboard />}
            {activeSection === 'pipeline' && <CustomerPipeline />}
            {activeSection === 'campaigns' && <EmailCampaignCenter />}
            {activeSection === 'websites' && <WebsiteGallery />}
            {activeSection === 'api' && <ApiUsageMonitor />}
            {activeSection === 'operations' && <OperationsLog />}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 shadow-sm border-t border-gray-200 dark:border-gray-700 mt-auto">
        <div className="px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-6">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Last refresh: {formatTime(lastRefresh)}
              </div>
              
              {/* System Status Indicators */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Database:</span>
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(systemStatus.database)}`}></div>
                    <span className="ml-1 text-xs text-gray-600 dark:text-gray-300 capitalize">
                      {systemStatus.database}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Email:</span>
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(systemStatus.email)}`}></div>
                    <span className="ml-1 text-xs text-gray-600 dark:text-gray-300 capitalize">
                      {systemStatus.email}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">API:</span>
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(systemStatus.api)}`}></div>
                    <span className="ml-1 text-xs text-gray-600 dark:text-gray-300 capitalize">
                      {systemStatus.api}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Version 2.0.0
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
