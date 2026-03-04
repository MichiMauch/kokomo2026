/**
 * Shared admin authentication helpers
 * Used by all /api/admin/* endpoints
 */

export async function hashSession(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + salt)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function isAuthenticated(request: Request): Promise<boolean> {
  const cookie = request.headers.get('cookie') || ''
  const match = cookie.match(/admin_session=([^;]+)/)
  if (!match) return false

  const adminPassword = import.meta.env.ADMIN_PASSWORD
  if (!adminPassword) return false

  const expected = await hashSession(adminPassword, 'kokomo-admin-salt')
  return match[1] === expected
}
