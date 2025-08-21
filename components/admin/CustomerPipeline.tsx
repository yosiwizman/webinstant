'use client'

import { useState, useEffect } from 'react'
import { Phone, Mail, MessageSquare, Clock, TrendingUp, Users, DollarSign, Download, Send, ChevronRight, Calendar, Activity, Star, AlertCircle } from 'lucide-react'

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

export default function CustomerPipeline() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [filter, setFilter] = useState<'all' | 'hot'>('all')
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

  // Mock data - replace with actual API calls
  useEffect(() => {
    const mockLeads: Lead[] = [
      {
        id: '1',
        businessName: "Joe's Pizza",
        email: 'joe@pizza.com',
        phone: '555-0123',
        stage: 'interested',
        daysInStage: 2,
        lastAction: 'Clicked preview link',
        lastActionDate: '2 hours ago',
        isHot: true,
        notes: ['Very interested in premium features']
      },
      {
        id: '2',
        businessName: 'Sparkle Cleaners',
        email: 'info@sparkle.com',
        phone: '555-0124',
        stage: 'engaged',
        daysInStage: 5,
        lastAction: 'Opened email',
        lastActionDate: '1 day ago'
      },
      {
        id: '3',
        businessName: 'City Dental',
        email: 'contact@citydental.com',
        stage: 'contacted',
        daysInStage: 3,
        lastAction: 'Email sent',
        lastActionDate: '3 days ago'
      },
      {
        id: '4',
        businessName: 'Green Lawn Care',
        email: 'green@lawn.com',
        phone: '555-0125',
        stage: 'customer',
        daysInStage: 0,
        lastAction: 'Subscription activated',
        lastActionDate: 'Today',
        revenue: 299,
        joinDate: '2024-01-15'
      },
      {
        id: '5',
        businessName: 'Auto Repair Plus',
        email: 'service@autoplus.com',
        stage: 'lead',
        daysInStage: 1,
        lastAction: 'Preview created',
        lastActionDate: '1 day ago'
      },
      {
        id: '6',
        businessName: 'Bella Salon',
        email: 'bella@salon.com',
        phone: '555-0126',
        stage: 'interested',
        daysInStage: 1,
        lastAction: 'Clicked pricing page',
        lastActionDate: '4 hours ago',
        isHot: true
      },
      {
        id: '7',
        businessName: 'Tech Solutions',
        email: 'info@techsol.com',
        phone: '555-0127',
        stage: 'customer',
        daysInStage: 30,
        lastAction: 'Renewed subscription',
        lastActionDate: '1 week ago',
        revenue: 499,
        joinDate: '2023-12-01'
      }
    ]
    
    setLeads(mockLeads)
    
    // Calculate metrics
    const stageCount: StageMetrics = {
      lead: mockLeads.filter(l => l.stage === 'lead').length,
      contacted: mockLeads.filter(l => l.stage === 'contacted').length,
      engaged: mockLeads.filter(l => l.stage === 'engaged').length,
      interested: mockLeads.filter(l => l.stage === 'interested').length,
      customer: mockLeads.filter(l => l.stage === 'customer').length
    }
    setMetrics(stageCount)
    
    // Calculate conversion rates
    const total = mockLeads.length
    const contacted = stageCount.contacted + stageCount.engaged + stageCount.interested + stageCount.customer
    const engaged = stageCount.engaged + stageCount.interested + stageCount.customer
    const customers = stageCount.customer
    
    setConversionRates({
      leadToContact: total > 0 ? Math.round((contacted / total) * 100) : 0,
      contactToEngaged: contacted > 0 ? Math.round((engaged / contacted) * 100) : 0,
      engagedToCustomer: engaged > 0 ? Math.round((customers / engaged) * 100) : 0,
      overall: total > 0 ? Math.round((customers / total) * 100) : 0
    })
  }, [])

  const stages = [
    { id: 'lead', name: 'Lead', color: 'bg-gray-100', textColor: 'text-gray-700', icon: Users },
    { id: 'contacted', name: 'Contacted', color: 'bg-blue-100', textColor: 'text-blue-700', icon: Mail },
    { id: 'engaged', name: 'Engaged', color: 'bg-yellow-100', textColor: 'text-yellow-700', icon: Activity },
    { id: 'interested', name: 'Interested', color: 'bg-purple-100', textColor: 'text-purple-700', icon: Star },
    { id: 'customer', name: 'Customer', color: 'bg-green-100', textColor: 'text-green-700', icon: DollarSign }
  ]

  const hotLeads = leads.filter(lead => lead.isHot)
  const customers = leads.filter(lead => lead.stage === 'customer')

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData('leadId', leadId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, newStage: string) => {
    e.preventDefault()
    const leadId = e.dataTransfer.getData('leadId')
    
    setLeads(prevLeads => 
      prevLeads.map(lead => 
        lead.id === leadId 
          ? { ...lead, stage: newStage as Lead['stage'], daysInStage: 0, lastAction: `Moved to ${newStage}`, lastActionDate: 'Just now' }
          : lead
      )
    )
  }

  const sendFollowUp = (lead: Lead) => {
    console.log('Sending follow-up to:', lead.businessName)
    // Implement follow-up logic
  }

  const addNote = () => {
    if (selectedLead && newNote.trim()) {
      setLeads(prevLeads =>
        prevLeads.map(lead =>
          lead.id === selectedLead.id
            ? { ...lead, notes: [...(lead.notes || []), newNote] }
            : lead
        )
      )
      setNewNote('')
      setShowNoteModal(false)
    }
  }

  const downloadInvoice = (lead: Lead) => {
    console.log('Downloading invoice for:', lead.businessName)
    // Implement invoice download
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Customer Pipeline</h1>
        <p className="text-gray-600">Track leads through your sales funnel</p>
      </div>

      {/* Conversion Metrics */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Lead → Contact</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{conversionRates.leadToContact}%</div>
          <div className="text-xs text-gray-500 mt-1">{metrics.contacted + metrics.engaged + metrics.interested + metrics.customer} of {metrics.lead + metrics.contacted + metrics.engaged + metrics.interested + metrics.customer}</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Contact → Engaged</span>
            <TrendingUp className="w-4 h-4 text-yellow-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{conversionRates.contactToEngaged}%</div>
          <div className="text-xs text-gray-500 mt-1">{metrics.engaged + metrics.interested + metrics.customer} of {metrics.contacted + metrics.engaged + metrics.interested + metrics.customer}</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Engaged → Customer</span>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{conversionRates.engagedToCustomer}%</div>
          <div className="text-xs text-gray-500 mt-1">{metrics.customer} of {metrics.engaged + metrics.interested + metrics.customer}</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Overall Conversion</span>
            <TrendingUp className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{conversionRates.overall}%</div>
          <div className="text-xs text-gray-500 mt-1">{metrics.customer} customers</div>
        </div>
      </div>

      {/* Hot Leads Section */}
      {hotLeads.length > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg shadow-lg p-6 mb-8 border border-orange-200">
          <div className="flex items-center mb-4">
            <AlertCircle className="w-6 h-6 text-orange-500 mr-2" />
            <h2 className="text-xl font-bold text-gray-900">🔥 Hot Leads - Action Required!</h2>
            <span className="ml-auto text-sm text-gray-600">Last 24 hours</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hotLeads.map(lead => (
              <div key={lead.id} className="bg-white rounded-lg p-4 border border-orange-200">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{lead.businessName}</h3>
                    <p className="text-sm text-gray-600">{lead.lastAction} • {lead.lastActionDate}</p>
                  </div>
                  <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">HOT</span>
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
                    className="flex items-center justify-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </div>
                
                {lead.notes && lead.notes.length > 0 && (
                  <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-600">
                    Note: {lead.notes[lead.notes.length - 1]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pipeline Kanban Board */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Pipeline Stages</h2>
        <div className="grid grid-cols-5 gap-4">
          {stages.map(stage => (
            <div
              key={stage.id}
              className="bg-gray-50 rounded-lg p-4"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <stage.icon className={`w-5 h-5 ${stage.textColor}`} />
                  <h3 className="font-semibold text-gray-900">{stage.name}</h3>
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
                      className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 cursor-move hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-gray-900 text-sm">{lead.businessName}</h4>
                        {lead.isHot && (
                          <span className="text-orange-500 text-xs">🔥</span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                        <Clock className="w-3 h-3" />
                        <span>{lead.daysInStage} days</span>
                      </div>
                      
                      <p className="text-xs text-gray-600 mb-3">{lead.lastAction}</p>
                      
                      <div className="flex gap-1">
                        <button
                          onClick={() => sendFollowUp(lead)}
                          className="flex-1 px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded hover:bg-blue-100 transition-colors"
                        >
                          Email
                        </button>
                        {lead.phone && (
                          <a
                            href={`tel:${lead.phone}`}
                            className="flex-1 px-2 py-1 bg-green-50 text-green-600 text-xs rounded hover:bg-green-100 transition-colors text-center"
                          >
                            Call
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Customer List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Paying Customers</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Total Revenue:</span>
              <span className="text-xl font-bold text-green-600">
                ${customers.reduce((sum, c) => sum + (c.revenue || 0), 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Business
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Join Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {customers.map(customer => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{customer.businessName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">{customer.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-green-600">${customer.revenue}/mo</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">{customer.joinDate}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      Active
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2">
                      <button
                        onClick={() => downloadInvoice(customer)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => sendFollowUp(customer)}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Note Modal */}
      {showNoteModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add Note for {selectedLead.businessName}</h3>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
              placeholder="Enter your note..."
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={addNote}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Save Note
              </button>
              <button
                onClick={() => {
                  setShowNoteModal(false)
                  setNewNote('')
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
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
