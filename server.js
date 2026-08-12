/**
 * Node server — for local development, and for any host that runs Node.
 *
 * Data lives in a JSON file. That is fine locally and on a box with a real
 * disk; it is NOT fine on a host with an ephemeral filesystem (Render's free
 * tier included), where the file disappears on every restart. Use the
 * Cloudflare Worker with D1 for anything you want to keep.
 */

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

import { handleApi } from './src/api.js'
import { FileStore } from './src/store/file.js'

const ROOT = fileURLToPath(new URL('.', import.meta.url))
const PUBLIC_DIR = join(ROOT, 'public')

const PORT = Number(process.env.PORT) || 8787
const DATA_FILE = process.env.DATA_FILE || join(ROOT, 'data', 'fitness.json')
const PASSCODE = process.env.APP_PASSCODE || ''
const SECRET = process.env.SESSION_SECRET || PASSCODE
const AI_KEY = process.env.ANTHROPIC_API_KEY || null

if (!PASSCODE) {
  console.error('APP_PASSCODE is not set. Start with: APP_PASSCODE=yourcode npm start')
  process.exit(1)
}

const store = new FileStore(DATA_FILE)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  try {
    // Mirrors the Worker so local and live answer the same question.
    if (url.pathname === '/api/version') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ version: 'dev', tag: null }))
      return
    }

    if (url.pathname.startsWith('/api/')) {
      const request = await toWebRequest(req, url)
      const response = await handleApi(request, {
        store,
        secret: SECRET,
        passcode: PASSCODE,
        aiKey: AI_KEY,
      })
      await sendWebResponse(res, response)
      return
    }

    await serveStatic(url.pathname, res)
  } catch (error) {
    console.error('Request failed', error)
    res.writeHead(500, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'Something went wrong handling that request.' }))
  }
})

/** Convert a Node request into the web-standard Request the router expects. */
async function toWebRequest(req, url) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const body = chunks.length ? Buffer.concat(chunks) : undefined

  return new Request(url.toString(), {
    method: req.method,
    headers: new Headers(req.headers),
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
  })
}

async function sendWebResponse(res, response) {
  const headers = {}
  for (const [key, value] of response.headers) headers[key] = value
  res.writeHead(response.status, headers)
  res.end(Buffer.from(await response.arrayBuffer()))
}

async function serveStatic(pathname, res) {
  // normalize() collapses any ../ segments before we touch the filesystem, so a
  // crafted path cannot escape the public directory.
  const relative = normalize(pathname === '/' ? '/index.html' : pathname).replace(/^(\.\.[/\\])+/, '')
  const filePath = join(PUBLIC_DIR, relative)

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  try {
    const content = await readFile(filePath)
    res.writeHead(200, { 'content-type': MIME[extname(filePath)] || 'application/octet-stream' })
    res.end(content)
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Single-page app: unknown paths fall through to the shell.
      const shell = await readFile(join(PUBLIC_DIR, 'index.html'))
      res.writeHead(200, { 'content-type': MIME['.html'] })
      res.end(shell)
      return
    }
    throw error
  }
}

server.listen(PORT, () => {
  console.log(`Fitness tracker running at http://localhost:${PORT}`)
  console.log(`Data file: ${DATA_FILE}`)
  console.log(`AI commentary: ${AI_KEY ? 'enabled' : 'disabled (rules engine only)'}`)
})
