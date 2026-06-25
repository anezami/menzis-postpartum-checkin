import type { Beslisboom } from '../../engine/types'
import type { Content } from '../../data/content/content.types'
import { optieLabel } from '../../data/content'

interface OptionChipsProps {
  vraagIndex: number
  boom: Beslisboom
  c: Content
  rtl: boolean
  onKies: (waarde: number) => void
}

export default function OptionChips({ vraagIndex, boom, c, rtl, onKies }: OptionChipsProps) {
  const vraag = boom.vragen[vraagIndex]
  if (!vraag) return null

  return (
    <div
      className={`flex flex-col gap-2 ${rtl ? 'items-end' : 'items-start'}`}
      role="group"
      aria-label={c.vragen[vraag.id]?.tekst}
    >
      {vraag.opties.map((optie) => (
        <button
          key={optie.waarde}
          type="button"
          onClick={() => onKies(optie.waarde)}
          className="min-h-[48px] px-5 py-2.5 rounded-2xl bg-white border-2 border-menzis-inkt/20 text-menzis-inkt font-medium text-base hover:border-menzis-geel hover:bg-menzis-zacht active:bg-menzis-geel/30 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-menzis-geel text-start shadow-sm"
        >
          {optieLabel(c, vraag.id, optie.waarde)}
        </button>
      ))}
    </div>
  )
}
