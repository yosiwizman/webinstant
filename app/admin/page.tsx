'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Statistics {
  totalBusinesses: number
  websitesGenerated: number
  emailsSent: number
  openRate: number
  clickRate: number
  conversions: number
  revenue: number
}

interface BusinessActivity {
  id: string
  business_name: string
  created_at: string
  status: {
    imported: boolean
    generated: boolean
    sent: boolean
    opened: boolean
    clicked: boolean
    converted: boolean
  }
}

interface ChartData {
  date: string
  value: number
}

export default function AdminPage() {
  const [stats, setStats] = useState<Statistics>({
    totalBusinesses: 0,
    websitesGenerated: 0,
    emailsSent: 0,
    openRate: 0,
    clickRate: 0,
    conversions: 0,
    revenue: 0
  })
  
  const [recentActivity, setRecentActivity] = useState<BusinessActivity[]>([])
  const [conversionChart, setConversionChart] = useState<ChartData[]>([])
  const [revenueChart, setRevenueChart] = useState<ChartData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [generatingPreviews, setGeneratingPreviews] = useState(false)
  const [sendingCampaign, setSendingCampaign] = useState(false)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setIsLoading(true)
    try {
      // Fetch statistics
      const [
        businessesResult,
        websitesResult,
        emailsResult,
        conversionsResult
      ] = await Promise.all([
        supabase.from('businesses').select('id', { count: 'exact' }),
        supabase.from('website_previews').select('id', { count: 'exact' }),
        supabase.from('email_logs').select('id', { count: 'exact' }),
        supabase.from('conversions').select('id, revenue', { count: 'exact' })
      ])

      const totalBusinesses = businessesResult.count || 0
      const websitesGenerated = websitesResult.count || 0
      const emailsSent = emailsResult.count || 0
      const conversions = conversionsResult.count || 0

      // Calculate revenue
      const revenue = conversionsResult.data?.reduce((sum, conv) => sum + (conv.revenue || 0), 0) || 0

      // Fetch email tracking stats for open and click rates
      const { data: emailTracking } = await supabase
        .from('email_tracking')
        .select('event_type')

      const opens = emailTracking?.filter(e => e.event_type === 'open').length || 0
      const clicks = emailTracking?.filter(e => e.event_type === 'click').length || 0
      
      const openRate = emailsSent > 0 ? (opens / emailsSent) * 100 : 0
      const clickRate = emailsSent > 0 ? (clicks / emailsSent) * 100 : 0

      setStats({
        totalBusinesses,
        websitesGenerated,
        emailsSent,
        openRate: Math.round(openRate * 10) / 10,
        clickRate: Math.round(clickRate * 10) / 10,
        conversions,
        revenue
      })

      // Fetch recent activity
      const { data: recentBusinesses } = await supabase
        .from('businesses')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      if (recentBusinesses) {
        const activityData = await Promise.all(
          recentBusinesses.map(async (business) => {
            const [preview, email, tracking, conversion] = await Promise.all([
              supabase.from('website_previews').select('id').eq('business_id', business.id).single(),
              supabase.from('email_logs').select('id').eq('business_id', business.id).single(),
              supabase.from('email_tracking').select('event_type').eq('business_id', business.id),
              supabase.from('conversions').select('id').eq('business_id', business.id).single()
            ])

            const opened = tracking.data?.some(t => t.event_type === 'open') || false
            const clicked = tracking.data?.some(t => t.event_type === 'click') || false

            return {
              id: business.id,
              business_name: business.business_name,
              created_at: business.created_at,
              status: {
                imported: true,
                generated: !!preview.data,
                sent: !!email.data,
                opened,
                clicked,
                converted: !!conversion.data
              }
            }
          })
        )
        setRecentActivity(activityData)
      }

      // Fetch conversion chart data (last 7 days)
      const conversionDates = Array.from({ length: 7 }, (_, i) => {
        const date = new Date()
        date.setDate(date.getDate() - (6 - i))
        return date.toISOString().split('T')[0]
      })

      const conversionData = await Promise.all(
        conversionDates.map(async (date) => {
          const { count } = await supabase
            .from('conversions')
            .select('id', { count: 'exact' })
            .gte('created_at', `${date}T00:00:00`)
            .lt('created_at', `${date}T23:59:59`)
          
          return {
            date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
            value: count || 0
          }
        })
      )
      setConversionChart(conversionData)

      // Fetch revenue chart data (last 30 days)
      const revenueDates = Array.from({ length: 30 }, (_, i) => {
        const date = new Date()
        date.setDate(date.getDate() - (29 - i))
        return date.toISOString().split('T')[0]
      })

      const revenueData = await Promise.all(
        revenueDates.map(async (date) => {
          const { data } = await supabase
            .from('conversions')
            .select('revenue')
            .gte('created_at', `${date}T00:00:00`)
            .lt('created_at', `${date}T23:59:59`)
          
          const dailyRevenue = data?.reduce((sum, conv) => sum + (conv.revenue || 0), 0) || 0
          
          return {
            date: new Date(date).getDate().toString(),
            value: dailyRevenue
          }
        })
      )
      setRevenueChart(revenueData)

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingFile(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/import-businesses', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()
      
      if (response.ok) {
        alert(`Successfully imported ${result.statistics.imported} businesses`)
        fetchDashboardData()
      } else {
        alert(`Error: ${result.error}`)
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload file')
    } finally {
      setUploadingFile(false)
      if (event.target) {
        event.target.value = ''
      }
    }
  }

  const handleGeneratePreviews = async () => {
    setGeneratingPreviews(true)
    try {
      // Get businesses without previews
      const { data: businessesWithoutPreviews } = await supabase
        .from('businesses')
        .select('id')
        .is('preview_url', null)

      if (!businessesWithoutPreviews || businessesWithoutPreviews.length === 0) {
        alert('All businesses already have previews')
        return
      }

      let generated = 0
      for (const business of businessesWithoutPreviews) {
        const response = await fetch('/api/generate-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ business_id: business.id })
        })

        if (response.ok) {
          generated++
        }
      }

      alert(`Generated ${generated} previews`)
      fetchDashboardData()
    } catch (error) {
      console.error('Generate previews error:', error)
      alert('Failed to generate previews')
    } finally {
      setGeneratingPreviews(false)
    }
  }

  const handleSendCampaign = async () => {
    if (!confirm('Are you sure you want to send emails to all businesses with previews?')) {
      return
    }

    setSendingCampaign(true)
    try {
      const response = await fetch('/api/send-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      const result = await response.json()
      
      if (response.ok) {
        alert(`Campaign sent! Emails sent: ${result.emailsSent}, Failed: ${result.emailsFailed}`)
        fetchDashboardData()
      } else {
        alert(`Error: ${result.error}`)
      }
    } catch (error) {
      console.error('Send campaign error:', error)
      alert('Failed to send campaign')
    } finally {
      setSendingCampaign(false)
    }
  }

  const StatCard = ({ title, value, suffix = '' }: { title: string; value: number | string; suffix?: string }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">{title}</h3>
      <p className="mt-2 text-3xl font-bold text-gray-900">
        {typeof value === 'number' ? value.toLocaleString() : value}{suffix}
      </p>
    </div>
  )

  const StatusBadge = ({ active }: { active: boolean }) => (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
      active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-400'
    }`}>
      {active ? '✓' : '○'}
    </span>
  )

  const SimpleChart = ({ data, title, height = 200, prefix = '' }: { data: ChartData[]; title: string; height?: number; prefix?: string }) => {
    const maxValue = Math.max(...data.map(d => d.value), 1)
    
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="relative" style={{ height }}>
          <div className="flex items-end justify-between h-full">
            {data.map((item, index) => (
              <div key={index} className="flex flex-col items-center flex-1">
                <div className="w-full px-1">
                  <div 
                    className="bg-blue-500 rounded-t hover:bg-blue-600 transition-colors relative group"
                    style={{ 
                      height: `${(item.value / maxValue) * 100}%`,
                      minHeight: item.value > 0 ? '4px' : '0'
                    }}
                  >
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {prefix}{item.value.toLocaleString()}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-gray-500 mt-2">{item.date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>
        
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard title="Total Businesses" value={stats.totalBusinesses} />
          <StatCard title="Websites Generated" value={stats.websitesGenerated} />
          <StatCard title="Emails Sent" value={stats.emailsSent} />
          <StatCard title="Open Rate" value={stats.openRate} suffix="%" />
          <StatCard title="Click Rate" value={stats.clickRate} suffix="%" />
          <StatCard title="Conversions" value={stats.conversions} />
          <StatCard title="Revenue" value={`$${stats.revenue.toLocaleString()}`} />
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Actions</h2>
          <div className="flex flex-wrap gap-4">
            <label className="relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={uploadingFile}
                className="hidden"
              />
              <button
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors cursor-pointer"
                onClick={(e) => e.currentTarget.parentElement?.querySelector('input')?.click()}
                disabled={uploadingFile}
              >
                {uploadingFile ? 'Uploading...' : 'Import CSV'}
              </button>
            </label>
            
            <button
              onClick={handleGeneratePreviews}
              disabled={generatingPreviews}
              className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled: cursor-not-allowed transition-colors"
            >
              {generatingPreviews ? 'Generating...' : 'Generate Previews'}
            </button>
            
            <button
              onClick={handleSendCampaign}
              disabled={sendingCampaign}
              className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {sendingCampaign ? 'Sending...' : 'Send Campaign'}
            </button>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <SimpleChart 
            data={conversionChart} 
            title="Daily Conversions (Last 7 Days)" 
          />
          <SimpleChart 
            data={revenueChart} 
            title="Revenue (Last 30 Days)" 
            prefix="$"
          />
        </div>

        {/* Recent Activity Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold">Recent Activity</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Business Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date Added
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Imported
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Generated
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sent
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Opened
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Clicked
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Converted
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentActivity.map((business) => (
                  <tr key={business.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {business.business_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(business.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <StatusBadge active={business.status.imported} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <StatusBadge active={business.status.generated} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <StatusBadge active={business.status.sent} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <StatusBadge active={business.status.opened} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <StatusBadge active={business.status.clicked} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <StatusBadge active={business.status.converted} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
