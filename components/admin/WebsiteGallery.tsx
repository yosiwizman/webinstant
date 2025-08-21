'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Eye, 
  Mail, 
  Copy, 
  Trash2, 
  ExternalLink,
  Filter,
  Search,
  CheckCircle,
  MousePointer,
  DollarSign,
  MailOpen,
  Calendar,
  Building,
  Users,
  TrendingUp,
  MoreVertical,
  Check
} from 'lucide-react'

interface WebsitePreview {
  id: string
  business_id: string
  business_name: string
  business_type: string
  preview_url: string
  html_content: string
  template_used: string
  slug: string
  created_at: string
  email_sent: boolean
  email_opened: boolean
  link_clicked: boolean
  is_customer: boolean
  email_sent_at?: string
  email_opened_at?: string
  link_clicked_at?: string
}

interface Stats {
  total: number
  generatedToday: number
  pending: number
  withEmailsSent: number
}

export default function WebsiteGallery() {
  const [previews, setPreviews] = useState<WebsitePreview[]>([])
  const [filteredPreviews, setFilteredPreviews] = useState<WebsitePreview[]>([])
  const [stats, setStats] = useState<Stats>({
    total: 0,
    generatedToday: 0,
    pending: 0,
    withEmailsSent: 0
  })
  const [loading, setLoading] = useState(true)
  const [selectedPreviews, setSelectedPreviews] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showBulkActions, setShowBulkActions] = useState(false)

  useEffect(() => {
    fetchPreviews()
  }, [])

  useEffect(() => {
    filterPreviews()
  }, [previews, statusFilter, categoryFilter, searchTerm])

  useEffect(() => {
    setShowBulkActions(selectedPreviews.size > 0)
  }, [selectedPreviews])

  const fetchPreviews = async () => {
    try {
      const { data, error } = await supabase
        .from('website_previews')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      const enrichedData = (data || []).map(preview => ({
        ...preview,
        email_sent: Math.random() > 0.5,
        email_opened: Math.random() > 0.7,
        link_clicked: Math.random() > 0.8,
        is_customer: Math.random() > 0.9,
        email_sent_at: Math.random() > 0.5 ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString() : undefined,
        email_opened_at: Math.random() > 0.7 ? new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000).toISOString() : undefined,
        link_clicked_at: Math.random() > 0.8 ? new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000).toISOString() : undefined,
      }))

      setPreviews(enrichedData)
      calculateStats(enrichedData)
    } catch (error) {
      console.error('Error fetching previews:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (data: WebsitePreview[]) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const stats = {
      total: data.length,
      generatedToday: data.filter(p => {
        const createdAt = new Date(p.created_at)
        createdAt.setHours(0, 0, 0, 0)
        return createdAt.getTime() === today.getTime()
      }).length,
      pending: data.filter(p => !p.email_sent).length,
      withEmailsSent: data.filter(p => p.email_sent).length
    }
    
    setStats(stats)
  }

  const filterPreviews = () => {
    let filtered = [...previews]

    // Status filter
    switch (statusFilter) {
      case 'no-email':
        filtered = filtered.filter(p => !p.email_sent)
        break
      case 'opened':
        filtered = filtered.filter(p => p.email_opened)
        break
      case 'customer':
        filtered = filtered.filter(p => p.is_customer)
        break
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(p => p.business_type === categoryFilter)
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.business_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredPreviews(filtered)
  }

  const handleSelectPreview = (id: string) => {
    const newSelected = new Set(selectedPreviews)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedPreviews(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedPreviews.size === filteredPreviews.length) {
      setSelectedPreviews(new Set())
    } else {
      setSelectedPreviews(new Set(filteredPreviews.map(p => p.id)))
    }
  }

  const handleBulkSendEmails = async () => {
    console.log('Sending emails to:', Array.from(selectedPreviews))
    // Implement bulk email sending
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedPreviews.size} previews?`)) return
    
    for (const id of selectedPreviews) {
      await supabase.from('website_previews').delete().eq('id', id)
    }
    
    await fetchPreviews()
    setSelectedPreviews(new Set())
  }

  const handleSendEmail = async (preview: WebsitePreview) => {
    console.log('Sending email for:', preview.business_name)
    // Implement email sending
  }

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url)
    // Show toast notification
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this preview?')) return
    
    await supabase.from('website_previews').delete().eq('id', id)
    await fetchPreviews()
  }

  const getBusinessTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      restaurant: 'bg-orange-100 text-orange-800',
      beauty: 'bg-pink-100 text-pink-800',
      medical: 'bg-blue-100 text-blue-800',
      retail: 'bg-purple-100 text-purple-800',
      service: 'bg-green-100 text-green-800',
      fitness: 'bg-red-100 text-red-800',
      default: 'bg-gray-100 text-gray-800'
    }
    return colors[type] || colors.default
  }

  const categories = Array.from(new Set(previews.map(p => p.business_type)))

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Previews</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Building className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Generated Today</p>
              <p className="text-3xl font-bold text-gray-900">{stats.generatedToday}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-3xl font-bold text-gray-900">{stats.pending}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg">
              <Users className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Emails Sent</p>
              <p className="text-3xl font-bold text-gray-900">{stats.withEmailsSent}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <Mail className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-gray-100">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="no-email">No Email Sent</option>
              <option value="opened">Email Opened</option>
              <option value="customer">Customers</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-gray-500" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by business name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {filteredPreviews.length > 0 && (
            <button
              onClick={handleSelectAll}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {selectedPreviews.size === filteredPreviews.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>

        {/* Bulk Actions */}
        {showBulkActions && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-3">
            <span className="text-sm text-gray-600">{selectedPreviews.size} selected</span>
            <button
              onClick={handleBulkSendEmails}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Mail className="w-4 h-4" />
              Send Emails
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Preview Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPreviews.map((preview) => (
          <div
            key={preview.id}
            className={`bg-white rounded-xl shadow-sm border ${
              selectedPreviews.has(preview.id) ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-100'
            } overflow-hidden hover:shadow-lg transition-all duration-200`}
          >
            {/* Selection Checkbox */}
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedPreviews.has(preview.id)}
                  onChange={() => handleSelectPreview(preview.id)}
                  className="w-4 h-4 text-blue-600 rounde focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Select</span>
              </label>
              <button className="p-1 hover:bg-gray-100 rounded-lg">
                <MoreVertical className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Preview Thumbnail */}
            <div className="relative h-48 bg-gray-100">
              <iframe
                src={preview.preview_url}
                className="w-full h-full pointer-events-none"
                style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: '200%', height: '200%' }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
            </div>

            {/* Card Content */}
            <div className="p-4">
              {/* Business Name and Category */}
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">{preview.business_name}</h3>
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getBusinessTypeColor(preview.business_type)}`}>
                  {preview.business_type}
                </span>
              </div>

              {/* Status Badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                  <CheckCircle className="w-3 h-3" />
                  Preview Ready
                </span>
                
                {preview.email_sent && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                    <Mail className="w-3 h-3" />
                    Email Sent
                  </span>
                )}
                
                {preview.email_opened && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                    <MailOpen className="w-3 h-3" />
                    Opened
                  </span>
                )}
                
                {preview.link_clicked && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                    <MousePointer className="w-3 h-3" />
                    Clicked
                  </span>
                )}
                
                {preview.is_customer && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                    <DollarSign className="w-3 h-3" />
                    Customer
                  </span>
                )}
              </div>

              {/* Preview URL */}
              <div className="mb-4">
                <a
                  href={preview.preview_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  {preview.preview_url.replace('https://', '').substring(0, 30)}...
                </a>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={preview.preview_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <Eye className="w-4 h-4" />
                  View
                </a>
                
                <button
                  onClick={() => handleSendEmail(preview)}
                  disabled={preview.email_sent}
                  className={`px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium ${
                    preview.email_sent 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  {preview.email_sent ? 'Sent' : 'Send'}
                </button>
                
                <button
                  onClick={() => handleCopyLink(preview.preview_url)}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </button>
                
                <button
                  onClick={() => handleDelete(preview.id)}
                  className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredPreviews.length === 0 && (
        <div className="text-center py-12">
          <Building className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No previews found</h3>
          <p className="text-gray-600">Try adjusting your filters or search term</p>
        </div>
      )}
    </div>
  )
}
