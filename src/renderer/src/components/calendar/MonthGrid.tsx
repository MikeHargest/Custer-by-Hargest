import React from 'react'
import { v4 as uuidv4 } from 'uuid'
import { X } from 'lucide-react'
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

interface MonthGridProps {
  monthGridDays: {
    dateString: string
    dayNumber: number
    isToday: boolean
    isWeekend: boolean
    isEmpty?: boolean
    monthNameLong?: string
    monthNameShort?: string
    isFirstDayOfMonth?: boolean
    isPast?: boolean
  }[]
  timelineTasks: TimelineTask[]
  setTimelineTasks: React.Dispatch<React.SetStateAction<TimelineTask[]>>
  allEvents: any[]
  projects: Project[]
  taskIdToNameMap: Map<string, string>
  addingToCell: { projectId: string; date: string } | null
  setAddingToCell: React.Dispatch<React.SetStateAction<{ projectId: string; date: string; x: number; y: number } | null>>
  setContextMenu: (menu: { type: 'task' | 'event', id: string, title: string, projectId: string, x: number, y: number } | null) => void
}

export default function MonthGrid({
  monthGridDays,
  timelineTasks,
  setTimelineTasks,
  allEvents,
  projects,
  taskIdToNameMap,
  addingToCell,
  setAddingToCell,
  setContextMenu
}: MonthGridProps) {
  const monthGridContainerRef = React.useRef<HTMLDivElement>(null)
  const initialScrollDone = React.useRef(false)
  const [isReady, setIsReady] = React.useState(false)
  const isPanning = React.useRef(false)
  const panStartY = React.useRef(0)
  const panScrollTop = React.useRef(0)
  const [visibleMonthStr, setVisibleMonthStr] = React.useState(() => {
    // Initialize with today's month so the header shows the correct month immediately
    const today = new Date()
    const raw = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  })

  const doScrollToToday = React.useCallback((behavior: ScrollBehavior = 'instant') => {
    const container = monthGridContainerRef.current
    if (!container) return
    const todayCell = container.querySelector('.day-cell-container[data-is-today="true"]') as HTMLElement
    if (!todayCell) return

    // With position:relative on the grid div, todayCell.offsetTop gives exact
    // distance from the grid top. The grid starts right after the sticky header,
    // so scrolling to todayCell.offsetTop places the row flush under the header.
    container.scrollTo({ top: todayCell.offsetTop, behavior })
  }, [])

  // useLayoutEffect runs before browser paint. Combined with requestAnimationFrame
  // and isReady state, it ensures we scroll to today before the user sees anything,
  // preventing the "October 2025" flash.
  React.useLayoutEffect(() => {
    if (!initialScrollDone.current && monthGridContainerRef.current && monthGridDays.length > 0) {
      requestAnimationFrame(() => {
        doScrollToToday('instant')
        initialScrollDone.current = true
        setIsReady(true)
      })
    }
  }, [monthGridDays, doScrollToToday])

  React.useEffect(() => {
    const handleCustomScroll = () => doScrollToToday('smooth')
    window.addEventListener('scroll-to-today', handleCustomScroll)
    return () => window.removeEventListener('scroll-to-today', handleCustomScroll)
  }, [doScrollToToday])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget
    const rect = container.getBoundingClientRect()
    // Find an element slightly below the sticky header area
    const el = document.elementFromPoint(rect.left + rect.width / 2, rect.top + 160)
    if (!el) return

    // Look for our specific data attribute
    const cell = el.closest('.day-cell-container') as HTMLElement
    if (cell && cell.dataset.monthLong) {
      if (cell.dataset.monthLong !== visibleMonthStr) {
        setVisibleMonthStr(cell.dataset.monthLong)
      }
    }
  }

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.button !== 2) return
    isPanning.current = true
    panStartY.current = e.clientY
    panScrollTop.current = monthGridContainerRef.current?.scrollTop || 0
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!isPanning.current || !monthGridContainerRef.current) return
    e.preventDefault()
    const dy = e.clientY - panStartY.current
    monthGridContainerRef.current.scrollTop = panScrollTop.current - dy
  }

  const handleMouseUp = (): void => {
    isPanning.current = false
  }

  const removeTask = (taskId: string): void => {
    setTimelineTasks((prev) => prev.filter((t) => t.id !== taskId))
  }

  return (
    <div
      ref={monthGridContainerRef}
      className="month-grid-container"
      onScroll={handleScroll}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
      style={{ height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto', cursor: isPanning.current ? 'grabbing' : 'auto', opacity: isReady ? 1 : 0 }}
    >
      {/* Combined sticky header: Month name + weekday labels */}
      <div
        className="month-sticky-header"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 42,
          background: 'var(--card-bg)',
          borderBottom: '1px solid rgba(255,255,255,0.05)'
        }}
      >
        {/* Month name row */}
        <div
          style={{
            height: '45px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {visibleMonthStr}
          </div>
        </div>

        {/* Weekday labels row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            paddingTop: '6px',
            paddingBottom: '6px'
          }}
        >
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div
              key={day}
              style={{
                padding: '4px 8px',
                fontWeight: 600,
                fontSize: '12px',
                color: 'rgba(255,255,255,0.4)',
                textAlign: 'center'
              }}
            >
              {day}
            </div>
          ))}
        </div>
      </div>


      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gridAutoRows: 'minmax(150px, auto)',
          gap: '1px',
          background: 'rgba(255,255,255,0.05)',
          flex: 1,
          position: 'relative'
        }}
      >
        {monthGridDays.map((d, i) => {
          if (d.isEmpty) {
            return (
              <div
                key={`empty-${d.dateString}-${i}`}
                style={{ background: d.isWeekend ? 'linear-gradient(rgba(255,255,255,0.015), rgba(255,255,255,0.015)), var(--card-bg)' : 'var(--card-bg)' }}
                className="day-cell-container"
                data-month-long={d.monthNameLong}
              />
            )
          }

          const tasksForDay = timelineTasks.filter((t) => t.date === d.dateString)
          const eventsForDay = allEvents.filter((e) => e.date === d.dateString)

          return (
            <div
              key={d.dateString + i}
              className="day-cell-container"
              data-month-long={d.monthNameLong}
              data-is-today={d.isToday}
              onDoubleClick={(e) => {
                if (projects.length > 0 && !addingToCell) {
                  setAddingToCell({
                    projectId: projects[0].id,
                    date: d.dateString,
                    x: e.clientX,
                    y: e.clientY
                  })
                }
              }}
              style={{
                background: d.isToday
                  ? '#1f1f1f'
                  : d.isPast
                    ? d.isWeekend
                      ? 'linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.2)), linear-gradient(rgba(255,255,255,0.015), rgba(255,255,255,0.015)), var(--card-bg)'
                      : 'linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.2)), var(--card-bg)'
                    : d.isWeekend
                      ? 'linear-gradient(rgba(255,255,255,0.015), rgba(255,255,255,0.015)), var(--card-bg)'
                      : 'var(--card-bg)',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                opacity: 1, // Continuous scroll means all months have 1 opacity
                cursor: 'pointer',
                overflow: 'hidden',
                minHeight: 0
              }}
              onDragOver={handleDragOver}
              onDrop={(e) => {
                e.preventDefault()
                const rawData = e.dataTransfer.getData('text/plain')
                if (!rawData) return
                try {
                  const payload = JSON.parse(rawData)
                  if (payload.type === 'move_timeline_task') {
                    setTimelineTasks((prev) =>
                      prev.map((t) => {
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
                      })
                    )
                    return
                  }
                  if (payload.type === 'resize_timeline_task') {
                    setTimelineTasks((prev) =>
                      prev.map((t) => {
                        if (t.id === payload.id) {
                          if (d.dateString < t.date) {
                            return {
                              ...t,
                              date: d.dateString,
                              endDate: t.endDate || t.date
                            }
                          }
                          return {
                            ...t,
                            endDate: d.dateString === t.date ? undefined : d.dateString
                          }
                        }
                        return t
                      })
                    )
                    return
                  }
                  if (payload && payload.projectId && payload.text) {
                    const sourceTaskId = payload.taskId || payload.itemId
                    setTimelineTasks((prev) => [
                      ...prev,
                      {
                        id: uuidv4(),
                        projectId: payload.projectId,
                        taskName: payload.text,
                        date: d.dateString,
                        taskId: sourceTaskId
                      }
                    ])
                  }
                } catch {
                  // Ignore parsing errors
                }
              }}
            >
              <div
                style={{
                  textAlign: 'right',
                  fontSize: '12px',
                  color: d.isToday ? 'var(--text-primary)' : d.isPast ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.45)',
                  fontWeight: d.isToday ? 700 : 500,
                  marginBottom: '4px'
                }}
              >
                {d.monthNameShort && d.isFirstDayOfMonth ? `${d.dayNumber} ${d.monthNameShort}` : d.dayNumber}
              </div>
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  paddingRight: '4px'
                }}
                className="custom-scrollbar"
              >
                {eventsForDay.map((event) => (
                  <div
                    key={event.id}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setContextMenu({
                        type: 'event',
                        id: event.id,
                        title: event.title,
                        projectId: event.projectId,
                        x: e.clientX,
                        y: e.clientY
                      })
                    }}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        'text/plain',
                        JSON.stringify({
                          type: 'move_event',
                          id: event.id,
                          projectId: event.projectId
                        })
                      )
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '2px 6px',
                      background: 'var(--calendar-event-bg)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '11px',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderLeft: `2px solid ${event.projectColor || 'var(--accent)'}`,
                      marginBottom: '2px',
                      cursor: 'grab'
                    }}
                    title={`Event: ${event.title}\n(Drag to move instance)`}
                  >
                    <LucideIcons.Calendar size={10} style={{ flexShrink: 0, opacity: 0.7, color: event.projectColor || 'var(--accent)' }} />
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'var(--text-secondary)',
                      flex: 1
                    }}>
                      {event.title}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const delEvent = new CustomEvent('delete-event-instance', {
                          detail: { eventId: event.id, projectId: event.projectId }
                        })
                        window.dispatchEvent(delEvent)
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(255,255,255,0.2)',
                        cursor: 'pointer',
                        padding: '0 2px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="Delete instance"
                    >
                      <LucideIcons.X size={10} />
                    </button>
                  </div>
                ))}
                {tasksForDay.map((task) => {
                  const currentTaskName =
                    task.taskId && taskIdToNameMap.has(task.taskId)
                      ? taskIdToNameMap.get(task.taskId)!
                      : task.taskName
                  const isParent = isParentTask(projects, task.projectId, task.taskId, currentTaskName)
                  const project = projects.find((p) => p.id === task.projectId)
                  return (
                    <div
                      key={task.id}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setContextMenu({
                          type: 'task',
                          id: task.id,
                          title: currentTaskName || '',
                          projectId: task.projectId,
                          x: e.clientX,
                          y: e.clientY
                        })
                      }}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          'text/plain',
                          JSON.stringify({
                            type: 'move_timeline_task',
                            id: task.id,
                            projectId: task.projectId
                          })
                        )
                      }}
                      style={{
                        background: 'var(--calendar-task-bg)',
                        color: 'var(--text-primary)',
                        padding: '4px 6px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '11px',
                        fontWeight: isParent ? 600 : 400,
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderLeft: `3px solid ${project?.color || 'var(--accent)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '4px',
                        overflow: 'hidden'
                      }}
                      title={`Task: ${currentTaskName} (${project?.name || 'Unknown'})`}
                    >
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1
                        }}
                      >
                        {currentTaskName}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeTask(task.id)
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'rgba(255,255,255,0.3)',
                          cursor: 'pointer',
                          padding: '0',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  )
                })}

                {/* Tasks rendering continues... */}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
