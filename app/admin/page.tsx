'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Statistics {
  totalBusinesses: number
  websitesGenerated: number
  emailsSent: number
  openRate: number
  clickRate: number
}

interface BusinessActivity {
  id: string
  business_name: string
  email: string
  phone: string
  city: string
  state: string
  created_at: string
  preview_url?: string
  status: {
    imported: boolean
    generated: boolean
    sent: boolean
    opened: boolean
    clicked: boolean
  }
}

interface DatabaseBusiness {
  id: string
  business_name: string
  preview_url?: string
}

export default function AdminPage() {
  const [stats, setStats] = useState<Statistics>({
    totalBusinesses: 0,
    websitesGenerated: 0,
    emailsSent: 0,
    openRate: 0,
    clickRate: 0
  })
  
  const [recentActivity, setRecentActivity] = useState<BusinessActivity[]>([])
  const [databaseBusinesses, setDatabaseBusinesses] = useState<DatabaseBusiness[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [generatingPreviews, setGeneratingPreviews] = useState(false)
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 })
  const [sendingCampaign, setSendingCampaign] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)
  const [fixingUrls, setFixingUrls] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (isMounted) {
      fetchDashboardData()
    }
  }, [isMounted])

  const fetchDashboardData = async () => {
    setIsLoading(true)
    try {
      // Fetch statistics
      const [
        businessesResult,
        websitesResult,
        emailsResult
      ] = await Promise.all([
        supabase.from('businesses').select('id', { count: 'exact' }),
        supabase.from('website_previews').select('id', { count: 'exact' }),
        supabase.from('email_logs').select('id', { count: 'exact' })
      ])

      const totalBusinesses = businessesResult.count || 0
      const websitesGenerated = websitesResult.count || 0
      const emailsSent = emailsResult.count || 0

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
        clickRate: Math.round(clickRate * 10) / 10
      })

      // Fetch all businesses
      const { data: allBusinesses } = await supabase
        .from('businesses')
        .select('id, business_name, email, phone, city, state, created_at')
        .order('created_at', { ascending: false })

      if (allBusinesses) {
        // Fetch all website previews in one query
        const businessIds = allBusinesses.map(b => b.id)
        const { data: allPreviews } = await supabase
          .from('website_previews')
          .select('business_id, preview_url')
          .in('business_id', businessIds)

        // Create a map of business_id to preview_url for quick lookup
        const previewMap = new Map()
        allPreviews?.forEach(preview => {
          previewMap.set(preview.business_id, preview.preview_url)
        })

        const activityData = await Promise.all(
          allBusinesses.map(async (business) => {
            const [email, tracking] = await Promise.all([
              supabase.from('email_logs').select('id').eq('business_id', business.id).maybeSingle(),
              supabase.from('email_tracking').select('event_type').eq('business_id', business.id)
            ])

            const opened = tracking.data?.some(t => t.event_type === 'open') || false
            const clicked = tracking.data?.some(t => t.event_type === 'click') || false
            const previewUrl = previewMap.get(business.id)

            return {
              id: business.id,
              business_name: business.business_name,
              email: business.email,
              phone: business.phone,
              city: business.city,
              state: business.state,
              created_at: business.created_at,
              preview_url: previewUrl,
              status: {
                imported: true,
                generated: !!previewUrl,
                sent: !!email.data,
                opened,
                clicked
              }
            }
          })
        )
        setRecentActivity(activityData)

        // Prepare database businesses list
        const dbBusinessesList: DatabaseBusiness[] = allBusinesses.map(business => ({
          id: business.id,
          business_name: business.business_name,
          preview_url: previewMap.get(business.id)
        }))
        setDatabaseBusinesses(dbBusinessesList)
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestEmail = async () => {
    if (recentActivity.length === 0) {
      alert('No businesses available to test email with. Please import businesses first.')
      return
    }

    setTestingEmail(true)
    try {
      const firstBusiness = recentActivity[0]
      console.log('Testing email with business:', firstBusiness.business_name)

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: firstBusiness.id,
          test_mode: true
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        alert(`✅ Test email sent successfully!\n\nBusiness: ${firstBusiness.business_name}\nEmail: ${firstBusiness.email}\nMessage ID: ${result.messageId}`)
      } else {
        alert(`❌ Failed to send test email\n\nError: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Test email error:', error)
      alert(`❌ Failed to send test email\n\nError: ${error}`)
    } finally {
      setTestingEmail(false)
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
    setGenerationProgress({ current: 0, total: 0 })
    
    try {
      // Get all businesses (only the fields we need)
      const { data: allBusinesses, error: fetchError } = await supabase
        .from('businesses')
        .select('id, business_name')

      if (fetchError) {
        console.error('Error fetching businesses:', fetchError)
        alert('Failed to fetch businesses')
        return
      }

      if (!allBusinesses || allBusinesses.length === 0) {
        alert('No businesses found to generate previews for')
        return
      }

      // Get all existing previews
      const { data: existingPreviews } = await supabase
        .from('website_previews')
        .select('business_id')

      // Create a set of business IDs that already have previews
      const businessesWithPreviews = new Set(existingPreviews?.map(p => p.business_id) || [])

      // Filter businesses without previews
      const businessesWithoutPreviews = allBusinesses.filter(
        business => !businessesWithPreviews.has(business.id)
      )

      if (businessesWithoutPreviews.length === 0) {
        alert('All businesses already have previews generated')
        return
      }

      const totalToGenerate = businessesWithoutPreviews.length
      setGenerationProgress({ current: 0, total: totalToGenerate })

      let successCount = 0
      let failCount = 0
      const errors = []

      // Generate previews one by one
      for (let i = 0; i < businessesWithoutPreviews.length; i++) {
        const business = businessesWithoutPreviews[i]
        setGenerationProgress({ current: i + 1, total: totalToGenerate })

        try {
          console.log(`Generating preview for ${business.business_name} (${i + 1}/${totalToGenerate})`)
          
          const response = await fetch('/api/generate-preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ business_id: business.id })
          })

          const result = await response.json()

          if (response.ok) {
            successCount++
            console.log(`Successfully generated preview for ${business.business_name}`)
          } else {
            failCount++
            errors.push(`${business.business_name}: ${result.error || 'Unknown error'}`)
            console.error(`Failed to generate preview for ${business.business_name}:`, result.error)
          }

          // Add a small delay to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 500))
          
        } catch (error) {
          failCount++
          errors.push(`${business.business_name}: ${error}`)
          console.error(`Error generating preview for ${business.business_name}:`, error)
        }
      }

      // Show results
      let message = `Preview generation complete!\n\n`
      message += `✓ Successfully generated: ${successCount}\n`
      if (failCount > 0) {
        message += `✗ Failed: ${failCount}\n`
        if (errors.length > 0) {
          message += `\nErrors:\n${errors.slice(0, 5).join('\n')}`
          if (errors.length > 5) {
            message += `\n... and ${errors.length - 5} more errors`
          }
        }
      }
      
      alert(message)
      
      // Refresh the dashboard data to show new previews
      await fetchDashboardData()
      
    } catch (error) {
      console.error('Generate previews error:', error)
      alert('Failed to generate previews: ' + error)
    } finally {
      setGeneratingPreviews(false)
      setGenerationProgress({ current: 0, total: 0 })
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

  const handleFixPreviewUrls = async () => {
    if (!confirm('This will update all preview URLs to use the correct format. Continue?')) {
      return
    }

    setFixingUrls(true)
    try {
      const response = await fetch('/api/fix-preview-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      const result = await response.json()
      
      if (response.ok && result.success) {
        let message = `✅ Preview URLs fixed successfully!\n\n`
        message += `Total previews: ${result.stats.total}\n`
        message += `Updated: ${result.stats.updated}\n`
        message += `Already correct: ${result.stats.skipped}`
        
        if (result.stats.errors > 0) {
          message += `\nErrors: ${result.stats.errors}`
          if (result.errors && result.errors.length > 0) {
            message += `\n\nError details:\n${result.errors.slice(0, 3).join('\n')}`
          }
        }
        
        alert(message)
        
        // Refresh the dashboard to show updated URLs
        await fetchDashboardData()
      } else {
        alert(`❌ Failed to fix preview URLs\n\nError: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Fix preview URLs error:', error)
      alert(`❌ Failed to fix preview URLs\n\nError: ${error}`)
    } finally {
      setFixingUrls(false)
    }
  }

  const formatDate = (dateString: string) => {
    if (!isMounted) return '—'
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
      })
    } catch {
      return '—'
    }
  }

  const StatCar = ({ title, value, suffix = '' }: { title: string; value: number | string; suffix?: string }) => (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">{title}</h3>
      <p className="text-3xl font-bold text-gray-900">
        {typeof value === 'number' ? value.toLocaleString() : value}{suffix}
      </p>
    </div>
  )

  const StatusBadge = ({ active }: { active: boolean }) => (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
      active 
        ? 'bg-green-100 text-green-800 border border-green-200' 
        : 'bg-gray-100 text-gray-500 border border-gray-200'
    }`}>
      {active ? '✓' : '○'}
    </span>
  )

  const PreviewLink = ({ url, businessName, showFullUrl = false }: { url?: string; businessName: string; showFullUrl?: boolean }) => {
    if (!url) {
      if (showFullUrl) {
        return <span className="text-gray-400">No preview generated</span>
      }
      return <StatusBadge active={false} />
    }
    
    if (showFullUrl) {
      return (
        <div className="flex items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline text-sm truncate max-w-xs"
            title={url}
          >
            {url}
          </a>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-200 transition-colors flex-shrink-0"
            title={`View preview for ${businessName}`}
          >
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View
          </a>
        </div>
      )
    }
    
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-200 transition-colors"
        title={`View preview for ${businessName}`}
      >
        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
        View
      </a>
    )
  }

  if (!isMounted || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-700 font-medium">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="mt-2 text-gray-600">Manage your business outreach campaigns</p>
          
          {/* Test and Fix Buttons */}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={handleTestEmail}
              disabled={testingEmail || recentActivity.length === 0}
              className={`inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white transition-colors ${
                testingEmail || recentActivity.length === 0
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700 active:bg-green-800 shadow-lg hover:shadow-xl'
              }`}
            >
              {testingEmail ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Testing Email System...
                </>
              ) : (
                <>
                  <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Test Email System
                </>
              )}
            </button>
            
            <button
              onClick={handleFixPreviewUrls}
              disabled={fixingUrls || stats.websitesGenerated === 0}
              className={`inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white transition-colors ${
                fixingUrls || stats.websitesGenerated === 0
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-orange-600 hover:bg-orange-700 active:bg-orange-800 shadow-lg hover:shadow-xl'
              }`}
            >
              {fixingUrls ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Fixing URLs...
                </>
              ) : (
                <>
                  <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  Fix Preview URLs
                </>
              )}
            </button>
          </div>
        </div>
        
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <StatCard title="Total Businesses" value={stats.totalBusinesses} />
          <StatCard title="Websites Generated" value={stats.websitesGenerated} />
          <StatCard title="Emails Sent" value={stats.emailsSent} />
          <StatCard title="Open Rate" value={stats.openRate} suffix="%" />
          <StatCard title="Click Rate" value={stats.clickRate} suffix="%" />
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Campaign Actions</h2>
          <div className="flex flex-wrap gap-4">
            <div className="relative">
              <input
                type="file"
                id="csv-upload"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={uploadingFile}
                className="sr-only"
              />
              <label
                htmlFor="csv-upload"
                className={`inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white cursor-pointer transition-colors ${
                  uploadingFile 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                }`}
              >
                {uploadingFile ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Import CSV
                  </>
                )}
              </label>
            </div>
            
            <button
              onClick={handleGeneratePreviews}
              disabled={generatingPreviews}
              className={`inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white transition-colors ${
                generatingPreviews 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700 active:bg-green-800'
              }`}
            >
              {generatingPreviews ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {generationProgress.total > 0 
                    ? `Generating ${generationProgress.current} of ${generationProgress.total}...`
                    : 'Generating...'}
                </>
              ) : (
                <>
                  <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Generate Previews
                </>
              )}
            </button>
            
            <button
              onClick={handleSendCampaign}
              disabled={sendingCampaign}
              className={`inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white transition-colors ${
                sendingCampaign 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800'
              }`}
            >
              {sendingCampaign ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending...
                </>
              ) : (
                <>
                  <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Send Campaign
                </>
              )}
            </button>
          </div>
        </div>

        {/* Imported Businesses Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-xl font-semibold text-gray-900">Imported Businesses ({recentActivity.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Business Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Date Added
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Preview
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Email Sent
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Opened
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Clicked
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentActivity.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                      No businesses imported yet. Upload a CSV file to get started.
                    </td>
                  </tr>
                ) : (
                  recentActivity.map((business) => (
                    <tr key={business.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {business.business_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {business.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {business.phone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {business.city}, {business.state}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(business.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <PreviewLink url={business.preview_url} businessName={business.business_name} />
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Businesses in Database Section */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-xl font-semibold text-gray-900">Businesses in Database ({databaseBusinesses.length})</h2>
            <p className="mt-1 text-sm text-gray-600">All businesses with their IDs and preview URLs</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Business ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Business Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Preview URL
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {databaseBusinesses.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                      No businesses in database
                    </td>
                  </tr>
                ) : (
                  databaseBusinesses.map((business) => (
                    <tr key={business.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono text-gray-900">
                        {business.id}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {business.business_name}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <PreviewLink url={business.preview_url} businessName={business.business_name} showFullUrl={true} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
