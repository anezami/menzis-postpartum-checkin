export type SpeechTokenResponse = {
  authToken: string
  region: string
  iceServers: { urls: string | string[]; username: string; credential: string }[]
}

export class SpeechNotConfiguredError extends Error {
  constructor(detail: string) {
    super(`speech_not_configured: ${detail}`)
    this.name = 'SpeechNotConfiguredError'
  }
}

/** Fetches the combined avatar + STT auth token from the dev proxy. */
export async function getSpeechToken(): Promise<SpeechTokenResponse> {
  const res = await fetch('/api/lizz/avatar-token')
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as { detail?: string; error?: string }
      detail = body.detail ?? body.error ?? detail
    } catch {
      // ignore parse errors
    }
    throw new SpeechNotConfiguredError(detail)
  }
  return (await res.json()) as SpeechTokenResponse
}
