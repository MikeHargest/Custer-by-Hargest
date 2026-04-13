import { useState, useEffect } from 'react'
import { Play, Pause, Square, ExternalLink } from 'lucide-react'

interface MiniTimerState {
  title: string
  taskName: string | null
  timeLeft: number
  isRunning: boolean
  isFinished: boolean
  isStopwatch?: boolean
  bgColor?: string
}

export default function MiniTimer({ timerId }: { timerId: string }): React.ReactElement {
  const [state, setState] = useState<MiniTimerState | null>(null)

  useEffect(() => {
    // @ts-ignore - sync state from main
    const cleanup = window.api.onSyncTimerState((id: string, newState: MiniTimerState) => {
      if (id === timerId) {
        setState(newState)
      }
    })
    return cleanup
  }, [timerId])

  if (!state) {
    return <div className="mini-timer-loading">Loading...</div>
  }

  const { title, taskName, timeLeft, isRunning, isFinished, bgColor } = state

  const handleStartPause = (): void => {
    // @ts-ignore - toggle action
    window.api.actionTimer(timerId, 'TOGGLE')
  }

  const handleReset = (): void => {
    // @ts-ignore - reset action
    window.api.actionTimer(timerId, 'RESET')
  }

  const handleReturn = (): void => {
    // @ts-ignore - close window
    window.api.closeMiniWindow(timerId)
  }

  const displayHours = Math.floor(timeLeft / 3600)
  const displayMinutes = Math.floor((timeLeft % 3600) / 60)
  const displaySeconds = timeLeft % 60
  const pad = (num: number): string => num.toString().padStart(2, '0')

  // Чистый круглый стиль без принудительной заливки
  const roundStyle = {
    borderRadius: '50%',
    width: '44px',
    height: '44px',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    WebkitAppRegion: 'no-drag',
    flexShrink: 0
  } as React.CSSProperties

  return (
    <div
      className="mini-timer-container"
      style={{
        background: bgColor || 'var(--card-bg)',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}
    >
      <div className="mini-timer-header">
        <span className="mini-timer-title" title={title}>
          {title}
        </span>
        <button className="mini-timer-return" onClick={handleReturn}>
          <ExternalLink size={14} style={{ transform: 'rotate(180deg)' }} />
        </button>
      </div>

      <div className="mini-timer-task">{taskName || 'No task attached'}</div>

      <div className={`mini-timer-display ${isFinished ? 'finished' : ''}`}>
        {displayHours > 0 ? `${pad(displayHours)}:` : ''}
        {pad(displayMinutes)}:{pad(displaySeconds)}
      </div>

      <div className="mini-timer-controls" style={{ justifyContent: 'center', gap: '12px' }}>
        {isFinished ? (
          <button
            className="control-btn btn-reset"
            onClick={handleReset}
            style={{ width: '80%', borderRadius: '20px', WebkitAppRegion: 'no-drag' } as any}
          >
            <Square size={16} style={{ marginRight: '8px' }} /> Stop
          </button>
        ) : (
          <>
            {!isRunning ? (
              <button
                className="control-btn btn-play"
                onClick={handleStartPause}
                style={roundStyle}
              >
                <Play size={22} style={{ marginLeft: '3px' }} />
              </button>
            ) : (
              <button
                className="control-btn btn-pause"
                onClick={handleStartPause}
                style={roundStyle}
              >
                <Pause size={22} />
              </button>
            )}
            <button className="control-btn btn-reset" onClick={handleReset} style={roundStyle}>
              <Square size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
