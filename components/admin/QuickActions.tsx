'use client'

import { useState, MouseEvent } from 'react'
import { 
  PlusIcon, 
  SparklesIcon, 
  PaperAirplaneIcon, 
  MagnifyingGlassIcon, 
  ArrowDownTrayIcon,
  XMarkIcon,
  CloudArrowUpIcon
} from '@heroicons/react/24/outline'

interface ActionButton {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  action: () => Promise<void>
}

// Simple toast implementation since react-hot-toast is not available
const toast = {
  error: (message: string) => {
    console.error(message)
    alert(`Error: ${message}`)
  },
  success: (message: string) => {
    console.log(message)
    alert(`Success: ${message}`)
  },
  loading: (message: string) => {
    console.log(message)
    return message
  },
  dismiss: (_toastId: string) => {
    console.log(`Dismissing toast: ${_toastId}`)
  }
}

// Simple motion components replacement
const AnimatePresence = ({ children }: { children: React.ReactNode }) => <>{children}</>

interface MotionDivProps {
  children: React.ReactNode
  className?: string
  onClick?: (e: MouseEvent) => void
  style?: React.CSSProperties
}

interface MotionButtonProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

const motion = {
  div: ({ children, className, onClick, style }: MotionDivProps) => (
    <div className={className} onClick={onClick} style={style}>{children}</div>
  ),
  button: ({ children, className, onClick }: MotionButtonProps) => (
    <button className={className} onClick={onClick}>{children}</button>
  )
}

export default function QuickActions() {
  const [isOpen, setIsOpen] = useState(false)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  const handleImportBusinesses = async () => {
    setShowImportModal(true)
  }

  const processImportFile = async () => {
    if (!importFile) {
      toast.error('Please select a file to import')
      return
    }

    setLoadingAction('import')
    setUploadProgress(0)

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      const formData = new FormData()
      formData.append('file', importFile)

      const response = await fetch('/api/admin/import-businesses', {
        method: 'POST',
        body: formData
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (!response.ok) throw new Error('Import failed')

      const result = await response.json()
      toast.success(`Successfully imported ${result.count || 0} businesses`)
      setShowImportModal(false)
      setImportFile(null)
    } catch (error) {
      toast.error('Failed to import businesses')
      console.error('Import error:', error)
    } finally {
      setLoadingAction(null)
      setUploadProgress(0)
    }
  }

  const handleGeneratePreviews = async () => {
    setLoadingAction('generate')
    
    try {
      // Show progress toast
      const toastId = toast.loading('Generating previews...')

      const response = await fetch('/api/admin/batch-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          limit: 10,
          onlyMissing: true 
        })
      })

      if (!response.ok) throw new Error('Generation failed')

      const result = await response.json()
      toast.dismiss(toastId)
      toast.success(`Generated ${result.generated || 0} previews successfully`)
    } catch (error) {
      toast.error('Failed to generate previews')
      console.error('Generation error:', error)
    } finally {
      setLoadingAction(null)
    }
  }

  const handleSendCampaign = async () => {
    setLoadingAction('campaign')
    
    try {
      const response = await fetch('/api/campaign/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'quick',
          template: 'default',
          targetAudience: 'no-website'
        })
      })

      if (!response.ok) throw new Error('Campaign send failed')

      const result = await response.json()
      toast.success(`Campaign sent to ${result.sent || 0} businesses`)
    } catch (error) {
      toast.error('Failed to send campaign')
      console.error('Campaign error:', error)
    } finally {
      setLoadingAction(null)
    }
  }

  const handleCheckNoWebsite = async () => {
    setLoadingAction('check')
    
    try {
      const response = await fetch('/api/admin/check-no-website', {
        method: 'GET'
      })

      if (!response.ok) throw new Error('Check failed')

      const result = await response.json()
      toast.success(`Found ${result.count || 0} businesses without websites`)
    } catch (error) {
      toast.error('Failed to check businesses')
      console.error('Check error:', error)
    } finally {
      setLoadingAction(null)
    }
  }

  const handleExportReport = async () => {
    setLoadingAction('export')
    
    try {
      const response = await fetch('/api/admin/export-report', {
        method: 'GET'
      })

      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `report-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast.success('Report downloaded successfully')
    } catch (error) {
      toast.error('Failed to export report')
      console.error('Export error:', error)
    } finally {
      setLoadingAction(null)
    }
  }

  const actions: ActionButton[] = [
    {
      id: 'import',
      label: 'Import Businesses',
      icon: CloudArrowUpIcon,
      color: 'bg-blue-500 hover:bg-blue-600',
      action: handleImportBusinesses
    },
    {
      id: 'generate',
      label: 'Generate Previews',
      icon: SparklesIcon,
      color: 'bg-purple-500 hover:bg-purple-600',
      action: handleGeneratePreviews
    },
    {
      id: 'campaign',
      label: 'Send Campaign',
      icon: PaperAirplaneIcon,
      color: 'bg-green-500 hover:bg-green-600',
      action: handleSendCampaign
    },
    {
      id: 'check',
      label: 'Check No-Website',
      icon: MagnifyingGlassIcon,
      color: 'bg-orange-500 hover:bg-orange-600',
      action: handleCheckNoWebsite
    },
    {
      id: 'export',
      label: 'Export Report',
      icon: ArrowDownTrayIcon,
      color: 'bg-indigo-500 hover:bg-indigo-600',
      action: handleExportReport
    }
  ]

  return (
    <>
      {/* Main FAB */}
      <div className="fixed bottom-6 right-6 z-50">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              className="absolute bottom-16 right-0 flex flex-col gap-3 mb-2"
            >
              {actions.map((action) => {
                const Icon = action.icon
                const isLoading = loadingAction === action.id
                
                return (
                  <motion.div
                    key={action.id}
                    className="flex items-center gap-3"
                  >
                    <span className="bg-gray-900 text-white px-3 py-1 rounded-lg text-sm whitespace-nowrap shadow-lg">
                      {action.label}
                    </span>
                    <button
                      onClick={action.action}
                      disabled={isLoading || loadingAction !== null}
                      className={`
                        ${action.color} 
                        text-white rounded-full p-3 shadow-lg 
                        transition-all duration-200 
                        disabled:opacity-50 disabled:cursor-not-allowed
                        ${!isLoading && !loadingAction ? 'hover:scale-110' : ''}
                      `}
                    >
                      {isLoading ? (
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Icon className="w-6 h-6" />
                      )}
                    </button>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          className={`
            ${isOpen ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'}
            text-white rounded-full p-4 shadow-xl transition-colors duration-200
          `}
        >
          {isOpen ? (
            <XMarkIcon className="w-6 h-6" />
          ) : (
            <PlusIcon className="w-6 h-6" />
          )}
        </motion.button>
      </div>

      {/* Import Modal */}
      <AnimatePresence>
        {showImportModal && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => !loadingAction && setShowImportModal(false)}
          >
            <motion.div
              onClick={(e: MouseEvent) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl"
            >
              <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Import Businesses
              </h3>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-900 dark:text-gray-100
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100
                    dark:file:bg-gray-700 dark:file:text-blue-400"
                  disabled={loadingAction === 'import'}
                />
                {importFile && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Selected: {importFile.name}
                  </p>
                )}
              </div>

              {uploadProgress > 0 && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowImportModal(false)
                    setImportFile(null)
                  }}
                  disabled={loadingAction === 'import'}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 
                    dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={processImportFile}
                  disabled={!importFile || loadingAction === 'import'}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                    transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                    flex items-center gap-2"
                >
                  {loadingAction === 'import' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <CloudArrowUpIcon className="w-4 h-4" />
                      Import
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
