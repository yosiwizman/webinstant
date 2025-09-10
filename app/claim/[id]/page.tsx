'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface WebsitePreview {
  id: string
  preview_url?: string
  business_id?: string
  title?: string
  description?: string
  created_at?: string
}

export default function ClaimPage() {
  const params = useParams()
  const [preview, setPreview] = useState<WebsitePreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [domainName, setDomainName] = useState('')
  const [domainAvailable, setDomainAvailable] = useState<boolean | null>(null)
  const [checkingDomain, setCheckingDomain] = useState(false)
  const [businessEmail, setBusinessEmail] = useState<string>('')
  const [businessName, setBusinessName] = useState<string>('')
  const [alreadyPaid, setAlreadyPaid] = useState<boolean>(false)

  const fetchWebsitePreview = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error } = await supabase
        .from('website_previews')
        .select('id, preview_url, business_id, created_at')
        .eq('id', params.id)
        .single()

      if (error) throw error
      
      if (!data) {
        throw new Error('Website preview not found')
      }

      setPreview(data)

      // Fetch business email/name for checkout
      if (data.business_id) {
        const { data: biz } = await supabase
          .from('businesses')
          .select('business_name, email')
          .eq('id', data.business_id)
          .single()
        setBusinessEmail(biz?.email || '')
        setBusinessName(biz?.business_name || '')

        // Check if already paid
        const { data: payments } = await supabase
          .from('payment_intents')
          .select('status')
          .eq('business_id', data.business_id)
          .in('status', ['completed', 'succeeded'])
          .limit(1)
        setAlreadyPaid(!!(payments && payments.length > 0))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load website preview')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    fetchWebsitePreview()
  }, [fetchWebsitePreview])

  const checkDomainAvailability = async () => {
    if (!domainName || domainName.length < 3) {
      setDomainAvailable(null)
      return
    }

    setCheckingDomain(true)
    
    // Simulate domain check - replace with actual API call
    setTimeout(() => {
      // Mock availability check
      const isAvailable = Math.random() > 0.3
      setDomainAvailable(isAvailable)
      setCheckingDomain(false)
    }, 1000)
  }

  const handleClaimWebsite = async () => {
    if (!domainName || !domainAvailable) {
      alert('Please select an available domain name first')
      return
    }
    if (!preview?.business_id) {
      alert('Missing business information for checkout')
      return
    }
    try {
      const resp = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: preview.business_id,
          domainName: `${domainName}.com`,
          email: businessEmail || undefined,
          businessName: businessName || undefined,
        })
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Failed to start checkout')
      if (json.checkoutUrl) {
        window.location.href = json.checkoutUrl
      } else {
        alert('Unexpected response from payment API')
      }
    } catch (e) {
      alert((e as Error).message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your website preview...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="bg-red-100 rounded-full p-3 w-16 h-16 mx-auto mb-4">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Preview</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={fetchWebsitePreview}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-gray-100">
      {/* Full-screen iframe */}
      {preview?.preview_url ? (
        <iframe
          src={preview.preview_url}
          className="w-full h-screen border-0"
          title="Website Preview"
          sandbox="allow-scripts allow-same-origin"
        />
      ) : (
        <div className="w-full h-screen flex items-center justify-center text-gray-600">
          Preview URL is not available.
        </div>
      )}

      {/* Floating claim card */}
      <div className="fixed bottom-4 right-4 top-4 w-full max-w-md lg:bottom-auto lg:top-8 lg:right-8 z-50">
        <div className="bg-white rounded-2xl shadow-2xl p-6 lg:p-8 border border-gray-200">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
              Claim This Website
            </h1>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl lg:text-4xl font-bold text-blue-600">$150</span>
              <span className="text-gray-500 text-sm">/year</span>
            </div>
            <p className="text-gray-600 mt-2 text-sm">Everything included for 1 year</p>
          </div>

          {/* What&apos;s included */}
          <div className="bg-blue-50 rounded-xl p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
              <svg className="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              What&apos;s Included:
            </h3>
            <ul className="space-y-2">
              {[
                'Custom domain name (.com)',
                'Premium web hosting',
                'SSL security certificate',
                'Mobile-responsive design',
                'Monthly updates & maintenance',
                '24/7 customer support'
              ].map((item, index) => (
                <li key={index} className="flex items-start text-sm text-gray-700">
                  <svg className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Domain selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Choose Your Domain Name
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={domainName}
                  onChange={(e) => {
                    setDomainName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                    setDomainAvailable(null)
                  }}
                  onBlur={checkDomainAvailability}
                  placeholder="yourbusiness"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-16"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  .com
                </span>
              </div>
              <button
                onClick={checkDomainAvailability}
                disabled={checkingDomain || !domainName}
                className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkingDomain ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-700"></div>
                ) : (
                  'Check'
                )}
              </button>
            </div>
            
            {/* Domain availability status */}
            {domainAvailable !== null && domainName && (
              <div className={`mt-2 text-sm flex items-center ${domainAvailable ? 'text-green-600' : 'text-red-600'}`}>
                {domainAvailable ? (
                  <>
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Great! {domainName}.com is available
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    {domainName}.com is taken. Try another name
                  </>
                )}
              </div>
            )}
          </div>

          {/* CTA Button */}
          {alreadyPaid ? (
            <div className="w-full py-4 bg-green-100 text-green-800 font-semibold rounded-lg text-center">
              Paid — Deployment in progress.
            </div>
          ) : (
            <button
              onClick={handleClaimWebsite}
              disabled={!domainAvailable || !domainName}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-lg shadow-lg"
            >
              Get My Website
            </button>
          )}

          {/* Trust badges */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Secure Payment
              </div>
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                </svg>
                Money-back Guarantee
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
