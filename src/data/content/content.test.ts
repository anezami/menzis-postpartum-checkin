import { describe, it, expect } from 'vitest'
import { getContent, vraagTekst, optieLabel, uitkomstTekst, SUPPORTED_TALEN } from './index'
import type { Taal } from './index'
import beslisboom from '../beslisboom.json'
import { bepaalNiveau, evalueer } from '../../engine/triage'
import { getBeslisboom } from '../profielen'

// ── helpers ───────────────────────────────────────────────────────────────────

/** Recursively collect all leaf key-paths from an object / array. */
function collectLeafPaths(obj: unknown, prefix = ''): string[] {
  if (Array.isArray(obj)) {
    return obj.flatMap((item, i) => collectLeafPaths(item, `${prefix}[${i}]`))
  }
  if (typeof obj === 'object' && obj !== null) {
    return Object.keys(obj as Record<string, unknown>).flatMap((key) => {
      const full = prefix ? `${prefix}.${key}` : key
      return collectLeafPaths((obj as Record<string, unknown>)[key], full)
    })
  }
  return [prefix]
}

/** Recursively collect all leaf string values from an object / array. */
function collectLeafStrings(obj: unknown): string[] {
  if (Array.isArray(obj)) return obj.flatMap(collectLeafStrings)
  if (typeof obj === 'object' && obj !== null) {
    return Object.values(obj as Record<string, unknown>).flatMap(collectLeafStrings)
  }
  if (typeof obj === 'string') return [obj]
  return []
}

const boom = getBeslisboom()
const vraagIds = beslisboom.vragen.map((v) => v.id)  // ['stemming','genieten','ondersteuning']
const niveaus  = beslisboom.uitkomsten.map((u) => u.niveau) // [1,2,3,4]

// ── 1. Metadata per language ──────────────────────────────────────────────────

describe('getContent — metadata per language', () => {
  const expectedMeta: Record<Taal, { naam: string; dir: 'ltr' | 'rtl' }> = {
    nl: { naam: 'Nederlands', dir: 'ltr' },
    en: { naam: 'English',    dir: 'ltr' },
    tr: { naam: 'Türkçe',     dir: 'ltr' },
    ar: { naam: 'العربية',    dir: 'rtl' },
  }

  for (const taal of SUPPORTED_TALEN) {
    it(`${taal}: taal field is "${taal}"`, () => {
      expect(getContent(taal).taal).toBe(taal)
    })
    it(`${taal}: naam is "${expectedMeta[taal].naam}"`, () => {
      expect(getContent(taal).naam).toBe(expectedMeta[taal].naam)
    })
    it(`${taal}: dir is "${expectedMeta[taal].dir}"`, () => {
      expect(getContent(taal).dir).toBe(expectedMeta[taal].dir)
    })
  }

  it('ar dir is rtl', () => {
    expect(getContent('ar').dir).toBe('rtl')
  })

  it('nl, en, tr dir are ltr', () => {
    for (const t of ['nl', 'en', 'tr'] as Taal[]) {
      expect(getContent(t).dir).toBe('ltr')
    }
  })
})

// ── 2. Key-path completeness: all languages share the same deep structure ─────

describe('i18n completeness — identical key structure across all languages', () => {
  it('all 4 languages produce the same sorted leaf key-path set', () => {
    const pathSets = SUPPORTED_TALEN.map((t) =>
      collectLeafPaths(getContent(t)).sort()
    )
    for (let i = 1; i < pathSets.length; i++) {
      expect(pathSets[i]).toEqual(pathSets[0])
    }
  })
})

// ── 3. vragen keys match beslisboom.json vraag ids ────────────────────────────

describe('vragen keys vs beslisboom vraag ids', () => {
  for (const taal of SUPPORTED_TALEN) {
    it(`${taal}: vragen keys === [${vraagIds.join(',')}]`, () => {
      const keys = Object.keys(getContent(taal).vragen).sort()
      expect(keys).toEqual([...vraagIds].sort())
    })

    it(`${taal}: each vraag has opties for "1","2","3","4"`, () => {
      for (const id of vraagIds) {
        const opties = getContent(taal).vragen[id].opties
        expect(Object.keys(opties).sort()).toEqual(['1', '2', '3', '4'])
      }
    })
  }
})

// ── 4. uitkomsten keys match beslisboom niveaus ───────────────────────────────

describe('uitkomsten keys vs beslisboom niveaus', () => {
  for (const taal of SUPPORTED_TALEN) {
    it(`${taal}: uitkomsten has keys "1","2","3","4"`, () => {
      const keys = Object.keys(getContent(taal).uitkomsten).sort()
      expect(keys).toEqual(niveaus.map(String).sort())
    })
  }
})

// ── 5. No empty-string values ─────────────────────────────────────────────────

describe('no empty-string leaf values in any language', () => {
  for (const taal of SUPPORTED_TALEN) {
    it(`${taal}: all string values are non-empty after trim`, () => {
      const strings = collectLeafStrings(getContent(taal))
      expect(strings.length).toBeGreaterThan(0)
      for (const s of strings) {
        expect(s.trim().length, `Empty value found in ${taal}`).toBeGreaterThan(0)
      }
    })
  }
})

// ── 6. lizz.tussenzinnen length 3 ────────────────────────────────────────────

describe('lizz.tussenzinnen has exactly 3 entries', () => {
  for (const taal of SUPPORTED_TALEN) {
    it(`${taal}: tussenzinnen.length === 3`, () => {
      expect(getContent(taal).lizz.tussenzinnen).toHaveLength(3)
    })
  }
})

// ── 7. Placeholder assertions ─────────────────────────────────────────────────

describe('template placeholders in every language', () => {
  for (const taal of SUPPORTED_TALEN) {
    it(`${taal}: lizz.begroeting contains {naam}`, () => {
      expect(getContent(taal).lizz.begroeting).toContain('{naam}')
    })
    it(`${taal}: lizz.voortgang contains {huidig}`, () => {
      expect(getContent(taal).lizz.voortgang).toContain('{huidig}')
    })
    it(`${taal}: lizz.voortgang contains {totaal}`, () => {
      expect(getContent(taal).lizz.voortgang).toContain('{totaal}')
    })
  }
})

// ── 8. vangnet references emergency number "112" ──────────────────────────────

describe('vangnet references 112 in every language', () => {
  for (const taal of SUPPORTED_TALEN) {
    it(`${taal}: vangnet contains "112"`, () => {
      expect(getContent(taal).vangnet).toContain('112')
    })
  }
})

// ── 9. Content accessor functions ─────────────────────────────────────────────

describe('vraagTekst()', () => {
  it('nl stemming returns localized question text', () => {
    const c = getContent('nl')
    expect(vraagTekst(c, 'stemming')).toBe(c.vragen.stemming.tekst)
    expect(vraagTekst(c, 'stemming').length).toBeGreaterThan(0)
  })

  it('en genieten returns English question text', () => {
    const c = getContent('en')
    expect(vraagTekst(c, 'genieten')).toBe(c.vragen.genieten.tekst)
  })

  it('ar ondersteuning returns Arabic question text', () => {
    const c = getContent('ar')
    expect(vraagTekst(c, 'ondersteuning')).toBe(c.vragen.ondersteuning.tekst)
  })

  it('unknown vraagId falls back to the id itself', () => {
    const c = getContent('nl')
    expect(vraagTekst(c, 'onbekend')).toBe('onbekend')
  })
})

describe('optieLabel()', () => {
  it('nl stemming waarde 1 equals content opties["1"]', () => {
    const c = getContent('nl')
    expect(optieLabel(c, 'stemming', 1)).toBe(c.vragen.stemming.opties['1'])
  })

  it('en genieten waarde 4 equals content opties["4"]', () => {
    const c = getContent('en')
    expect(optieLabel(c, 'genieten', 4)).toBe(c.vragen.genieten.opties['4'])
  })

  it('tr ondersteuning waarde 2 equals content opties["2"]', () => {
    const c = getContent('tr')
    expect(optieLabel(c, 'ondersteuning', 2)).toBe(c.vragen.ondersteuning.opties['2'])
  })

  it('ar stemming waarde 3 equals content opties["3"]', () => {
    const c = getContent('ar')
    expect(optieLabel(c, 'stemming', 3)).toBe(c.vragen.stemming.opties['3'])
  })

  it('unknown vraagId falls back to the waarde as string', () => {
    const c = getContent('nl')
    expect(optieLabel(c, 'onbekend', 2)).toBe('2')
  })
})

describe('uitkomstTekst()', () => {
  it('nl niveau 1 returns correct UitkomstContent', () => {
    const c = getContent('nl')
    const u = uitkomstTekst(c, 1)
    expect(u.titel).toBe(c.uitkomsten['1'].titel)
    expect(u.advies).toBe(c.uitkomsten['1'].advies)
    expect(u.lizzBoodschap).toBe(c.uitkomsten['1'].lizzBoodschap)
  })

  it('en niveau 4 returns correct UitkomstContent', () => {
    const c = getContent('en')
    const u = uitkomstTekst(c, 4)
    expect(u.titel).toBe(c.uitkomsten['4'].titel)
    expect(u.lizzBoodschap.length).toBeGreaterThan(0)
  })

  it('ar niveau 2 returns correct UitkomstContent', () => {
    const c = getContent('ar')
    const u = uitkomstTekst(c, 2)
    expect(u.titel).toBe(c.uitkomsten['2'].titel)
  })

  it('unknown niveau returns empty-placeholder object', () => {
    const c = getContent('nl')
    const u = uitkomstTekst(c, 99)
    expect(u.titel).toBe('')
    expect(u.advies).toBe('')
    expect(u.lizzBoodschap).toBe('')
  })
})

// ── 10. Engine / language parity ─────────────────────────────────────────────
// Scoring is purely numeric — content language cannot change outcomes.

describe('Engine parity — outcomes are language-independent', () => {
  const scenarios: { label: string; antwoorden: Record<string, number>; niveau: number; signaal: string }[] = [
    { label: 'Scenario A — all 1s → niveau 1',  antwoorden: { stemming: 1, genieten: 1, ondersteuning: 1 }, niveau: 1, signaal: 'geen_signaal' },
    { label: 'Scenario B — one 4 → niveau 4',   antwoorden: { stemming: 4, genieten: 1, ondersteuning: 1 }, niveau: 4, signaal: 'professional_contact' },
    { label: 'Scenario C — highest 3 → niveau 3', antwoorden: { stemming: 2, genieten: 3, ondersteuning: 1 }, niveau: 3, signaal: 'digitale_zelfzorg' },
  ]

  for (const s of scenarios) {
    it(`${s.label}: niveau and signaal are the same in all languages`, () => {
      for (const taal of SUPPORTED_TALEN) {
        // Engine is language-agnostic; calling evalueer with the same boom
        const uitkomst = evalueer(boom, s.antwoorden)
        expect(uitkomst.niveau, `${taal}: expected niveau ${s.niveau}`).toBe(s.niveau)
        expect(uitkomst.signaal, `${taal}: expected signaal ${s.signaal}`).toBe(s.signaal)

        // Content layer lookup must also resolve for this niveau in every language
        const c = getContent(taal)
        const inhoud = uitkomstTekst(c, s.niveau)
        expect(inhoud.titel.trim().length, `${taal}: uitkomstTekst title must be non-empty`).toBeGreaterThan(0)
      }
    })
  }

  it('bepaalNiveau is identical across all languages for the same antwoorden', () => {
    const antwoorden = { stemming: 3, genieten: 2, ondersteuning: 4 }
    const niveau = bepaalNiveau(boom, antwoorden)
    // Call twice to confirm determinism (language has no effect on the engine)
    expect(bepaalNiveau(boom, antwoorden)).toBe(niveau)
    expect(niveau).toBe(4)
  })
})
