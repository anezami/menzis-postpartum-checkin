// Lizz conversation orchestration: LLM prompting for question phrasing and answer
// classification. The triage ENGINE (evalueer) remains the single source of truth —
// the LLM only conducts the conversation and maps free text to a waarde (1–4).

import { chat } from './githubModels'
import type { ChatMessage } from './githubModels'
import type { Taal } from '../data/content/content.types'
import type { Content } from '../data/content/content.types'
import type { Vraag } from '../engine/types'
import { optieLabel, vraagTekst } from '../data/content'

export type VraagBeurtArgs = {
  vraag: Vraag
  vraagIndex: number
  totaal: number
  naam: string
  taal: Taal
  c: Content
}

export type ClassificeerArgs = {
  userText: string
  vraag: Vraag
  taal: Taal
  c: Content
}

export type ClassificeerResult =
  | { onzeker: true }
  | { onzeker: false; waarde: number; erkenning: string }

// Tone instruction injected into every system prompt. {taal} is replaced at call time.
const TONE_INSTRUCTION =
  'You are Lizz, a warm and empathetic conversational guide for Menzis, a Dutch health ' +
  'insurer. Always reply ONLY in the language with BCP-47 code: {taal}. Keep your response ' +
  'short (1–2 sentences). Never give medical advice.'

/**
 * Asks the LLM to phrase the current question conversationally in the user's language.
 * Returns the phrased question text.
 */
export async function vraagBeurt(args: VraagBeurtArgs): Promise<string> {
  const { vraag, vraagIndex, totaal, naam, taal, c } = args

  const optionList = vraag.opties
    .map((o) => `${o.waarde}. ${optieLabel(c, vraag.id, o.waarde)}`)
    .join('\n')

  const systemPrompt = TONE_INSTRUCTION.replace('{taal}', taal)
  const userPrompt =
    `Ask question ${vraagIndex + 1} of ${totaal} to ${naam} in a warm, conversational way.\n` +
    `Question text: "${vraagTekst(c, vraag.id)}"\n` +
    `Options (for context only — do NOT list them, the user sees them as buttons):\n${optionList}`

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  return chat(messages, { temperature: 0.7, max_tokens: 150 })
}

/**
 * Classifies the user's free-text reply into one of the 4 option waarden.
 * Returns { onzeker: true } when confidence < 0.5 or parsing fails — the UI then
 * shows the option chips so the user can pick explicitly.
 */
export async function classificeerAntwoord(args: ClassificeerArgs): Promise<ClassificeerResult> {
  const { userText, vraag, taal, c } = args

  const optionList = vraag.opties
    .map((o) => `${o.waarde}: "${optieLabel(c, vraag.id, o.waarde)}"`)
    .join('\n')

  const systemPrompt =
    `You classify a user's free-text answer to a health check-in question. ` +
    `Output ONLY valid JSON with exactly these keys: ` +
    `{"waarde": 1|2|3|4, "zekerheid": 0..1, "erkenning": "<short empathetic acknowledgement in language ${taal}>"}. ` +
    `waarde must be the integer 1, 2, 3, or 4. zekerheid is your confidence from 0.0 to 1.0. ` +
    `Never add any text outside the JSON object.`

  const userPrompt =
    `Question: "${vraagTekst(c, vraag.id)}"\n` +
    `Options:\n${optionList}\n\n` +
    `User answered: "${userText}"\n\n` +
    `Classify which option best matches. Reply in language: ${taal}`

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  try {
    const raw = await chat(messages, {
      temperature: 0.2,
      max_tokens: 120,
      response_format: { type: 'json_object' },
    })

    const parsed = JSON.parse(raw) as {
      waarde?: unknown
      zekerheid?: unknown
      erkenning?: unknown
    }

    const waarde = Number(parsed.waarde)
    const zekerheid = Number(parsed.zekerheid)

    if (!Number.isInteger(waarde) || waarde < 1 || waarde > 4) {
      return { onzeker: true }
    }
    if (zekerheid < 0.5) {
      return { onzeker: true }
    }

    const erkenning = typeof parsed.erkenning === 'string' ? parsed.erkenning : ''
    return { onzeker: false, waarde, erkenning }
  } catch {
    return { onzeker: true }
  }
}
