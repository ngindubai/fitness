/**
 * Service worker.
 *
 * Its only job is to make the app installable and to keep the shell loading
 * when the phone has no signal. API requests are never cached — a stale
 * calorie total is worse than an error message.
 */

const CACHE = 'fitness-shell-v6'
const SHELL = ['/', '/index.html', '/app.js', '/movements.js', '/anim.js', '/styles.css', '/icon.svg', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()))
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

  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') return

  // Network first, so a deployed change is picked up immediately; the cache is
  // only there for when the network is not.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone()
        caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {})
        return response
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/index.html')))
  )
})
