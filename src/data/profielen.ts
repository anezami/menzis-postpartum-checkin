import type { Beslisboom, Profiel } from '../engine/types'
import beslisboomData from './beslisboom.json'
import profielenData from './profielen.json'

/** Typed map of demo token -> Profiel. */
type ProfielenMap = Record<string, Profiel>

export function getProfiel(token: string): Profiel | undefined {
  return (profielenData as ProfielenMap)[token]
}

export function getBeslisboom(): Beslisboom {
  return beslisboomData as Beslisboom
}
