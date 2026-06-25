import { useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { getProfiel } from '../data/profielen'
import { useCheckin } from '../context/CheckinContext'
import Header from '../components/Header'
import Card from '../components/Card'
import PrimaryButton from '../components/PrimaryButton'

export default function StartPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { startSessie } = useCheckin()

  const token = params.get('token') ?? ''
  const moment = params.get('moment') ?? ''
  const profiel = token ? getProfiel(token) : undefined

  useEffect(() => {
    if (profiel && token && moment) {
      startSessie(token, moment, profiel)
      navigate('/welkom', { replace: true })
    }
    // We intentionally only run this on mount; token/moment come from URL and won't change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // If profile is found, we're mid-redirect — render nothing
  if (profiel) return null

  return (
    <div className="min-h-screen bg-menzis-zacht">
      <Header />
      <main className="max-w-md mx-auto px-4 py-10">
        <Card>
          <h1 className="text-2xl font-bold text-menzis-inkt mb-3">
            Welkom bij de postpartum check-in
          </h1>
          <p className="text-menzis-inkt/70 mb-6 leading-relaxed">
            We konden jouw profiel niet vinden. Kies hieronder een van de
            demo-profielen om de check-in te proberen.
          </p>

          <div className="flex flex-col gap-3">
            {[
              { token: 'demo123', moment: 'inschrijving', label: '👤 Sanne — 3 weken postpartum' },
              { token: 'demo456', moment: '6_maanden', label: '👤 Fatima — 6 maanden postpartum' },
              { token: 'demo789', moment: '12_maanden', label: '👤 Lotte — 12 maanden postpartum' },
            ].map(({ token: t, moment: m, label }) => (
              <Link key={t} to={`/start?token=${t}&moment=${m}`} className="block">
                <PrimaryButton variant="ghost" type="button">
                  {label}
                </PrimaryButton>
              </Link>
            ))}
          </div>
        </Card>
      </main>
    </div>
  )
}
