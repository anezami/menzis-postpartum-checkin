import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import type { Antwoorden, Profiel, Signaal, Uitkomst } from '../engine/types'
import type { Taal } from '../data/content/content.types'
import { detecteerTaal, getOpgeslagenTaal, setOpgeslagenTaal } from '../i18n/taal'

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

type CheckinState = {
  profiel: Profiel | null
  token: string | null
  moment: string | null
  antwoorden: Antwoorden
  /** In-memory signal store. reset() clears the session but KEEPS signalen so
   *  the dashboard persists across multiple check-in runs within the same app
   *  lifetime. Signals are intentionally lost on a full page refresh — this is a
   *  frontend-only demo with no persistence layer. */
  signalen: Signaal[]
  /** Active UI language; persisted in localStorage. */
  taal: Taal
}

type CheckinActions = {
  startSessie: (token: string, moment: string, profiel: Profiel) => void
  setAntwoord: (vraagId: string, waarde: number) => void
  /** Clears the current session (profiel, token, moment, antwoorden) but keeps signalen. */
  reset: () => void
  registreerSignaal: (uitkomst: Uitkomst, profiel: Profiel, moment: string) => void
  /** Switch the active language and persist the choice. */
  setTaal: (taal: Taal) => void
}

type CheckinContextValue = CheckinState & CheckinActions

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const CheckinContext = createContext<CheckinContextValue | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

let _counter = 0

export function CheckinProvider({ children }: { children: ReactNode }) {
  const [profiel, setProfiel] = useState<Profiel | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [moment, setMoment] = useState<string | null>(null)
  const [antwoorden, setAntwoorden] = useState<Antwoorden>({})
  const [signalen, setSignalen] = useState<Signaal[]>([])
  const [taal, setTaalState] = useState<Taal>(() => getOpgeslagenTaal() ?? detecteerTaal())

  function startSessie(t: string, m: string, p: Profiel) {
    setToken(t)
    setMoment(m)
    setProfiel(p)
    setAntwoorden({})
  }

  function setAntwoord(vraagId: string, waarde: number) {
    setAntwoorden((prev) => ({ ...prev, [vraagId]: waarde }))
  }

  function reset() {
    setToken(null)
    setMoment(null)
    setProfiel(null)
    setAntwoorden({})
    // signalen intentionally kept — see comment on CheckinState.signalen
  }

  function registreerSignaal(uitkomst: Uitkomst, p: Profiel, m: string) {
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : String(++_counter)

    const signaal: Signaal = {
      id,
      naam: p.naam,
      moment: m,
      niveau: uitkomst.niveau,
      signaal: uitkomst.signaal,
      kleur: uitkomst.kleur,
      tijdstip: new Date().toISOString(),
    }
    setSignalen((prev) => [...prev, signaal])
  }

  function setTaal(t: Taal) {
    setOpgeslagenTaal(t)
    setTaalState(t)
  }

  return (
    <CheckinContext.Provider
      value={{
        profiel,
        token,
        moment,
        antwoorden,
        signalen,
        taal,
        startSessie,
        setAntwoord,
        reset,
        registreerSignaal,
        setTaal,
      }}
    >
      {children}
    </CheckinContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCheckin(): CheckinContextValue {
  const ctx = useContext(CheckinContext)
  if (!ctx) throw new Error('useCheckin must be used inside <CheckinProvider>')
  return ctx
}
