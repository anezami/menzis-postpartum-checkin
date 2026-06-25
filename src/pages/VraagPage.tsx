import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useCheckin } from '../context/CheckinContext'
import { getBeslisboom } from '../data/profielen'
import Header from '../components/Header'
import Card from '../components/Card'
import ProgressBar from '../components/ProgressBar'
import OptionButton from '../components/OptionButton'
import PrimaryButton from '../components/PrimaryButton'

export default function VraagPage() {
  const { index: indexStr } = useParams<{ index: string }>()
  const navigate = useNavigate()
  const { antwoorden, setAntwoord, profiel } = useCheckin()

  const boom = getBeslisboom()
  const index = parseInt(indexStr ?? '0', 10)
  const vraag = boom.vragen[index]
  const isLast = index === boom.vragen.length - 1
  const huidigAntwoord = vraag ? antwoorden[vraag.id] : undefined

  if (!profiel || !vraag) {
    return <Navigate to="/start" replace />
  }

  function gaVorige() {
    if (index > 0) navigate(`/vraag/${index - 1}`)
    else navigate('/welkom')
  }

  function gaVolgende() {
    if (isLast) navigate('/uitkomst')
    else navigate(`/vraag/${index + 1}`)
  }

  return (
    <div className="min-h-screen bg-menzis-zacht">
      <Header />
      <main className="max-w-md mx-auto px-4 py-8">
        {/* Progress */}
        <div className="mb-6">
          <ProgressBar current={index + 1} total={boom.vragen.length} />
        </div>

        <Card>
          <fieldset className="border-0 p-0 m-0">
            <legend className="text-xl font-bold text-menzis-inkt mb-6 leading-snug w-full">
              {vraag.tekst}
            </legend>

            <div className="flex flex-col gap-3">
              {vraag.opties.map((optie) => (
                <OptionButton
                  key={optie.waarde}
                  name={vraag.id}
                  label={optie.label}
                  value={optie.waarde}
                  selected={huidigAntwoord === optie.waarde}
                  onChange={(v) => setAntwoord(vraag.id, v)}
                />
              ))}
            </div>
          </fieldset>
        </Card>

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          <PrimaryButton
            variant="ghost"
            fullWidth={false}
            className="flex-1"
            onClick={gaVorige}
            aria-label="Vorige vraag"
          >
            ← Vorige
          </PrimaryButton>
          <PrimaryButton
            fullWidth={false}
            className="flex-1"
            disabled={huidigAntwoord === undefined}
            onClick={gaVolgende}
            aria-label={isLast ? 'Bekijk de uitkomst' : 'Volgende vraag'}
          >
            {isLast ? 'Bekijk uitkomst →' : 'Volgende →'}
          </PrimaryButton>
        </div>
      </main>
    </div>
  )
}
