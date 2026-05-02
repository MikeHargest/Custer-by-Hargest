import React from 'react'
import { v4 as uuidv4 } from 'uuid'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Project, TimelineTask } from '../../types'
import { formatLocalDate } from '../../utils/dateUtils'
import CalendarEventItem from './CalendarEventItem'
import CalendarTaskItem from './CalendarTaskItem'

interface DayGridProps {
  dayData: {
    dateString: string
    dayNumber: number
    dayNameLong: string
    dayNameShort: string
    isToday: boolean
    isWeekend: boolean
    monthNameLong: string
  }
  weekDaysForDayView: { // pass week days so we can show horizontal list
    dateString: string
    dayNumber: number
    dayNameShort: string
    isToday: boolean
  }[]
  onSelectDay: (dateString: string) => void
  onPrevDay: () => void
  onNextDay: () => void
  timelineTasks: TimelineTask[]
  setTimelineTasks: React.Dispatch<React.SetStateAction<TimelineTask[]>>
  allEvents: any[]
  projects: Project[]
  taskIdToNameMap: Map<string, string>
  addingToCell: { projectId: string; date: string } | null
  setAddingToCell: React.Dispatch<React.SetStateAction<{ projectId: string; date: string; x: number; y: number } | null>>
  setContextMenu: (menu: { type: 'task' | 'event'; id: string; title: string; projectId: string; x: number; y: number } | null) => void
}

export default function DayGrid({
  dayData,
  weekDaysForDayView,
  onSelectDay,
  onPrevDay,
  onNextDay,
  timelineTasks,
  setTimelineTasks,
  allEvents,
  projects,
  taskIdToNameMap,
  addingToCell,
  setAddingToCell,
  setContextMenu
}: DayGridProps): JSX.Element {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [allDayHeight, setAllDayHeight] = React.useState(80)
  const isResizingRef = React.useRef(false)

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      if (!isResizingRef.current) return
      setAllDayHeight(prev => Math.max(40, Math.min(prev + e.movementY, 500)))
    }
    const cleanup = (): void => {
      if (isResizingRef.current) {
        isResizingRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', cleanup)
    // If mouse is released outside the browser window, mouseup never fires
    window.addEventListener('blur', cleanup)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', cleanup)
      window.removeEventListener('blur', cleanup)
    }
  }, [])

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const tasksForDay = timelineTasks.filter((t) => {
    // Show tasks that start on this day
    if (t.date === dayData.dateString) return true
    // Show tasks that span across this day (started earlier, end later)
    if (t.endDate) {
      return (
        t.date !== dayData.dateString &&
        dayData.dateString > t.date &&
        dayData.dateString <= t.endDate
      )
    }
    return false
  })
  const allEventsForDay = allEvents.filter((e) => e.date === dayData.dateString)
  
  const allDayItems = allEventsForDay.filter(e => !e.time)
  const timedItems = allEventsForDay.filter(e => !!e.time)

  return (
    <div
      ref={containerRef}
      className="day-grid-container"
      onContextMenu={(e) => e.preventDefault()}
      style={{ height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}
    >
      <div
        className="day-sticky-header"
        style={{
          position: 'sticky',
          top: 0,
          background: 'var(--card-bg)',
          zIndex: 10,
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onPrevDay}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {dayData.dayNameLong}, {dayData.monthNameLong} {dayData.dayNumber}
            </div>
            {dayData.isToday && (
              <div style={{ fontSize: '11px', color: 'var(--accent)', marginTop: '2px' }}>
                Today
              </div>
            )}
          </div>
          <button
            onClick={onNextDay}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {weekDaysForDayView.map((d) => (
            <button
              key={d.dateString}
              onClick={() => onSelectDay(d.dateString)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                background: d.dateString === dayData.dateString ? 'var(--accent)' : 'transparent',
                color: d.dateString === dayData.dateString ? '#fff' : 'var(--text-secondary)',
                border: d.isToday ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px'
              }}
            >
              <span style={{ fontSize: '10px', opacity: 0.7 }}>{d.dayNameShort}</span>
              <span style={{ fontWeight: d.dateString === dayData.dateString ? 600 : 400 }}>{d.dayNumber}</span>
            </button>
          ))}
        </div>
      </div>

      {/* All-day events */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          minHeight: `${allDayHeight}px`,
          position: 'relative'
        }}
        onDragOver={handleDragOver}
        onDrop={(e) => {
          e.preventDefault()
          const projectId = e.dataTransfer.getData('projectId')
          if (projectId && projects.length > 0) {
            const eventTitle = prompt('Event title:', 'New Event')
            if (eventTitle) {
              const newEvent = {
                id: uuidv4(),
                title: eventTitle,
                date: dayData.dateString,
                time: undefined,
                syncStatus: 'pending_push',
                updatedAt: Date.now()
              }
              // Add to the first project (or find by projectId)
              // This is simplified - in reality you'd want to add to a specific project
              console.log('Add all-day event:', newEvent)
            }
          }
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {allDayItems.map((event) => (
            <CalendarEventItem
              key={event.id}
              event={event}
              projectColor={projects.find(p => p.id === event.projectId)?.color || 'var(--accent)'}
              onContextMenu={(x, y) => setContextMenu({ type: 'event', id: event.id, title: event.title, projectId: event.projectId || '', x, y })}
            />
          ))}
        </div>
        {/* Resizer */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '4px',
            cursor: 'row-resize'
          }}
          onMouseDown={() => {
            isResizingRef.current = true
            document.body.style.cursor = 'row-resize'
            document.body.style.userSelect = 'none'
          }}
        />
      </div>

      {/* Timed events and tasks */}
      <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {timedItems.map((event) => (
          <CalendarEventItem
            key={event.id}
            event={event}
            projectColor={projects.find(p => p.id === event.projectId)?.color || 'var(--accent)'}
            onContextMenu={(x, y) => setContextMenu({ type: 'event', id: event.id, title: event.title, projectId: event.projectId || '', x, y })}
          />
        ))}
        {tasksForDay.map((task) => (
          <CalendarTaskItem
            key={task.taskId || task.id}
            task={task}
            taskName={taskIdToNameMap.get(task.taskId || '') || 'Unknown Task'}
            projectColor={projects.find(p => p.id === task.projectId)?.color || 'var(--accent)'}
            onContextMenu={(x, y) => setContextMenu({ type: 'task', id: task.taskId || task.id, title: task.taskName || 'Unknown', projectId: task.projectId, x, y })}
          />
        ))}
      </div>
    </div>
  )
}
