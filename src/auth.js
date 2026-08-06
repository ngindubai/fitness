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
 * @param {string} [sub] user id carried inside the token
 * @param {number} [ttlDays]
 */
export async function issueToken(secret, sub = 'owner', ttlDays = TOKEN_TTL_DAYS) {
  const payload = {
    sub,
    exp: Date.now() + ttlDays * 86_400_000,
    iat: Date.now(),
  }
  const body = base64url(encoder.encode(JSON.stringify(payload)))
  const key = await hmacKey(secret)
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body)))
  return `${body}.${base64url(signature)}`
}

/**
 * @returns {Promise<{sub:string}|null>} the token payload when valid, else null.
 * Tokens issued before multi-user carried sub "owner", so old sessions keep
 * working unchanged.
 */
export async function verifyToken(token, secret) {
  if (!token || typeof token !== 'string') return null
  const [body, signature] = token.split('.')
  if (!body || !signature) return null

  try {
    const key = await hmacKey(secret)
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      fromBase64url(signature),
      encoder.encode(body)
    )
    if (!valid) return null

    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(body)))
    if (typeof payload.exp !== 'number' || payload.exp <= Date.now()) return null
    return { sub: typeof payload.sub === 'string' && payload.sub ? payload.sub : 'owner' }
  } catch {
    return null
  }
}

// -------------------------------------------------------- passcode hashing

/**
 * PBKDF2-SHA256 at 1,000 iterations. Deliberately light: Workers' free tier
 * allows ~10 ms of CPU per request and login verifies against every stored
 * user, so a heavyweight KDF would blow the budget. The honest note is that
 * short passcodes are the real weakness here, not the iteration count -
 * anyone who can dump the database of a passcode-only app has already won.
 */
const PBKDF2_ITERATIONS = 1000

function toHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex) {
  return Uint8Array.from(hex.match(/.{2}/g) || [], (pair) => parseInt(pair, 16))
}

async function pbkdf2(passcode, saltBytes) {
  const material = await crypto.subtle.importKey(
    'raw', encoder.encode(String(passcode)), 'PBKDF2', false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: PBKDF2_ITERATIONS },
    material,
    256
  )
  return new Uint8Array(bits)
}

/** @returns {Promise<{salt:string, hash:string}>} hex-encoded */
export async function hashPasscode(passcode) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16))
  const hash = await pbkdf2(passcode, saltBytes)
  return { salt: toHex(saltBytes), hash: toHex(hash) }
}

export async function verifyPasscodeHash(passcode, salt, expectedHash) {
  if (!salt || !expectedHash) return false
  const hash = toHex(await pbkdf2(passcode, fromHex(salt)))
  return timingSafeEqual(hash, expectedHash)
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
