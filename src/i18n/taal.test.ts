import { describe, it, expect, vi, afterEach } from 'vitest'
import { detecteerTaal, isRtl, getOpgeslagenTaal, setOpgeslagenTaal } from './taal'
import { SUPPORTED_TALEN } from '../data/content/content.types'
import type { Taal } from '../data/content/content.types'

// ── helpers ───────────────────────────────────────────────────────────────────

/** Minimal window stub so the `typeof window === 'undefined'` guard passes. */
function stubWindow() {
  vi.stubGlobal('window', {})
}

/** Create a simple in-memory localStorage stub. */
function makeLocalStorageStub() {
  const store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]) },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

// ── 1. isRtl ──────────────────────────────────────────────────────────────────

describe('isRtl()', () => {
  it('returns true for "ar"', () => {
    expect(isRtl('ar')).toBe(true)
  })

  it('returns false for "nl"', () => {
    expect(isRtl('nl')).toBe(false)
  })

  it('returns false for "en"', () => {
    expect(isRtl('en')).toBe(false)
  })

  it('returns false for "tr"', () => {
    expect(isRtl('tr')).toBe(false)
  })
})

// ── 2. detecteerTaal ─────────────────────────────────────────────────────────

describe('detecteerTaal()', () => {
  it('falls back to "nl" when window is undefined (SSR)', () => {
    // window is not set — the guard short-circuits to 'nl'
    expect(detecteerTaal()).toBe('nl')
  })

  it('"en-US" → "en"', () => {
    stubWindow()
    vi.stubGlobal('navigator', { languages: ['en-US'], language: 'en-US' })
    expect(detecteerTaal()).toBe('en')
  })

  it('"tr" (exact match) → "tr"', () => {
    stubWindow()
    vi.stubGlobal('navigator', { languages: ['tr'], language: 'tr' })
    expect(detecteerTaal()).toBe('tr')
  })

  it('"ar-EG" → "ar"', () => {
    stubWindow()
    vi.stubGlobal('navigator', { languages: ['ar-EG'], language: 'ar-EG' })
    expect(detecteerTaal()).toBe('ar')
  })

  it('"fr-FR" (unsupported) falls back to "nl"', () => {
    stubWindow()
    vi.stubGlobal('navigator', { languages: ['fr-FR'], language: 'fr-FR' })
    expect(detecteerTaal()).toBe('nl')
  })

  it('"de" then "en-GB" — first supported wins', () => {
    stubWindow()
    vi.stubGlobal('navigator', { languages: ['de', 'en-GB'], language: 'de' })
    expect(detecteerTaal()).toBe('en')
  })

  it('"nl-NL" → "nl"', () => {
    stubWindow()
    vi.stubGlobal('navigator', { languages: ['nl-NL'], language: 'nl-NL' })
    expect(detecteerTaal()).toBe('nl')
  })

  it('result is always a member of SUPPORTED_TALEN', () => {
    stubWindow()
    const cases = ['en-US', 'tr', 'ar-EG', 'fr-FR', 'nl-NL', 'zh-CN']
    for (const lang of cases) {
      vi.stubGlobal('navigator', { languages: [lang], language: lang })
      const result = detecteerTaal()
      expect(SUPPORTED_TALEN).toContain(result)
    }
  })

  it('empty languages array falls back to navigator.language', () => {
    stubWindow()
    vi.stubGlobal('navigator', { languages: [], language: 'tr' })
    expect(detecteerTaal()).toBe('tr')
  })
})

// ── 3. getOpgeslagenTaal / setOpgeslagenTaal ──────────────────────────────────

describe('getOpgeslagenTaal() / setOpgeslagenTaal()', () => {
  it('returns null when window is undefined (SSR)', () => {
    // window is not stubbed here — function should return null
    expect(getOpgeslagenTaal()).toBeNull()
  })

  it('returns null when nothing has been stored yet', () => {
    stubWindow()
    vi.stubGlobal('localStorage', makeLocalStorageStub())
    expect(getOpgeslagenTaal()).toBeNull()
  })

  it('round-trip: setOpgeslagenTaal then getOpgeslagenTaal returns same value', () => {
    stubWindow()
    vi.stubGlobal('localStorage', makeLocalStorageStub())

    const talen: Taal[] = ['nl', 'en', 'tr', 'ar']
    for (const t of talen) {
      setOpgeslagenTaal(t)
      expect(getOpgeslagenTaal()).toBe(t)
    }
  })

  it('overwriting with a new valid taal is reflected immediately', () => {
    stubWindow()
    vi.stubGlobal('localStorage', makeLocalStorageStub())

    setOpgeslagenTaal('en')
    expect(getOpgeslagenTaal()).toBe('en')

    setOpgeslagenTaal('ar')
    expect(getOpgeslagenTaal()).toBe('ar')
  })

  it('invalid stored value is rejected and null is returned', () => {
    stubWindow()
    const ls = makeLocalStorageStub()
    // Inject an invalid value directly into the store
    ls.setItem('menzis_taal', 'de')
    vi.stubGlobal('localStorage', ls)
    expect(getOpgeslagenTaal()).toBeNull()
  })

  it('setOpgeslagenTaal is a no-op when window is undefined (SSR)', () => {
    // No window stub — should not throw
    expect(() => setOpgeslagenTaal('nl')).not.toThrow()
  })

  it('stored value persists after multiple getOpgeslagenTaal calls', () => {
    stubWindow()
    vi.stubGlobal('localStorage', makeLocalStorageStub())

    setOpgeslagenTaal('tr')
    expect(getOpgeslagenTaal()).toBe('tr')
    expect(getOpgeslagenTaal()).toBe('tr')
  })
})
