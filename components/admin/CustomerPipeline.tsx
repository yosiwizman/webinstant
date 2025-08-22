'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Phone, Mail, MessageSquare, Clock, TrendingUp, Users, DollarSign, Download, Send, Activity, Star, AlertCircle } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { adminStyles, DataCache, formatters } from '@/lib/admin-utils'

interface Lead {
  id: string
  businessName: string
  email: string
  phone?: string
  stage: 'lead' | 'contacted' | 'engaged' | 'interested' | 'customer'
  daysInStage: number
  lastAction: string
  lastActionDate: string
  revenue?: number
  joinDate?: string
  notes?: string[]
  isHot?: boolean
  previewUrl?: string
  claimedAt?: string
}

interface StageMetrics {
  lead: number
  contacted: number
  engaged: number
  interested: number
  customer: number
}

interface ConversionRates {
  leadToContact: number
  contactToEngaged: number
  engagedToCustomer: number
  overall: number
}

// Initialize cache
const dataCache = new DataCache<{
  leads: Lead[]
  metrics: StageMetrics
  conversionRates: ConversionRates
}>(5) // 5 minute cache

export default function CustomerPipeline() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [metrics, setMetrics] = useState<StageMetrics>({
    lead: 0,
    contacted: 0,
    engaged: 0,
    interested: 0,
    customer: 0
  })
  const [conversionRates, setConversionRates] = useState<ConversionRates>({
    leadToContact: 0,
    contactToEngaged: 0,
    engagedToCustomer: 0,
    overall: 0
  })
  const [loading, setLoading] = useState(true)
  const hasFetched = useRef(false)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const fetchRealBusinessData = useCallback(async () => {
    // Check cache first
    const cached = dataCache.get('pipeline-data')
    if (cached) {
      setLeads(cached.leads)
      setMetrics(cached.metrics)
      setConversionRates(cached.conversionRates)
      setLoading(false)
      return
    }

    // Helper functions
    const getTimeAgo = (date: Date): string => {
      const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
      
      if (seconds < 60) return 'Just now'
      if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`
      if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
      if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`
      return date.toLocaleDateString()
    }

    const getDaysSince = (date: Date): number => {
      return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
    }

    try {
      // Fetch all businesses with their email tracking data
      const { data: businesses, error } = await supabase
        .from('businesses')
        .select(`
          *,
          website_previews (
            id,
            preview_url,
            slug
          )
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching businesses:', error)
        return
      }

      if (!businesses) {
        setLoading(false)
        return
      }

      // Process businesses into pipeline stages
      const processedLeads: Lead[] = businesses.map(business => {
        let stage: Lead['stage'] = 'lead'
        let lastAction = 'Preview created'
        let lastActionDate = ''
        let daysInStage = 0
        let isHot = false

        // Determine stage based on actual data
        if (business.claimed_at) {
          stage = 'customer'
          lastAction = 'Website claimed'
          const claimedDate = new Date(business.claimed_at)
          lastActionDate = getTimeAgo(claimedDate)
          daysInStage = getDaysSince(claimedDate)
        } else if (business.email_clicked_at) {
          stage = 'interested'
          lastAction = 'Clicked preview link'
          const clickedDate = new Date(business.email_clicked_at)
          lastActionDate = getTimeAgo(clickedDate)
          daysInStage = getDaysSince(clickedDate)
          
          // Mark as hot if clicked within last 24 hours
          const hoursSinceClick = (Date.now() - clickedDate.getTime()) / (1000 * 60 * 60)
          isHot = hoursSinceClick <= 24
        } else if (business.email_opened_at) {
          stage = 'engaged'
          lastAction = 'Opened email'
          const openedDate = new Date(business.email_opened_at)
          lastActionDate = getTimeAgo(openedDate)
          daysInStage = getDaysSince(openedDate)
        } else if (business.email_sent_at) {
          stage = 'contacted'
          lastAction = 'Email sent'
          const sentDate = new Date(business.email_sent_at)
          lastActionDate = getTimeAgo(sentDate)
          daysInStage = getDaysSince(sentDate)
        } else if (business.website_previews && business.website_previews.length > 0) {
          stage = 'lead'
          lastAction = 'Preview created'
          const createdDate = new Date(business.created_at)
          lastActionDate = getTimeAgo(createdDate)
          daysInStage = getDaysSince(createdDate)
        }

        // Get preview URL if available
        const previewUrl = business.website_previews?.[0]?.preview_url || 
                          (business.website_previews?.[0]?.slug ? 
                           `${window.location.origin}/preview/${business.website_previews[0].slug}` : 
                           undefined)

        return {
          id: business.id,
          businessName: business.name,
          email: business.email,
          phone: business.phone,
          stage,
          daysInStage,
          lastAction,
          lastActionDate,
          isHot,
          previewUrl,
          revenue: business.claimed_at ? 299 : undefined,
          joinDate: business.claimed_at ? new Date(business.claimed_at).toLocaleDateString() : undefined,
          claimedAt: business.claimed_at
        }
      })

      setLeads(processedLeads)
      
      // Calculate metrics
      const stageCount: StageMetrics = {
        lead: processedLeads.filter(l => l.stage === 'lead').length,
        contacted: processedLeads.filter(l => l.stage === 'contacted').length,
        engaged: processedLeads.filter(l => l.stage === 'engaged').length,
        interested: processedLeads.filter(l => l.stage === 'interested').length,
        customer: processedLeads.filter(l => l.stage === 'customer').length
      }
      setMetrics(stageCount)
      
      // Calculate conversion rates
      const total = processedLeads.length
      const contacted = stageCount.contacted + stageCount.engaged + stageCount.interested + stageCount.customer
      const engaged = stageCount.engaged + stageCount.interested + stageCount.customer
      const customers = stageCount.customer
      
      const rates = {
        leadToContact: total > 0 ? Math.round((contacted / total) * 100) : 0,
        contactToEngaged: contacted > 0 ? Math.round((engaged / contacted) * 100) : 0,
        engagedToCustomer: engaged > 0 ? Math.round((customers / engaged) * 100) : 0,
        overall: total > 0 ? Math.round((customers / total) * 100) : 0
      }
      setConversionRates(rates)

      // Cache the data
      dataCache.set('pipeline-data', {
        leads: processedLeads,
        metrics: stageCount,
        conversionRates: rates
      })

      setLoading(false)
    } catch (error) {
      console.error('Error processing business data:', error)
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true
      fetchRealBusinessData()
    }
  }, [fetchRealBusinessData])

  const stages = [
    { id: 'lead', name: 'Lead', color: 'bg-gray-100 dark:bg-gray-700', textColor: 'text-gray-700 dark:text-gray-300', icon: Users },
    { id: 'contacted', name: 'Contacted', color: 'bg-blue-100 dark:bg-blue-900/30', textColor: 'text-blue-700 dark:text-blue-400', icon: Mail },
    { id: 'engaged', name: 'Engaged', color: 'bg-yellow-100 dark:bg-yellow-900/30', textColor: 'text-yellow-700 dark:text-yellow-400', icon: Activity },
    { id: 'interested', name: 'Interested', color: 'bg-purple-100 dark:bg-purple-900/30', textColor: 'text-purple-700 dark:text-purple-400', icon: Star },
    { id: 'customer', name: 'Customer', color: 'bg-green-100 dark:bg-green-900/30', textColor: 'text-green-700 dark:text-green-400', icon: DollarSign }
  ]

  const hotLeads = leads.filter(lead => lead.isHot)
  const customers = leads.filter(lead => lead.stage === 'customer')

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData('leadId', leadId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent, newStage: string) => {
    e.preventDefault()
    const leadId = e.dataTransfer.getData('leadId')
    
    // Update local state immediately for UI responsiveness
    setLeads(prevLeads => 
      prevLeads.map(lead => 
        lead.id === leadId 
          ? { ...lead, stage: newStage as Lead['stage'], daysInStage: 0, lastAction: `Moved to ${newStage}`, lastActionDate: 'Just now' }
          : lead
      )
    )

    // Clear cache to force refresh on next load
    dataCache.clear()
    
    // Note: In production, you'd update the database here
    console.log(`Moving lead ${leadId} to stage ${newStage}`)
  }

  const sendFollowUp = async (lead: Lead) => {
    console.log('Sending follow-up to:', lead.businessName)
    
    try {
      // Send follow-up email via API
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: lead.email,
          businessName: lead.businessName,
          businessId: lead.id,
          type: 'follow-up',
          previewUrl: lead.previewUrl
        })
      })

      if (response.ok) {
        alert(`Follow-up email sent to ${lead.businessName}`)
        
        // Update the email_sent_at timestamp in database
        await supabase
          .from('businesses')
          .update({ 
            email_sent_at: new Date().toISOString(),
            last_contact_at: new Date().toISOString()
          })
          .eq('id', lead.id)
        
        // Clear cache and refresh
        dataCache.clear()
        fetchRealBusinessData()
      } else {
        alert('Failed to send follow-up email')
      }
    } catch (error) {
      console.error('Error sending follow-up:', error)
      alert('Error sending follow-up email')
    }
  }

  const addNote = async () => {
    if (selectedLead && newNote.trim()) {
      // In production, save note to database
      const { error } = await supabase
        .from('business_notes')
        .insert({
          business_id: selectedLead.id,
          note: newNote,
          created_at: new Date().toISOString()
        })

      if (!error) {
        setLeads(prevLeads =>
          prevLeads.map(lead =>
            lead.id === selectedLead.id
              ? { ...lead, notes: [...(lead.notes || []), newNote] }
              : lead
          )
        )
        // Clear cache
        dataCache.clear()
      }
      
      setNewNote('')
      setShowNoteModal(false)
    }
  }

  const downloadInvoice = (lead: Lead) => {
    console.log('Downloading invoice for:', lead.businessName)
    // Generate and download invoice
    const invoiceData = {
      businessName: lead.businessName,
      email: lead.email,
      amount: lead.revenue || 299,
      date: lead.joinDate || new Date().toLocaleDateString()
    }
    
    // Create a simple text invoice (in production, generate PDF)
    const invoiceText = `
INVOICE
================
Business: ${invoiceData.businessName}
Email: ${invoiceData.email}
Amount: $${invoiceData.amount}
Date: ${invoiceData.date}
Status: PAID
================
Thank you for your business!
    `.trim()
    
    const blob = new Blob([invoiceText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `invoice-${lead.businessName.replace(/\s+/g, '-').toLowerCase()}.txt`
    a.click()
  }

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className={adminStyles.heading + " mb-2"}>Customer Pipeline</h1>
        <p className={adminStyles.text}>Track your {leads.length} real businesses through the sales funnel</p>
      </div>

      {/* Conversion Metrics */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className={adminStyles.card}>
          <div className="flex items-center justify-between mb-2">
            <span className={adminStyles.label}>Lead → Contact</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{conversionRates.leadToContact}%</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{metrics.contacted + metrics.engaged + metrics.interested + metrics.customer} of {metrics.lead + metrics.contacted + metrics.engaged + metrics.interested + metrics.customer}</div>
        </div>
        
        <div className={adminStyles.card}>
          <div className="flex items-center justify-between mb-2">
            <span className={adminStyles.label}>Contact → Engaged</span>
            <TrendingUp className="w-4 h-4 text-yellow-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{conversionRates.contactToEngaged}%</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{metrics.engaged + metrics.interested + metrics.customer} of {metrics.contacted + metrics.engaged + metrics.interested + metrics.customer}</div>
        </div>
        
        <div className={adminStyles.card}>
          <div className="flex items-center justify-between mb-2">
            <span className={adminStyles.label}>Engaged → Customer</span>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{conversionRates.engagedToCustomer}%</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{metrics.customer} of {metrics.engaged + metrics.interested + metrics.customer}</div>
        </div>
        
        <div className={adminStyles.card}>
          <div className="flex items-center justify-between mb-2">
            <span className={adminStyles.label}>Overall Conversion</span>
            <TrendingUp className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{conversionRates.overall}%</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{metrics.customer} customers</div>
        </div>
      </div>

      {/* Hot Leads Section */}
      {hotLeads.length > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg shadow-lg p-6 mb-8 border border-orange-200 dark:border-orange-800">
          <div className="flex items-center mb-4">
            <AlertCircle className="w-6 h-6 text-orange-500 mr-2" />
            <h2 className={adminStyles.subheading}>🔥 Hot Leads - Action Required!</h2>
            <span className="ml-auto text-sm text-gray-600 dark:text-gray-400">Clicked within 24 hours</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hotLeads.map(lead => (
              <div key={lead.id} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-orange-200 dark:border-orange-700">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{lead.businessName}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{lead.lastAction} • {lead.lastActionDate}</p>
                  </div>
                  <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs font-medium rounded-full">HOT</span>
                </div>
                
                <div className="flex gap-2">
                  {lead.phone && (
                    <a
                      href={`tel:${lead.phone}`}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      <span className="text-sm font-medium">Call</span>
                    </a>
                  )}
                  <button
                    onClick={() => sendFollowUp(lead)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    <span className="text-sm font-medium">Follow-up</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedLead(lead)
                      setShowNoteModal(true)
                    }}
                    className="flex items-center justify-center px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </div>
                
                {lead.notes && lead.notes.length > 0 && (
                  <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
                    Note: {lead.notes[lead.notes.length - 1]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No hot leads message */}
      {hotLeads.length === 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 mb-8 text-center">
          <p className={adminStyles.text}>No hot leads at the moment. Send more emails to generate interest!</p>
        </div>
      )}

      {/* Pipeline Kanban Board */}
      <div className="mb-8">
        <h2 className={adminStyles.subheading + " mb-4"}>Pipeline Stages</h2>
        <div className="grid grid-cols-5 gap-4">
          {stages.map(stage => (
            <div
              key={stage.id}
              className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <stage.icon className={`w-5 h-5 ${stage.textColor}`} />
                  <h3 className="font-semibold text-gray-900 dark:text-white">{stage.name}</h3>
                </div>
                <span className={`px-2 py-1 ${stage.color} ${stage.textColor} text-xs font-medium rounded-full`}>
                  {metrics[stage.id as keyof StageMetrics]}
                </span>
              </div>
              
              <div className="space-y-3">
                {leads
                  .filter(lead => lead.stage === stage.id)
                  .map(lead => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead.id)}
                      className="bg-white dark:bg-gray-700 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-600 cursor-move hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-white text-sm">{lead.businessName}</h4>
                        {lead.isHot && (
                          <span className="text-orange-500 text-xs">🔥</span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-2">
                        <Clock className="w-3 h-3" />
                        <span>{lead.daysInStage} days</span>
                      </div>
                      
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">{lead.lastAction}</p>
                      
                      <div className="flex gap-1">
                        <button
                          onClick={() => sendFollowUp(lead)}
                          className="flex-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                        >
                          Email
                        </button>
                        {lead.phone && (
                          <a
                            href={`tel:${lead.phone}`}
                            className="flex-1 px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs rounded hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors text-center"
                          >
                            Call
                          </a>
                        )}
                        {lead.previewUrl && (
                          <a
                            href={lead.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs rounded hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                          >
                            View
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                  
                {leads.filter(lead => lead.stage === stage.id).length === 0 && (
                  <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                    No businesses in this stage
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Customer List */}
      {customers.length > 0 && (
        <div className={adminStyles.card}>
          <div className="border-b border-gray-200 dark:border-gray-700 -mx-6 -mt-6 px-6 py-4 mb-6">
            <div className="flex items-center justify-between">
              <h2 className={adminStyles.subheading}>Paying Customers</h2>
              <div className="flex items-center gap-2">
                <span className={adminStyles.label}>Total Revenue:</span>
                <span className="text-xl font-bold text-green-600 dark:text-green-400">
                  ${customers.reduce((sum, c) => sum + (c.revenue || 0), 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className={adminStyles.tableHeader}>Business</th>
                  <th className={adminStyles.tableHeader}>Email</th>
                  <th className={adminStyles.tableHeader}>Phone</th>
                  <th className={adminStyles.tableHeader}>Revenue</th>
                  <th className={adminStyles.tableHeader}>Claimed Date</th>
                  <th className={adminStyles.tableHeader}>Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {customers.map(customer => (
                  <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{customer.businessName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={adminStyles.text + " text-sm"}>{customer.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={adminStyles.text + " text-sm"}>{customer.phone || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-green-600 dark:text-green-400">${customer.revenue}/mo</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={adminStyles.text + " text-sm"}>{customer.joinDate}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button
                          onClick={() => downloadInvoice(customer)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          title="Download Invoice"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => sendFollowUp(customer)}
                          className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300"
                          title="Send Email"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                        {customer.previewUrl && (
                          <a
                            href={customer.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300"
                            title="View Website"
                          >
                            <Activity className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No customers message */}
      {customers.length === 0 && (
        <div className={adminStyles.card + " text-center"}>
          <DollarSign className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
          <h3 className={adminStyles.subheading + " mb-2"}>No Customers Yet</h3>
          <p className={adminStyles.text}>Keep nurturing your leads. They&apos;ll convert soon!</p>
        </div>
      )}

      {/* Note Modal */}
      {showNoteModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={adminStyles.card + " w-full max-w-md"}>
            <h3 className={adminStyles.subheading + " mb-4"}>Add Note for {selectedLead.businessName}</h3>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className={adminStyles.input}
              rows={4}
              placeholder="Enter your note..."
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={addNote}
                className={adminStyles.buttonPrimary + " flex-1"}
              >
                Save Note
              </button>
              <button
                onClick={() => {
                  setShowNoteModal(false)
                  setNewNote('')
                }}
                className={adminStyles.buttonSecondary + " flex-1"}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
