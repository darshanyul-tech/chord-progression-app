import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/base.css'
import './styles/shell.css'
import './styles/stats.css'
import App from './App.tsx'
import { initAdvancedMode } from './state/advancedMode' // ADVANCED USER MODE (trial) — remove with the feature

initAdvancedMode() // ADVANCED USER MODE (trial) — sync stored pref to <body> before first paint

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
