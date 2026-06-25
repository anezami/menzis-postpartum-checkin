import { describe, it, expect } from 'vitest'
import { bepaalNiveau, evalueer } from './triage'
import { getBeslisboom } from '../data/profielen'
import type { Antwoorden, Beslisboom } from './types'
import beslisboomJson from '../data/beslisboom.json'

const boom = getBeslisboom()

// ── helpers ──────────────────────────────────────────────────────────────────

function antwoorden(stemming: number, genieten: number, ondersteuning: number): Antwoorden {
  return { stemming, genieten, ondersteuning }
}

// ── Scenario A — all answers = 1 → niveau 1 ──────────────────────────────────

describe('Scenario A — all answers 1', () => {
  const a = antwoorden(1, 1, 1)

  it('bepaalNiveau returns 1', () => {
    expect(bepaalNiveau(boom, a)).toBe(1)
  })

  it('evalueer returns uitkomst niveau 1, kleur groen, signaal geen_signaal', () => {
    const u = evalueer(boom, a)
    expect(u.niveau).toBe(1)
    expect(u.kleur).toBe('groen')
    expect(u.signaal).toBe('geen_signaal')
  })
})

// ── Scenario B — one answer = 4, max-scoring → niveau 4 ─────────────────────

describe('Scenario B — one answer = 4 (max-scoring)', () => {
  const cases: [string, Antwoorden][] = [
    ['4 in stemming',       antwoorden(4, 1, 1)],
    ['4 in genieten',       antwoorden(1, 4, 1)],
    ['4 in ondersteuning',  antwoorden(1, 1, 4)],
  ]

  for (const [label, a] of cases) {
    it(`bepaalNiveau returns 4 when ${label}`, () => {
      expect(bepaalNiveau(boom, a)).toBe(4)
    })

    it(`evalueer returns rood / professional_contact when ${label}`, () => {
      const u = evalueer(boom, a)
      expect(u.niveau).toBe(4)
      expect(u.kleur).toBe('rood')
      expect(u.signaal).toBe('professional_contact')
    })
  }
})

// ── Scenario C — highest answer = 3 → niveau 3 ───────────────────────────────

describe('Scenario C — highest answer = 3', () => {
  const a = antwoorden(2, 3, 1)

  it('bepaalNiveau returns 3', () => {
    expect(bepaalNiveau(boom, a)).toBe(3)
  })

  it('evalueer returns oranje / digitale_zelfzorg', () => {
    const u = evalueer(boom, a)
    expect(u.niveau).toBe(3)
    expect(u.kleur).toBe('oranje')
    expect(u.signaal).toBe('digitale_zelfzorg')
  })
})

// ── Scenario — highest answer = 2 → niveau 2 ─────────────────────────────────

describe('Scenario — highest answer = 2', () => {
  const a = antwoorden(1, 2, 1)

  it('bepaalNiveau returns 2', () => {
    expect(bepaalNiveau(boom, a)).toBe(2)
  })

  it('evalueer returns geel / content_aanbod', () => {
    const u = evalueer(boom, a)
    expect(u.niveau).toBe(2)
    expect(u.kleur).toBe('geel')
    expect(u.signaal).toBe('content_aanbod')
  })
})

// ── Edge: empty antwoorden ────────────────────────────────────────────────────

describe('Edge — empty antwoorden', () => {
  const empty: Antwoorden = {}

  it('bepaalNiveau returns 0', () => {
    expect(bepaalNiveau(boom, empty)).toBe(0)
  })

  it('evalueer throws because no uitkomst exists for niveau 0', () => {
    expect(() => evalueer(boom, empty)).toThrow()
  })
})

// ── Edge: partial antwoorden (1 of 3 answered) ───────────────────────────────

describe('Edge — partial antwoorden (only stemming answered)', () => {
  it('bepaalNiveau returns max over answered values only', () => {
    const a: Antwoorden = { stemming: 2 }
    expect(bepaalNiveau(boom, a)).toBe(2)
  })

  it('evalueer returns correct uitkomst for the single answered vraag', () => {
    const a: Antwoorden = { ondersteuning: 3 }
    const u = evalueer(boom, a)
    expect(u.niveau).toBe(3)
    expect(u.kleur).toBe('oranje')
  })
})

// ── Edge: unknown scoring strategy ───────────────────────────────────────────

describe('Edge — unknown scoring strategy', () => {
  it('bepaalNiveau throws referencing the unknown strategy name', () => {
    // Cast to bypass TypeScript's union guard — this tests the runtime registry guard.
    const fakeBoom = { ...boom, scoring: 'gemiddelde' } as unknown as Beslisboom
    expect(() => bepaalNiveau(fakeBoom, antwoorden(1, 2, 1))).toThrow(/gemiddelde/)
  })
})

// ── Data integrity ────────────────────────────────────────────────────────────

describe('Data integrity — beslisboom.json', () => {
  it('scoring is "max"', () => {
    expect(beslisboomJson.scoring).toBe('max')
  })

  it('has exactly 3 vragen', () => {
    expect(beslisboomJson.vragen).toHaveLength(3)
  })

  it('each vraag has exactly 4 opties', () => {
    for (const v of beslisboomJson.vragen) {
      expect(v.opties).toHaveLength(4)
    }
  })

  it('each vraag opties have waarden 1, 2, 3, 4', () => {
    for (const v of beslisboomJson.vragen) {
      const waarden = v.opties.map((o) => o.waarde).sort((a, b) => a - b)
      expect(waarden).toEqual([1, 2, 3, 4])
    }
  })

  it('uitkomsten cover niveaus 1, 2, 3, 4', () => {
    const niveaus = beslisboomJson.uitkomsten.map((u) => u.niveau).sort((a, b) => a - b)
    expect(niveaus).toEqual([1, 2, 3, 4])
  })

  it('signaal mapping: 1=geen_signaal, 2=content_aanbod, 3=digitale_zelfzorg, 4=professional_contact', () => {
    const map: Record<number, string> = {
      1: 'geen_signaal',
      2: 'content_aanbod',
      3: 'digitale_zelfzorg',
      4: 'professional_contact',
    }
    for (const u of beslisboomJson.uitkomsten) {
      expect(u.signaal).toBe(map[u.niveau])
    }
  })

  it('kleur mapping: 1=groen, 2=geel, 3=oranje, 4=rood', () => {
    const map: Record<number, string> = { 1: 'groen', 2: 'geel', 3: 'oranje', 4: 'rood' }
    for (const u of beslisboomJson.uitkomsten) {
      expect(u.kleur).toBe(map[u.niveau])
    }
  })
})
