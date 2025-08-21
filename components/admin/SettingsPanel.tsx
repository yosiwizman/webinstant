'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

interface Settings {
  apiKeys: {
    resend: string
    openai: string
    together: string
    supabase_url: string
    supabase_anon: string
  }
  email: {
    defaultTemplate: string
    sendTime: string
    dailyLimit: number
    fromName: string
    fromEmail: string
  }
  automation: {
    enabled: boolean
    dailyTarget: number
    priorityRules: {
      newBusinesses: boolean
      followUps: boolean
      reminders: boolean
    }
  }
  notifications: {
    paymentAlerts: boolean
    lowBalanceWarnings: boolean
    dailySummary: boolean
    alertEmail: string
  }
}

const defaultSettings: Settings = {
  apiKeys: {
    resend: '',
    openai: '',
    together: '',
    supabase_url: '',
    supabase_anon: ''
  },
  email: {
    defaultTemplate: 'website_ready',
    sendTime: '09:00',
    dailyLimit: 100,
    fromName: 'Your Business',
    fromEmail: 'hello@yourbusiness.com'
  },
  automation: {
    enabled: false,
    dailyTarget: 50,
    priorityRules: {
      newBusinesses: true,
      followUps: true,
      reminders: false
    }
  },
  notifications: {
    paymentAlerts: true,
    lowBalanceWarnings: true,
    dailySummary: false,
    alertEmail: ''
  }
}

export default function SettingsPanel() {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingApi, setTestingApi] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, boolean>>({})
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({})
  const [activeTab, setActiveTab] = useState<'api' | 'email' | 'automation' | 'notifications'>('api')
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const loadSettings = useCallback(async () => {
    try {
      // First try to load from Supabase
      const { data } = await supabase
        .from('admin_settings')
        .select('*')
        .single()

      if (data) {
        setSettings(data.settings as Settings)
      } else {
        // Fall back to localStorage
        const localSettings = localStorage.getItem('adminSettings')
        if (localSettings) {
          setSettings(JSON.parse(localSettings))
        }
      }
    } catch {
      // Try localStorage as fallback
      const localSettings = localStorage.getItem('adminSettings')
      if (localSettings) {
        setSettings(JSON.parse(localSettings))
      }
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const saveSettings = async () => {
    setSaving(true)
    try {
      // Save to localStorage first (immediate)
      localStorage.setItem('adminSettings', JSON.stringify(settings))

      // Then save to Supabase
      const { error } = await supabase
        .from('admin_settings')
        .upsert({
          id: 'default',
          settings,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      // Show success message
      alert('Settings saved successfully!')
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Settings saved locally but failed to sync to database')
    } finally {
      setSaving(false)
    }
  }

  const testApiConnection = async (apiName: string) => {
    setTestingApi(apiName)
    try {
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          apiName,
          apiKey: settings.apiKeys[apiName as keyof typeof settings.apiKeys]
        })
      })

      const result = await response.json()
      setTestResults(prev => ({ ...prev, [apiName]: result.success }))
      
      if (result.success) {
        alert(`✅ ${apiName.toUpperCase()} connection successful!`)
      } else {
        alert(`❌ ${apiName.toUpperCase()} connection failed: ${result.error}`)
      }
    } catch {
      setTestResults(prev => ({ ...prev, [apiName]: false }))
      alert(`❌ Failed to test ${apiName} connection`)
    } finally {
      setTestingApi(null)
    }
  }

  const maskApiKey = (key: string) => {
    if (!key) return ''
    if (key.length <= 8) return '••••••••'
    return `${key.slice(0, 4)}••••••••${key.slice(-4)}`
  }

  const updateApiKey = (keyName: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      apiKeys: {
        ...prev.apiKeys,
        [keyName]: value
      }
    }))
  }

  const updateEmailSettings = (field: string, value: string | number) => {
    setSettings(prev => ({
      ...prev,
      email: {
        ...prev.email,
        [field]: value
      }
    }))
  }

  const updateAutomation = (field: string, value: boolean | number) => {
    if (field.includes('.')) {
      const [, child] = field.split('.')
      setSettings(prev => ({
        ...prev,
        automation: {
          ...prev.automation,
          priorityRules: {
            ...prev.automation.priorityRules,
            [child]: value
          }
        }
      }))
    } else {
      setSettings(prev => ({
        ...prev,
        automation: {
          ...prev.automation,
          [field]: value
        }
      }))
    }
  }

  const updateNotifications = (field: string, value: boolean | string) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [field]: value
      }
    }))
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex space-x-8 px-6">
          <button
            onClick={() => setActiveTab('api')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'api'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            API Keys
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'email'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Email Settings
          </button>
          <button
            onClick={() => setActiveTab('automation')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'automation'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Automation
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'notifications'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Notifications
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* API Keys Section */}
        {activeTab === 'api' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              API Configuration
            </h3>
            
            {Object.entries(settings.apiKeys).map(([key, value]) => (
              <div key={key} className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {key.replace(/_/g, ' ').toUpperCase()}
                </label>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 relative">
                    <input
                      type={showApiKey[key] ? 'text' : 'password'}
                      value={showApiKey[key] ? value : maskApiKey(value)}
                      onChange={(e) => {
                        if (showApiKey[key]) {
                          updateApiKey(key, e.target.value)
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      readOnly={!showApiKey[key]}
                    />
                    <button
                      onClick={() => setShowApiKey(prev => ({ ...prev, [key]: !prev[key] }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    >
                      {showApiKey[key] ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <button
                    onClick={() => testApiConnection(key)}
                    disabled={testingApi === key || !value}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      testResults[key] === true
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        : testResults[key] === false
                        ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {testingApi === key ? 'Testing...' : 'Test'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Email Settings Section */}
        {activeTab === 'email' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Email Configuration
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default Template
              </label>
              <select
                value={settings.email.defaultTemplate}
                onChange={(e) => updateEmailSettings('defaultTemplate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="website_ready">Website Ready</option>
                <option value="follow_up">Follow Up</option>
                <option value="reminder">Reminder</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Send Time
                </label>
                <input
                  type="time"
                  value={settings.email.sendTime}
                  onChange={(e) => updateEmailSettings('sendTime', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Daily Limit
                </label>
                <input
                  type="number"
                  value={settings.email.dailyLimit}
                  onChange={(e) => updateEmailSettings('dailyLimit', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  From Name
                </label>
                <input
                  type="text"
                  value={settings.email.fromName}
                  onChange={(e) => updateEmailSettings('fromName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  From Email
                </label>
                <input
                  type="email"
                  value={settings.email.fromEmail}
                  onChange={(e) => updateEmailSettings('fromEmail', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* Automation Section */}
        {activeTab === 'automation' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Automation Settings
            </h3>

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">Auto-Campaign</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Automatically send campaigns to new businesses
                </p>
              </div>
              <button
                onClick={() => updateAutomation('enabled', !settings.automation.enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.automation.enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.automation.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Daily Target
              </label>
              <input
                type="number"
                value={settings.automation.dailyTarget}
                onChange={(e) => updateAutomation('dailyTarget', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Number of businesses to contact per day
              </p>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Priority Rules</h4>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.automation.priorityRules.newBusinesses}
                    onChange={(e) => updateAutomation('priorityRules.newBusinesses', e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Prioritize new businesses
                  </span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.automation.priorityRules.followUps}
                    onChange={(e) => updateAutomation('priorityRules.followUps', e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Send follow-ups after 3 days
                  </span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.automation.priorityRules.reminders}
                    onChange={(e) => updateAutomation('priorityRules.reminders', e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Send reminders after 7 days
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Section */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Notification Preferences
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Alert Email Address
              </label>
              <input
                type="email"
                value={settings.notifications.alertEmail}
                onChange={(e) => updateNotifications('alertEmail', e.target.value)}
                placeholder="admin@example.com"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Payment Alerts</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Get notified when a business makes a payment
                  </p>
                </div>
                <button
                  onClick={() => updateNotifications('paymentAlerts', !settings.notifications.paymentAlerts)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.notifications.paymentAlerts ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.notifications.paymentAlerts ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Low Balance Warnings</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Alert when email credits are running low
                  </p>
                </div>
                <button
                  onClick={() => updateNotifications('lowBalanceWarnings', !settings.notifications.lowBalanceWarnings)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.notifications.lowBalanceWarnings ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.notifications.lowBalanceWarnings ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Daily Summary</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Receive a daily summary of all activities
                  </p>
                </div>
                <button
                  onClick={() => updateNotifications('dailySummary', !settings.notifications.dailySummary)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.notifications.dailySummary ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.notifications.dailySummary ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
