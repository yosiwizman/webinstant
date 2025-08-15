import React from 'react'

interface BaseTemplateProps {
  children: React.ReactNode
  title?: string
}

export default function BaseTemplate({ children, title }: BaseTemplateProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {title && (
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          </div>
        </header>
      )}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
