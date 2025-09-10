import fetch from 'node-fetch'

const VERCEL_API_BASE = 'https://api.vercel.com'

function authHeaders() {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
    'Content-Type': 'application/json',
  }
  return headers
}

function withTeam(query: Record<string, string | undefined> = {}) {
  const teamId = process.env.VERCEL_TEAM_ID
  return teamId ? { ...query, teamId } : query
}

function buildUrl(path: string, query: Record<string, string | undefined> = {}) {
  const url = new URL(VERCEL_API_BASE + path)
  const q = withTeam(query)
  Object.entries(q).forEach(([k, v]) => v && url.searchParams.set(k, v))
  return url.toString()
}

export async function addDomainToProject(domain: string) {
  const projectId = process.env.VERCEL_PROJECT_ID
  if (!projectId) throw new Error('VERCEL_PROJECT_ID is not set')

  const url = buildUrl(`/v10/projects/${projectId}/domains`)
  const resp = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name: domain })
  })

  const json = await resp.json()
  if (!resp.ok) {
    throw new Error(json?.error?.message || JSON.stringify(json))
  }
  return json
}

export async function verifyProjectDomain(domain: string) {
  const projectId = process.env.VERCEL_PROJECT_ID
  if (!projectId) throw new Error('VERCEL_PROJECT_ID is not set')

  const url = buildUrl(`/v10/projects/${projectId}/domains/${domain}/verify`)
  const resp = await fetch(url, { method: 'POST', headers: authHeaders() })
  const json = await resp.json()
  if (!resp.ok) {
    throw new Error(json?.error?.message || JSON.stringify(json))
  }
  return json
}

