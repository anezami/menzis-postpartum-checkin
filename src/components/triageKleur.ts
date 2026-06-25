/**
 * Single source of truth: maps uitkomst.kleur to Tailwind class sets.
 * All triage color logic lives here — never scatter it across components.
 */

export type TriageKleur = 'groen' | 'geel' | 'oranje' | 'rood'

export type KleurConfig = {
  /** Light background for result cards */
  bgLight: string
  textColor: string
  borderColor: string
  badgeBg: string
  badgeText: string
  emoji: string
}

export const triageKleurMap: Record<TriageKleur, KleurConfig> = {
  groen: {
    bgLight: 'bg-triage-groen/10',
    textColor: 'text-triage-groen',
    borderColor: 'border-triage-groen',
    badgeBg: 'bg-triage-groen',
    badgeText: 'text-white',
    emoji: '🟢',
  },
  geel: {
    bgLight: 'bg-triage-geel/10',
    textColor: 'text-triage-geel',
    borderColor: 'border-triage-geel',
    badgeBg: 'bg-triage-geel',
    badgeText: 'text-menzis-inkt',
    emoji: '🟡',
  },
  oranje: {
    bgLight: 'bg-triage-oranje/10',
    textColor: 'text-triage-oranje',
    borderColor: 'border-triage-oranje',
    badgeBg: 'bg-triage-oranje',
    badgeText: 'text-white',
    emoji: '🟠',
  },
  rood: {
    bgLight: 'bg-triage-rood/10',
    textColor: 'text-triage-rood',
    borderColor: 'border-triage-rood',
    badgeBg: 'bg-triage-rood',
    badgeText: 'text-white',
    emoji: '🔴',
  },
}

export function getKleur(kleur: string): KleurConfig {
  return triageKleurMap[kleur as TriageKleur] ?? triageKleurMap.groen
}
