/**
 * Minimal single-user authentication.
 *
 * The app sits on a public URL and holds a detailed record of what one person
 * eats, drinks and weighs. That is not data to leave open to the internet, so a
 * passcode is required even though there is only ever one user.
 *
 * Tokens are HMAC-SHA256 signed and carry their own expiry. There is no session
 * store to keep in sync, and nothing sensitive is inside the token itself.
 */

const encoder = new TextEncoder()

function base64url(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

/** Constant-time comparison, so a wrong passcode cannot be found by timing. */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const TOKEN_TTL_DAYS = 60

/**
 * @param {string} secret signing secret
 * @param {number} [ttlDays]
 */
export async function issueToken(secret, ttlDays = TOKEN_TTL_DAYS) {
  const payload = {
    sub: 'owner',
    exp: Date.now() + ttlDays * 86_400_000,
    iat: Date.now(),
  }
  const body = base64url(encoder.encode(JSON.stringify(payload)))
  const key = await hmacKey(secret)
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body)))
  return `${body}.${base64url(signature)}`
}

/**
 * @returns {Promise<boolean>} whether the token is well-formed, signed and unexpired
 */
export async function verifyToken(token, secret) {
  if (!token || typeof token !== 'string') return false
  const [body, signature] = token.split('.')
  if (!body || !signature) return false

  try {
    const key = await hmacKey(secret)
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      fromBase64url(signature),
      encoder.encode(body)
    )
    if (!valid) return false

    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(body)))
    return typeof payload.exp === 'number' && payload.exp > Date.now()
  } catch {
    return false
  }
}

/** Check a submitted passcode against the configured one. */
export function checkPasscode(submitted, expected) {
  if (!expected) return false
  return timingSafeEqual(String(submitted || ''), String(expected))
}

/** Pull a bearer token from the Authorization header or the session cookie. */
export function extractToken(request) {
  const header = request.headers.get('authorization')
  if (header && header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim()

  const cookie = request.headers.get('cookie') || ''
  const match = cookie.match(/(?:^|;\s*)ff_session=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

export function sessionCookie(token, ttlDays = TOKEN_TTL_DAYS) {
  const maxAge = ttlDays * 86_400
  return `ff_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${maxAge}`
}

export const clearedCookie = 'ff_session=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0'
