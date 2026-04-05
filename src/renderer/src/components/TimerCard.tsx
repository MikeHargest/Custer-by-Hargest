import { useState, useEffect, useRef } from 'react'
import { Play, Pause, Square, Music, X, AppWindow } from 'lucide-react'
import type { TimerData, UITheme } from '../types'

interface TimerCardProps {
  data: TimerData
  theme: UITheme
  onUpdate: (updates: Partial<TimerData>) => void
  onDelete: () => void
}
export default function TimerCard({ data, onUpdate, onDelete, theme }: TimerCardProps) {
  const [timeLeft, setTimeLeft] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isPinned, setIsPinned] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Calculate total seconds from inputs
  const getTotalSeconds = () => data.hours * 3600 + data.minutes * 60 + data.seconds

  // Initialize time left if not running
  useEffect(() => {
    if (!isRunning && !isFinished) {
      setTimeLeft(getTotalSeconds())
    }
  }, [data.hours, data.minutes, data.seconds])

  const playAlarm = () => {
    if (data.soundPath) {
      // Load local file using atom protocol or standard file path
      const fullPath = data.soundPath.startsWith('file://')
        ? data.soundPath
        : `file:///${data.soundPath.replace(/\\/g, '/')}`

      if (!audioRef.current) {
        audioRef.current = new Audio(fullPath)
      } else {
        audioRef.current.src = fullPath
      }
      audioRef.current.loop = true
      audioRef.current.play().catch((err) => console.error('Audio play failed:', err))
    } else {
      // Default browser beep fallback (if no mp3 chosen)
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
      audio.loop = true
      audio.play().catch((e) => console.error('Error playing fallback audio', e))
      audioRef.current = audio
    }
  }

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (isRunning && !data.isStopwatch && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1)
      }, 1000)
    } else if (isRunning && !data.isStopwatch && timeLeft === 0) {
      // Timer finished!
      if (!isFinished) {
        // Prevent multiple calls if already finished
        setIsRunning(false)
        setIsFinished(true)
        setHasStarted(false)
        onUpdate({ isRunning: false })
        playAlarm()
        // @ts-ignore
        window.api.showNotification('Time is up!', `Timer "${data.title}" has finished.`)
      }
    } else if (isRunning && data.isStopwatch) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev + 1)
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRunning, timeLeft, data.isStopwatch, isFinished])

  const stopAlarm = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    setIsFinished(false)
  }

  const handleStart = () => {
    if (getTotalSeconds() === 0 && !data.isStopwatch) return
    setIsRunning(true)
    setHasStarted(true)
    onUpdate({ isRunning: true })
  }

  const handlePause = () => {
    setIsRunning(false)
    onUpdate({ isRunning: false })
  }

  const handleReset = () => {
    setIsRunning(false)
    setHasStarted(false)
    stopAlarm()
    setTimeLeft(getTotalSeconds())
    onUpdate({ isRunning: false })
  }

  const handleSoundSelect = async () => {
    // @ts-ignore
    const filePath = await window.api.selectAudioFile()
    if (filePath) {
      const fileName = filePath.split('\\').pop()?.split('/').pop() || 'Sound'
      onUpdate({ soundPath: filePath, soundName: fileName })
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const rawData = e.dataTransfer.getData('text/plain')
    if (rawData) {
      try {
        const parsed = JSON.parse(rawData)
        if (parsed.text) {
          onUpdate({ taskName: parsed.text })
          return
        }
      } catch (err) {
        // Fallback for raw text
      }
      onUpdate({ taskName: rawData })
    }
  }

  const clearTask = () => {
    onUpdate({ taskName: null })
  }

  const handlePin = () => {
    setIsPinned(true)
    // @ts-ignore
    window.api.createMiniWindow(data.id)

    // Removed auto-start on pop-out
  }

  const handleUnpin = () => {
    setIsPinned(false)
    // @ts-ignore
    window.api.closeMiniWindow(data.id)
  }

  // --- Mini Window Synchronization ---
  useEffect(() => {
    if (isPinned) {
      const syncState = (): void => {
        // @ts-ignore - window.api is injected by preload
        window.api.syncTimerState(data.id, {
          title: data.title,
          taskName: data.taskName,
          timeLeft,
          isRunning,
          isFinished,
          isStopwatch: data.isStopwatch,
          bgColor: theme.timerBg || '#0A0A0A'
        })
      }

      // Immediate sync for ongoing state changes
      const syncId = requestAnimationFrame(syncState)

      // Delayed sync to catch the mini-window after it finishes loading
      const delayedSync = setTimeout(syncState, 600)

      // Periodic heartbeat so paused timers still sync
      const heartbeat = setInterval(syncState, 1000)

      return () => {
        cancelAnimationFrame(syncId)
        clearTimeout(delayedSync)
        clearInterval(heartbeat)
      }
    }
    return undefined
  }, [isPinned, data.title, data.taskName, timeLeft, isRunning, isFinished, data.id])

  useEffect(() => {
    if (!isPinned) return

    // @ts-ignore
    const cleanupAction = window.api.onActionTimer((id: string, action: string) => {
      if (id !== data.id) return
      if (action === 'TOGGLE') {
        if (isFinished) return
        if (isRunning) {
          handlePause()
        } else {
          handleStart()
        }
      } else if (action === 'RESET') {
        handleReset()
      }
    })

    // @ts-ignore
    const cleanupClose = window.api.onMiniWindowClosed((id: string) => {
      if (id === data.id) {
        setIsPinned(false)
      }
    })

    return () => {
      if (cleanupAction) cleanupAction()
      if (cleanupClose) cleanupClose()
    }
  }, [isPinned, isRunning, isFinished, data.id])
  // -----------------------------------

  // Formatting display time
  const displayHours = Math.floor(timeLeft / 3600)
  const displayMinutes = Math.floor((timeLeft % 3600) / 60)
  const displaySeconds = timeLeft % 60

  const pad = (num: number) => num.toString().padStart(2, '0')

  const progress =
    !data.isStopwatch && getTotalSeconds() > 0 ? (timeLeft / getTotalSeconds()) * 100 : 0

  return (
    <div
      className={`timer-card ${isFinished ? 'finished' : ''} ${isPinned ? 'pinned' : ''}`}
      data-timer-id={data.id}
      onDragOver={isPinned ? undefined : handleDragOver}
      onDragLeave={isPinned ? undefined : handleDragLeave}
      onDrop={isPinned ? undefined : handleDrop}
    >
      <div className="timer-header">
        <input
          type="text"
          className="timer-title"
          value={data.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Timer name"
          disabled={isPinned}
        />
        <div style={{ display: 'flex', gap: '4px' }}>
          {!isPinned ? (
            <button className="timer-pin" onClick={handlePin} title="Open in mini-window">
              <AppWindow size={16} />
            </button>
          ) : (
            <button
              className="timer-pin active"
              onClick={handleUnpin}
              title="Return to main window"
            >
              <AppWindow size={16} />
            </button>
          )}
          <button className="timer-delete" onClick={onDelete} title="Delete timer">
            <X size={16} />
          </button>
        </div>
      </div>

      {isPinned ? (
        <div className="timer-pinned-state">
          <div className="pinned-icon-container">
            <AppWindow size={32} />
          </div>
          <p>Opened in mini-window.</p>
          <button className="unpin-btn" onClick={handleUnpin}>
            Return here
          </button>
        </div>
      ) : (
        <>
          <div
            className={`timer-task-container ${isDragOver ? 'drag-over' : ''} ${data.taskName ? 'has-task' : ''}`}
          >
            {data.taskName ? (
              <>
                <span className="timer-task-text" title={data.taskName}>
                  {data.taskName}
                </span>
                <button className="timer-task-clear" onClick={clearTask} title="Clear task">
                  <X size={14} />
                </button>
              </>
            ) : (
              <span>Drag task here</span>
            )}
          </div>

          {!hasStarted && !isFinished && !data.isStopwatch ? (
            <div className="timer-display">
              <div className="time-input-group">
                <input
                  type="number"
                  className="time-input"
                  min="0"
                  max="99"
                  value={data.hours}
                  onChange={(e) => onUpdate({ hours: Math.max(0, parseInt(e.target.value) || 0) })}
                />
                <span className="time-label">Hr</span>
              </div>
              <span className="time-separator">:</span>
              <div className="time-input-group">
                <input
                  type="number"
                  className="time-input"
                  min="0"
                  max="59"
                  value={data.minutes}
                  onChange={(e) =>
                    onUpdate({ minutes: Math.max(0, Math.min(59, parseInt(e.target.value) || 0)) })
                  }
                />
                <span className="time-label">Min</span>
              </div>
              <span className="time-separator">:</span>
              <div className="time-input-group">
                <input
                  type="number"
                  className="time-input"
                  min="0"
                  max="59"
                  value={data.seconds}
                  onChange={(e) =>
                    onUpdate({ seconds: Math.max(0, Math.min(59, parseInt(e.target.value) || 0)) })
                  }
                />
                <span className="time-label">Sec</span>
              </div>
            </div>
          ) : (
            <div className="timer-display" style={{ fontSize: '48px', fontWeight: 'bold' }}>
              {displayHours > 0 ? `${pad(displayHours)}:` : ''}
              {pad(displayMinutes)}:{pad(displaySeconds)}
            </div>
          )}

          {/* Thin progress bar below timer display */}
          {!data.isStopwatch && getTotalSeconds() > 0 && (
            <div className="timer-progress-track">
              <div className="timer-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          )}

          <div className="bottom-controls">
            {!data.isStopwatch && (
              <button className="sound-selector" onClick={handleSoundSelect}>
                <Music size={14} />
                <span className="sound-name">{data.soundName ? data.soundName : 'Sound'}</span>
              </button>
            )}

            <div
              className="timer-controls"
              style={data.isStopwatch ? { marginLeft: 'auto' } : undefined}
            >
              {isFinished ? (
                <button
                  className="control-btn btn-reset"
                  onClick={handleReset}
                  style={{ width: '100%' }}
                >
                  <Square size={16} style={{ marginRight: '8px' }} /> Stop
                </button>
              ) : (
                <>
                  {!isRunning ? (
                    <button
                      className="control-btn btn-play"
                      onClick={handleStart}
                      disabled={getTotalSeconds() === 0 && !data.isStopwatch}
                      style={{ opacity: getTotalSeconds() === 0 && !data.isStopwatch ? 0.3 : 1 }}
                      title="Start"
                    >
                      <Play />
                    </button>
                  ) : (
                    <button className="control-btn btn-pause" onClick={handlePause}>
                      <Pause />
                    </button>
                  )}
                  <button className="control-btn btn-reset" onClick={handleReset} title="Reset">
                    <Square size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
