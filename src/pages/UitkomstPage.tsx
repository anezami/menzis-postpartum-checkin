import { useEffect, useRef } from 'react'
import { useNavigate, Link, Navigate } from 'react-router-dom'
import { useCheckin } from '../context/CheckinContext'
import { evalueer } from '../engine/triage'
import { getBeslisboom } from '../data/profielen'
import { getKleur } from '../components/triageKleur'
import type { Uitkomst } from '../engine/types'
import Header from '../components/Header'
import Card from '../components/Card'
import TriageBadge from '../components/TriageBadge'
import PrimaryButton from '../components/PrimaryButton'

export default function UitkomstPage() {
  const { profiel, moment, antwoorden, registreerSignaal, reset } = useCheckin()
  const navigate = useNavigate()
  const registreerd = useRef(false)

  const boom = getBeslisboom()

  // Compute outcome safely; may fail if no valid answers (direct URL access)
  let uitkomst: Uitkomst | null = null
  if (profiel && moment) {
    try {
      uitkomst = evalueer(boom, antwoorden)
    } catch {
      // No valid answers — will redirect below
    }
  }

  const kleurConfig = uitkomst ? getKleur(uitkomst.kleur) : null

  useEffect(() => {
    if (!profiel || !moment || !uitkomst) {
      navigate('/start', { replace: true })
      return
    }
    if (!registreerd.current) {
      registreerSignaal(uitkomst, profiel, moment)
      registreerd.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!uitkomst || !kleurConfig || !profiel || !moment) {
    return <Navigate to="/start" replace />
  }

  function handleOpnieuw() {
    reset()
    navigate('/start?token=demo123&moment=inschrijving')
  }

  const niveauLabel = ['', 'Alles gaat goed', 'Informatie & inspiratie', 'Digitale zelfzorg', 'Meer ondersteuning'][uitkomst.niveau] ?? uitkomst.kleur

  return (
    <div className="min-h-screen bg-menzis-zacht">
      <Header />
      <main className="max-w-md mx-auto px-4 py-10">
        {/* Result card with colored left border */}
        <div
          className={`rounded-3xl shadow-md overflow-hidden border-l-8 bg-white ${kleurConfig.borderColor}`}
          role="region"
          aria-label="Uitkomst van je check-in"
        >
          <div className="p-6">
            <div className="mb-4">
              <TriageBadge kleur={uitkomst.kleur} label={`Niveau ${uitkomst.niveau} · ${niveauLabel}`} />
            </div>
            <h1 className="text-2xl font-bold text-menzis-inkt mb-3">
              {kleurConfig.emoji} {uitkomst.titel}
            </h1>
            <p className="text-base text-menzis-inkt/80 leading-relaxed">
              {uitkomst.advies}
            </p>
          </div>
        </div>

        {/* Safety-net block for niveau 4 (rood) — always shown */}
        {uitkomst.niveau === 4 && (
          <Card className="mt-4 !bg-menzis-zacht border border-triage-rood/30">
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0" aria-hidden="true">🛟</span>
              <div>
                <p className="font-semibold text-menzis-inkt mb-1">
                  Voel je je acuut niet veilig of heb je dringend hulp nodig?
                </p>
                <p className="text-sm text-menzis-inkt/80 leading-relaxed">
                  Neem contact op met je huisarts of de huisartsenpost.{' '}
                  Bij spoed: bel <strong>112</strong>.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 mt-6">
          <Link to="/dashboard" className="block">
            <PrimaryButton>
              Naar dashboard →
            </PrimaryButton>
          </Link>
          <PrimaryButton variant="ghost" onClick={handleOpnieuw}>
            Opnieuw beginnen
          </PrimaryButton>
        </div>
      </main>
    </div>
  )
}
