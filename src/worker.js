/**
 * Cloudflare Worker entry point.
 *
 * Static assets are served by the platform; anything under /api is handled by
 * the shared router in api.js.
 */

import { handleApi } from './api.js'
import { D1Store } from './store/d1.js'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // Which build is live, readable without signing in — the answer to
    // "did the update land?".
    if (url.pathname === '/api/version') {
      return json({ version: env.CF_VERSION_METADATA?.id || 'dev', tag: env.CF_VERSION_METADATA?.tag || null }, 200)
    }

    // Static assets are served straight from the edge, without this worker
    // running at all — their cache policy lives in public/_headers.
    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request)
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
