// Common type definitions
export interface User {
  id: string
  email: string
  name?: string
  createdAt: Date
  updatedAt: Date
}

export interface Business {
  id: string
  name: string
  address: string
  phone?: string
  email?: string
  ownerId?: string
  claimedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
