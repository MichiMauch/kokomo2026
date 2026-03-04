/**
 * Lightweight Victron VRM API client
 * Fetches battery charge level from Victron Energy monitoring
 */

const VRM_API_BASE = 'https://vrmapi.victronenergy.com/v2'

// In-memory token cache (survives across warm serverless invocations)
let cachedToken: { token: string; expiresAt: number } | null = null

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token
  }

  const username = import.meta.env.VICTRON_USERNAME
  const password = import.meta.env.VICTRON_PASSWORD

  if (!username || !password) {
    throw new Error('VICTRON_USERNAME and VICTRON_PASSWORD must be set')
  }

  const res = await fetch(`${VRM_API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })

  if (!res.ok) {
    throw new Error(`Victron login failed: ${res.status}`)
  }

  const data = await res.json()
  cachedToken = {
    token: data.token,
    expiresAt: Date.now() + 55 * 60 * 1000, // 55 min (token valid for 1h)
  }

  return data.token
}

export async function getBatteryCharge(): Promise<number> {
  const installationId = import.meta.env.VICTRON_INSTALLATION_ID
  if (!installationId) {
    throw new Error('VICTRON_INSTALLATION_ID must be set')
  }

  const token = await getToken()

  const params = new URLSearchParams({ interval: '15mins' })
  const res = await fetch(
    `${VRM_API_BASE}/installations/${installationId}/stats?${params}`,
    { headers: { 'x-authorization': `Bearer ${token}` } }
  )

  if (!res.ok) {
    // If token expired, clear cache and retry once
    if (res.status === 401) {
      cachedToken = null
      const newToken = await getToken()
      const retry = await fetch(
        `${VRM_API_BASE}/installations/${installationId}/stats?${params}`,
        { headers: { 'x-authorization': `Bearer ${newToken}` } }
      )
      if (!retry.ok) throw new Error(`Victron API error: ${retry.status}`)
      const retryData = await retry.json()
      return extractBatteryCharge(retryData)
    }
    throw new Error(`Victron API error: ${res.status}`)
  }

  const data = await res.json()
  return extractBatteryCharge(data)
}

function extractBatteryCharge(data: any): number {
  const bs = data?.records?.bs
  if (!bs || bs.length === 0) return 0
  return Math.round(bs[bs.length - 1][1] || 0)
}
