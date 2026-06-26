import { describe, it, expect } from 'vitest'
import {
  sttLocale,
  ttsVoice,
  AVATAR_CHARACTER,
  AVATAR_STYLE,
} from './speechConfig'
import type { Taal } from '../data/content/content.types'

describe('AVATAR constants', () => {
  it('AVATAR_CHARACTER is "lisa"', () => {
    expect(AVATAR_CHARACTER).toBe('lisa')
  })

  it('AVATAR_STYLE is "casual-sitting"', () => {
    expect(AVATAR_STYLE).toBe('casual-sitting')
  })
})

describe('sttLocale()', () => {
  it('nl → nl-NL', () => {
    expect(sttLocale('nl')).toBe('nl-NL')
  })

  it('en → en-US', () => {
    expect(sttLocale('en')).toBe('en-US')
  })

  it('tr → tr-TR', () => {
    expect(sttLocale('tr')).toBe('tr-TR')
  })

  it('ar → ar-EG', () => {
    expect(sttLocale('ar')).toBe('ar-EG')
  })

  it('unknown taal falls back to nl-NL', () => {
    // Cast to Taal to simulate an unrecognised value at runtime
    expect(sttLocale('xx' as Taal)).toBe('nl-NL')
  })
})

describe('ttsVoice()', () => {
  it('nl → nl-NL-FennaNeural', () => {
    expect(ttsVoice('nl')).toBe('nl-NL-FennaNeural')
  })

  it('en → en-US-JennyNeural', () => {
    expect(ttsVoice('en')).toBe('en-US-JennyNeural')
  })

  it('tr → tr-TR-EmelNeural', () => {
    expect(ttsVoice('tr')).toBe('tr-TR-EmelNeural')
  })

  it('ar → ar-EG-SalmaNeural', () => {
    expect(ttsVoice('ar')).toBe('ar-EG-SalmaNeural')
  })

  it('unknown taal falls back to nl-NL-FennaNeural', () => {
    expect(ttsVoice('xx' as Taal)).toBe('nl-NL-FennaNeural')
  })
})
