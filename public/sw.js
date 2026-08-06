/**
 * Service worker — deliberately a janitor, nothing more.
 *
 * Earlier versions intercepted fetches to serve a cached shell offline.
 * That interception is how a phone ended up with a permanent white screen:
 * Cloudflare 307-redirects /index.html to /, Chrome refuses redirected
 * responses for navigations, and a cached wrong response meant every load
 * failed before a single byte of HTML ran. An offline shell is worthless
 * for an app whose every screen needs the API anyway, so the trade is made
 * the other way now:
 *
 * - NO fetch handler. Requests go straight to the network, always. No cache
 *   can ever sit between the browser and a page load again.
 * - On activation it deletes every cache older versions left behind, which
 *   is what rescues any phone still stuck on a poisoned cache: the browser
 *   update-checks this file on navigation, sees new bytes, installs it, and
 *   the old broken worker is gone.
 */

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) await caches.delete(key)
      await self.clients.claim()
    })()
  )
})
