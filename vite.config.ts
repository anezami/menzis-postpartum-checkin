import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { DefaultAzureCredential } from '@azure/identity'
import type { AccessToken } from '@azure/identity'
import { resolveProviderId, providerConfig, transformBody } from './src/llm/llmProviders.js'

// ---------------------------------------------------------------------------
// Foundry token cache — lazily initialised, refreshed 5 min before expiry.
// ---------------------------------------------------------------------------

let foundryCredential: DefaultAzureCredential | null = null
let cachedFoundryToken: AccessToken | null = null

async function getFoundryToken(): Promise<string | null> {
  if (!foundryCredential) foundryCredential = new DefaultAzureCredential()
  try {
    if (
      !cachedFoundryToken ||
      cachedFoundryToken.expiresOnTimestamp - Date.now() < 5 * 60 * 1000
    ) {
      cachedFoundryToken = await foundryCredential.getToken('https://ai.azure.com/.default')
    }
    return cachedFoundryToken?.token ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Speech token cache — separate credential + cache for Cognitive Services.
// Refreshed 5 min before expiry. Used by both TTS Avatar and STT endpoints.
// ---------------------------------------------------------------------------

let speechCredential: DefaultAzureCredential | null = null
let cachedSpeechToken: AccessToken | null = null

async function getSpeechAadToken(): Promise<string> {
  if (!speechCredential) speechCredential = new DefaultAzureCredential()
  if (
    !cachedSpeechToken ||
    cachedSpeechToken.expiresOnTimestamp - Date.now() < 5 * 60 * 1000
  ) {
    cachedSpeechToken = await speechCredential.getToken('https://cognitiveservices.azure.com/.default')
  }
  return cachedSpeechToken.token
}

// ---------------------------------------------------------------------------
// Dev-only proxy: forwards POST /api/lizz/chat to the configured LLM provider.
// Credentials are resolved here in Node and NEVER reach the browser.
// ---------------------------------------------------------------------------

function lizzProxyPlugin(): Plugin {
  return {
    name: 'lizz-proxy',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.envDir ?? process.cwd(), '')
      const providerId = resolveProviderId(env)
      const { endpoint, model } = providerConfig(providerId, env)

      console.log(`[lizz-proxy] provider=${providerId} model=${model}`)

      // ── GET /api/lizz/avatar-token ───────────────────────────────────────
      // Returns AAD auth value + ICE relay token for the Azure TTS Avatar.
      // All credentials are resolved server-side; nothing secret reaches the browser.
      server.middlewares.use('/api/lizz/avatar-token', (req: IncomingMessage, res: ServerResponse): void => {
        void (async () => {
          if (req.method !== 'GET') {
            res.statusCode = 405
            res.end()
            return
          }

          const region = process.env.SPEECH_REGION ?? 'swedencentral'
          const resourceId =
            process.env.SPEECH_RESOURCE_ID ??
            '/subscriptions/fb5cf409-7bc6-4446-aea6-d49b899eaa8b/resourceGroups/foundrytests/providers/Microsoft.CognitiveServices/accounts/foundrytestjes'

          let aadToken: string
          try {
            aadToken = await getSpeechAadToken()
          } catch (err) {
            console.error('[lizz-proxy] speech AAD token error:', String(err).slice(0, 120))
            res.statusCode = 503
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'speech_not_configured', detail: 'AAD token unavailable — run: az login' }))
            return
          }

          const authValue = `aad#${resourceId}#${aadToken}`

          let iceServers: { urls: string | string[]; username: string; credential: string }[]
          try {
            const relayRes = await fetch(
              `https://${region}.tts.speech.microsoft.com/cognitiveservices/avatar/relay/token/v1`,
              { headers: { Authorization: `Bearer ${authValue}` } },
            )
            if (!relayRes.ok) {
              const detail = `relay HTTP ${relayRes.status}`
              console.error('[lizz-proxy] avatar relay token error:', detail)
              res.statusCode = 503
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'speech_not_configured', detail }))
              return
            }
            const relay = await relayRes.json() as { Urls: string | string[]; Username: string; Password: string }
            iceServers = [{ urls: relay.Urls, username: relay.Username, credential: relay.Password }]
          } catch (err) {
            console.error('[lizz-proxy] avatar relay fetch error:', String(err).slice(0, 120))
            res.statusCode = 503
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'speech_not_configured', detail: 'relay fetch failed' }))
            return
          }

          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ authToken: authValue, region, iceServers }))
        })()
      })

      server.middlewares.use('/api/lizz/chat', (req: IncomingMessage, res: ServerResponse): void => {
        void (async () => {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.end()
            return
          }

          // Acquire bearer token for the active provider
          let token: string | null
          if (providerId === 'foundry') {
            token = await getFoundryToken()
          } else {
            token = (env['GITHUB_TOKEN'] ?? env['GITHUB_MODELS_TOKEN'] ?? '').trim() || null
          }

          if (!token) {
            res.statusCode = 503
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'llm_not_configured' }))
            return
          }

          let body: Record<string, unknown>
          try {
            const chunks: Buffer[] = []
            await new Promise<void>((resolve, reject) => {
              req.on('data', (chunk: Buffer) => { chunks.push(chunk) })
              req.on('end', () => { resolve() })
              req.on('error', reject)
            })
            body = JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>
          } catch {
            res.statusCode = 400
            res.end('Bad Request')
            return
          }

          try {
            const upstreamBody = transformBody(providerId, body, model)
            const upstream = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(upstreamBody),
            })
            const text = await upstream.text()
            res.statusCode = upstream.status
            res.setHeader('Content-Type', 'application/json')
            res.end(text)
          } catch (err) {
            console.error('[lizz-proxy] upstream error:', err)
            res.statusCode = 502
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'upstream_failure' }))
          }
        })()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), lizzProxyPlugin()],
  test: {
    environment: 'node',
  },
})
