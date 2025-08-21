'use client'

import { useState, useEffect } from 'react'
import { 
  CheckCircleIcon, 
  InformationCircleIcon, 
  ExclamationTriangleIcon, 
  XCircleIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  EnvelopeIcon,
  DocumentIcon,
  UserPlusIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

interface Operation {
  id: string
  timestamp: Date
  type: 'email_sent' | 'preview_generated' | 'business_imported' | 'api_warning' | 'error'
  status: 'success' | 'info' | 'warning' | 'error'
  message: string
  details?: string
}

interface DailySummary {
  totalOperations: number
  byType: {
    email_sent: number
    preview_generated: number
    business_imported: number
    api_warning: number
    error: number
  }
  successRate: number
  errorCount: number
}

export default function OperationsLog() {
  const [operations, setOperations] = useState<Operation[]>([])
  const [filteredOperations, setFilteredOperations] = useState<Operation[]>([])
  const [dailySummary, setDailySummary] = useState<DailySummary>({
    totalOperations: 0,
    byType: {
      email_sent: 0,
      preview_generated: 0,
      business_imported: 0,
      api_warning: 0,
      error: 0
    },
    successRate: 0,
    errorCount: 0
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  // Format time helper function
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: true 
    })
  }

  // Format short time helper function
  const formatShortTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
  }

  // Mock data generator for demonstration
  const generateMockOperations = (): Operation[] => {
    const mockOperations: Operation[] = [
      {
        id: '1',
        timestamp: new Date(Date.now() - 60000),
        type: 'email_sent',
        status: 'success',
        message: "Email sent to Joe's Pizza",
        details: 'Campaign: Website Ready'
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 120000),
        type: 'preview_generated',
        status: 'success',
        message: "Preview generated for Bella's Salon",
        details: 'Template: Service Business'
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 180000),
        type: 'api_warning',
        status: 'warning',
        message: 'Together AI rate limit approaching',
        details: '80% of hourly limit reached'
      },
      {
        id: '4',
        timestamp: new Date(Date.now() - 240000),
        type: 'business_imported',
        status: 'info',
        message: 'New business imported: Fresh Flowers Co.',
        details: 'Source: CSV Upload'
      },
      {
        id: '5',
        timestamp: new Date(Date.now() - 300000),
        type: 'error',
        status: 'error',
        message: 'Failed to send email to invalid@example.com',
        details: 'Error: Invalid email address'
      },
      {
        id: '6',
        timestamp: new Date(Date.now() - 360000),
        type: 'email_sent',
        status: 'success',
        message: 'Email sent to Sunshine Cleaners',
        details: 'Campaign: Follow-up'
      },
      {
        id: '7',
        timestamp: new Date(Date.now() - 420000),
        type: 'preview_generated',
        status: 'success',
        message: 'Preview generated for City Dental',
        details: 'Template: Healthcare'
      },
      {
        id: '8',
        timestamp: new Date(Date.now() - 480000),
        type: 'business_imported',
        status: 'info',
        message: '5 businesses imported from batch upload',
        details: 'Source: API Integration'
      }
    ]
    
    // Add more operations to reach 50
    for (let i = 9; i <= 50; i++) {
      const types: Operation['type'][] = ['email_sent', 'preview_generated', 'business_imported', 'api_warning', 'error']
      const type = types[Math.floor(Math.random() * types.length)]
      const status = type === 'error' ? 'error' : 
                     type === 'api_warning' ? 'warning' :
                     type === 'business_imported' ? 'info' : 'success'
      
      mockOperations.push({
        id: i.toString(),
        timestamp: new Date(Date.now() - (i * 60000)),
        type,
        status,
        message: generateMessage(type, i),
        details: generateDetails(type)
      })
    }
    
    return mockOperations
  }

  const generateMessage = (type: Operation['type'], index: number): string => {
    const messages = {
      email_sent: [`Email sent to Business ${index}`, `Follow-up sent to Client ${index}`, `Reminder sent to Shop ${index}`],
      preview_generated: [`Preview generated for Company ${index}`, `Website created for Store ${index}`],
      business_imported: [`Business ${index} imported`, `New lead added: Business ${index}`],
      api_warning: ['API rate limit warning', 'Slow response time detected', 'Queue backlog warning'],
      error: [`Failed to send email to business${index}@example.com`, `Preview generation failed`, `Import error for row ${index}`]
    }
    const typeMessages = messages[type]
    return typeMessages[Math.floor(Math.random() * typeMessages.length)]
  }

  const generateDetails = (type: Operation['type']): string => {
    const details = {
      email_sent: ['Campaign: Website Ready', 'Campaign: Follow-up', 'Campaign: Special Offer'],
      preview_generated: ['Template: Restaurant', 'Template: Service', 'Template: Retail'],
      business_imported: ['Source: CSV Upload', 'Source: Manual Entry', 'Source: API'],
      api_warning: ['75% of limit reached', 'Response time > 5s', 'Queue size: 100+'],
      error: ['Invalid email', 'Network timeout', 'Template error']
    }
    const typeDetails = details[type]
    return typeDetails[Math.floor(Math.random() * typeDetails.length)]
  }

  // Load operations and calculate summary
  useEffect(() => {
    const loadOperations = () => {
      const ops = generateMockOperations()
      setOperations(ops)
      calculateDailySummary(ops)
    }
    
    loadOperations()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      setIsRefreshing(true)
      loadOperations()
      setLastRefresh(new Date())
      setTimeout(() => setIsRefreshing(false), 500)
    }, 30000)
    
    return () => clearInterval(interval)
  }, [])

  // Calculate daily summary
  const calculateDailySummary = (ops: Operation[]) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const todayOps = ops.filter(op => op.timestamp >= today)
    
    const summary: DailySummary = {
      totalOperations: todayOps.length,
      byType: {
        email_sent: 0,
        preview_generated: 0,
        business_imported: 0,
        api_warning: 0,
        error: 0
      },
      successRate: 0,
      errorCount: 0
    }
    
    todayOps.forEach(op => {
      summary.byType[op.type]++
      if (op.status === 'error') summary.errorCount++
    })
    
    const successCount = todayOps.filter(op => op.status === 'success').length
    summary.successRate = todayOps.length > 0 ? (successCount / todayOps.length) * 100 : 0
    
    setDailySummary(summary)
  }

  // Filter operations
  useEffect(() => {
    let filtered = [...operations]
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(op => 
        op.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.details?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(op => op.type === filterType)
    }
    
    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(op => op.status === filterStatus)
    }
    
    // Date range filter
    if (dateRange.start) {
      const startDate = new Date(dateRange.start)
      filtered = filtered.filter(op => op.timestamp >= startDate)
    }
    if (dateRange.end) {
      const endDate = new Date(dateRange.end)
      endDate.setHours(23, 59, 59, 999)
      filtered = filtered.filter(op => op.timestamp <= endDate)
    }
    
    setFilteredOperations(filtered)
  }, [operations, searchTerm, filterType, filterStatus, dateRange])

  const getStatusColor = (status: Operation['status']) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-50'
      case 'info': return 'text-blue-600 bg-blue-50'
      case 'warning': return 'text-yellow-600 bg-yellow-50'
      case 'error': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusIcon = (status: Operation['status']) => {
    switch (status) {
      case 'success': return <CheckCircleIcon className="w-5 h-5" />
      case 'info': return <InformationCircleIcon className="w-5 h-5" />
      case 'warning': return <ExclamationTriangleIcon className="w-5 h-5" />
      case 'error': return <XCircleIcon className="w-5 h-5" />
      default: return null
    }
  }

  const getTypeIcon = (type: Operation['type']) => {
    switch (type) {
      case 'email_sent': return <EnvelopeIcon className="w-4 h-4" />
      case 'preview_generated': return <DocumentIcon className="w-4 h-4" />
      case 'business_imported': return <UserPlusIcon className="w-4 h-4" />
      default: return null
    }
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    const ops = generateMockOperations()
    setOperations(ops)
    calculateDailySummary(ops)
    setLastRefresh(new Date())
    setTimeout(() => setIsRefreshing(false), 500)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Operations Log</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            Last refresh: {formatTime(lastRefresh)}
          </span>
          <button
            onClick={handleRefresh}
            className={`p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-all ${
              isRefreshing ? 'animate-spin' : ''
            }`}
          >
            <ArrowPathIcon className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Daily Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Total Operations</p>
            <p className="text-2xl font-bold text-gray-900">{dailySummary.totalOperations}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Success Rate</p>
            <p className="text-2xl font-bold text-green-600">{dailySummary.successRate.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Errors</p>
            <p className="text-2xl font-bold text-red-600">{dailySummary.errorCount}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Emails Sent</p>
            <p className="text-2xl font-bold text-blue-600">{dailySummary.byType.email_sent}</p>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1">
              <DocumentIcon className="w-4 h-4 text-gray-500" />
              <span className="text-gray-600">Previews: {dailySummary.byType.preview_generated}</span>
            </span>
            <span className="flex items-center gap-1">
              <UserPlusIcon className="w-4 h-4 text-gray-500" />
              <span className="text-gray-600">Imports: {dailySummary.byType.business_imported}</span>
            </span>
            <span className="flex items-center gap-1">
              <ExclamationTriangleIcon className="w-4 h-4 text-yellow-500" />
              <span className="text-gray-600">Warnings: {dailySummary.byType.api_warning}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search operations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Types</option>
            <option value="email_sent">Email Sent</option>
            <option value="preview_generated">Preview Generated</option>
            <option value="business_imported">Business Imported</option>
            <option value="api_warning">API Warning</option>
            <option value="error">Error</option>
          </select>
          
          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
          
          {/* Date Range */}
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Activity Feed</h3>
          <p className="text-sm text-gray-500 mt-1">Showing {filteredOperations.length} of {operations.length} operations</p>
        </div>
        
        <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
          {filteredOperations.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No operations found matching your filters
            </div>
          ) : (
            filteredOperations.map((operation) => (
              <div key={operation.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-4">
                  {/* Status Icon */}
                  <div className={`p-2 rounded-lg ${getStatusColor(operation.status)}`}>
                    {getStatusIcon(operation.status)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(operation.type)}
                      <p className="text-sm font-medium text-gray-900">{operation.message}</p>
                    </div>
                    {operation.details && (
                      <p className="text-sm text-gray-500 mt-1">{operation.details}</p>
                    )}
                  </div>
                  
                  {/* Timestamp */}
                  <div className="flex items-center gap-1 text-sm text-gray-500 whitespace-nowrap">
                    <ClockIcon className="w-4 h-4" />
                    {formatShortTime(operation.timestamp)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
