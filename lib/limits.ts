export type Provider = 'together_ai' | 'anthropic' | 'replicate' | 'serpapi' | 'resend' | 'tinypng'

interface WindowState {
  errors: number
  cost: number
  windowStart: number
}

const state: Record<Provider, WindowState> = {
  together_ai: { errors: 0, cost: 0, windowStart: Date.now() },
  anthropic: { errors: 0, cost: 0, windowStart: Date.now() },
  replicate: { errors: 0, cost: 0, windowStart: Date.now() },
  serpapi: { errors: 0, cost: 0, windowStart: Date.now() },
  resend: { errors: 0, cost: 0, windowStart: Date.now() },
  tinypng: { errors: 0, cost: 0, windowStart: Date.now() },
}

function windowMs() {
  const mins = parseInt(process.env.LIMITS_WINDOW_MINUTES || '60', 10)
  return mins * 60 * 1000
}

function thresholds() {
  return {
    maxErrors: parseInt(process.env.LIMITS_MAX_ERRORS || '20', 10),
    maxDailyCost: parseFloat(process.env.LIMITS_MAX_DAILY_COST || '50'),
  }
}

export function recordError(provider: Provider) {
  resetWindowIfNeeded(provider)
  state[provider].errors += 1
}

export function recordCost(provider: Provider, delta: number) {
  resetWindowIfNeeded(provider)
  state[provider].cost += Math.max(0, delta)
}

export function canProceed(provider: Provider) {
  resetWindowIfNeeded(provider)
  const t = thresholds()
  return state[provider].errors < t.maxErrors && state[provider].cost < t.maxDailyCost
}

function resetWindowIfNeeded(provider: Provider) {
  const now = Date.now()
  if (now - state[provider].windowStart > windowMs()) {
    state[provider] = { errors: 0, cost: 0, windowStart: now }
  }
}

