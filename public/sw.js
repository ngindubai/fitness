/**
 * Service worker.
 *
 * Its only job is to make the app installable and to keep the shell loading
 * when the phone has no signal. API requests are never cached — a stale
 * calorie total is worse than an error message.
 *
 * Hard-learned rules baked in here:
 * - Cloudflare serves "/index.html" as a 307 redirect to "/", and Chrome
 *   refuses redirected responses for page navigations (a blank white page).
 *   So the shell caches "/" only, and only clean 200s are ever stored.
 * - A failed asset request must NEVER fall back to HTML: serving index.html
 *   where app.js was expected is a syntax error and a dead app.
 * - Only same-version assets may be cached together, or a mixed old/new
 *   index.html + app.js pair crashes on missing elements. The cache name is
 *   versioned and old caches are dropped on activate.
 */

const CACHE = 'fitness-shell-v7'
const SHELL = ['/', '/app.js', '/movements.js', '/anim.js', '/styles.css', '/icon.svg', '/manifest.webmanifest']

/** Only clean, non-redirected 200s are worth keeping. */
const cacheable = (response) =>
  response && response.ok && !response.redirected && (response.type === 'basic' || response.type === 'default')

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then(async (cache) => {
        for (const url of SHELL) {
          try {
            const response = await fetch(url, { cache: 'no-cache' })
            if (cacheable(response)) await cache.put(url, response)
          } catch { /* a missed shell asset falls back to the network later */ }
        }
      })
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.origin !== location.origin) return
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') return

  // Network first, so a deployed change is picked up immediately; the cache
  // only answers when the network cannot.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (cacheable(response)) {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {})
        }
        return response
      })
      .catch(async () => {
        const cached = await caches.match(event.request, { ignoreSearch: event.request.mode === 'navigate' })
        if (cached) return cached
        // Pages may fall back to the cached shell; assets must fail honestly.
        if (event.request.mode === 'navigate') {
          const shell = await caches.match('/')
          if (shell) return shell
        }
        return Response.error()
      })
  )
})
