"use client"

import React from "react"

export default function ClientActions({ previewUrl }: { previewUrl?: string | null }) {
  if (!previewUrl) return null
  return (
    <div className="flex flex-wrap gap-2">
      <button
        className="rounded-xl bg-gray-100 px-4 py-2 hover:bg-gray-200"
        onClick={() => navigator.clipboard.writeText(String(previewUrl))}
      >
        Copy Preview Link
      </button>
    </div>
  )
}