import React from 'react'
import { v4 as uuidv4 } from 'uuid'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { Project, TimelineTask } from '../../types'
import { formatLocalDate } from '../../utils/dateUtils'

const isParentTask = (
  projects: Project[],
  projectId: string,
  taskId?: string,
  taskName?: string
): boolean => {
  const project = projects.find((p) => p.id === projectId)
  if (!project) return false

  const checkTasks = (tasks: any[]): boolean => {
    for (const t of tasks) {
      if (taskId && t.id === taskId) return !!(t.subtasks && t.subtasks.length > 0)
      if (!taskId && taskName && t.text === taskName) return !!(t.subtasks && t.subtasks.length > 0)

      if (t.subtasks && t.subtasks.length > 0) {
        if (checkTasks(t.subtasks)) return true
      }
    }
    return false
  }
  return checkTasks(project.tasks || [])
}

interface WeekGridProps {
  weekDays: {
    dateString: string
    dayNumber: number
    dayNameShort: string
    isToday: boolean
    isWeekend: boolean
    monthNameLong: string
  }[]
  onPrevWeek: () => void
  onNextWeek: () => void
  timelineTasks: TimelineTask[]
  setTimelineTasks: React.Dispatch<React.SetStateAction<TimelineTask[]>>
  allEvents: any[]
  projects: Project[]
  taskIdToNameMap: Map<string, string>
  addingToCell: { projectId: string; date: string } | null
  setAddingToCell: React.Dispatch<React.SetStateAction<{ projectId: string; date: string; x: number; y: number } | null>>
  setContextMenu: (menu: { type: 'task' | 'event', id: string, title: string, projectId: string, x: number, y: number } | null) => void
}

export default function WeekGrid({
  weekDays,
  onPrevWeek,
  onNextWeek,
  timelineTasks,
  setTimelineTasks,
  allEvents,
  projects,
  taskIdToNameMap,
  addingToCell,
  setAddingToCell,
  setContextMenu
}: WeekGridProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [allDayHeight, setAllDayHeight] = React.useState(80)
  const isResizingRef = React.useRef(false)

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return
      setAllDayHeight(prev => Math.max(40, Math.min(prev + e.movementY, 500)))
    }
    const cleanup = () => {
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

  const removeTask = (taskId: string): void => {
    setTimelineTasks((prev) => prev.filter((t) => t.id !== taskId))
  }

  return (
    <div
      ref={containerRef}
      className="week-grid-container"
      onContextMenu={(e) => e.preventDefault()}
      style={{ height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'var(--card-bg)' }}
    >
      <div
        className="week-sticky-header"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 42,
          background: 'var(--card-bg)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button onClick={onPrevWeek} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '4px' }}>
              <ChevronLeft size={16} />
            </button>
            <button onClick={onNextWeek} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '4px' }}>
              <ChevronRight size={16} />
            </button>
          </div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {weekDays[0]?.monthNameLong || ''}
          </div>
        </div>

        <div style={{ display: 'flex' }}>
          <div style={{ width: '50px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.05)' }}></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1 }}>
            {weekDays.map((d) => (
              <div
                key={d.dateString}
                style={{ padding: '8px', borderRight: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{d.dayNameShort}</div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: d.isToday ? 'var(--accent)' : 'var(--text-primary)' }}>{d.dayNumber}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Resizable All-Day Grid */}
        <div style={{ display: 'flex', height: `${allDayHeight}px`, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ width: '50px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
            All-Day
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1 }}>
            {weekDays.map(d => {
              const tasksForDay = timelineTasks.filter((t) => t.date === d.dateString)
              const allEventsForDay = allEvents.filter((e) => e.date === d.dateString)
              const allDayItems = allEventsForDay.filter(e => !e.time)

              return (
                <div
                  key={`allday-${d.dateString}`}
                  onDoubleClick={(e) => {
                    if (projects.length > 0 && !addingToCell) {
                      setAddingToCell({ projectId: projects[0].id, date: d.dateString, x: e.clientX, y: e.clientY })
                    }
                  }}
                  style={{ borderRight: '1px solid rgba(255,255,255,0.05)', padding: '4px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', background: d.isWeekend ? 'linear-gradient(rgba(255,255,255,0.015), rgba(255,255,255,0.015)), var(--card-bg)' : 'transparent' }}
                  className="custom-scrollbar"
                >
                  {allDayItems.map((event) => (
                    <div
                      key={event.id}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setContextMenu({ type: 'event', id: event.id, title: event.title, projectId: event.projectId, x: e.clientX, y: e.clientY })
                      }}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'move_event', id: event.id, projectId: event.projectId }))}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 6px', background: 'var(--calendar-event-bg)', borderRadius: 'var(--radius-sm)',
                        fontSize: '11px', border: '1px solid rgba(255,255,255,0.05)', borderLeft: `2px solid ${event.projectColor || 'var(--accent)'}`, cursor: 'grab'
                      }}
                    >
                      <LucideIcons.Calendar size={10} style={{ flexShrink: 0, opacity: 0.7, color: event.projectColor || 'var(--accent)' }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)', flex: 1 }}>{event.title}</span>
                    </div>
                  ))}
                  {tasksForDay.map((task) => {
                    const currentTaskName = task.taskId && taskIdToNameMap.has(task.taskId) ? taskIdToNameMap.get(task.taskId)! : task.taskName
                    const project = projects.find((p) => p.id === task.projectId)
                    return (
                      <div
                        key={task.id}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setContextMenu({ type: 'task', id: task.id, title: currentTaskName || '', projectId: task.projectId, x: e.clientX, y: e.clientY })
                        }}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'move_timeline_task', id: task.id, projectId: task.projectId }))}
                        style={{
                          background: 'var(--calendar-task-bg)', color: 'var(--text-primary)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', fontSize: '11px',
                          border: '1px solid rgba(255,255,255,0.05)', borderLeft: `2px solid ${project?.color || 'var(--accent)'}`,
                          display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden'
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{currentTaskName}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>

        {/* Resizer Handle */}
        <div
          onMouseDown={(e) => {
            e.preventDefault()
            isResizingRef.current = true
            document.body.style.cursor = 'row-resize'
            document.body.style.userSelect = 'none'
          }}
          style={{ height: '5px', background: 'rgba(255,255,255,0.02)', cursor: 'row-resize', position: 'absolute', bottom: -2, left: 0, right: 0, zIndex: 50 }}
          title="Drag to resize all-day section"
        />

      </div>

      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
        {/* Time Scale Column */}
        <div style={{ width: '50px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}>
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} style={{ height: '60px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '10px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingTop: '4px', boxSizing: 'border-box' }}>
              {i.toString().padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* Days Columns */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1 }}>
          {weekDays.map((d, i) => {
            const allEventsForDay = allEvents.filter((e) => e.date === d.dateString)
            const timedItems = allEventsForDay.filter(e => !!e.time)

            return (
              <div
                key={d.dateString}
                style={{ borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', background: d.isWeekend ? 'linear-gradient(rgba(255,255,255,0.015), rgba(255,255,255,0.015)), var(--card-bg)' : 'transparent', minWidth: 0 }}
              >
                {/* Hourly Grid Section */}
                <div
                  style={{ flex: 1, position: 'relative' }}
                  onDoubleClick={(e) => {
                    if (projects.length > 0 && !addingToCell) {
                      setAddingToCell({ projectId: projects[0].id, date: d.dateString, x: e.clientX, y: e.clientY })
                    }
                  }}
                  onDragOver={handleDragOver}
                  onDrop={(e) => {
                    e.preventDefault()
                    const rawData = e.dataTransfer.getData('text/plain')
                    if (!rawData) return
                    try {
                      const payload = JSON.parse(rawData)
                      if (payload.type === 'move_timeline_task') {
                        setTimelineTasks((prev) => prev.map((t) => {
                          if (t.id === payload.id) {
                            if (t.endDate) {
                              const oldStartDate = new Date(t.date + 'T00:00:00').getTime()
                              const oldEndDate = new Date(t.endDate + 'T00:00:00').getTime()
                              const diffMs = oldEndDate - oldStartDate
                              const newStartDate = new Date(d.dateString + 'T00:00:00').getTime()
                              const newEndDate = formatLocalDate(new Date(newStartDate + diffMs))
                              return { ...t, date: d.dateString, endDate: newEndDate }
                            }
                            return { ...t, date: d.dateString }
                          }
                          return t
                        }))
                        return
                      }
                      if (payload.type === 'resize_timeline_task') {
                        setTimelineTasks((prev) => prev.map((t) => {
                          if (t.id === payload.id) {
                            if (d.dateString < t.date) return { ...t, date: d.dateString, endDate: t.endDate || t.date }
                            return { ...t, endDate: d.dateString === t.date ? undefined : d.dateString }
                          }
                          return t
                        }))
                        return
                      }
                      if (payload && payload.projectId && payload.text) {
                        const sourceTaskId = payload.taskId || payload.itemId
                        setTimelineTasks((prev) => [...prev, { id: uuidv4(), projectId: payload.projectId, taskName: payload.text, date: d.dateString, taskId: sourceTaskId }])
                      }
                    } catch { }
                  }}
                >
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div key={i} style={{ height: '60px', borderBottom: '1px solid rgba(255,255,255,0.02)', boxSizing: 'border-box' }} />
                  ))}

                  {/* Render Timed Events absolutely positioned */}
                  {timedItems.map(event => {
                    const [hh, mm] = (event.time || '00:00').split(':').map(Number)
                    const topPx = (hh * 60) + (mm)
                    return (
                      <div
                        key={event.id}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setContextMenu({ type: 'event', id: event.id, title: event.title, projectId: event.projectId, x: e.clientX, y: e.clientY })
                        }}
                        style={{
                          position: 'absolute',
                          top: `${topPx}px`,
                          left: '2px',
                          right: '4px',
                          height: '40px',
                          background: 'var(--calendar-event-bg)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid rgba(255,255,255,0.05)',
                          borderLeft: `3px solid ${event.projectColor || 'var(--accent)'}`,
                          padding: '2px 4px',
                          fontSize: '10px',
                          overflow: 'hidden',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1px' }}>{event.time}</div>
                        <div style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.title}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
