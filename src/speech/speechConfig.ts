import type { Taal } from '../data/content/content.types'

export const AVATAR_CHARACTER = 'lisa'
export const AVATAR_STYLE = 'casual-sitting'

const STT_LOCALE_MAP: Record<Taal, string> = {
  nl: 'nl-NL',
  en: 'en-US',
  tr: 'tr-TR',
  ar: 'ar-EG',
}

const TTS_VOICE_MAP: Record<Taal, string> = {
  nl: 'nl-NL-FennaNeural',
  en: 'en-US-JennyNeural',
  tr: 'tr-TR-EmelNeural',
  ar: 'ar-EG-SalmaNeural',
}

export function sttLocale(taal: Taal): string {
  return STT_LOCALE_MAP[taal] ?? 'nl-NL'
}

export function ttsVoice(taal: Taal): string {
  return TTS_VOICE_MAP[taal] ?? 'nl-NL-FennaNeural'
}
