import type { Antwoorden, Beslisboom, ScoringStrategie, Uitkomst } from './types'

/**
 * Registry mapping each ScoringStrategie name to a reducer over answer values.
 * Add new strategies here — evalueer picks one at runtime, never branches on id.
 */
const scoringStrategieën: Record<ScoringStrategie, (waarden: number[]) => number> = {
  max: (waarden) => Math.max(...waarden),
}

/**
 * Collects the chosen waarde for every vraag in the boom, applies the scoring
 * strategy from the registry and returns the computed niveau.
 * Returns 0 when no answers have been given.
 * Throws when the boom's scoring strategy is not registered.
 */
export function bepaalNiveau(boom: Beslisboom, antwoorden: Antwoorden): number {
  const waarden = boom.vragen
    .map((v) => antwoorden[v.id])
    .filter((w): w is number => w !== undefined)

  if (waarden.length === 0) return 0

  const strategie = scoringStrategieën[boom.scoring]
  if (!strategie) {
    throw new Error(
      `Onbekende scoring strategie: "${boom.scoring}". Registreer hem in scoringStrategieën.`,
    )
  }

  return strategie(waarden)
}

/**
 * Evaluates the boom for the given answers and returns the matching Uitkomst.
 * Throws when no uitkomst matches the computed niveau.
 */
export function evalueer(boom: Beslisboom, antwoorden: Antwoorden): Uitkomst {
  const niveau = bepaalNiveau(boom, antwoorden)
  const uitkomst = boom.uitkomsten.find((u) => u.niveau === niveau)
  if (!uitkomst) {
    throw new Error(
      `Geen uitkomst gevonden voor niveau ${niveau} in beslisboom "${boom.id}".`,
    )
  }
  return uitkomst
}

export { scoringStrategieën }
