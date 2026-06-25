import { Routes, Route, Navigate } from 'react-router-dom'
import StartPage from './pages/StartPage'
import WelcomePage from './pages/WelcomePage'
import VraagPage from './pages/VraagPage'
import UitkomstPage from './pages/UitkomstPage'
import DashboardPage from './pages/DashboardPage'
import LizzPage from './pages/LizzPage'

export default function App() {
  return (
    <Routes>
      {/* Default: open Lizz (conversational) mode */}
      <Route
        path="/"
        element={<Navigate to="/lizz?token=demo123&moment=inschrijving" replace />}
      />
      <Route path="/lizz" element={<LizzPage />} />
      <Route path="/start" element={<StartPage />} />
      <Route path="/welkom" element={<WelcomePage />} />
      <Route path="/vraag/:index" element={<VraagPage />} />
      <Route path="/uitkomst" element={<UitkomstPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      {/* Catch-all fallback */}
      <Route
        path="*"
        element={<Navigate to="/lizz?token=demo123&moment=inschrijving" replace />}
      />
    </Routes>
  )
}

