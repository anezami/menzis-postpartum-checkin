export type Optie = {
  waarde: number
  label: string
}

export type Vraag = {
  id: string
  tekst: string
  type: string
  opties: Optie[]
}

export type Uitkomst = {
  niveau: number
  kleur: 'groen' | 'geel' | 'oranje' | 'rood'
  titel: string
  advies: string
  signaal: string
}

export type ScoringStrategie = 'max'

export type Beslisboom = {
  id: string
  titel: string
  intro: string
  momenten: string[]
  scoring: ScoringStrategie
  vragen: Vraag[]
  uitkomsten: Uitkomst[]
}

/** vraagId -> gekozen waarde */
export type Antwoorden = Record<string, number>

export type Profiel = {
  naam: string
  wekenPostpartum: number
  moment: string
}

/** A recorded triage signal stored in the in-memory signal store. */
export type Signaal = {
  id: string
  naam: string
  moment: string
  niveau: number
  signaal: string
  kleur: string
  tijdstip: string // ISO 8601
}
