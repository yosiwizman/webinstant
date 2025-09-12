'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react'
import { getBrowserSupabase } from '@/lib/supabaseClient'
import { 
  CheckCircleIcon, 
  InformationCircleIcon, 
  ExclamationTriangleIcon, 
  XCircleIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  EnvelopeIcon,
  DocumentIcon,
  UserPlusIcon,
  ClockIcon,
  CodeBracketIcon,
  ServerIcon
} from '@heroicons/react/24/outline'

interface Operation {
  id: string
  created_at: string
  operation_type: string
  status: 'success' | 'info' | 'warning' | 'error'
  message: string
  details?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

interface DailySummary {
  totalOperations: number
  byType: Record<string, number>
  successRate: number
  errorCount: number
}

export default function OperationsLog() {
  const [operations, setOperations] = useState<Operation[]>([])
  const [filteredOperations, setFilteredOperations] = useState<Operation[]>([])
  const [dailySummary, setDailySummary] = useState<DailySummary>({
    totalOperations: 0,
    byType: {},
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
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

const supabase: any = getBrowserSupabase()

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
  const formatShortTime = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  // Calculate daily summary
  const calculateDailySummary = (ops: Operation[]) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const todayOps = ops.filter(op => new Date(op.created_at) >= today)
    
    const summary: DailySummary = {
      totalOperations: todayOps.length,
      byType: {},
      successRate: 0,
      errorCount: 0
    }
    
    // Count by type
    todayOps.forEach(op => {
      if (!summary.byType[op.operation_type]) {
        summary.byType[op.operation_type] = 0
      }
      summary.byType[op.operation_type]++
      
      if (op.status === 'error') summary.errorCount++
    })
    
    const successCount = todayOps.filter(op => op.status === 'success').length
    summary.successRate = todayOps.length > 0 ? (successCount / todayOps.length) * 100 : 0
    
    setDailySummary(summary)
  }

  // Load operations from database
  const loadOperations = useCallback(async () => {
    try {
      setIsLoading(true)
      setHasError(false)
      
      // Query operations_log table
      const { data, error } = await supabase
        .from('operations_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Error loading operations:', error)
        setHasError(true)
        return
      }

      if (data) {
        setOperations(data)
        calculateDailySummary(data)
      }
    } catch (error) {
      console.error('Error loading operations:', error)
      setHasError(true)
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    await loadOperations()
    setLastRefresh(new Date())
    setTimeout(() => setIsRefreshing(false), 500)
  }, [loadOperations])

  // Initial load only - no auto-refresh
  useEffect(() => {
    loadOperations()
  }, [loadOperations])

  // Filter operations
  useEffect(() => {
    let filtered = [...operations]
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(op => 
        op.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(op.details).toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(op => op.operation_type === filterType)
    }
    
    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(op => op.status === filterStatus)
    }
    
    // Date range filter
    if (dateRange.start) {
      const startDate = new Date(dateRange.start)
      filtered = filtered.filter(op => new Date(op.created_at) >= startDate)
    }
    if (dateRange.end) {
      const endDate = new Date(dateRange.end)
      endDate.setHours(23, 59, 59, 999)
      filtered = filtered.filter(op => new Date(op.created_at) <= endDate)
    }
    
    setFilteredOperations(filtered)
  }, [operations, searchTerm, filterType, filterStatus, dateRange])

  const getStatusColor = (status: Operation['status']) => {
    switch (status) {
      case 'success': return 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/50'
      case 'info': return 'text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50'
      case 'warning': return 'text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/50'
      case 'error': return 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/50'
      default: return 'text-gray-700 dark:text-gray-400 bg-gray-100 dark:bg-gray-700'
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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email_sent': 
      case 'email_opened':
      case 'email_clicked':
        return <EnvelopeIcon className="w-4 h-4" />
      case 'preview_generated': 
      case 'website_created':
        return <DocumentIcon className="w-4 h-4" />
      case 'business_imported': 
      case 'business_created':
      case 'business_updated':
        return <UserPlusIcon className="w-4 h-4" />
      case 'api_call':
      case 'api_error':
        return <ServerIcon className="w-4 h-4" />
      default: 
        return <CodeBracketIcon className="w-4 h-4" />
    }
  }

  // Get unique operation types for filter
  const uniqueTypes = Array.from(new Set(operations.map(op => op.operation_type)))

  return (
    <div className="space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Operations Log</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Last refresh: {formatTime(lastRefresh)}
          </span>
          <button
            onClick={handleRefresh}
            className={`p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all ${
              isRefreshing ? 'animate-spin' : ''
            }`}
          >
            <ArrowPathIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>
      </div>

      {/* Daily Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Today&apos;s Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-300">Total Operations</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{dailySummary.totalOperations}</p>
          </div>
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-300">Success Rate</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{dailySummary.successRate.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-300">Errors</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{dailySummary.errorCount}</p>
          </div>
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-300">Emails Sent</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {dailySummary.byType['email_sent'] || 0}
            </p>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1">
              <DocumentIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
              <span className="text-gray-700 dark:text-gray-300">
                Previews: {dailySummary.byType['preview_generated'] || 0}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <UserPlusIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
              <span className="text-gray-700 dark:text-gray-300">
                Imports: {dailySummary.byType['business_imported'] || 0}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <ServerIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
              <span className="text-gray-700 dark:text-gray-300">
                API Calls: {dailySummary.byType['api_call'] || 0}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search operations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Types</option>
            {uniqueTypes.map(type => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
          
          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Activity Feed</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
            {isLoading ? 'Loading...' : 
             hasError ? 'Unable to load operations' :
             filteredOperations.length === 0 && operations.length === 0 ? 
             'No operations logged yet' :
             `Showing ${filteredOperations.length} of ${operations.length} operations`}
          </p>
        </div>
        
        <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
          {isLoading ? (
            <div className="px-6 py-12 text-center">
              <div className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
                Loading operations...
              </div>
            </div>
          ) : hasError ? (
            <div className="px-6 py-12 text-center text-gray-700 dark:text-gray-300">
              No operations yet. Start by importing businesses or sending emails!
            </div>
          ) : filteredOperations.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-700 dark:text-gray-300">
              {operations.length === 0 ? 
                'No operations logged yet. Start by importing businesses or sending emails!' :
                'No operations found matching your filters'}
            </div>
          ) : (
            filteredOperations.map((operation) => (
              <div key={operation.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-start gap-4">
                  {/* Status Icon */}
                  <div className={`p-2 rounded-lg ${getStatusColor(operation.status)}`}>
                    {getStatusIcon(operation.status)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700 dark:text-gray-300">
                        {getTypeIcon(operation.operation_type)}
                      </span>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{operation.message}</p>
                    </div>
                    {operation.details && (
                      <div className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                        {typeof operation.details === 'object' ? (
                          <pre className="font-sans whitespace-pre-wrap">
                            {JSON.stringify(operation.details, null, 2)}
                          </pre>
                        ) : (
                          <p>{operation.details}</p>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Timestamp */}
                  <div className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    <ClockIcon className="w-4 h-4" />
                    {formatShortTime(operation.created_at)}
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
