import React, { useMemo, useState, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import MonthGrid from './calendar/MonthGrid'
import { Project, TaskItem, TimelineTask } from '../types'
import { expandRecurringEvents } from '../utils/recurrence'
import * as LucideIcons from 'lucide-react'
import {
  FolderOpen,
  X,
  CheckSquare,
  CalendarDays,
  Plus,
  EyeOff,
  SlidersHorizontal,
  RotateCcw,
  RefreshCcw,
  AlignLeft,
  ChevronUp,
  ChevronDown,
  PanelLeft
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
  hiddenProjectIds: string[]
  setHiddenProjectIds: (ids: string[]) => void
  isSidebarOpen: boolean
  onToggleSidebar: () => void
  onSyncWorkspaceEvents?: () => void
  isSyncing?: boolean
  selectedProjectId?: string | null
}

export default function CalendarView({
  projects,
  timelineTasks,
  setTimelineTasks,
  onAddProjectItem,
  hiddenProjectIds,
  setHiddenProjectIds,
  isSidebarOpen,
  onToggleSidebar,
  onSyncWorkspaceEvents,
  isSyncing,
  selectedProjectId
}: TimelineViewProps): React.ReactElement {
  const PAST_DAYS = 14
  const minCellWidth = 150

  // 1. State and Refs first
  const [viewMode, setViewMode] = useState<'timeline' | 'month'>('timeline')
  const [viewDate, setViewDate] = useState(new Date())
  const [addingToCell, setAddingToCell] = useState<{ projectId: string; date: string } | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState<string>('')
  const [isDraggingResize, setIsDraggingResize] = useState(false)
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [startX, setStartX] = useState(0)
  const [startY, setStartY] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)

  const scrollRef = useRef<HTMLDivElement>(null)
  const filterMenuRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const adjustMonth = (offset: number): void => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1))
  }

  const hiddenProjects = useMemo(() => new Set(hiddenProjectIds), [hiddenProjectIds])

  const toggleProjectVisibility = (id: string, e?: React.MouseEvent): void => {
    e?.stopPropagation()
    const newHidden = new Set(hiddenProjectIds)
    if (newHidden.has(id)) newHidden.delete(id)
    else newHidden.add(id)
    setHiddenProjectIds(Array.from(newHidden))
  }

  // 2. Memoized values next

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

  const monthGridDays = useMemo(() => {
    const arr: {
      dateString: string
      dayNumber: number
      isCurrentMonth: boolean
      isToday: boolean
      isWeekend: boolean
    }[] = []
    const today = new Date()

    const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1)
    const dayOfWeek = firstDay.getDay()
    const startOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1

    const prevMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 0)
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(prevMonth)
      d.setDate(prevMonth.getDate() - i)
      const isWeekend = d.getDay() === 0 || d.getDay() === 6
      arr.push({
        dateString: d.toISOString().split('T')[0],
        dayNumber: d.getDate(),
        isCurrentMonth: false,
        isToday: false,
        isWeekend
      })
    }

    const lastDay = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0)
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), i)
      const isWeekend = d.getDay() === 0 || d.getDay() === 6
      arr.push({
        dateString: d.toISOString().split('T')[0],
        dayNumber: i,
        isCurrentMonth: true,
        isToday: d.toDateString() === today.toDateString(),
        isWeekend
      })
    }

    const totalSlots = arr.length > 35 ? 42 : 35
    const remaining = totalSlots - arr.length
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, i)
      const isWeekend = d.getDay() === 0 || d.getDay() === 6
      arr.push({
        dateString: d.toISOString().split('T')[0],
        dayNumber: i,
        isCurrentMonth: false,
        isToday: false,
        isWeekend
      })
    }

    return arr
  }, [viewDate])

  const allEvents = useMemo(() => {
    const list: any[] = []

    // Determine the full range to expand events for (Timeline range + Month Grid range)
    const timelineStart = days[0]?.dateString || ''
    const timelineEnd = days[days.length - 1]?.dateString || ''
    const monthStart = monthGridDays[0]?.dateString || ''
    const monthEnd = monthGridDays[monthGridDays.length - 1]?.dateString || ''

    const startDate = [timelineStart, monthStart].filter(Boolean).sort()[0] || ''
    const endDate = [timelineEnd, monthEnd].filter(Boolean).sort().reverse()[0] || ''

    const traverse = (projs: Project[]) => {
      for (const p of projs) {
        if (p.events) {
          const expanded = expandRecurringEvents(p.events, startDate, endDate)
          list.push(
            ...expanded
              .map((e) => ({ ...e, projectId: p.id, projectColor: p.color }))
          )
        }
        if (p.subprojects) traverse(p.subprojects)
      }
    }
    if (startDate && endDate) traverse(projects)
    return list
  }, [projects, days, monthGridDays])

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

  const scrollToToday = (): void => {
    if (!scrollRef.current) return

    if (viewMode === 'timeline') {
      const todayIndex = days.findIndex((d) => d.isToday)
      if (todayIndex !== -1) {
        const targetLeft = todayIndex * minCellWidth
        scrollRef.current.scrollTo({ left: targetLeft, behavior: 'smooth' })
      }
    } else {
      // Month view vertical scroll + reset date
      setViewDate(new Date())
      const todayIndex = monthGridDays.findIndex((d) => d.isToday)
      if (todayIndex !== -1) {
        const row = Math.floor(todayIndex / 7)
        const rowHeight = scrollRef.current.scrollHeight / (monthGridDays.length / 7)
        scrollRef.current.scrollTo({ top: row * rowHeight, behavior: 'smooth' })
      }
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
      if (
        showFilterMenu &&
        filterMenuRef.current &&
        !filterMenuRef.current.contains(event.target as Node)
      ) {
        setShowFilterMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [addingToCell, showFilterMenu])

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

        if (parsed.type === 'move_event') {
          const dropEvent = new CustomEvent('event-dropped-on-calendar', {
            detail: {
              eventId: parsed.id,
              projectId: projectId,
              newDate: dateString
            }
          })
          window.dispatchEvent(dropEvent)
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
            cursor: isPanning ? 'grabbing' : 'auto'
          }}
        >
          {/* Shared Top Bar Controls */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 45,
              background: 'var(--card-bg)',
              height: '45px',
              padding: '0 10px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              width: 'max-content',
              minWidth: '100%',
              boxSizing: 'border-box',
              gap: '6px'
            }}
          >
            <button
              onClick={onToggleSidebar}
              title={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
              style={{
                background: 'transparent',
                border: 'none',
                color: isSidebarOpen ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isSidebarOpen ? 0.6 : 0.4,
                transition: 'opacity 0.2s',
                width: '30px',
                height: '30px',
                marginRight: '8px'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) =>
                (e.currentTarget.style.opacity = isSidebarOpen ? '0.6' : '0.4')
              }
            >
              <PanelLeft size={18} />
            </button>
            <div
              style={{
                width: '200px',
                minWidth: '200px',
                height: '100%',
                padding: '0 12px 0 24px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                position: 'sticky',
                left: 0,
                background: 'var(--card-bg)',
                zIndex: 46,
                boxSizing: 'border-box'
              }}
            >
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
                    padding: '4px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'all 0.2s'
                  }}
                  title="Timeline View"
                >
                  <AlignLeft size={14} />
                </button>
                <button
                  onClick={() => setViewMode('month')}
                  style={{
                    background: viewMode === 'month' ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: viewMode === 'month' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    border: 'none',
                    padding: '4px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'all 0.2s'
                  }}
                  title="Month Grid View"
                >
                  <CalendarDays size={14} />
                </button>
              </div>
              <button
                onClick={scrollToToday}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text-primary)',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 500,
                  transition: 'all 0.2s'
                }}
                title="Scroll to Today"
              >
                Today
              </button>
              {onSyncWorkspaceEvents && (
                <button
                  onClick={onSyncWorkspaceEvents}
                  disabled={isSyncing}
                  title="Sync Events with Google Calendar"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: isSyncing ? 'var(--accent)' : 'var(--text-secondary)',
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-md)',
                    cursor: isSyncing ? 'default' : 'pointer',
                    fontSize: '12px',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s'
                  }}
                >
                  <RefreshCcw size={12} className={isSyncing ? 'spin-anim' : ''} />
                  {isSyncing ? 'Syncing...' : 'GCal Sync'}
                </button>
              )}
            </div>
          </div>

          {viewMode === 'timeline' ? (
            <table
              className="timeline-container"
              style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%', tableLayout: 'fixed' }}
            >
              {/* Calendar Header Row */}
              <thead>


                {/* Row 2: Projects Label (rowSpan=2) + Months */}
                <tr>
                  <th
                    rowSpan={2}
                    style={{
                      width: '200px',
                      minWidth: '200px',
                      height: '90px',
                      padding: '8px 8px 8px 24px',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                      position: 'sticky',
                      top: '45px',
                      left: 0,
                      background: 'var(--card-bg)',
                      zIndex: 35,
                      textAlign: 'left',
                      borderRight: '1px solid rgba(255,255,255,0.05)',
                      boxShadow: '1px 0 0 rgba(255,255,255,0.05)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Projects</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowFilterMenu(!showFilterMenu)
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          opacity: showFilterMenu ? 1 : 0.5
                        }}
                        title="Filter projects"
                      >
                        <SlidersHorizontal size={14} />
                      </button>
                      {showFilterMenu && (
                        <div
                          ref={filterMenuRef}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: '100%',
                            marginLeft: '8px',
                            background: 'var(--card-bg)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 'var(--radius-md)',
                            padding: '6px 0',
                            minWidth: '180px',
                            zIndex: 100,
                            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                            maxHeight: '400px',
                            overflowY: 'auto'
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div style={{ padding: '4px 12px 8px 12px', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
                            Visibility
                          </div>
                          {projects.map((p) => (
                            <button
                              key={p.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleProjectVisibility(p.id)
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                width: '100%',
                                padding: '8px 12px',
                                paddingLeft: `${24 + (p.depth || 0) * 16}px`,
                                background: 'transparent',
                                border: 'none',
                                color: hiddenProjects.has(p.id) ? 'var(--text-secondary)' : 'var(--text-primary)',
                                cursor: 'pointer',
                                fontSize: '13px',
                                textAlign: 'left',
                                transition: 'background 0.2s',
                                opacity: hiddenProjects.has(p.id) ? 0.6 : 1
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <div
                                style={{
                                  width: '12px',
                                  height: '12px',
                                  borderRadius: '3px',
                                  border: `2px solid ${p.color || 'var(--accent)'}`,
                                  background: hiddenProjects.has(p.id) ? 'transparent' : (p.color || 'var(--accent)'),
                                  flexShrink: 0
                                }}
                              />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                            </button>
                          ))}
                          {hiddenProjects.size > 0 && (
                            <>
                              <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '6px 0' }} />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setHiddenProjectIds([])
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px',
                                  width: '100%',
                                  padding: '8px 12px',
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--text-primary)',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  textAlign: 'left',
                                  fontWeight: 500
                                }}
                              >
                                <RotateCcw size={12} style={{ color: 'var(--text-secondary)' }} />
                                <span>Show all projects</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </th>
                  {months.map((m) => (
                    <th
                      key={m.name}
                      colSpan={m.count}
                      style={{
                        height: '45px',
                        padding: '0 12px',
                        borderBottom: 'none',
                        borderLeft: 'none',
                        textAlign: 'left',
                        background: 'var(--card-bg)',
                        position: 'sticky',
                        top: '45px',
                        zIndex: 10,
                        boxSizing: 'border-box',
                        overflow: 'visible'
                      }}
                    >
                      <div
                        style={{
                          position: 'sticky',
                          left: '216px',
                          display: 'inline-block',
                          width: 'max-content',
                          fontSize: '13px',
                          color: 'var(--text-primary)',
                          fontWeight: 600,
                          padding: '0 4px',
                          whiteSpace: 'nowrap',
                          zIndex: 11
                        }}
                      >
                        {m.name}
                      </div>
                    </th>
                  ))}
                </tr>

                {/* Row 3: Days */}
                <tr>
                  {days.map((d) => (
                    <th
                      key={d.dateString}
                      style={{
                        width: `${minCellWidth}px`,
                        minWidth: `${minCellWidth}px`,
                        padding: '8px 12px',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        borderLeft: 'none',
                        textAlign: 'center',
                        color: d.isDummy
                          ? 'rgba(255,255,255,0.12)'
                          : d.isToday
                            ? 'var(--accent)'
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
                              ? 'rgba(0,0,0,0.3)'
                              : 'var(--card-bg)',
                        position: 'sticky',
                        top: '90px',
                        zIndex: 10,
                        fontSize: '12px'
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
                        style={{ background: 'transparent' }}
                      >
                        {/* Project Title Column */}
                        <td
                          style={{
                            width: '200px',
                            minWidth: '200px',
                            padding: `10px 8px 10px ${24 + (project.depth || 0) * 16}px`,
                            position: 'sticky',
                            left: 0,
                            background: 'var(--card-bg)',
                            borderRight: '1px solid rgba(255,255,255,0.05)',
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            zIndex: 5,
                            verticalAlign: 'top',
                            boxShadow: '1px 0 0 rgba(255,255,255,0.05)'
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              color: 'var(--text-primary)'
                            }}
                          >
                            {(() => {
                              if (project.icon?.startsWith('file')) {
                                return (
                                  <img
                                    src={project.icon}
                                    alt=""
                                    style={{
                                      width: '15px',
                                      height: '15px',
                                      borderRadius: 'var(--radius-sm)',
                                      objectFit: 'cover',
                                      flexShrink: 0
                                    }}
                                  />
                                )
                              }
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              const IconComponent = (LucideIcons as any)[project.icon || 'FolderOpen']
                              if (IconComponent) {
                                return <IconComponent size={15} style={{ color: project.color || 'var(--accent)', flexShrink: 0 }} />
                              }
                              return (
                                <span
                                  style={{
                                    fontSize: '13px',
                                    width: '15px',
                                    textAlign: 'center',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}
                                >
                                  {project.icon}
                                </span>
                              )
                            })()}
                            <span
                              style={{
                                fontWeight: 600,
                                fontSize: '13px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: 1
                              }}
                              title={project.name}
                            >
                              {project.name}
                            </span>
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

                          const eventsForDay = allEvents.filter(
                            (e) => e.projectId === project.id && e.date === d.dateString
                          )

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
                                position: 'relative',
                                width: `${minCellWidth}px`,
                                minWidth: `${minCellWidth}px`,
                                padding: '8px',
                                borderLeft: 'none',
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
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
                                        ? 'rgba(0,0,0,0.3)'
                                        : 'transparent',
                                opacity: d.isPast && !d.isToday ? 0.7 : 1,
                                cursor: d.isDummy ? 'default' : 'pointer',
                                pointerEvents: d.isDummy ? 'none' : 'auto'
                              }}
                            >
                              {/* Project Boundary Bracket Lines */}
                              {project.startDate && project.endDate && d.dateString >= project.startDate && d.dateString <= project.endDate && (
                                <div 
                                  style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    pointerEvents: 'none',
                                    zIndex: 1
                                  }}
                                >
                                  {/* Horizontal Top Line - Subtle */}
                                  <div style={{
                                    position: 'absolute',
                                    top: '-1px',
                                    left: 0,
                                    right: 0,
                                    height: '1px',
                                    background: project.color || 'var(--accent)',
                                    opacity: 0.25
                                  }} />

                                  {/* Vertical Start Line - Half height */}
                                  {project.startDate === d.dateString && (
                                    <div style={{
                                      position: 'absolute',
                                      top: 0,
                                      left: 0,
                                      width: '2px',
                                      height: '50%',
                                      background: project.color || 'var(--accent)',
                                      opacity: 0.6
                                    }} />
                                  )}

                                  {/* Vertical End Line - Half height */}
                                  {project.endDate === d.dateString && (
                                    <div style={{
                                      position: 'absolute',
                                      top: 0,
                                      right: 0,
                                      width: '2px',
                                      height: '50%',
                                      background: project.color || 'var(--accent)',
                                      opacity: 0.6
                                    }} />
                                  )}
                                </div>
                              )}
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
                                          projectId: project.id
                                        })
                                      )
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      padding: '4px 8px',
                                      background: 'rgba(255,255,255,0.03)',
                                      borderRadius: 'var(--radius-sm)',
                                      fontSize: '11px',
                                      borderLeft: `2px solid ${project.color || 'var(--accent)'}`,
                                      cursor: 'grab'
                                    }}
                                    className="timeline-task-item"
                                    title={`Event: ${event.title}${event.time ? '\nTime: ' + event.time : ''}${event.location ? '\nLoc: ' + event.location : ''}\n(Drag to move instance)`}
                                  >
                                    <LucideIcons.Calendar size={12} style={{ flexShrink: 0, opacity: 0.7, color: project.color || 'var(--accent)' }} />
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
                                        // Dispatch a custom event to delete this event instance
                                        const delEvent = new CustomEvent('delete-event-instance', {
                                          detail: {
                                            eventId: event.id,
                                            projectId: project.id
                                          }
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
                                        alignItems: 'center',
                                        marginLeft: 'auto'
                                      }}
                                      title="Delete instance"
                                      className="event-delete-btn"
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
              </tbody>
            </table>
          ) : (
            <MonthGrid
              viewDate={viewDate}
              adjustMonth={adjustMonth}
              monthGridDays={monthGridDays}
              timelineTasks={timelineTasks}
              setTimelineTasks={setTimelineTasks}
              allEvents={allEvents}
              projects={projects}
              taskIdToNameMap={taskIdToNameMap}
              addingToCell={addingToCell}
              setAddingToCell={setAddingToCell}
              newItemName={newItemName}
              setNewItemName={setNewItemName}
              selectedTaskId={selectedTaskId}
              setSelectedTaskId={setSelectedTaskId}
              onAddProjectItem={onAddProjectItem}
            />
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
              onClick={() => setHiddenProjectIds([])}
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
