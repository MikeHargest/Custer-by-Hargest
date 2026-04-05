import React, { useMemo, useState, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Project, TaskItem, TimelineTask } from '../types'
import {
  FolderOpen,
  X,
  CheckSquare,
  CalendarDays,
  AlignLeft,
  Plus,
  Eye,
  EyeOff
} from 'lucide-react'

const isParentTask = (
  projects: Project[],
  projectId: string,
  taskId?: string,
  taskName?: string
): boolean => {
  const project = projects.find((p) => p.id === projectId)
  if (!project) return false

  const checkTasks = (tasks: TaskItem[]): boolean => {
    for (const t of tasks) {
      if (taskId && t.id === taskId) return !!(t.subtasks && t.subtasks.length > 0)
      if (!taskId && taskName && t.text === taskName) return !!(t.subtasks && t.subtasks.length > 0)

      if (t.subtasks && t.subtasks.length > 0) {
        if (checkTasks(t.subtasks)) return true
      }
    }
    return false
  }
  return checkTasks(project.tasks)
}

interface TimelineViewProps {
  projects: Project[]
  timelineTasks: TimelineTask[]
  setTimelineTasks: React.Dispatch<React.SetStateAction<TimelineTask[]>>
  onAddProjectItem: (
    projectId: string,
    name: string,
    parentTaskId?: string,
    explicitTaskId?: string
  ) => string
}

export default function TimelineView({
  projects,
  timelineTasks,
  setTimelineTasks,
  onAddProjectItem
}: TimelineViewProps): React.ReactElement {
  const PAST_DAYS = 14
  const minCellWidth = 150

  const { days, months, mondayOffsetIndex } = useMemo(() => {
    const arr: Array<{
      dateString: string
      dayStr: string
      isToday: boolean
      isWeekend: boolean
      isPast?: boolean
      isDummy?: boolean
    }> = []
    const monthCounts: { name: string; count: number }[] = []
    let foundMondayIndex = 0

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    // Start PAST_DAYS before today
    const START_OFFSET = -PAST_DAYS
    const FUTURE_DAYS = 30

    for (let i = START_OFFSET; i < FUTURE_DAYS; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)

      const rawDay = d.toLocaleDateString('ru-RU', { weekday: 'short', day: '2-digit' })
      const dayStr = rawDay.charAt(0).toUpperCase() + rawDay.slice(1).replace(',', '')

      const rawMonth = d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
      const monthStr = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1)

      const isWeekend = d.getDay() === 0 || d.getDay() === 6
      const dateString = d.toISOString().split('T')[0]

      arr.push({
        dateString,
        dayStr,
        isToday: dateString === todayStr,
        isWeekend,
        isPast: dateString < todayStr
      })
      const dayOfWeek = d.getDay() // 0 is Sunday, 1 is Monday...
      if (dateString === todayStr) {
        // If today is Sunday (0), Monday was 6 days ago. Otherwise today - 1 days ago.
        const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        foundMondayIndex = Math.max(0, arr.length - 1 - daysSinceMonday)
      }

      const lastMonth = monthCounts[monthCounts.length - 1]
      if (lastMonth && lastMonth.name === monthStr) {
        lastMonth.count++
      } else {
        monthCounts.push({ name: monthStr, count: 1 })
      }
    }

    // Pad with dummy columns to fill wide screens
    const MIN_COLS = PAST_DAYS + FUTURE_DAYS + 40
    if (arr.length < MIN_COLS) {
      const extra = MIN_COLS - arr.length
      const lastDate = new Date(arr[arr.length - 1].dateString)
      for (let i = 1; i <= extra; i++) {
        const d = new Date(lastDate)
        d.setDate(lastDate.getDate() + i)

        const rawDay = d.toLocaleDateString('ru-RU', { weekday: 'short', day: '2-digit' })
        const dayStr = rawDay.charAt(0).toUpperCase() + rawDay.slice(1).replace(',', '')
        const rawMonth = d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
        const monthStr = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1)
        const isWeekend = d.getDay() === 0 || d.getDay() === 6

        arr.push({
          dateString: d.toISOString().split('T')[0],
          dayStr,
          isToday: false,
          isWeekend,
          isDummy: true
        })

        const lastMonth = monthCounts[monthCounts.length - 1]
        if (lastMonth && lastMonth.name === monthStr) {
          lastMonth.count++
        } else {
          monthCounts.push({ name: monthStr, count: 1 })
        }
      }
    }

    return { days: arr, months: monthCounts, mondayOffsetIndex: foundMondayIndex }
  }, [])

  const taskIdToNameMap = useMemo(() => {
    const map = new Map<string, string>()

    const traverse = (tasks: TaskItem[]): void => {
      for (const t of tasks) {
        map.set(t.id, t.text)
        if (t.subtasks) traverse(t.subtasks)
      }
    }

    projects.forEach((p) => traverse(p.tasks))
    return map
  }, [projects])

  const monthGridDays = useMemo(() => {
    const arr: {
      dateString: string
      dayNumber: number
      isCurrentMonth: boolean
      isToday: boolean
    }[] = []
    const today = new Date()

    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    const startOffset = firstDay.getDay()

    const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0)
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(prevMonth)
      d.setDate(prevMonth.getDate() - i)
      arr.push({
        dateString: d.toISOString().split('T')[0],
        dayNumber: d.getDate(),
        isCurrentMonth: false,
        isToday: false
      })
    }

    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), i)
      arr.push({
        dateString: d.toISOString().split('T')[0],
        dayNumber: i,
        isCurrentMonth: true,
        isToday: d.toDateString() === today.toDateString()
      })
    }

    const totalSlots = arr.length > 35 ? 42 : 35
    const remaining = totalSlots - arr.length
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + 1, i)
      arr.push({
        dateString: d.toISOString().split('T')[0],
        dayNumber: i,
        isCurrentMonth: false,
        isToday: false
      })
    }

    return arr
  }, [])

  const [addingToCell, setAddingToCell] = useState<{ projectId: string; date: string } | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState<string>('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [hiddenProjects, setHiddenProjects] = useState<Set<string>>(new Set())
  const [isDraggingResize, setIsDraggingResize] = useState(false)

  const toggleProjectVisibility = (id: string, e: React.MouseEvent): void => {
    e.stopPropagation()
    const newHidden = new Set(hiddenProjects)
    if (newHidden.has(id)) newHidden.delete(id)
    else newHidden.add(id)
    setHiddenProjects(newHidden)
  }

  type ViewMode = 'timeline' | 'month'
  const [viewMode, setViewMode] = useState<ViewMode>('timeline')

  const scrollRef = useRef<HTMLDivElement>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [startX, setStartX] = useState(0)
  const [startY, setStartY] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)

  const scrollToToday = (): void => {
    if (!scrollRef.current) return
    const projectColumnWidth = 200
    const todayIndex = days.findIndex((d) => d.isToday)

    if (todayIndex !== -1) {
      // Scroll so today column is centered in the visible area
      const targetLeft =
        projectColumnWidth +
        todayIndex * minCellWidth -
        scrollRef.current.clientWidth / 2 +
        minCellWidth / 2
      scrollRef.current.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' })
    }
  }

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (
        addingToCell &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setAddingToCell(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [addingToCell])

  React.useEffect(() => {
    if (viewMode === 'timeline' && scrollRef.current && mondayOffsetIndex > 0) {
      const scrollPos = mondayOffsetIndex * minCellWidth
      scrollRef.current.scrollTo({ left: scrollPos, behavior: 'instant' })
    }
  }, [viewMode, mondayOffsetIndex]) // Added mondayOffsetIndex to ensure it scrolls when index is calculated

  React.useEffect(() => {
    const handleCustomDrop = (e: Event): void => {
      const customEvent = e as CustomEvent<{
        date: string
        projectId: string
        taskText: string
        taskId: string
      }>
      const { date, projectId, taskText, taskId } = customEvent.detail
      if (!date || !projectId || !taskText) return

      setTimelineTasks((prev) => [
        ...prev,
        {
          id: uuidv4(),
          projectId,
          taskName: taskText,
          date,
          taskId
        }
      ])
    }

    window.addEventListener('task-dropped-on-timeline', handleCustomDrop)
    return () => window.removeEventListener('task-dropped-on-timeline', handleCustomDrop)
  }, [setTimelineTasks])

  const handleMouseDown = (e: React.MouseEvent): void => {
    if (e.button === 2 && scrollRef.current) {
      // Right click
      setIsPanning(true)
      setStartX(e.pageX - scrollRef.current.offsetLeft)
      setStartY(e.pageY - scrollRef.current.offsetTop)
      setScrollLeft(scrollRef.current.scrollLeft)
      setScrollTop(scrollRef.current.scrollTop)
    }
  }

  const handleMouseLeave = (): void => {
    setIsPanning(false)
  }

  const handleMouseUp = (e: React.MouseEvent): void => {
    if (e.button === 2) {
      setIsPanning(false)
    }
  }

  const handleMouseMove = (e: React.MouseEvent): void => {
    if (!isPanning || !scrollRef.current) return
    e.preventDefault()
    const x = e.pageX - scrollRef.current.offsetLeft
    const y = e.pageY - scrollRef.current.offsetTop
    const walkX = x - startX
    const walkY = y - startY
    scrollRef.current.scrollTo({
      left: scrollLeft - walkX,
      top: scrollTop - walkY,
      behavior: 'instant'
    })
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

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = (e: React.DragEvent, projectId: string, dateString: string): void => {
    e.preventDefault()
    const rawData = e.dataTransfer.getData('text/plain')
    if (!rawData) return

    try {
      const parsed = JSON.parse(rawData)
      if (parsed && typeof parsed === 'object') {
        if (parsed.type === 'move_timeline_task') {
          if (parsed.projectId !== projectId) {
            console.warn(
              `Cannot drop item from project ${parsed.projectId} onto project row ${projectId}`
            )
            // @ts-ignore: window.api is injected via preload script
            window.api?.showNotification(
              'Invalid Drop',
              'You can only drop moving tasks onto their parent project row.'
            )
            return
          }

          // Shift the task's date
          setTimelineTasks((prev) =>
            prev.map((t) => {
              if (t.id === parsed.id) {
                // If it has an endDate, shift it too to maintain duration
                if (t.endDate) {
                  const oldStartDate = new Date(t.date).getTime()
                  const oldEndDate = new Date(t.endDate).getTime()
                  const diffMs = oldEndDate - oldStartDate
                  const newStartDate = new Date(dateString).getTime()
                  const newEndDate = new Date(newStartDate + diffMs).toISOString().split('T')[0]
                  return { ...t, date: dateString, endDate: newEndDate }
                }
                return { ...t, date: dateString }
              }
              return t
            })
          )
          return
        }

        if (parsed.type === 'resize_timeline_task') {
          setTimelineTasks((prev) =>
            prev.map((t) => {
              if (t.id === parsed.id) {
                // Prevent dragging end date before start date
                if (dateString < t.date) {
                  return { ...t, date: dateString, endDate: t.endDate || t.date }
                }
                return { ...t, endDate: dateString === t.date ? undefined : dateString }
              }
              return t
            })
          )
          return
        }

        if (parsed.text) {
          if (parsed.projectId !== projectId) {
            console.warn(
              `Cannot drop item from project ${parsed.projectId} onto project row ${projectId}`
            )
            // @ts-ignore: window.api is injected via preload script
            window.api?.showNotification(
              'Invalid Drop',
              'You can only drop tasks onto their parent project row.'
            )
            return
          }
          const sourceTaskId = parsed.taskId || parsed.itemId
          setTimelineTasks((prev) => [
            ...prev,
            {
              id: uuidv4(),
              projectId,
              taskName: parsed.text,
              date: dateString,
              taskId: sourceTaskId
            }
          ])
          return
        }
      }
    } catch {
      // Ignore parsing errors and fallback to raw data
    }

    // Fallback for raw text
    setTimelineTasks((prev) => [
      ...prev,
      { id: uuidv4(), projectId, taskName: rawData, date: dateString, taskId: undefined }
    ])
  }

  const removeTask = (taskId: string): void => {
    setTimelineTasks((prev) => prev.filter((t) => t.id !== taskId))
  }

  return (
    <div
      className="timeline-view"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        boxSizing: 'border-box',
        background: 'var(--card-bg)'
      }}
    >
      <div
        className="timeline-card"
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '20px',
            flexShrink: 0,
            padding: '16px 16px 0 16px'
          }}
        >
          <h2 style={{ color: 'var(--text-primary)', margin: 0, flex: 1 }}>Project Calendar</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={scrollToToday}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text-primary)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                transition: 'all 0.2s',
                ...(viewMode === 'month' ? { opacity: 0.5, pointerEvents: 'none' } : {})
              }}
              title="Scroll to Today"
            >
              Today
            </button>
            <div
              style={{
                display: 'flex',
                background: 'rgba(0,0,0,0.2)',
                padding: '2px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(255,255,255,0.05)'
              }}
            >
              <button
                onClick={() => setViewMode('timeline')}
                style={{
                  background: viewMode === 'timeline' ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: viewMode === 'timeline' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: 'none',
                  padding: '6px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.2s'
                }}
                title="Timeline View"
              >
                <AlignLeft size={16} />
              </button>
              <button
                onClick={() => setViewMode('month')}
                style={{
                  background: viewMode === 'month' ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: viewMode === 'month' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: 'none',
                  padding: '6px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.2s'
                }}
                title="Month Grid View"
              >
                <CalendarDays size={16} />
              </button>
            </div>
          </div>
        </div>

        <div
          className="timeline-card-scroll-area"
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onContextMenu={(e) => e.preventDefault()} // Prevent default right click menu
          style={{
            overflow: 'scroll',
            flex: 1,
            padding: viewMode === 'timeline' ? '0 12px 12px 0' : '0 12px 12px 12px',
            cursor: isPanning ? 'grabbing' : 'auto'
          }}
        >
          {viewMode === 'timeline' ? (
            <table
              className="timeline-container"
              style={{ borderCollapse: 'collapse', minWidth: '100%', tableLayout: 'fixed' }}
            >
              {/* Calendar Header Row */}
              <thead>
                {/* Months Row */}
                <tr>
                  <th
                    style={{
                      width: '224px',
                      minWidth: '224px',
                      padding: '12px 12px 12px 24px',
                      borderBottom: '2px solid rgba(255,255,255,0.1)',
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                      position: 'sticky',
                      top: 0,
                      left: 0,
                      background: 'var(--card-bg)',
                      zIndex: 20,
                      textAlign: 'left',
                      boxShadow: '1px 1px 0 rgba(255,255,255,0.05)'
                    }}
                    rowSpan={2}
                  >
                    Projects
                  </th>
                  {months.map((m) => (
                    <th
                      key={m.name}
                      colSpan={m.count}
                      style={{
                        padding: 0,
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        borderLeft: '1px solid rgba(255,255,255,0.05)',
                        textAlign: 'left',
                        background: 'var(--card-bg)',
                        position: 'sticky',
                        top: 0,
                        zIndex: 10
                      }}
                    >
                      <div
                        style={{
                          position: 'sticky',
                          left: '212px',
                          padding: '8px 12px',
                          display: 'inline-block',
                          color: 'var(--text-primary)',
                          fontWeight: 600
                        }}
                      >
                        {m.name}
                      </div>
                    </th>
                  ))}
                </tr>
                {/* Days Row */}
                <tr>
                  {days.map((d) => (
                    <th
                      key={d.dateString}
                      style={{
                        width: `${minCellWidth}px`,
                        minWidth: `${minCellWidth}px`,
                        padding: '10px 12px',
                        borderBottom: '2px solid rgba(255,255,255,0.1)',
                        borderLeft: d.isDummy
                          ? '1px dashed rgba(255,255,255,0.04)'
                          : '1px solid rgba(255,255,255,0.05)',
                        textAlign: 'center',
                        color: d.isDummy
                          ? 'rgba(255,255,255,0.12)'
                          : d.isToday
                            ? 'var(--accent)'
                            : d.isWeekend
                              ? 'rgba(255,120,120,0.6)'
                              : d.isPast
                                ? 'rgba(255,255,255,0.3)'
                                : 'var(--text-secondary)',
                        fontWeight: d.isToday ? 'bold' : 'normal',
                        opacity: d.isPast && !d.isToday ? 0.55 : 1,
                        background: d.isDummy
                          ? 'rgba(0,0,0,0.15)'
                          : d.isPast
                            ? 'rgba(0,0,0,0.08)'
                            : d.isWeekend
                              ? 'rgba(255,255,255,0.03)'
                              : 'var(--card-bg)',
                        position: 'sticky',
                        top: '40px',
                        zIndex: 10
                      }}
                    >
                      {d.dayStr}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Project Rows */}
              <tbody>
                {projects.length === 0 ? (
                  <tr>
                    <td
                      style={{
                        padding: '24px',
                        color: 'var(--text-secondary)',
                        textAlign: 'center'
                      }}
                      colSpan={days.length + 1}
                    >
                      No projects created yet. Add a project in the sidebar to start scheduling
                      tasks.
                    </td>
                  </tr>
                ) : (
                  projects
                    .filter((p) => !hiddenProjects.has(p.id))
                    .map((project) => (
                      <tr
                        key={project.id}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                      >
                        {/* Project Title Column */}
                        <td
                          style={{
                            width: '224px',
                            minWidth: '224px',
                            padding: `16px 12px 16px ${24 + (project.depth || 0) * 20}px`,
                            position: 'sticky',
                            left: 0,
                            background: 'var(--card-bg)',
                            borderRight: '1px solid rgba(255,255,255,0.05)',
                            zIndex: 5,
                            verticalAlign: 'top',
                            boxShadow: '1px 0 0 rgba(255,255,255,0.05)'
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              color: 'var(--text-primary)'
                            }}
                          >
                            {project.icon && project.icon.startsWith('file') ? (
                              <img
                                src={project.icon}
                                alt=""
                                style={{
                                  width: '16px',
                                  height: '16px',
                                  borderRadius: 'var(--radius-md)',
                                  objectFit: 'cover',
                                  flexShrink: 0
                                }}
                              />
                            ) : project.icon && project.icon.length < 5 ? (
                              <span
                                style={{
                                  fontSize: '14px',
                                  width: '16px',
                                  textAlign: 'center',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}
                              >
                                {project.icon}
                              </span>
                            ) : (
                              <FolderOpen
                                size={16}
                                style={{ color: project.color || 'var(--accent)', flexShrink: 0 }}
                              />
                            )}
                            <span
                              style={{
                                fontWeight: 600,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: 1
                              }}
                              title={project.name}
                            >
                              {project.name}
                            </span>
                            <button
                              onClick={(e) => toggleProjectVisibility(project.id, e)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center',
                                opacity: 0.5
                              }}
                              title={
                                hiddenProjects.has(project.id) ? 'Show Project' : 'Hide Project'
                              }
                            >
                              {hiddenProjects.has(project.id) ? (
                                <EyeOff size={14} />
                              ) : (
                                <Eye size={14} />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Day Cells for this Project */}
                        {days.map((d) => {
                          const tasksForDay = timelineTasks.filter((t) => {
                            if (t.projectId !== project.id) return false
                            // Multi-day tasks: only render on start date
                            if (t.endDate) {
                              return t.date === d.dateString
                            }
                            return t.date === d.dateString
                          })

                          // Also find multi-day tasks that span across this day (but started earlier)
                          // to reserve vertical space for them
                          const spanningTasks = timelineTasks.filter((t) => {
                            if (t.projectId !== project.id) return false
                            if (!t.endDate) return false
                            return (
                              t.date !== d.dateString &&
                              d.dateString > t.date &&
                              d.dateString <= t.endDate
                            )
                          })

                          // Check if this cell is the start of any multi-day task
                          const hasMultiDayStart = tasksForDay.some(
                            (t) => t.endDate && t.endDate !== t.date
                          )
                          // Check if this cell only passes through multi-day tasks (no starts here)
                          const isPassThroughOnly =
                            spanningTasks.length > 0 && tasksForDay.length === 0

                          return (
                            <td
                              key={`${project.id}-${d.dateString}`}
                              className="timeline-cell"
                              data-date={d.dateString}
                              data-project-id={project.id}
                              onDragOver={d.isDummy ? undefined : handleDragOver}
                              onDrop={
                                d.isDummy
                                  ? undefined
                                  : (e) => handleDrop(e, project.id, d.dateString)
                              }
                              onDoubleClick={() => {
                                if (!addingToCell && !d.isDummy) {
                                  setAddingToCell({ projectId: project.id, date: d.dateString })
                                  setNewItemName('')
                                  setSelectedTaskId('')
                                }
                              }}
                              style={{
                                width: `${minCellWidth}px`,
                                minWidth: `${minCellWidth}px`,
                                padding: '8px',
                                borderLeft: d.isDummy
                                  ? '1px dashed rgba(255,255,255,0.04)'
                                  : '1px solid rgba(255,255,255,0.05)',
                                verticalAlign: 'top',
                                background: d.isDummy
                                  ? `repeating-linear-gradient(
                                    -45deg,
                                    rgba(0,0,0,0.08),
                                    rgba(0,0,0,0.08) 2px,
                                    transparent 2px,
                                    transparent 10px
                                  )`
                                  : d.isToday
                                    ? 'rgba(255,255,255,0.05)'
                                    : d.isPast
                                      ? 'rgba(0,0,0,0.06)'
                                      : d.isWeekend
                                        ? 'rgba(255,255,255,0.02)'
                                        : 'transparent',
                                opacity: d.isPast && !d.isToday ? 0.7 : 1,
                                cursor: d.isDummy ? 'default' : 'pointer',
                                pointerEvents: d.isDummy ? 'none' : 'auto'
                              }}
                            >
                              <div
                                className="timeline-cell"
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '6px',
                                  minHeight: '32px',
                                  height: '100%',
                                  position: 'relative',
                                  // Start cell: high z-index so the overflowing task bar appears
                                  // above later sibling td elements (which follow in DOM order).
                                  // Pass-through cells: pointer-events none so the task bar
                                  // (from the start cell) can receive clicks/drags.
                                  zIndex: hasMultiDayStart ? 999 : undefined,
                                  pointerEvents: isPassThroughOnly ? 'none' : 'auto'
                                }}
                              >
                                {/* Invisible placeholders for multi-day tasks passing through this cell */}
                                {spanningTasks.map((st) => (
                                  <div
                                    key={`placeholder-${st.id}`}
                                    style={{ height: '26px', flexShrink: 0, visibility: 'hidden' }}
                                  />
                                ))}
                                {tasksForDay.map((task) => {
                                  const currentTaskName =
                                    task.taskId && taskIdToNameMap.has(task.taskId)
                                      ? taskIdToNameMap.get(task.taskId)!
                                      : task.taskName
                                  const isParent = isParentTask(
                                    projects,
                                    task.projectId,
                                    task.taskId,
                                    currentTaskName
                                  )

                                  const isStart = true // We only render on start date now
                                  const isEnd = true // Resize handle always visible since we render from start

                                  // Calculate span width in pixels
                                  let spanDays = 1
                                  if (task.endDate) {
                                    const start = new Date(task.date)
                                    const end = new Date(task.endDate)
                                    const diffTime = end.getTime() - start.getTime()
                                    spanDays = Math.max(
                                      1,
                                      Math.round(diffTime / (1000 * 3600 * 24)) + 1
                                    )
                                  }
                                  // Width in pixels: each cell = minCellWidth, minus padding (16px from left cell)
                                  const spanWidthPx =
                                    spanDays > 1 ? `${spanDays * minCellWidth - 1}px` : '100%'

                                  return (
                                    <div
                                      key={task.id}
                                      style={{
                                        position: 'relative',
                                        height: '26px',
                                        flexShrink: 0,
                                        zIndex: spanDays > 1 ? 5 : 2,
                                        // During resize drag, let pointer events pass through to td cells
                                        pointerEvents:
                                          isDraggingResize && spanDays > 1 ? 'none' : 'auto'
                                      }}
                                    >
                                      <div
                                        onDoubleClick={(e) => e.stopPropagation()}
                                        draggable={isStart}
                                        onDragStart={(e) => {
                                          if (isStart) {
                                            e.dataTransfer.setData(
                                              'text/plain',
                                              JSON.stringify({
                                                type: 'move_timeline_task',
                                                id: task.id,
                                                projectId: project.id
                                              })
                                            )
                                          } else {
                                            e.preventDefault()
                                          }
                                        }}
                                        style={{
                                          background: 'var(--timeline-task-bg, var(--card-bg))',
                                          color: 'var(--text-primary)',
                                          padding: '5px 9px',
                                          borderRadius: 'var(--radius-md)',
                                          fontSize: '12px',
                                          fontWeight: isParent ? 600 : 400,
                                          position: 'absolute',
                                          top: 0,
                                          left: 0,
                                          width: spanWidthPx,
                                          height: '100%',
                                          boxSizing: 'border-box',
                                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                          border: `1px solid rgba(255,255,255,0.05)`,
                                          borderLeft: isStart
                                            ? `3px solid ${project.color || 'var(--accent)'}`
                                            : 'none',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          gap: '6px',
                                          opacity: 0.95,
                                          minHeight: '26px',
                                          zIndex: 2 // relative to the slot's z-index
                                        }}
                                        title={`Task: ${currentTaskName}\nDates: ${new Date(task.date).toLocaleDateString()} - ${task.endDate ? new Date(task.endDate).toLocaleDateString() : 'Single day'}`}
                                      >
                                        {isStart && (
                                          <>
                                            {isParent ? (
                                              <FolderOpen
                                                size={12}
                                                style={{
                                                  flexShrink: 0,
                                                  opacity: 0.9,
                                                  color: project.color || 'var(--accent)'
                                                }}
                                              />
                                            ) : (
                                              <CheckSquare
                                                size={12}
                                                style={{ flexShrink: 0, opacity: 0.6 }}
                                              />
                                            )}
                                            <div
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                flex: 1,
                                                minWidth: 0
                                              }}
                                            >
                                              <span
                                                style={{
                                                  overflow: 'hidden',
                                                  textOverflow: 'ellipsis',
                                                  whiteSpace: 'nowrap',
                                                  flexShrink: 1
                                                }}
                                                title={`Task: ${currentTaskName}\nDates: ${new Date(task.date).toLocaleDateString()} - ${task.endDate ? new Date(task.endDate).toLocaleDateString() : 'Single day'}`}
                                              >
                                                {currentTaskName}
                                              </span>
                                              {task.endDate && (
                                                <span
                                                  style={{
                                                    fontSize: '10px',
                                                    opacity: 0.8,
                                                    marginLeft: '6px',
                                                    fontWeight: 500,
                                                    flexShrink: 0
                                                  }}
                                                >
                                                  {new Date(task.date).toLocaleDateString(
                                                    undefined,
                                                    { day: 'numeric', month: 'short' }
                                                  )}{' '}
                                                  -{' '}
                                                  {new Date(task.endDate).toLocaleDateString(
                                                    undefined,
                                                    { day: 'numeric', month: 'short' }
                                                  )}
                                                </span>
                                              )}
                                            </div>
                                          </>
                                        )}

                                        {isEnd && (
                                          <div
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              marginLeft: 'auto',
                                              gap: '4px'
                                            }}
                                          >
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                removeTask(task.id)
                                              }}
                                              style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: 'rgba(0,0,0,0.5)',
                                                cursor: 'pointer',
                                                padding: '2px',
                                                display: 'flex',
                                                alignItems: 'center'
                                              }}
                                              title="Remove"
                                            >
                                              <X size={12} />
                                            </button>
                                            <div
                                              draggable
                                              onDragStart={(e) => {
                                                e.stopPropagation()
                                                setIsDraggingResize(true)
                                                e.dataTransfer.setData(
                                                  'text/plain',
                                                  JSON.stringify({
                                                    type: 'resize_timeline_task',
                                                    id: task.id,
                                                    projectId: project.id
                                                  })
                                                )
                                              }}
                                              onDragEnd={() => setIsDraggingResize(false)}
                                              style={{
                                                width: '6px',
                                                height: '16px',
                                                background: 'rgba(255,255,255,0.2)',
                                                borderRadius: '2px',
                                                cursor: 'ew-resize',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'space-evenly',
                                                alignItems: 'center',
                                                padding: '2px 0'
                                              }}
                                              title="Drag to resize"
                                            >
                                              <div
                                                style={{
                                                  width: '2px',
                                                  height: '2px',
                                                  background: 'rgba(255,255,255,0.5)',
                                                  borderRadius: '50%'
                                                }}
                                              />
                                              <div
                                                style={{
                                                  width: '2px',
                                                  height: '2px',
                                                  background: 'rgba(255,255,255,0.5)',
                                                  borderRadius: '50%'
                                                }}
                                              />
                                              <div
                                                style={{
                                                  width: '2px',
                                                  height: '2px',
                                                  background: 'rgba(255,255,255,0.5)',
                                                  borderRadius: '50%'
                                                }}
                                              />
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}

                                {addingToCell?.projectId === project.id &&
                                addingToCell?.date === d.dateString ? (
                                  <div
                                    ref={dropdownRef}
                                    className="timeline-add-dropdown"
                                    style={{
                                      borderLeft: `3px solid ${project.color || 'var(--accent)'}`
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    onDoubleClick={(e) => e.stopPropagation()}
                                  >
                                    {project.tasks && project.tasks.length > 0 && (
                                      <>
                                        <div className="dropdown-header">Existing Tasks</div>
                                        {project.tasks.map((t) => (
                                          <button
                                            key={t.id}
                                            className="dropdown-task-item"
                                            onClick={() => {
                                              const newTaskId = onAddProjectItem(
                                                project.id,
                                                t.text,
                                                t.id,
                                                uuidv4()
                                              )
                                              setTimelineTasks((prev) => [
                                                ...prev,
                                                {
                                                  id: uuidv4(),
                                                  projectId: project.id,
                                                  taskName: t.text,
                                                  date: d.dateString,
                                                  taskId: newTaskId
                                                }
                                              ])
                                              setAddingToCell(null)
                                            }}
                                          >
                                            <CheckSquare size={14} />
                                            <span
                                              style={{
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                              }}
                                            >
                                              {t.text}
                                            </span>
                                          </button>
                                        ))}
                                        <div className="dropdown-divider" />
                                      </>
                                    )}
                                    <div className="dropdown-header">New Task</div>
                                    <div className="dropdown-new-task">
                                      <input
                                        autoFocus
                                        value={newItemName}
                                        onChange={(e) => setNewItemName(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleInlineAdd()
                                          if (e.key === 'Escape') setAddingToCell(null)
                                        }}
                                        placeholder="Task name..."
                                      />
                                      <button
                                        onClick={handleInlineAdd}
                                        disabled={!newItemName.trim()}
                                        title="Add Task"
                                      >
                                        <Plus size={16} />
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    className="timeline-add-btn"
                                    data-project-id={project.id}
                                    data-date={d.dateString}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setAddingToCell({ projectId: project.id, date: d.dateString })
                                      setNewItemName('')
                                      setSelectedTaskId('')
                                    }}
                                    title="Double click cell or click here to add"
                                    style={{
                                      pointerEvents: 'auto'
                                    }}
                                  >
                                    +
                                  </button>
                                )}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))
                )}
                {/* Ghost / filler rows to extend grid lines to the full visible area */}
                {Array.from({ length: 8 }).map((_, rowIdx) => (
                  <tr key={`ghost-row-${rowIdx}`} style={{ height: '52px' }}>
                    {/* Sticky project column - empty */}
                    <td
                      style={{
                        width: '224px',
                        minWidth: '224px',
                        position: 'sticky',
                        left: 0,
                        background: 'var(--card-bg)',
                        borderRight: '1px solid rgba(255,255,255,0.03)',
                        borderBottom: rowIdx < 7 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                        zIndex: 5
                      }}
                    />
                    {/* Ghost day cells */}
                    {days.map((d) => (
                      <td
                        key={`ghost-${rowIdx}-${d.dateString}`}
                        style={{
                          width: `${minCellWidth}px`,
                          minWidth: `${minCellWidth}px`,
                          borderLeft: d.isDummy
                            ? '1px dashed rgba(255,255,255,0.03)'
                            : '1px solid rgba(255,255,255,0.03)',
                          borderBottom: rowIdx < 7 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                          background: d.isDummy
                            ? `repeating-linear-gradient(
                                -45deg,
                                rgba(0,0,0,0.06),
                                rgba(0,0,0,0.06) 2px,
                                transparent 2px,
                                transparent 10px
                              )`
                            : 'transparent',
                          pointerEvents: 'none'
                        }}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div
              className="month-grid-container"
              style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: '1px',
                  background: 'rgba(255,255,255,0.05)',
                  borderBottom: '1px solid rgba(255,255,255,0.05)'
                }}
              >
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div
                    key={day}
                    style={{
                      background: 'var(--card-bg)',
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
                  gridAutoRows: 'minmax(120px, 1fr)',
                  gap: '1px',
                  background: 'rgba(255,255,255,0.05)',
                  flex: 1
                }}
              >
                {monthGridDays.map((d, i) => {
                  const tasksForDay = timelineTasks.filter((t) => t.date === d.dateString)

                  return (
                    <div
                      key={d.dateString + i}
                      onDoubleClick={() => {
                        if (projects.length > 0 && !addingToCell) {
                          // In month view, default to the first project for inline adding if none selected
                          setAddingToCell({ projectId: projects[0].id, date: d.dateString })
                          setNewItemName('')
                          setSelectedTaskId('')
                        }
                      }}
                      style={{
                        background: d.isToday ? 'rgba(255,255,255,0.05)' : 'var(--card-bg)',
                        padding: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        opacity: d.isCurrentMonth ? 1 : 0.4,
                        cursor: 'pointer'
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
                        {tasksForDay.map((task) => {
                          const currentTaskName =
                            task.taskId && taskIdToNameMap.has(task.taskId)
                              ? taskIdToNameMap.get(task.taskId)!
                              : task.taskName
                          const isParent = isParentTask(
                            projects,
                            task.projectId,
                            task.taskId,
                            currentTaskName
                          )
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
                                gap: '4px'
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
          )}
        </div>

        {/* Project Visibility Footer Summary (only if some are hidden) */}
        {hiddenProjects.size > 0 && (
          <div
            style={{
              padding: '8px 24px',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              background: 'rgba(255,255,255,0.02)',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              gap: '12px',
              alignItems: 'center'
            }}
          >
            <EyeOff size={12} />
            <span>
              Hidden projects:{' '}
              {Array.from(hiddenProjects)
                .map((id) => projects.find((p) => p.id === id)?.name)
                .filter(Boolean)
                .join(', ')}
            </span>
            <button
              onClick={() => setHiddenProjects(new Set())}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent)',
                fontSize: '11px',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline'
              }}
            >
              Show all
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
