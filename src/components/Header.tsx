import { Link } from 'react-router-dom'

export default function Header() {
  return (
    <header className="bg-menzis-inkt py-4 px-6 flex items-center justify-between shadow-sm">
      <Link
        to="/"
        className="text-menzis-wit font-bold text-xl tracking-tight rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-menzis-geel"
        aria-label="Menzis — terug naar start"
      >
        Menzis
      </Link>
      <Link
        to="/lizz?token=demo123&moment=inschrijving"
        className="text-xs text-menzis-wit/60 hover:text-menzis-wit transition-colors rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-menzis-geel px-2 py-1"
      >
        Lizz ✨
      </Link>
    </header>
  )
}
