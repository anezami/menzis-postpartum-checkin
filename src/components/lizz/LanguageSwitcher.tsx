import { useState, useEffect, useRef } from 'react'
import type { Taal } from '../../data/content/content.types'
import type { Content } from '../../data/content/content.types'
import { SUPPORTED_TALEN, content } from '../../data/content'

interface LanguageSwitcherProps {
  taal: Taal
  onSetTaal: (t: Taal) => void
  c: Content
}

export default function LanguageSwitcher({ taal, onSetTaal, c }: LanguageSwitcherProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={c.taalKiezer}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-1.5 text-menzis-wit/80 hover:text-menzis-wit transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-menzis-geel rounded px-2 py-1 text-sm"
      >
        <span aria-hidden="true">🌐</span>
        <span>{content[taal].naam}</span>
        <span aria-hidden="true" className="text-xs">▾</span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={c.taalKiezer}
          className="absolute top-full end-0 mt-1 bg-white rounded-2xl shadow-lg py-2 min-w-[160px] z-50 border border-menzis-inkt/10"
        >
          {SUPPORTED_TALEN.map((t) => (
            <li key={t} role="option" aria-selected={t === taal}>
              <button
                type="button"
                onClick={() => {
                  onSetTaal(t)
                  setOpen(false)
                }}
                className={`w-full text-start px-4 py-2.5 text-base hover:bg-menzis-zacht transition-colors focus:outline-none focus-visible:bg-menzis-zacht ${
                  t === taal ? 'font-bold text-menzis-inkt' : 'text-menzis-inkt/80'
                }`}
              >
                {content[t].naam}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
