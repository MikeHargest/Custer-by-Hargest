import React, { useMemo, useState, useRef, forwardRef, useImperativeHandle } from 'react'
import { v4 as uuidv4 } from 'uuid'
import MonthGrid from './calendar/MonthGrid'
import WeekGrid from './calendar/WeekGrid'
import DayGrid from './calendar/DayGrid'
import { Project, TaskItem, TimelineTask } from '../types'
import { expandRecurringEvents } from '../utils/recurrence'
import { formatLocalDate } from '../utils/dateUtils'
import * as LucideIcons from 'lucide-react'
import {
  FolderOpen,
  X,
  CheckSquare
} from 'lucide-react'
import CalendarQuickAdd from './calendar/CalendarQuickAdd'
import CalendarContextMenu from './calendar/CalendarContextMenu'
import { isParentTask } from './calendar/calendarUtils'

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
  onAddEvent: (projectId: string, eventName: string, date: string) => void
  onAddAlarm: (date: string, time: string, title: string) => void
  hiddenProjectIds: string[]
  setHiddenProjectIds: (ids: string[]) => void
  onSyncWorkspaceEvents?: () => void
  isSyncing?: boolean
  selectedProjectId?: string | null
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>
  viewMode: 'timeline' | 'month' | 'week' | 'day'
  setViewMode: (mode: 'timeline' | 'month' | 'week' | 'day') => void
  showFilterMenu: boolean
  setShowFilterMenu: (show: boolean) => void
  viewDate: Date
  setViewDate: React.Dispatch<React.SetStateAction<Date>>
  scrollToToday: () => void
}

const CalendarView = forwardRef<
  { scrollToToday: () => void },
  TimelineViewProps
>(function CalendarView(
  {
    projects,
    timelineTasks,
    setTimelineTasks,
    onAddProjectItem,
    onAddEvent,
    onAddAlarm,
    hiddenProjectIds,
    setHiddenProjectIds: _setHiddenProjectIds,
    onSyncWorkspaceEvents: _onSyncWorkspaceEvents,
    isSyncing: _isSyncing,
    setProjects,
    viewMode,
    setViewMode: _setViewMode,
    showFilterMenu: _showFilterMenu,
    setShowFilterMenu: _setShowFilterMenu,
    viewDate,
    setViewDate
  },
  ref
): React.ReactElement {
  const PAST_DAYS = 14
  const minCellWidth = 150

  // 1. State and Refs first
  const [addingToCell, setAddingToCell] = useState<{
    projectId: string
    date: string
    x: number
    y: number
  } | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    type: 'task' | 'event'
    id: string
    title: string
    projectId: string
    x: number
    y: number
    originalDate?: string
  } | null>(null)
  // const [newItemName, setNewItemName] = useState('')
  // const [selectedTaskId, setSelectedTaskId] = useState<string>('')
  const [isDraggingResize, setIsDraggingResize] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [startX, setStartX] = useState(0)
  const [startY, setStartY] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)

  const scrollRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({
    scrollToToday: () => {
      if (!scrollRef.current) return

      if (viewMode === 'timeline') {
        const todayIndex = days.findIndex((d) => d.isToday)
        if (todayIndex !== -1) {
          const targetLeft = todayIndex * minCellWidth
          scrollRef.current.scrollTo({ left: targetLeft, behavior: 'smooth' })
        }
      } else {
        setViewDate(new Date())
        window.dispatchEvent(new CustomEvent('scroll-to-today'))
      }
    }
  }))

  /*
  const adjustMonth = (offset: number): void => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1))
  }
  */

  const hiddenProjects = useMemo(() => new Set(hiddenProjectIds), [hiddenProjectIds])


  // 2. Memoized values next
  const flattenedProjects = useMemo(() => {
    const flat: Project[] = []
    const traverse = (projs: Project[], depth = 0) => {
      projs.forEach(p => {
        flat.push({ ...p, depth })
        if (p.subprojects) traverse(p.subprojects, depth + 1)
      })
    }
    traverse(projects)
    return flat
  }, [projects])

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
    const todayStr = formatLocalDate(today)

    // Start PAST_DAYS before today
    const START_OFFSET = -PAST_DAYS
    const FUTURE_DAYS = 30

    for (let i = START_OFFSET; i < FUTURE_DAYS; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)

      const rawDay = d.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit' })
      const dayStr = rawDay.charAt(0).toUpperCase() + rawDay.slice(1).replace(',', '')

      const rawMonth = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      const monthStr = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1)

      const isWeekend = d.getDay() === 0 || d.getDay() === 6
      const dateString = formatLocalDate(d)

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

        const rawDay = d.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit' })
        const dayStr = rawDay.charAt(0).toUpperCase() + rawDay.slice(1).replace(',', '')
        const rawMonth = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        const monthStr = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1)
        const isWeekend = d.getDay() === 0 || d.getDay() === 6

        arr.push({
          dateString: formatLocalDate(d),
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
      isToday: boolean
      isWeekend: boolean
      isEmpty?: boolean
      monthNameLong?: string
      monthNameShort?: string
      isFirstDayOfMonth?: boolean
      isPast?: boolean
    }[] = []

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = formatLocalDate(today)

    // Start 6 months ago
    const startMonth = new Date(today.getFullYear(), today.getMonth() - 6, 1)

    // Generate 18 months total
    for (let i = 0; i < 18; i++) {
      const mDate = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1)
      const rawMonthLong = mDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      const monthNameLong = rawMonthLong.charAt(0).toUpperCase() + rawMonthLong.slice(1)

      const rawMonthShort = mDate.toLocaleDateString('en-US', { month: 'short' })
      const monthNameShort = rawMonthShort.replace('.', '')

      const dayOfWeek = mDate.getDay()
      const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1

      // Empty pad the beginning to align the 1st of the month with its correct weekday
      for (let p = 0; p < offset; p++) {
        arr.push({ isEmpty: true, dateString: `dummy-${formatLocalDate(mDate)}-${p}`, dayNumber: 0, isToday: false, isWeekend: p === 5 || p === 6, monthNameLong })
      }

      const lastDay = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0).getDate()
      for (let d = 1; d <= lastDay; d++) {
        const cDate = new Date(mDate.getFullYear(), mDate.getMonth(), d)
        const dateString = formatLocalDate(cDate)
        const isWeekend = cDate.getDay() === 0 || cDate.getDay() === 6
        arr.push({
          isEmpty: false,
          dateString,
          dayNumber: d,
          isToday: dateString === todayStr,
          isWeekend,
          isPast: dateString < todayStr,
          monthNameLong,
          monthNameShort,
          isFirstDayOfMonth: d === 1
        })
      }

      // Tail pad to finish the final week
      let currentMonthLength = offset + lastDay
      const endOffset = (7 - (currentMonthLength % 7)) % 7
      for (let p = 0; p < endOffset; p++) {
        const weekdayIndex = (currentMonthLength + p) % 7
        arr.push({ isEmpty: true, dateString: `dummy-end-${formatLocalDate(mDate)}-${p}`, dayNumber: 0, isToday: false, isWeekend: weekdayIndex === 5 || weekdayIndex === 6, monthNameLong })
      }

    }

    return arr
  }, [])

  const weekDays = useMemo(() => {
    const list: any[] = []
    const startOfWeek = new Date(viewDate)
    const day = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
    startOfWeek.setDate(diff)
    startOfWeek.setHours(0, 0, 0, 0)

    const todayStr = formatLocalDate(new Date())

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek)
      d.setDate(startOfWeek.getDate() + i)
      const dateString = formatLocalDate(d)
      const isToday = dateString === todayStr
      const dayNumber = d.getDate()
      const dayNameShort = d.toLocaleDateString('en-US', { weekday: 'short' })
      const isWeekend = d.getDay() === 0 || d.getDay() === 6
      const monthNameLong = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      list.push({ dateString, dayNumber, dayNameShort, isToday, isWeekend, monthNameLong })
    }
    return list
  }, [viewDate])

  const dayData = useMemo(() => {
    const d = new Date(viewDate)
    d.setHours(0, 0, 0, 0)
    const todayStr = formatLocalDate(new Date())
    const dateString = formatLocalDate(d)
    const isToday = dateString === todayStr
    const dayNumber = d.getDate()
    const dayNameLong = d.toLocaleDateString('en-US', { weekday: 'long' })
    const dayNameShort = d.toLocaleDateString('en-US', { weekday: 'short' })
    const isWeekend = d.getDay() === 0 || d.getDay() === 6
    const monthNameLong = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    return { dateString, dayNumber, dayNameLong, dayNameShort, isToday, isWeekend, monthNameLong }
  }, [viewDate])

  const allEvents = useMemo(() => {
    const list: any[] = []

    // Determine the full range to expand events for (Timeline range + Month Grid range)
    const timelineStart = days[0]?.dateString || ''
    const timelineEnd = days[days.length - 1]?.dateString || ''

    let monthStart = ''
    let monthEnd = ''
    if (monthGridDays.length > 0) {
      const actualDays = monthGridDays.filter((d) => !d.isEmpty)
      monthStart = actualDays[0]?.dateString || ''
      monthEnd = actualDays[actualDays.length - 1]?.dateString || ''
    }

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

    const traverseTasks = (tasks: TaskItem[]): void => {
      for (const t of tasks) {
        map.set(t.id, t.text)
        if (t.subtasks) traverseTasks(t.subtasks)
      }
    }

    const traverseProjects = (projs: Project[]) => {
      projs.forEach(p => {
        if (p.tasks) traverseTasks(p.tasks)
        if (p.subprojects) traverseProjects(p.subprojects)
      })
    }

    traverseProjects(projects)
    return map
  }, [projects])

  const handlePrevWeek = () => {
    setViewDate(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() - 7)
      return d
    })
  }

  const handleNextWeek = () => {
    setViewDate(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() + 7)
      return d
    })
  }

  const handlePrevDay = () => {
    setViewDate(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() - 1)
      return d
    })
  }

  const handleNextDay = () => {
    setViewDate(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() + 1)
      return d
    })
  }

  const handleSelectDay = (dateStr: string) => {
    setViewDate(new Date(dateStr + 'T00:00:00'))
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

  const handleQuickAddTask = (projectId: string, name: string, date: string, taskId?: string) => {
    const finalTaskId = taskId ? onAddProjectItem(projectId, name, taskId, uuidv4()) : onAddProjectItem(projectId, name, undefined, uuidv4())

    setTimelineTasks((prev) => [
      ...prev,
      {
        id: uuidv4(),
        projectId: projectId,
        taskName: name,
        date: date,
        taskId: finalTaskId
      }
    ])
  }

  const handleRenameItem = (type: 'task' | 'event', id: string, projectId: string, newTitle: string) => {
    if (type === 'task') {
      const targetTask = timelineTasks.find(t => t.id === id)
      const taskId = targetTask?.taskId || id // Fallback to id if it's already the taskId

      const updateTasksRecursive = (tasks: TaskItem[]): TaskItem[] => {
        return tasks.map(t => {
          if (t.id === taskId) return { ...t, text: newTitle }
          if (t.subtasks) return { ...t, subtasks: updateTasksRecursive(t.subtasks) }
          return t
        })
      }
      const updateProjectsRecursive = (projs: Project[]): Project[] => {
        return projs.map(p => {
          if (p.id === projectId) return { ...p, tasks: updateTasksRecursive(p.tasks || []) }
          if (p.subprojects) return { ...p, subprojects: updateProjectsRecursive(p.subprojects) }
          return p
        })
      }
      setProjects(prev => updateProjectsRecursive(prev))
      setTimelineTasks(prev => prev.map(t => {
        // Update BOTH the record we clicked AND any other records pointing to the same taskId
        if (t.id === id || t.taskId === taskId) return { ...t, taskName: newTitle }
        return t
      }))
    } else {
      const updateProjectsRecursive = (projs: Project[]): Project[] => {
        return projs.map(p => {
          if (p.id === projectId) return {
            ...p,
            events: (p.events || []).map(e => e.id === id ? { ...e, title: newTitle, updatedAt: Date.now() } : e)
          }
          if (p.subprojects) return { ...p, subprojects: updateProjectsRecursive(p.subprojects) }
          return p
        })
      }
      setProjects(prev => updateProjectsRecursive(prev))
    }
  }

  const handleDeleteItem = (type: 'task' | 'event', id: string, projectId: string) => {
    if (type === 'task') {
      // Right click delete on calendar item just removes IT from the calendar record
      setTimelineTasks(prev => prev.filter(t => t.id !== id))
    } else {
      const updateProjectsRecursive = (projs: Project[]): Project[] => {
        return projs.map(p => {
          if (p.id === projectId) return { ...p, events: (p.events || []).filter(e => e.id !== id) }
          if (p.subprojects) return { ...p, subprojects: updateProjectsRecursive(p.subprojects) }
          return p
        })
      }
      setProjects(prev => updateProjectsRecursive(prev))
    }
  }

  const handleChangeItemProject = (type: 'task' | 'event', id: string, oldProjectId: string, newProjectId: string) => {
    if (type === 'task') {
      // If we change project for a timeline task, we update the reference
      setTimelineTasks(prev => prev.map(t => {
        if (t.id === id) return { ...t, projectId: newProjectId }
        return t
      }))
      // Note: moving the actual TaskItem to another project in the sidebar is more complex
      // so for now we just change the calendar assignment.
    } else {
      setProjects(prev => {
        let movedEvent: any = null
        const removeRecursive = (projs: Project[]): Project[] => {
          return projs.map(p => {
            if (p.id === oldProjectId) {
              const events = p.events || []
              const found = events.find(e => e.id === id)
              if (found) movedEvent = found
              return { ...p, events: events.filter(e => e.id !== id) }
            }
            if (p.subprojects) return { ...p, subprojects: removeRecursive(p.subprojects) }
            return p
          })
        }
        const addRecursive = (projs: Project[]): Project[] => {
          return projs.map(p => {
            if (p.id === newProjectId) return { ...p, events: [...(p.events || []), movedEvent] }
            if (p.subprojects) return { ...p, subprojects: addRecursive(p.subprojects) }
            return p
          })
        }
        const projsAfterRemove = removeRecursive(prev)
        if (movedEvent) return addRecursive(projsAfterRemove)
        return projsAfterRemove
      })
    }
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
                  const oldStartDate = new Date(t.date + 'T00:00:00').getTime()
                  const oldEndDate = new Date(t.endDate + 'T00:00:00').getTime()
                  const diffMs = oldEndDate - oldStartDate
                  const newStartDate = new Date(dateString + 'T00:00:00').getTime()
                  const newEndDate = formatLocalDate(new Date(newStartDate + diffMs))
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
            overflow: viewMode === 'timeline' ? 'scroll' : 'hidden',
            flex: 1,
            cursor: isPanning ? 'grabbing' : 'auto',
            position: 'relative',
            background: 'var(--card-bg)'
          }}
        >
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
                      top: '0px',
                      left: 0,
                      background: 'var(--card-bg)',
                      zIndex: 35,
                      textAlign: 'left',
                      borderRight: '1px solid rgba(255,255,255,0.05)',
                      boxShadow: '1px 0 0 rgba(255,255,255,0.05)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }} />
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
                        top: '0px',
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
                            ? 'var(--text-primary)'
                            : 'rgba(255,255,255,0.4)', // Darker color for other days
                        fontWeight: 600,
                        opacity: 1,
                        background: d.isDummy
                          ? 'rgba(0,0,0,0.15)'
                          : d.isToday
                            ? '#1f1f1f' // Darkened solid color
                            : d.isWeekend
                              ? 'linear-gradient(rgba(255,255,255,0.015), rgba(255,255,255,0.015)), var(--card-bg)'
                              : d.isPast && !d.isToday
                                ? 'rgba(0,0,0,0.08)'
                                : 'var(--card-bg)',
                        position: 'sticky',
                        top: '45px',
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
                {flattenedProjects.length === 0 ? (
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
                  flattenedProjects
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
                                  setAddingToCell({ projectId: project.id, date: d.dateString, x: 0, y: 0 })
                                  // setNewItemName('')
                                  // setSelectedTaskId('')
                                }
                              }}
                              style={{
                                position: 'relative',
                                width: `${minCellWidth}px`,
                                minWidth: `${minCellWidth}px`,
                                maxWidth: `${minCellWidth}px`,
                                padding: '8px',
                                borderLeft: 'none',
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                verticalAlign: 'top',
                                overflow: 'hidden',
                                background: d.isDummy
                                  ? `repeating-linear-gradient(
                                    -45deg,
                                    rgba(0,0,0,0.08),
                                    rgba(0,0,0,0.08) 2px,
                                    transparent 2px,
                                    transparent 10px
                                  )`
                                  : d.isToday
                                    ? '#1f1f1f' // Darkened solid color
                                    : d.isWeekend
                                      ? 'linear-gradient(rgba(255,255,255,0.015), rgba(255,255,255,0.015)), var(--card-bg)'
                                      : d.isPast && !d.isToday
                                        ? 'rgba(0,0,0,0.06)'
                                        : 'var(--card-bg)', // Use var(--card-bg) instead of transparent
                                opacity: d.isPast && !d.isToday && !d.isWeekend ? 0.7 : 1,
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
                                    style={{ height: '24px', flexShrink: 0, visibility: 'hidden' }}
                                  />
                                ))}

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
                                        projectId: project.id,
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
                                          projectId: project.id
                                        })
                                      )
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      padding: '4px 8px',
                                      background: 'var(--calendar-event-bg)',
                                      borderRadius: 'var(--radius-sm)',
                                      fontSize: '11px',
                                      height: '24px',
                                      border: '1px solid rgba(255,255,255,0.05)',
                                      borderLeft: `2px solid ${project.color || 'var(--accent)'}`,
                                      cursor: 'grab',
                                      overflow: 'hidden',
                                      minWidth: 0
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
                                        height: '24px',
                                        flexShrink: 0,
                                        zIndex: spanDays > 1 ? 5 : 2,
                                        // During resize drag, let pointer events pass through to td cells
                                        pointerEvents:
                                          isDraggingResize && spanDays > 1 ? 'none' : 'auto'
                                      }}
                                    >
                                      <div
                                        onContextMenu={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setContextMenu({
                                            type: 'task',
                                            id: task.id,
                                            title: currentTaskName || '',
                                            projectId: project.id,
                                            x: e.clientX,
                                            y: e.clientY
                                          })
                                        }}
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
                                          background: 'var(--calendar-task-bg)',
                                          color: 'var(--text-primary)',
                                          padding: '5px 9px',
                                          borderRadius: 'var(--radius-md)',
                                          fontSize: '12px',
                                          fontWeight: isParent ? 600 : 400,
                                          position: 'absolute',
                                          top: 0,
                                          left: 0,
                                          width: spanWidthPx,
                                          height: '24px',
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
                                          minHeight: '24px',
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

                                <button
                                  className="timeline-add-btn"
                                  data-project-id={project.id}
                                  data-date={d.dateString}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setAddingToCell({
                                      projectId: project.id,
                                      date: d.dateString,
                                      x: e.clientX,
                                      y: e.clientY
                                    })
                                  }}
                                  title="Add Task, Event or Alarm"
                                  style={{
                                    pointerEvents: 'auto'
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          ) : viewMode === 'month' ? (
            <div style={{
              position: 'absolute',
              top: '45px',
              left: 0,
              right: 0,
              bottom: 0,
              overflow: 'hidden'
            }}>
              <MonthGrid
                monthGridDays={monthGridDays}
                timelineTasks={timelineTasks}
                setTimelineTasks={setTimelineTasks}
                allEvents={allEvents}
                projects={flattenedProjects}
                taskIdToNameMap={taskIdToNameMap}
                addingToCell={addingToCell}
                setAddingToCell={setAddingToCell}
                setContextMenu={setContextMenu}
              />
            </div>
          ) : viewMode === 'week' ? (
            <div style={{
              position: 'absolute',
              top: '45px',
              left: 0,
              right: 0,
              bottom: 0,
              overflow: 'hidden'
            }}>
              <WeekGrid
                weekDays={weekDays}
                onPrevWeek={handlePrevWeek}
                onNextWeek={handleNextWeek}
                timelineTasks={timelineTasks}
                setTimelineTasks={setTimelineTasks}
                allEvents={allEvents}
                projects={flattenedProjects}
                taskIdToNameMap={taskIdToNameMap}
                addingToCell={addingToCell}
                setAddingToCell={setAddingToCell}
                setContextMenu={setContextMenu}
              />
            </div>
          ) : (
            <div style={{
              position: 'absolute',
              top: '45px',
              left: 0,
              right: 0,
              bottom: 0,
              overflow: 'hidden'
            }}>
              <DayGrid
                dayData={dayData}
                weekDaysForDayView={weekDays}
                onSelectDay={handleSelectDay}
                onPrevDay={handlePrevDay}
                onNextDay={handleNextDay}
                timelineTasks={timelineTasks}
                allEvents={allEvents}
                projects={flattenedProjects}
                taskIdToNameMap={taskIdToNameMap}
                setContextMenu={setContextMenu}
              />
            </div>
          )}
        </div>


        {addingToCell && (
          <CalendarQuickAdd
            projects={flattenedProjects}
            initialDate={addingToCell.date}
            initialProjectId={addingToCell.projectId}
            position={{ x: addingToCell.x, y: addingToCell.y }}
            onClose={() => setAddingToCell(null)}
            onAddTask={handleQuickAddTask}
            onAddEvent={onAddEvent}
            onAddAlarm={onAddAlarm}
            showProjectSelector={viewMode !== 'timeline'}
          />
        )}

        {contextMenu && (
          <CalendarContextMenu
            type={contextMenu.type}
            item={{ id: contextMenu.id, title: contextMenu.title, projectId: contextMenu.projectId }}
            projects={flattenedProjects}
            position={{ x: contextMenu.x, y: contextMenu.y }}
            onClose={() => setContextMenu(null)}
            onRename={(newTitle) => handleRenameItem(contextMenu.type, contextMenu.id, contextMenu.projectId, newTitle)}
            onDelete={() => handleDeleteItem(contextMenu.type, contextMenu.id, contextMenu.projectId)}
            onChangeProject={(newProjId) => handleChangeItemProject(contextMenu.type, contextMenu.id, contextMenu.projectId, newProjId)}
          />
        )}
      </div>
    </div>
  )
})

export default CalendarView
