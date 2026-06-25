import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { CheckinProvider } from './context/CheckinContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <CheckinProvider>
        <App />
      </CheckinProvider>
    </BrowserRouter>
  </StrictMode>,
)
