import { SUPPORTED_TALEN } from '../data/content/content.types'
import type { Taal } from '../data/content/content.types'

const STORAGE_KEY = 'menzis_taal'

/** Detect the best matching supported language from the browser's language preferences. */
export function detecteerTaal(): Taal {
  if (typeof window === 'undefined') return 'nl'
  const prefs = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const lang of prefs) {
    const primary = lang.split('-')[0].toLowerCase() as Taal
    if (SUPPORTED_TALEN.includes(primary)) return primary
  }
  return 'nl'
}

/** Returns true when the given language is written right-to-left. */
export function isRtl(taal: Taal): boolean {
  return taal === 'ar'
}

/** Read the user's persisted language choice from localStorage. Returns null on SSR or if not set. */
export function getOpgeslagenTaal(): Taal | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && SUPPORTED_TALEN.includes(stored as Taal)) return stored as Taal
  return null
}

/** Persist the user's language choice to localStorage. No-op on SSR. */
export function setOpgeslagenTaal(taal: Taal): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, taal)
}
