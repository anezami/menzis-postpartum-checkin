import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useCheckin } from '../context/CheckinContext'
import { getBeslisboom } from '../data/profielen'
import Header from '../components/Header'
import Card from '../components/Card'
import PrimaryButton from '../components/PrimaryButton'

export default function WelcomePage() {
  const { profiel } = useCheckin()
  const navigate = useNavigate()
  const [consent, setConsent] = useState(false)

  if (!profiel) {
    return <Navigate to="/start" replace />
  }

  const boom = getBeslisboom()

  const momentLabel: Record<string, string> = {
    inschrijving: 'vlak na de bevalling',
    '6_maanden': '6 maanden na de bevalling',
    '12_maanden': '12 maanden na de bevalling',
  }

  return (
    <div className="min-h-screen bg-menzis-zacht">
      <Header />
      <main className="max-w-md mx-auto px-4 py-10">
        <Card>
          <h1 className="text-3xl font-bold text-menzis-inkt mb-1">
            Hoi {profiel.naam} 👋
          </h1>
          <p className="text-sm text-menzis-inkt/60 mb-6">
            {profiel.wekenPostpartum} weken postpartum
            {profiel.moment in momentLabel && ` · ${momentLabel[profiel.moment]}`}
          </p>

          <p className="text-base text-menzis-inkt leading-relaxed mb-8">
            {boom.intro}
          </p>

          {/* Consent */}
          <div className="bg-menzis-zacht border border-menzis-geel/50 rounded-2xl p-4 mb-6">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 w-5 h-5 flex-shrink-0 rounded accent-[#FEC352] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-menzis-geel"
                aria-describedby="consent-label"
              />
              <span
                id="consent-label"
                className="text-sm text-menzis-inkt leading-relaxed"
              >
                Ik begrijp dat dit een{' '}
                <strong>demonstratie</strong> is met fictieve gegevens en{' '}
                <strong>geen medisch advies</strong>.
              </span>
            </label>
          </div>

          <PrimaryButton
            disabled={!consent}
            onClick={() => navigate('/vraag/0')}
            aria-label="Start de check-in"
          >
            Start check-in →
          </PrimaryButton>
        </Card>
      </main>
    </div>
  )
}
