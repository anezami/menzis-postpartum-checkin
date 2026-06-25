import type { Content, Taal, UitkomstContent } from './content.types'
import { SUPPORTED_TALEN } from './content.types'
import nlRaw from './nl.json'
import enRaw from './en.json'
import trRaw from './tr.json'
import arRaw from './ar.json'

export type { Content, Taal, UitkomstContent }
export { SUPPORTED_TALEN }

export const content: Record<Taal, Content> = {
  nl: nlRaw as unknown as Content,
  en: enRaw as unknown as Content,
  tr: trRaw as unknown as Content,
  ar: arRaw as unknown as Content,
}

export function getContent(taal: Taal): Content {
  return content[taal]
}

/** Returns the localised question text for the given vraagId. */
export function vraagTekst(c: Content, vraagId: string): string {
  return c.vragen[vraagId]?.tekst ?? vraagId
}

/** Returns the localised option label for the given vraagId and numeric waarde. */
export function optieLabel(c: Content, vraagId: string, waarde: number): string {
  return c.vragen[vraagId]?.opties[String(waarde)] ?? String(waarde)
}

/** Returns the localised uitkomst block for the given numeric niveau. */
export function uitkomstTekst(c: Content, niveau: number): UitkomstContent {
  return c.uitkomsten[String(niveau)] ?? { titel: '', advies: '', lizzBoodschap: '' }
}
