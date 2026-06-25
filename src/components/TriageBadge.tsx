import { getKleur } from './triageKleur'

interface TriageBadgeProps {
  kleur: string
  label?: string
}

export default function TriageBadge({ kleur, label }: TriageBadgeProps) {
  const config = getKleur(kleur)
  const displayLabel = label ?? kleur

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${config.badgeBg} ${config.badgeText}`}
    >
      {config.emoji} {displayLabel}
    </span>
  )
}
