import { describe, it, expect, vi, beforeEach } from 'vitest'
import { classificeerAntwoord } from './lizzConversation'
import type { ChatMessage } from './githubModels'

// Mock the transport — no network calls in tests.
vi.mock('./githubModels', () => ({
  chat: vi.fn<(messages: ChatMessage[]) => Promise<string>>(),
  LlmError: class LlmError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
      this.name = 'LlmError'
    }
  },
}))

import { chat } from './githubModels'
import { getContent } from '../data/content'
import { getBeslisboom } from '../data/profielen'

const nlContent = getContent('nl')
const enContent = getContent('en')
const boom = getBeslisboom()
const vraag = boom.vragen[0] // 'stemming'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('classificeerAntwoord', () => {
  it('maps valid model JSON to the correct waarde and erkenning', async () => {
    vi.mocked(chat).mockResolvedValueOnce(
      '{"waarde":2,"zekerheid":0.9,"erkenning":"Ik begrijp het."}',
    )
    const result = await classificeerAntwoord({
      userText: 'gaat wel',
      vraag,
      taal: 'nl',
      c: nlContent,
    })
    expect(result).toEqual({ onzeker: false, waarde: 2, erkenning: 'Ik begrijp het.' })
  })

  it('returns { onzeker: true } when zekerheid < 0.5', async () => {
    vi.mocked(chat).mockResolvedValueOnce('{"waarde":1,"zekerheid":0.3,"erkenning":"Hmm."}')
    const result = await classificeerAntwoord({
      userText: 'een beetje...',
      vraag,
      taal: 'nl',
      c: nlContent,
    })
    expect(result).toEqual({ onzeker: true })
  })

  it('returns { onzeker: true } when JSON is malformed', async () => {
    vi.mocked(chat).mockResolvedValueOnce('this is definitely not json')
    const result = await classificeerAntwoord({
      userText: 'wat',
      vraag,
      taal: 'nl',
      c: nlContent,
    })
    expect(result).toEqual({ onzeker: true })
  })

  it('returns { onzeker: true } when waarde is out of range (5)', async () => {
    vi.mocked(chat).mockResolvedValueOnce('{"waarde":5,"zekerheid":0.9,"erkenning":"..."}')
    const result = await classificeerAntwoord({
      userText: 'test',
      vraag,
      taal: 'nl',
      c: nlContent,
    })
    expect(result).toEqual({ onzeker: true })
  })

  it('returns { onzeker: true } when waarde is 0 (below range)', async () => {
    vi.mocked(chat).mockResolvedValueOnce('{"waarde":0,"zekerheid":0.95,"erkenning":"..."}')
    const result = await classificeerAntwoord({
      userText: 'test',
      vraag,
      taal: 'nl',
      c: nlContent,
    })
    expect(result).toEqual({ onzeker: true })
  })

  it('returns { onzeker: true } when chat throws (proxy / network error)', async () => {
    vi.mocked(chat).mockRejectedValueOnce(new Error('503'))
    const result = await classificeerAntwoord({
      userText: 'test',
      vraag,
      taal: 'nl',
      c: nlContent,
    })
    expect(result).toEqual({ onzeker: true })
  })

  it('propagates taal into both system and user messages', async () => {
    vi.mocked(chat).mockResolvedValueOnce('{"waarde":1,"zekerheid":0.9,"erkenning":"Good."}')
    await classificeerAntwoord({
      userText: 'good',
      vraag: boom.vragen[0],
      taal: 'en',
      c: enContent,
    })

    const [messages] = vi.mocked(chat).mock.calls[0]
    // System message must mention the language code
    expect(messages[0].content).toContain('en')
    // User message must also contain the language code
    expect(messages[1].content).toContain('en')
  })

  it('accepts waarde 1 (boundary) as valid', async () => {
    vi.mocked(chat).mockResolvedValueOnce('{"waarde":1,"zekerheid":0.8,"erkenning":"Fijn!"}')
    const result = await classificeerAntwoord({
      userText: 'heel goed',
      vraag,
      taal: 'nl',
      c: nlContent,
    })
    expect(result).toEqual({ onzeker: false, waarde: 1, erkenning: 'Fijn!' })
  })

  it('accepts waarde 4 (boundary) as valid', async () => {
    vi.mocked(chat).mockResolvedValueOnce('{"waarde":4,"zekerheid":0.85,"erkenning":"Ik hoor je."}')
    const result = await classificeerAntwoord({
      userText: 'slecht',
      vraag,
      taal: 'nl',
      c: nlContent,
    })
    expect(result).toEqual({ onzeker: false, waarde: 4, erkenning: 'Ik hoor je.' })
  })
})
