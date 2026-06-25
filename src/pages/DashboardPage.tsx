import { Link } from 'react-router-dom'
import { useCheckin } from '../context/CheckinContext'
import { getKleur } from '../components/triageKleur'
import Header from '../components/Header'
import Card from '../components/Card'
import TriageBadge from '../components/TriageBadge'
import PrimaryButton from '../components/PrimaryButton'

export default function DashboardPage() {
  const { signalen } = useCheckin()

  return (
    <div className="min-h-screen bg-menzis-zacht">
      <Header />
      <main className="max-w-md mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-menzis-inkt mb-2">
          Dashboard
        </h1>
        <p className="text-menzis-inkt/60 text-sm mb-6">
          Overzicht van alle check-ins in deze sessie.
        </p>

        {signalen.length === 0 ? (
          <Card>
            <p className="text-menzis-inkt/70 mb-2 text-base leading-relaxed">
              Hier verschijnen je check-in resultaten zodra je er een hebt afgerond. 🌱
            </p>
            <p className="text-menzis-inkt/60 text-sm mb-6">
              Nog geen resultaten beschikbaar.
            </p>
            <Link to="/start?token=demo123&moment=inschrijving" className="block">
              <PrimaryButton>Start een check-in →</PrimaryButton>
            </Link>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {signalen.map((s) => {
              const config = getKleur(s.kleur)
              return (
                <div
                  key={s.id}
                  className={`rounded-3xl shadow-md overflow-hidden border-l-8 bg-white ${config.borderColor}`}
                  role="article"
                  aria-label={`Check-in van ${s.naam}`}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="font-bold text-menzis-inkt text-base">{s.naam}</p>
                        <p className="text-sm text-menzis-inkt/60">{s.moment}</p>
                      </div>
                      <TriageBadge kleur={s.kleur} label={`Niveau ${s.niveau}`} />
                    </div>
                    <p className="text-sm text-menzis-inkt/80 mb-3 font-medium">
                      {config.emoji} {s.signaal.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-menzis-inkt/50">
                      {new Date(s.tijdstip).toLocaleString('nl-NL', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>
                </div>
              )
            })}

            <div className="mt-2">
              <Link to="/start?token=demo123&moment=inschrijving" className="block">
                <PrimaryButton variant="ghost">
                  Nog een check-in starten
                </PrimaryButton>
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
