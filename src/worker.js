/**
 * Cloudflare Worker entry point.
 *
 * Static assets are served by the platform; anything under /api is handled by
 * the shared router in api.js.
 */

import { handleApi } from './api.js'
import { D1Store } from './store/d1.js'

/**
 * A deployed build is only useful if it reaches the phone. Cloudflare serves
 * assets with `max-age=0, must-revalidate`, which is correct but still lets a
 * mobile browser hang on to an old module graph after an update. So the HTML
 * shell is never stored, and scripts and styles must be revalidated before
 * use — a 304 when nothing changed, the new file the moment it does.
 */
function freshen(response, pathname) {
  const headers = new Headers(response.headers)
  if (pathname === '/' || pathname.endsWith('.html')) {
    headers.set('cache-control', 'no-store, must-revalidate')
  } else if (/\.(?:js|css|webmanifest)$/.test(pathname)) {
    headers.set('cache-control', 'no-cache, must-revalidate')
  } else {
    return response
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // Which build is live, readable without signing in — the answer to
    // "did the update land?".
    if (url.pathname === '/api/version') {
      return json({ version: env.CF_VERSION_METADATA?.id || 'dev', tag: env.CF_VERSION_METADATA?.tag || null }, 200)
    }

    if (!url.pathname.startsWith('/api/')) {
      return freshen(await env.ASSETS.fetch(request), url.pathname)
    }

    if (!env.DB) {
      return json({ error: 'No D1 database bound. Check the [[d1_databases]] block in wrangler.toml.' }, 500)
    }
    if (!env.APP_PASSCODE) {
      return json({ error: 'APP_PASSCODE is not set. Run: npx wrangler secret put APP_PASSCODE' }, 500)
    }

    try {
      return await handleApi(request, {
        store: new D1Store(env.DB),
        // Falling back to the passcode as the signing secret keeps first-run
        // setup to a single secret; SESSION_SECRET lets you rotate sessions
        // without changing the passcode.
        secret: env.SESSION_SECRET || env.APP_PASSCODE,
        passcode: env.APP_PASSCODE,
        aiKey: env.ANTHROPIC_API_KEY || null,
      })
    } catch (error) {
      console.error('Unhandled API error', error)
      return json({ error: 'Something went wrong handling that request.' }, 500)
    }
  },
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
