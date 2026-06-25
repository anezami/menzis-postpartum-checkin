// Client-side transport: POST to the dev-proxy at /api/lizz/chat.
// The proxy (vite.config.ts) holds the GitHub token — it never reaches the browser.

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export type ChatOptions = {
  temperature?: number
  max_tokens?: number
  response_format?: { type: 'text' | 'json_object' }
}

export class LlmError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'LlmError'
  }
}

type ChoicesResponse = {
  choices: Array<{ message: { content: string | null } }>
}

export async function chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string> {
  const res = await fetch('/api/lizz/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, ...opts }),
  })

  if (!res.ok) {
    throw new LlmError(res.status, `LLM proxy returned ${res.status}`)
  }

  const data = (await res.json()) as ChoicesResponse
  const content = data.choices?.[0]?.message?.content
  if (content == null) throw new LlmError(200, 'empty response from model')
  return content
}
