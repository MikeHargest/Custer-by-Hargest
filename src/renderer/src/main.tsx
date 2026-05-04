import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// Apply cached theme before React mounts to prevent background flash on reload.
try {
  const raw = localStorage.getItem('cluster-ui-theme-cache')
  if (raw) {
    const cached = JSON.parse(raw) as {
      bgColor?: string
      cardBg?: string
      accent?: string
      textPrimary?: string
      boardAccent?: string
      boardBg?: string
      calendarTaskBg?: string
      calendarEventBg?: string
      timerBg?: string
    }
    const root = document.documentElement
    if (cached.bgColor) root.style.setProperty('--bg-color', cached.bgColor)
    if (cached.cardBg) root.style.setProperty('--card-bg', cached.cardBg)
    if (cached.accent) root.style.setProperty('--accent', cached.accent)
    if (cached.textPrimary) root.style.setProperty('--text-primary', cached.textPrimary)
    if (cached.boardAccent) root.style.setProperty('--board-accent', cached.boardAccent)
    if (cached.boardBg) root.style.setProperty('--board-bg', cached.boardBg)
    if (cached.calendarTaskBg) root.style.setProperty('--calendar-task-bg', cached.calendarTaskBg)
    if (cached.calendarEventBg)
      root.style.setProperty('--calendar-event-bg', cached.calendarEventBg)
    if (cached.timerBg) root.style.setProperty('--timer-bg', cached.timerBg)
  }
} catch {
  // Ignore malformed cache and continue with defaults.
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
