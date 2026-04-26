import React from 'react'
import { v4 as uuidv4 } from 'uuid'
import { ChevronUp, ChevronDown, CheckSquare, Plus, X } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { Project, TimelineTask } from '../../types'

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
  viewDate: Date
  adjustMonth: (offset: number) => void
  monthGridDays: {
    dateString: string
    dayNumber: number
    isCurrentMonth: boolean
    isToday: boolean
    isWeekend: boolean
  }[]
  timelineTasks: TimelineTask[]
  setTimelineTasks: React.Dispatch<React.SetStateAction<TimelineTask[]>>
  allEvents: any[]
  projects: Project[]
  taskIdToNameMap: Map<string, string>
  addingToCell: { projectId: string; date: string } | null
  setAddingToCell: React.Dispatch<React.SetStateAction<{ projectId: string; date: string } | null>>
  newItemName: string
  setNewItemName: React.Dispatch<React.SetStateAction<string>>
  selectedTaskId: string
  setSelectedTaskId: React.Dispatch<React.SetStateAction<string>>
  onAddProjectItem: (projectId: string, name: string, parentTaskId?: string, explicitTaskId?: string) => string
}

export default function MonthGrid({
  viewDate,
  adjustMonth,
  monthGridDays,
  timelineTasks,
  setTimelineTasks,
  allEvents,
  projects,
  taskIdToNameMap,
  addingToCell,
  setAddingToCell,
  newItemName,
  setNewItemName,
  selectedTaskId,
  setSelectedTaskId,
  onAddProjectItem
}: MonthGridProps) {
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleInlineAdd = (): void => {
    if (!addingToCell || !newItemName.trim()) {
      setAddingToCell(null)
      setNewItemName('')
      setSelectedTaskId('')
      return
    }

    const taskId = selectedTaskId ? selectedTaskId : undefined
    const newTaskId = onAddProjectItem(addingToCell.projectId, newItemName.trim(), taskId, uuidv4())
    setTimelineTasks((prev) => [
      ...prev,
      {
        id: uuidv4(),
        projectId: addingToCell.projectId,
        taskName: newItemName.trim(),
        date: addingToCell.date,
        taskId: newTaskId
      }
    ])
    setAddingToCell(null)
    setNewItemName('')
    setSelectedTaskId('')
  }

  const removeTask = (taskId: string): void => {
    setTimelineTasks((prev) => prev.filter((t) => t.id !== taskId))
  }

  return (
    <div
      className="month-grid-container"
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      {/* Month Header Label */}
      <div
        style={{
          height: '45px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: '8px',
          background: 'var(--card-bg)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          position: 'sticky',
          top: '45px',
          zIndex: 42
        }}
      >
        <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {viewDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(/^./, (str) => str.toUpperCase())}
        </div>
        <div style={{ display: 'flex', gap: '2px' }}>
          <button
            onClick={() => adjustMonth(-1)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              padding: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              opacity: 0.7,
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
          >
            <ChevronUp size={16} />
          </button>
          <button
            onClick={() => adjustMonth(1)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              padding: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              opacity: 0.7,
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '1px',
          background: 'rgba(255,255,255,0.05)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          position: 'sticky',
          top: '90px',
          zIndex: 41
        }}
      >
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div
            key={day}
            style={{
              background: (day === 'Sat' || day === 'Sun') ? 'rgba(0,0,0,0.3)' : 'var(--card-bg)',
              padding: '12px 8px',
              fontWeight: 600,
              fontSize: '12px',
              color: 'var(--text-secondary)',
              textAlign: 'center'
            }}
          >
            {day}
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gridAutoRows: '1fr',
          gap: '1px',
          background: 'rgba(255,255,255,0.05)',
          flex: 1
        }}
      >
        {monthGridDays.map((d, i) => {
          const tasksForDay = timelineTasks.filter((t) => t.date === d.dateString)
          const eventsForDay = allEvents.filter((e) => e.date === d.dateString)

          return (
            <div
              key={d.dateString + i}
              onDoubleClick={() => {
                if (projects.length > 0 && !addingToCell) {
                  setAddingToCell({ projectId: projects[0].id, date: d.dateString })
                  setNewItemName('')
                  setSelectedTaskId('')
                }
              }}
              style={{
                background: d.isToday
                  ? 'rgba(255,255,255,0.05)'
                  : d.isWeekend
                    ? 'rgba(0,0,0,0.3)'
                    : 'var(--card-bg)',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                opacity: d.isCurrentMonth ? 1 : 0.4,
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
                            const oldStartDate = new Date(t.date).getTime()
                            const oldEndDate = new Date(t.endDate).getTime()
                            const diffMs = oldEndDate - oldStartDate
                            const newStartDate = new Date(d.dateString).getTime()
                            const newEndDate = new Date(newStartDate + diffMs)
                              .toISOString()
                              .split('T')[0]
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
                  color: d.isToday ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: d.isToday ? 'bold' : 'normal',
                  marginBottom: '4px'
                }}
              >
                {d.dayNumber}
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
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '11px',
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
                        background: 'rgba(0,0,0,0.2)',
                        color: 'var(--text-primary)',
                        padding: '4px 6px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '11px',
                        fontWeight: isParent ? 600 : 400,
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

                {addingToCell && addingToCell.date === d.dateString && (
                  <div
                    ref={dropdownRef}
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      padding: '4px 6px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--accent)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      zIndex: 10,
                      minWidth: '100%',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="text"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleInlineAdd()
                          if (e.key === 'Escape') setAddingToCell(null)
                        }}
                        placeholder="New task..."
                        autoFocus
                        style={{
                          flex: 1,
                          background: 'rgba(0,0,0,0.2)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: 'var(--text-primary)',
                          padding: '4px 8px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '12px',
                          outline: 'none',
                          width: '100%'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <select
                        value={addingToCell.projectId}
                        onChange={(e) =>
                          setAddingToCell({ ...addingToCell, projectId: e.target.value })
                        }
                        style={{
                          flex: 1,
                          background: 'rgba(0,0,0,0.4)',
                          color: 'var(--text-primary)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 'var(--radius-md)',
                          padding: '2px 4px',
                          fontSize: '11px',
                          outline: 'none'
                        }}
                      >
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: '4px',
                        justifyContent: 'flex-end',
                        marginTop: '2px'
                      }}
                    >
                      <button
                        onClick={() => setAddingToCell(null)}
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: 'var(--text-secondary)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleInlineAdd}
                        style={{
                          background: 'var(--accent)',
                          border: 'none',
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '11px',
                          cursor: 'pointer',
                          fontWeight: 500
                        }}
                        disabled={!newItemName.trim()}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
