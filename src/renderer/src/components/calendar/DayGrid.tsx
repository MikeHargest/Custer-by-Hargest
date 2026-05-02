import React from 'react'
import { v4 as uuidv4 } from 'uuid'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { Project, TimelineTask } from '../../types'
import { formatLocalDate } from '../../utils/dateUtils'



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
  setContextMenu: (menu: { type: 'task' | 'event', id: string, title: string, projectId: string, x: number, y: number } | null) => void
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



  const tasksForDay = timelineTasks.filter((t) => t.date === dayData.dateString)
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
          zIndex: 42,
          background: 'var(--card-bg)',
          borderBottom: '1px solid rgba(255,255,255,0.05)'
        }}
      >
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button 
                onClick={onPrevDay}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', padding: '4px' }}
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={onNextDay}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', padding: '4px' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {dayData.dayNameLong}, {dayData.monthNameLong} {dayData.dayNumber}
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            {weekDaysForDayView.map(dw => (
               <button
                  key={dw.dateString}
                  onClick={() => onSelectDay(dw.dateString)}
                  style={{
                     display: 'flex', flexDirection: 'column', alignItems: 'center',
                     background: dayData.dateString === dw.dateString ? 'rgba(255,255,255,0.1)' : 'transparent',
                     border: 'none', padding: '4px 8px', borderRadius: '8px', cursor: 'pointer',
                     minWidth: '40px', transition: 'all 0.2s'
                  }}
               >
                 <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{dw.dayNameShort}</span>
                 <span style={{ fontSize: '13px', fontWeight: 600, color: dw.isToday ? 'var(--accent)' : 'var(--text-primary)' }}>{dw.dayNumber}</span>
               </button>
            ))}
          </div>
        </div>

        {/* Resizable All-Day Area for DayGrid */}
        <div style={{ display: 'flex', height: `${allDayHeight}px`, borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
          <div style={{ width: '50px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
             All-Day
          </div>
          <div 
             onDoubleClick={(e) => {
               if (projects.length > 0 && !addingToCell) {
                 setAddingToCell({ projectId: projects[0].id, date: dayData.dateString, x: e.clientX, y: e.clientY })
               }
             }}
             style={{ flex: 1, padding: '4px', overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '4px', alignContent: 'flex-start' }} className="custom-scrollbar"
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
                       display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', background: 'var(--calendar-event-bg)', borderRadius: 'var(--radius-sm)',
                       fontSize: '12px', border: '1px solid rgba(255,255,255,0.05)',
                       borderLeft: `3px solid ${event.projectColor || 'var(--accent)'}`,
                       cursor: 'grab', height: '24px', maxWidth: '200px'
                     }}
                 >
                   <LucideIcons.Calendar size={12} style={{ flexShrink: 0, opacity: 0.7, color: event.projectColor || 'var(--accent)' }} />
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
                         background: 'var(--calendar-task-bg)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: 'var(--radius-md)', fontSize: '12px',
                         border: '1px solid rgba(255,255,255,0.05)',
                         borderLeft: `4px solid ${project?.color || 'var(--accent)'}`,
                         height: '24px',
                         display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', maxWidth: '200px'
                       }}
                   >
                     <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{currentTaskName}</span>
                   </div>
                 )
             })}
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
      </div>

      <div style={{ display: 'flex', flex: 1, position: 'relative', background: 'var(--card-bg)' }}>
        {/* Time Scale */}
        <div style={{ width: '50px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}>
          {Array.from({ length: 24 }).map((_, i) => (
             <div key={i} style={{ height: '60px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '10px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingTop: '4px', boxSizing: 'border-box' }}>
                {i.toString().padStart(2, '0')}:00
             </div>
          ))}
        </div>

        {/* Day Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Time Grid View */}
          <div 
             style={{ flex: 1, position: 'relative' }}
             onDoubleClick={(e) => {
               if (projects.length > 0 && !addingToCell) {
                 setAddingToCell({ projectId: projects[0].id, date: dayData.dateString, x: e.clientX, y: e.clientY })
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
                         const newStartDate = new Date(dayData.dateString + 'T00:00:00').getTime()
                         const newEndDate = formatLocalDate(new Date(newStartDate + diffMs))
                         return { ...t, date: dayData.dateString, endDate: newEndDate }
                       }
                       return { ...t, date: dayData.dateString }
                     }
                     return t
                   }))
                   return
                 }
                 if (payload && payload.projectId && payload.text) {
                   const sourceTaskId = payload.taskId || payload.itemId
                   setTimelineTasks((prev) => [...prev, { id: uuidv4(), projectId: payload.projectId, taskName: payload.text, date: dayData.dateString, taskId: sourceTaskId }])
                 }
                  } catch (e) { console.error(e); }
             }}
          >
             {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} style={{ height: '60px', borderBottom: '1px solid rgba(255,255,255,0.02)', boxSizing: 'border-box' }}></div>
             ))}

             {/* Render Timed Events absolutely positioned */}
             {timedItems.map(event => {
                const [hh, mm] = (event.time || '00:00').split(':').map(Number)
                const topPx = (hh * 60) + (mm)
                // Default height 60px unless end time exists (not implemented yet, so 60)
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
                       left: '4px',
                       right: '16px',
                        height: '24px',
                       background: 'var(--calendar-event-bg)',
                       borderRadius: 'var(--radius-sm)',
                       border: '1px solid rgba(255,255,255,0.05)',
                       borderLeft: `3px solid ${event.projectColor || 'var(--accent)'}`,
                       padding: '4px 8px',
                       fontSize: '12px',
                       overflow: 'hidden',
                       boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                       cursor: 'pointer'
                    }}
                  >
                     <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>{event.time}</div>
                     <div style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.title}</div>
                  </div>
                )
             })}
          </div>
        </div>
      </div>
    </div>
  )
}
