export type Taal = 'nl' | 'en' | 'tr' | 'ar'

export const SUPPORTED_TALEN: Taal[] = ['nl', 'en', 'tr', 'ar']

export type VraagContent = {
  tekst: string
  opties: Record<string, string>
}

export type UitkomstContent = {
  titel: string
  advies: string
  lizzBoodschap: string
}

export type Content = {
  taal: Taal
  naam: 'Nederlands' | 'English' | 'Türkçe' | 'العربية'
  dir: 'ltr' | 'rtl'
  lizz: {
    naamLabel: string
    /** Greeting; use {naam} placeholder for the profile name */
    begroeting: string
    intro: string
    toestemming: string
    startKnop: string
    /** 3 short empathetic acknowledgements after an answer, before the next question */
    tussenzinnen: string[]
    /** "Lizz is typing…" style label / aria */
    denkt: string
    vorige: string
    volgende: string
    bekijkUitkomst: string
    /** Progress template; use {huidig} and {totaal} */
    voortgang: string
    opnieuw: string
    naarDashboard: string
    afsluiting: string
    /** Shown when free-text input doesn't match any option */
    nietBegrepen: string
    /** Shown in fallback when URL token is not recognised */
    onbekendToken: string
    /** Placeholder for the free-text input field */
    invoerPlaceholder: string
    /** Send button aria-label for the free-text input */
    verzend: string
    /** Toggle label to switch to the classic flow */
    klassiekToggle: string
  }
  /** Keyed by the vraag.id from beslisboom.json */
  vragen: Record<string, VraagContent>
  /** Keyed by niveau as string "1".."4" */
  uitkomsten: Record<string, UitkomstContent>
  /** Niveau-4 safety net text */
  vangnet: string
  dashboard: {
    titel: string
    leeg: string
    naam: string
    moment: string
    niveau: string
    signaal: string
    tijdstip: string
  }
  /** Friendly labels for check-in moments */
  momenten: Record<string, string>
  /** Aria/label for the language switcher */
  taalKiezer: string
}
