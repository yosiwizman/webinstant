// Standard query configuration to prevent flickering
export const queryConfig = {
  refetchInterval: false,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: false,
  retry: false,
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
}

// Standard color classes for consistency and better visibility
export const adminStyles = {
  // Layout containers
  page: "min-h-screen bg-gray-50 dark:bg-gray-900 p-6",
  container: "max-w-7xl mx-auto space-y-6",
  
  // Cards and panels
  card: "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-6",
  cardHover: "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow",
  
  // Typography
  heading: "text-2xl font-bold text-gray-900 dark:text-white",
  subheading: "text-xl font-semibold text-gray-900 dark:text-white",
  text: "text-gray-700 dark:text-gray-300",
  textMuted: "text-gray-500 dark:text-gray-400",
  label: "text-sm font-medium text-gray-600 dark:text-gray-400",
  
  // Form elements
  input: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent",
  select: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent",
  
  // Buttons
  buttonPrimary: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  buttonSecondary: "px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors",
  buttonDanger: "px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors",
  
  // Tables
  tableHeader: "text-left py-3 px-4 font-medium text-gray-900 dark:text-white",
  tableCell: "py-3 px-4 text-gray-700 dark:text-gray-300",
  tableRow: "border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50",
  
  // Status badges
  badgeSuccess: "px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded-full",
  badgeWarning: "px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-medium rounded-full",
  badgeError: "px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium rounded-full",
  badgeInfo: "px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium rounded-full",
  
  // Alerts
  alertSuccess: "border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 rounded-lg p-4",
  alertWarning: "border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4",
  alertError: "border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-lg p-4",
  alertInfo: "border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4",
}

// Debounce function to prevent excessive re-renders
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }
    
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}

// Cache manager for preventing unnecessary fetches
export class DataCache<T> {
  private cache: Map<string, { data: T; timestamp: number }> = new Map()
  private ttl: number // Time to live in milliseconds
  
  constructor(ttlMinutes: number = 5) {
    this.ttl = ttlMinutes * 60 * 1000
  }
  
  set(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }
  
  get(key: string): T | null {
    const cached = this.cache.get(key)
    if (!cached) return null
    
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key)
      return null
    }
    
    return cached.data
  }
  
  clear(): void {
    this.cache.clear()
  }
  
  has(key: string): boolean {
    const cached = this.cache.get(key)
    if (!cached) return false
    
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key)
      return false
    }
    
    return true
  }
}

// Format utilities
export const formatters = {
  currency: (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount)
  },
  
  percentage: (value: number) => {
    return `${value.toFixed(1)}%`
  },
  
  number: (value: number) => {
    return new Intl.NumberFormat('en-US').format(value)
  },
  
  date: (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  },
  
  dateTime: (date: string | Date) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  },
  
  timeAgo: (date: string | Date) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    
    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }
}
