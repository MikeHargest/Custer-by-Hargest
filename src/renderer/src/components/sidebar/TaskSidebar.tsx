import React, { useState, useEffect, useRef, memo, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Plus, ChevronDown, ChevronRight, Archive, Trash2, Folder, CheckSquare, Calendar as CalendarIcon } from 'lucide-react'
import { Project, TaskItem, TimelineTask, AppEvent } from '../../types'
import ColorPicker from '../ColorPicker'

// Subcomponents
import EventItem from './subcomponents/EventItem'
import TaskTree from './subcomponents/TaskTree'
import ProjectItem from './subcomponents/ProjectItem'

// Utils
import {
  findProjectRecursive,
  removeTaskFromProjects,
  enforceDepthLimit,
  getDepthOfTaskInList,
  removeProjectFromTree
} from './utils'

interface TaskSidebarProps {
  isOpen: boolean
  projects: Project[]
  setProjects: (action: React.SetStateAction<Project[]>, skipHistory?: boolean) => void
  timelineTasks: TimelineTask[]
  selectedProjectId: string | null
  setSelectedProjectId: React.Dispatch<React.SetStateAction<string | null>>
  onAddProject: (
    name: string,
    parentId?: string
  ) => Promise<{ id: string; name: string } | undefined>
  onDeleteProject: (id: string) => void
  onTaskAdded: (projectId: string, name: string, parentId?: string, explicitId?: string) => void
  onTaskDeleted?: (taskName: string, taskId: string) => void
  onAssignTaskToTimer?: (timerId: string, taskText: string) => void
  onAssignTaskToAlarm?: (alarmId: string, taskText: string) => void
  showTaskCounts: boolean
  showColoredDots: boolean
}

export default memo(function TaskSidebar({
  isOpen,
  projects,
  setProjects,
  timelineTasks,
  selectedProjectId,
  setSelectedProjectId,
  onAddProject,
  onDeleteProject,
  onTaskAdded,
  onTaskDeleted,
  onAssignTaskToTimer,
  onAssignTaskToAlarm,
  showTaskCounts,
  showColoredDots
}: TaskSidebarProps): React.ReactElement {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [dropIndicator, setDropIndicator] = useState<{
    id: string
    position: 'before' | 'inside' | 'after'
    type: 'project' | 'task'
  } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [isArchiveView, setIsArchiveView] = useState(false)
  const archiveTimersRef = useRef<Record<string, NodeJS.Timeout>>({})
  // Section expansion states
  const [isTasksExpanded, setIsTasksExpanded] = useState(true)
  const [isEventsExpanded, setIsEventsExpanded] = useState(true)
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)

  // Resizer state
  const [projectsHeight, setProjectsHeight] = useState(300)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false)
  const [resizeStartY, setResizeStartY] = useState(0)
  const [resizeStartHeight, setResizeStartHeight] = useState(300)

  // Tasks section resizer state
  const [tasksHeight, setTasksHeight] = useState(350)
  const [isResizingTasks, setIsResizingTasks] = useState(false)
  const [resizeTasksStartY, setResizeTasksStartY] = useState(0)
  const [resizeTasksStartHeight, setResizeTasksStartHeight] = useState(350)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)

  // Refs
  const detailBlockRef = useRef<HTMLDivElement>(null)
  const projectsRef = useRef(projects)
  const editingValueRef = useRef(editingValue)

  useEffect(() => {
    editingValueRef.current = editingValue
  }, [editingValue])

  useEffect(() => {
    projectsRef.current = projects
  }, [projects])

  // Persistence: Load on Mount
  useEffect(() => {
    const loadSidebarState = async () => {
      // @ts-ignore
      const savedTasksExp = await window.api.getStoreValue('sidebar-tasks-expanded')
      // @ts-ignore
      const savedEventsExp = await window.api.getStoreValue('sidebar-events-expanded')
      // @ts-ignore
      const savedProjH = await window.api.getStoreValue('sidebar-projects-height')
      // @ts-ignore
      const savedTaskH = await window.api.getStoreValue('sidebar-tasks-height')

      if (savedTasksExp !== null && savedTasksExp !== undefined) setIsTasksExpanded(savedTasksExp)
      if (savedEventsExp !== null && savedEventsExp !== undefined) setIsEventsExpanded(savedEventsExp)
      if (savedProjH) setProjectsHeight(savedProjH)
      if (savedTaskH) setTasksHeight(savedTaskH)

      // Disable the "initial jump" effect by waiting for state to apply before enabling transitions
      setTimeout(() => setIsInitialLoading(false), 50);
    }
    loadSidebarState()
  }, [])

  // Persistence: Save on Change
  useEffect(() => {
    const saveSidebarState = () => {
      // Only save when not actively resizing for performance
      if (!isResizingSidebar && !isResizingTasks) {
        // @ts-ignore
        window.api.setStoreValue('sidebar-tasks-expanded', isTasksExpanded)
        // @ts-ignore
        window.api.setStoreValue('sidebar-events-expanded', isEventsExpanded)
        // @ts-ignore
        window.api.setStoreValue('sidebar-projects-height', projectsHeight)
        // @ts-ignore
        window.api.setStoreValue('sidebar-tasks-height', tasksHeight)
      }
    }
    const timeout = setTimeout(saveSidebarState, 500)
    return () => clearTimeout(timeout)
  }, [isTasksExpanded, isEventsExpanded, projectsHeight, tasksHeight, isResizingSidebar, isResizingTasks])

  useEffect(() => {
    if (!isResizingSidebar) return

    const handleMouseMove = (e: MouseEvent): void => {
      const deltaY = e.clientY - resizeStartY
      // Invert delta because dragging UP should increase bottom block height
      const newHeight = resizeStartHeight - deltaY

      if (newHeight < 100) {
        setProjectsHeight(100)
      } else if (newHeight > window.innerHeight * 0.7) {
        setProjectsHeight(window.innerHeight * 0.7)
      } else {
        setProjectsHeight(newHeight)
      }
    }

    const handleMouseUp = (): void => {
      setIsResizingSidebar(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizingSidebar, resizeStartY, resizeStartHeight])

  // Tasks Resizer effect
  useEffect(() => {
    if (!isResizingTasks) return

    const handleMouseMove = (e: MouseEvent): void => {
      if (!detailBlockRef.current) return
      const containerRect = detailBlockRef.current.getBoundingClientRect()
      const deltaY = e.clientY - resizeTasksStartY
      const newHeight = resizeTasksStartHeight + deltaY

      const availableHeight = containerRect.height
      const eventsHeaderHeight = 50
      const maxTasksHeight = availableHeight - eventsHeaderHeight

      // --- SYMMETRIC SNAPPING LOGIC ---

      // 1. Downward Snap (Collapse Events)
      if (newHeight > maxTasksHeight - 40) {
        if (isEventsExpanded) {
          setIsEventsExpanded(false)
        }
        setTasksHeight(maxTasksHeight)
      }
      // 2. Upward Snap (Collapse Tasks)
      else if (newHeight < 60) {
        if (isTasksExpanded) {
          setIsTasksExpanded(false)
        }
        setTasksHeight(0)
      }
      // 3. Normal Resizing with Hysteresis
      else {
        // Re-expand Events if pulled up significantly
        if (!isEventsExpanded && newHeight < maxTasksHeight - 80) {
          setIsEventsExpanded(true)
        }
        // Re-expand Tasks if pulled down significantly
        if (!isTasksExpanded && newHeight > 80) {
          setIsTasksExpanded(true)
        }

        const clampedHeight = Math.max(0, Math.min(newHeight, maxTasksHeight))
        setTasksHeight(clampedHeight)
      }
    }

    const handleMouseUp = (): void => {
      setIsResizingTasks(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [
    isResizingTasks,
    resizeTasksStartY,
    resizeTasksStartHeight,
    isEventsExpanded,
    isTasksExpanded
  ])

  // Dynamic height capping to prevent overflow
  useEffect(() => {
    const capHeights = (): void => {
      if (!detailBlockRef.current || isResizingTasks || isTransitioning) return

      const containerHeight = detailBlockRef.current.getBoundingClientRect().height
      const eventsHeaderHeight = 50
      const maxAllowed = containerHeight - eventsHeaderHeight

      if (!isEventsExpanded) {
        setTasksHeight(maxAllowed)
      } else {
        if (tasksHeight > maxAllowed - 50) {
          setTasksHeight(maxAllowed - 100)
        }
      }
    }

    capHeights()
    window.addEventListener('resize', capHeights)
    return () => window.removeEventListener('resize', capHeights)
  }, [isEventsExpanded, isTasksExpanded, tasksHeight, isResizingTasks, isTransitioning])

  // Auto-collapse sections when sidebar is closed
  useEffect(() => {
    if (!isOpen) {
      setIsTasksExpanded(false)
      setIsEventsExpanded(false)
    }
  }, [isOpen])

  const handleAddProject = useCallback(
    (name: string, parentId?: string) => {
      return onAddProject(name, parentId)
    },
    [onAddProject]
  )

  const handleDeleteProject = useCallback(
    (id: string) => {
      onDeleteProject(id)
    },
    [onDeleteProject]
  )



  // ===== EVENTS LOGIC =====
  const handleAddEvent = useCallback(
    (projectId: string, title: string, eventId: string): void => {
      if (!title.trim()) return

      const newEvent: AppEvent = {
        id: eventId,
        title: title.trim(),
        date: undefined,
        time: undefined,
        syncStatus: 'pending_push',
        updatedAt: Date.now()
      }

      const updateRecursive = (projs: Project[]): Project[] => {
        return projs.map((p): Project => {
          if (p.id === projectId) {
            return { ...p, events: [...(p.events || []), newEvent] }
          }
          if (p.subprojects) return { ...p, subprojects: updateRecursive(p.subprojects) }
          return p
        })
      }
      setProjects((prev) => updateRecursive(prev))
    },
    [setProjects]
  )

  const handleDeleteEvent = useCallback(
    (projectId: string, eventId: string): void => {
      const updateRecursive = (projs: Project[]): Project[] => {
        return projs.map((p): Project => {
          if (p.id === projectId) {
            return {
              ...p,
              events: p.events?.filter((e) => {
                if (e.id === eventId) {
                  // If it has an externalId, we should mark as pending_delete instead of actual removal,
                  // but since this is TaskSidebar we might do a full removal. Let's just remove it here and sync manager will handle diffs,
                  // OR better: we should mark it deleted if syncing is active. For now, true deletion.
                  return false;
                }
                return true;
              }) || []
            }
          }
          if (p.subprojects) return { ...p, subprojects: updateRecursive(p.subprojects) }
          return p
        })
      }
      setProjects((prev) => updateRecursive(prev))
    },
    [setProjects]
  )
  const handleUpdateEvent = useCallback(
    (projectId: string, eventId: string, updates: Partial<AppEvent>): void => {
      const updateRecursive = (projs: Project[]): Project[] => {
        return projs.map((p): Project => {
          if (p.id === projectId) {
            return {
              ...p,
              events: p.events?.map((ev) =>
                ev.id === eventId ? { ...ev, ...updates, syncStatus: 'pending_push', updatedAt: Date.now() } : ev
              )
            }
          }
          if (p.subprojects) return { ...p, subprojects: updateRecursive(p.subprojects) }
          return p
        })
      }
      setProjects((prev) => updateRecursive(prev))
    },
    [setProjects]
  )

  const saveEventName = (projectId: string, eventId: string): void => {
    if (!editingValue.trim()) {
      cancelEditing()
      return
    }
    handleUpdateEvent(projectId, eventId, { title: editingValue.trim() })
    cancelEditing()
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (activeDropdown !== null) {
        const target = e.target as HTMLElement
        if (!target.closest('.project-dropdown') && !target.closest('.task-edit-btn')) {
          setActiveDropdown(null)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [activeDropdown])

  // Refs for drag-and-drop state (mouse-event based, since HTML5 DnD API is broken in Electron)
  const dragDataRef = useRef<{
    type: 'task' | 'project'
    projectId: string
    taskId: string
  } | null>(null)
  const dropTargetRef = useRef<{
    action: 'before' | 'after' | 'inside' | 'project' | 'timer' | 'alarm' | 'timeline'
    projectId: string
    taskId?: string
    projectIdTarget?: string
    timerId?: string
    alarmId?: string
    timelineDate?: string
    type?: 'task' | 'project'
  } | null>(null)
  const [isDragging, setIsDragging] = useState<string | null>(null) // taskId or projectId of dragged item

  // Color picker state
  const [colorPickerState, setColorPickerState] = useState<{
    projectId: string
    anchorRect: DOMRect
  } | null>(null)

  const openColorPickerFor = useCallback(
    (projectId: string, rect: DOMRect) => {
      setColorPickerState({ projectId, anchorRect: rect })
    },
    [setColorPickerState]
  )

  const getTaskTimelineDate = (projectId: string, taskId: string): string | null => {
    if (!timelineTasks) return null
    const found = timelineTasks.find((t) => t.projectId === projectId && t.taskId === taskId)
    if (!found) return null

    const formatDateStr = (dateStr: string): string => {
      try {
        const d = new Date(dateStr)
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      } catch {
        return dateStr
      }
    }
    if (found.date) return formatDateStr(found.date)
    return null
  }

  const startEditing = useCallback((id: string, value: string): void => {
    setEditingId(id)
    setEditingValue(value)
  }, [])

  const cancelEditing = useCallback((): void => {
    setEditingId(null)
    setEditingValue('')
  }, [])

  const saveProjectName = useCallback(
    async (projectId: string, newValue?: string): Promise<void> => {
      const currentNameInput =
        typeof newValue === 'string' ? newValue.trim() : editingValueRef.current.trim()
      if (!currentNameInput) {
        cancelEditing()
        return
      }

      // Check for name uniqueness in the state
      const isNameTaken = (name: string, excludeId: string): boolean => {
        const checkRecursive = (projs: Project[]): boolean => {
          for (const p of projs) {
            if (p.id !== excludeId && p.name.toLowerCase() === name.toLowerCase()) return true
            if (p.subprojects && checkRecursive(p.subprojects)) return true
          }
          return false
        }
        return checkRecursive(projectsRef.current)
      }

      let currentName = currentNameInput
      let counter = 1
      while (isNameTaken(currentName, projectId)) {
        currentName = `${currentNameInput} ${counter}`
        counter++
      }

      // Read synchronously from the ref. If this was called immediately after creation,
      // the caller should have used a setTimeout to allow React to flush the new project to the ref.
      const targetProject = findProjectRecursive(projectsRef.current, projectId)

      if (!targetProject) {
        console.warn('saveProjectName: project not found in ref', projectId)
        cancelEditing()
        return
      }

      let newPath = targetProject.path
      let newNotesPath = targetProject.notesPath
      let newBoardsPath = targetProject.boardsPath
      let finalName = currentName

      if (targetProject.name !== currentName && targetProject.path) {
        try {
          // @ts-ignore - window.api is injected by Electron preload
          const renamedPath = await window.api.renameProjectFolder(targetProject.path, currentName)
          if (renamedPath) {
            newPath = renamedPath
            newNotesPath = renamedPath + '/notes'
            newBoardsPath = renamedPath + '/boards'
            finalName = renamedPath.split(/[/\\]/).pop() || currentName
          }
        } catch (err) {
          console.error('Failed to rename project folder:', err)
        }
      }

      const updateRecursive = (projs: Project[]): Project[] => {
        return projs.map((p) => {
          if (p.id === projectId)
            return { ...p, name: finalName, path: newPath, notesPath: newNotesPath, boardsPath: newBoardsPath }
          if (p.subprojects) return { ...p, subprojects: updateRecursive(p.subprojects) }
          return p
        })
      }
      setProjects((prev) => updateRecursive(prev))
      cancelEditing()
    },
    [cancelEditing, setProjects]
  )

  const saveTaskName = useCallback(
    (projectId: string, taskId: string): void => {
      const currentText = editingValueRef.current.trim()
      if (!currentText) {
        cancelEditing()
        return
      }

      setProjects((prev) => {
        // Logic for updating task name: find project first, then update tasks
        const updateTasksRecursive = (tasks: TaskItem[]): TaskItem[] => {
          return tasks.map((t) => {
            if (t.id === taskId) return { ...t, text: currentText }
            if (t.subtasks && t.subtasks.length > 0) {
              return { ...t, subtasks: updateTasksRecursive(t.subtasks) }
            }
            return t
          })
        }

        const updateProjectsRecursive = (projs: Project[]): Project[] => {
          return projs.map((p) => {
            if (p.id === projectId) {
              return { ...p, tasks: updateTasksRecursive(p.tasks || []) }
            }
            if (p.subprojects) return { ...p, subprojects: updateProjectsRecursive(p.subprojects) }
            return p
          })
        }

        return updateProjectsRecursive(prev)
      })

      cancelEditing()
    },
    [cancelEditing, setProjects]
  )

  const updateProjectColor = useCallback(
    (projectId: string, color: string): void => {
      const updateRecursive = (projs: Project[]): Project[] => {
        return projs.map((p) => {
          if (p.id === projectId) {
            // Update this project and recursively update all its subprojects
            const updateDescendants = (proj: Project): Project => ({
              ...proj,
              color,
              subprojects: proj.subprojects?.map(updateDescendants)
            })
            return updateDescendants(p)
          }
          if (p.subprojects) return { ...p, subprojects: updateRecursive(p.subprojects) }
          return p
        })
      }
      setProjects((prev) => updateRecursive(prev), true)
    },
    [setProjects]
  )
  const handleColorChange = useCallback(
    (color: string) => {
      if (colorPickerState) {
        updateProjectColor(colorPickerState.projectId, color)
      }
    },
    [colorPickerState, updateProjectColor]
  )

  const toggleProjectExpansion = useCallback(
    (projectId: string, e: React.MouseEvent): void => {
      e.stopPropagation()
      const updateRecursive = (projs: Project[]): Project[] => {
        return projs.map((p) => {
          if (p.id === projectId) return { ...p, isExpanded: !p.isExpanded }
          if (p.subprojects) return { ...p, subprojects: updateRecursive(p.subprojects) }
          return p
        })
      }
      setProjects((prev) => updateRecursive(prev))
    },
    [setProjects]
  )

  const addSubProject = useCallback(
    async (parentProjectId: string, e?: React.MouseEvent): Promise<void> => {
      e?.stopPropagation()
      const result = await onAddProject('New Subproject', parentProjectId)
      if (result) {
        startEditing(result.id, result.name)
      }
    },
    [onAddProject, startEditing]
  )

  const selectedProject = findProjectRecursive(projects, selectedProjectId)

  const quickAddTask = useCallback(
    (projectId: string): void => {
      const p = findProjectRecursive(projectsRef.current, projectId)
      const taskNumber = (p?.tasks?.length || 0) + 1
      const autoName = `Task ${taskNumber} `
      const explicitId = uuidv4()
      onTaskAdded(projectId, autoName, undefined, explicitId)
      setTimeout(() => startEditing(explicitId, autoName), 0)
    },
    [onTaskAdded, startEditing]
  )

  const quickAddEvent = useCallback(
    (projectId: string): void => {
      const explicitId = uuidv4()
      const eventNumber = (selectedProject?.events?.length || 0) + 1
      const autoName = `Event ${eventNumber}`
      handleAddEvent(projectId, autoName, explicitId)
      setTimeout(() => startEditing(explicitId, autoName), 0)
    },
    [handleAddEvent, startEditing, selectedProject?.events?.length]
  )

  const deleteTask = (projectId: string, taskId: string): void => {
    const findTaskAndNotify = (tasks: TaskItem[]): boolean => {
      for (const t of tasks) {
        if (t.id === taskId) {
          if (onTaskDeleted) onTaskDeleted(t.text, taskId)
          return true
        }
        if (t.subtasks && findTaskAndNotify(t.subtasks)) return true
      }
      return false
    }

    const findProjectAndNotify = (projs: Project[]): boolean => {
      for (const p of projs) {
        if (p.id === projectId) {
          if (findTaskAndNotify(p.tasks || [])) return true
          if (findTaskAndNotify(p.archivedTasks || [])) return true
          return true
        }
        if (p.subprojects && findProjectAndNotify(p.subprojects)) return true
      }
      return false
    }
    findProjectAndNotify(projects)

    const removeTaskRecursive = (tasks: TaskItem[]): TaskItem[] => {
      return tasks
        .filter((t) => t.id !== taskId)
        .map((t) => ({
          ...t,
          subtasks: t.subtasks ? removeTaskRecursive(t.subtasks) : []
        }))
    }

    const updateProjectsRecursive = (projs: Project[]): Project[] => {
      return projs.map((p) => {
        if (p.id === projectId) {
          return {
            ...p,
            tasks: removeTaskRecursive(p.tasks || []),
            archivedTasks: removeTaskRecursive(p.archivedTasks || [])
          }
        }
        if (p.subprojects) return { ...p, subprojects: updateProjectsRecursive(p.subprojects) }
        return p
      })
    }
    setProjects(updateProjectsRecursive(projects))
  }

  const toggleTask = (projectId: string, taskId: string): void => {
    const updateTasksRecursive = (
      tasks: TaskItem[]
    ): { updatedTasks: TaskItem[]; found: boolean } => {
      let foundInThisLevel = false
      const newTasks = tasks.map((t) => {
        if (t.id === taskId) {
          foundInThisLevel = true
          const newStatus = !t.completed
          // Cascade Down: Set all subtasks recursively
          const setCompletedCascade = (ts: TaskItem[], status: boolean): TaskItem[] =>
            ts.map((st) => ({
              ...st,
              completed: status,
              subtasks: st.subtasks ? setCompletedCascade(st.subtasks, status) : []
            }))
          return {
            ...t,
            completed: newStatus,
            subtasks: t.subtasks ? setCompletedCascade(t.subtasks, newStatus) : []
          }
        }
        if (t.subtasks && t.subtasks.length > 0) {
          const { updatedTasks, found } = updateTasksRecursive(t.subtasks)
          if (found) {
            foundInThisLevel = true
            // Cascade Up: Check if all subtasks are finished
            const allSubtasksCompleted = updatedTasks.every((st) => st.completed)
            return { ...t, subtasks: updatedTasks, completed: allSubtasksCompleted }
          }
        }
        return t
      })
      return { updatedTasks: newTasks, found: foundInThisLevel }
    }

    const scheduleArchival = (tasks: TaskItem[], projId: string): void => {
      if (isArchiveView) return
      tasks.forEach((t) => {
        if (t.completed) {
          if (!archiveTimersRef.current[t.id]) {
            archiveTimersRef.current[t.id] = setTimeout(() => {
              performArchive(projId, t.id)
              delete archiveTimersRef.current[t.id]
            }, 1000)
          }
        } else {
          if (archiveTimersRef.current[t.id]) {
            clearTimeout(archiveTimersRef.current[t.id])
            delete archiveTimersRef.current[t.id]
          }
          if (t.subtasks && t.subtasks.length > 0) {
            scheduleArchival(t.subtasks, projId)
          }
        }
      })
    }

    const scheduleUnarchival = (tasks: TaskItem[], projId: string): void => {
      if (!isArchiveView) return
      tasks.forEach((t) => {
        if (!t.completed) {
          if (!archiveTimersRef.current[t.id]) {
            archiveTimersRef.current[t.id] = setTimeout(() => {
              performUnarchive(projId, t.id)
              delete archiveTimersRef.current[t.id]
            }, 1000)
          }
        } else {
          if (archiveTimersRef.current[t.id]) {
            clearTimeout(archiveTimersRef.current[t.id])
            delete archiveTimersRef.current[t.id]
          }
          if (t.subtasks && t.subtasks.length > 0) {
            scheduleUnarchival(t.subtasks, projId)
          }
        }
      })
    }

    const updateProjectsRecursive = (projs: Project[]): Project[] => {
      return projs.map((p) => {
        if (p.id === projectId) {
          if (isArchiveView) {
            const { updatedTasks } = updateTasksRecursive(p.archivedTasks || [])
            scheduleUnarchival(updatedTasks, p.id)
            return { ...p, archivedTasks: updatedTasks }
          } else {
            const { updatedTasks } = updateTasksRecursive(p.tasks || [])
            scheduleArchival(updatedTasks, p.id)
            return { ...p, tasks: updatedTasks }
          }
        }
        if (p.subprojects) return { ...p, subprojects: updateProjectsRecursive(p.subprojects) }
        return p
      })
    }
    setProjects(updateProjectsRecursive(projects))
  }

  const performArchive = useCallback((projectId: string, taskId: string) => {
    setProjects((prev) => {
      const updateProjectsRecursive = (projs: Project[]): Project[] => {
        return projs.map(p => {
          if (p.id === projectId) {
            let extractedTask: TaskItem | null = null;

            const removeImmutable = (tasks: TaskItem[]): TaskItem[] => {
              const res: TaskItem[] = [];
              for (const t of tasks) {
                if (t.id === taskId) {
                  extractedTask = t;
                  continue;
                }
                const newT = { ...t };
                if (newT.subtasks) {
                  newT.subtasks = removeImmutable(newT.subtasks);
                }
                res.push(newT);
              }
              return res;
            };

            const newTasks = removeImmutable(p.tasks || []);
            if (extractedTask) {
              return {
                ...p,
                tasks: newTasks,
                archivedTasks: [...(p.archivedTasks || []), extractedTask]
              };
            }
            return p;
          }
          if (p.subprojects) return { ...p, subprojects: updateProjectsRecursive(p.subprojects) };
          return p;
        });
      };
      return updateProjectsRecursive(prev);
    });
  }, [setProjects])

  const performUnarchive = useCallback((projectId: string, taskId: string) => {
    setProjects((prev) => {
      const updateProjectsRecursive = (projs: Project[]): Project[] => {
        return projs.map(p => {
          if (p.id === projectId) {
            let extractedTask: TaskItem | null = null;

            const removeImmutable = (tasks: TaskItem[]): TaskItem[] => {
              const res: TaskItem[] = [];
              for (const t of tasks) {
                if (t.id === taskId) {
                  extractedTask = { ...t, completed: false };
                  continue;
                }
                const newT = { ...t };
                if (newT.subtasks) {
                  newT.subtasks = removeImmutable(newT.subtasks);
                }
                res.push(newT);
              }
              return res;
            };

            const newArchivedTasks = removeImmutable(p.archivedTasks || []);
            if (extractedTask) {
              return {
                ...p,
                archivedTasks: newArchivedTasks,
                tasks: [...(p.tasks || []), extractedTask]
              };
            }
            return p;
          }
          if (p.subprojects) return { ...p, subprojects: updateProjectsRecursive(p.subprojects) };
          return p;
        });
      };
      return updateProjectsRecursive(prev);
    });
  }, [setProjects])

  const clearArchive = useCallback((projectId: string) => {
    if (window.confirm('Are you certain you want to permanently delete all archived tasks?')) {
      setProjects((prev) => {
        const updateProjectsRecursive = (projs: Project[]): Project[] => {
          return projs.map((p) => {
            if (p.id === projectId) {
              return { ...p, archivedTasks: [] }
            }
            if (p.subprojects) return { ...p, subprojects: updateProjectsRecursive(p.subprojects) }
            return p
          })
        }
        return updateProjectsRecursive(prev)
      })
    }
  }, [setProjects])

  const toggleTaskExpansion = (projectId: string, taskId: string): void => {
    const updateTasksRecursive = (tasks: TaskItem[]): TaskItem[] => {
      return tasks.map((t) => {
        if (t.id === taskId) return { ...t, isExpanded: !t.isExpanded }
        if (t.subtasks && t.subtasks.length > 0) {
          return { ...t, subtasks: updateTasksRecursive(t.subtasks) }
        }
        return t
      })
    }

    const updateProjectsRecursive = (projs: Project[]): Project[] => {
      return projs.map((p) => {
        if (p.id === projectId) {
          return { ...p, tasks: updateTasksRecursive(p.tasks || []) }
        }
        if (p.subprojects) return { ...p, subprojects: updateProjectsRecursive(p.subprojects) }
        return p
      })
    }
    setProjects(updateProjectsRecursive(projects))
  }

  // ===== DRAG & DROP: Mouse-event based (HTML5 DnD API broken in Electron) =====

  // ===== TASK DRAG & DROP PERFORMANCE HANDLERS =====

  const performDropBefore = useCallback(
    (sourceTaskId: string, targetProjectId: string, insertBeforeTaskId: string): void => {
      const { projects: cleaned, extracted } = removeTaskFromProjects(
        [...projectsRef.current],
        sourceTaskId
      )
      if (!extracted) return

      const targetProject = findProjectRecursive(cleaned, targetProjectId)
      const targetDepth = targetProject
        ? getDepthOfTaskInList(targetProject.tasks || [], insertBeforeTaskId, 0)
        : null
      if (targetDepth === null) return

      const safeTask = enforceDepthLimit(extracted, 2 - targetDepth)

      const insertBefore = (tasks: TaskItem[]): TaskItem[] => {
        const idx = tasks.findIndex((t) => t.id === insertBeforeTaskId)
        if (idx !== -1) {
          const newTasks = [...tasks]
          if (Array.isArray(safeTask)) newTasks.splice(idx, 0, ...safeTask)
          else newTasks.splice(idx, 0, safeTask)
          return newTasks
        }
        return tasks.map((t) => ({ ...t, subtasks: t.subtasks ? insertBefore(t.subtasks) : [] }))
      }

      setProjects(
        cleaned.map((p) => {
          if (p.id === targetProjectId) return { ...p, tasks: insertBefore(p.tasks || []) }
          if (p.subprojects)
            return {
              ...p,
              subprojects: p.subprojects.map((sub) =>
                sub.id === targetProjectId ? { ...sub, tasks: insertBefore(sub.tasks || []) } : sub
              )
            }
          return p
        })
      )
    },
    [setProjects]
  )

  const performDropInside = useCallback(
    (sourceTaskId: string, targetProjectId: string, targetTaskId: string): void => {
      const { projects: cleaned, extracted } = removeTaskFromProjects(
        [...projectsRef.current],
        sourceTaskId
      )
      if (!extracted) return

      const targetProject = findProjectRecursive(cleaned, targetProjectId)
      const targetDepth = targetProject
        ? getDepthOfTaskInList(targetProject.tasks || [], targetTaskId, 0)
        : null
      if (targetDepth === null || targetDepth >= 2) return

      const safeTask = enforceDepthLimit(extracted, 2 - (targetDepth + 1))

      const insertInto = (tasks: TaskItem[]): TaskItem[] => {
        return tasks.map((t) => {
          if (t.id === targetTaskId)
            return { ...t, isExpanded: true, subtasks: [...(t.subtasks || []), safeTask] }
          if (t.subtasks && t.subtasks.length > 0) return { ...t, subtasks: insertInto(t.subtasks) }
          return t
        })
      }

      setProjects(
        cleaned.map((p) => {
          if (p.id === targetProjectId) return { ...p, tasks: insertInto(p.tasks || []) }
          if (p.subprojects)
            return {
              ...p,
              subprojects: p.subprojects.map((sub) =>
                sub.id === targetProjectId ? { ...sub, tasks: insertInto(sub.tasks || []) } : sub
              )
            }
          return p
        })
      )
    },
    [setProjects]
  )

  const performDropOnProject = useCallback(
    (sourceTaskId: string, targetProjectId: string): void => {
      const { projects: cleaned, extracted } = removeTaskFromProjects(
        [...projectsRef.current],
        sourceTaskId
      )
      if (!extracted) return
      const safeTask = enforceDepthLimit(extracted, 2)
      setProjects(
        cleaned.map((p) => {
          if (p.id === targetProjectId) return { ...p, tasks: [...(p.tasks || []), safeTask] }
          if (p.subprojects)
            return {
              ...p,
              subprojects: p.subprojects.map((sub) =>
                sub.id === targetProjectId
                  ? { ...sub, tasks: [...(sub.tasks || []), safeTask] }
                  : sub
              )
            }
          return p
        })
      )
    },
    [setProjects]
  )

  const performDropAfter = useCallback(
    (sourceTaskId: string, targetProjectId: string, afterTaskId: string): void => {
      const { projects: cleaned, extracted } = removeTaskFromProjects(
        [...projectsRef.current],
        sourceTaskId
      )
      if (!extracted) return

      const targetProject = findProjectRecursive(cleaned, targetProjectId)
      const targetDepth = targetProject
        ? getDepthOfTaskInList(targetProject.tasks || [], afterTaskId, 0)
        : null
      if (targetDepth === null) return

      const safeTask = enforceDepthLimit(extracted, 2 - targetDepth)

      const insertAfter = (tasks: TaskItem[]): TaskItem[] => {
        const idx = tasks.findIndex((t) => t.id === afterTaskId)
        if (idx !== -1) {
          const newTasks = [...tasks]
          newTasks.splice(idx + 1, 0, safeTask)
          return newTasks
        }
        return tasks.map((t) => ({ ...t, subtasks: t.subtasks ? insertAfter(t.subtasks) : [] }))
      }

      setProjects(
        cleaned.map((p) => {
          if (p.id === targetProjectId) return { ...p, tasks: insertAfter(p.tasks || []) }
          if (p.subprojects)
            return {
              ...p,
              subprojects: p.subprojects.map((sub) =>
                sub.id === targetProjectId ? { ...sub, tasks: insertAfter(sub.tasks || []) } : sub
              )
            }
          return p
        })
      )
    },
    [setProjects]
  )

  // ===== PROJECT DRAG & DROP PERFORMANCE HANDLERS =====

  const performProjectDropBefore = useCallback(
    (sourceProjectId: string, targetProjectId: string): void => {
      const { projects: cleaned, extracted } = removeProjectFromTree(
        [...projectsRef.current],
        sourceProjectId
      )
      if (!extracted) return
      const insertBefore = (projs: Project[]): Project[] => {
        const idx = projs.findIndex((p) => p.id === targetProjectId)
        if (idx !== -1) {
          const newProjs = [...projs]
          newProjs.splice(idx, 0, extracted!)
          return newProjs
        }
        return projs.map((p) => ({
          ...p,
          subprojects: p.subprojects ? insertBefore(p.subprojects) : []
        }))
      }
      setProjects(insertBefore(cleaned))
    },
    [setProjects]
  )

  const performProjectDropAfter = useCallback(
    (sourceProjectId: string, targetProjectId: string): void => {
      const { projects: cleaned, extracted } = removeProjectFromTree(
        [...projectsRef.current],
        sourceProjectId
      )
      if (!extracted) return
      const insertAfter = (projs: Project[]): Project[] => {
        const idx = projs.findIndex((p) => p.id === targetProjectId)
        if (idx !== -1) {
          const newProjs = [...projs]
          newProjs.splice(idx + 1, 0, extracted!)
          return newProjs
        }
        return projs.map((p) => ({
          ...p,
          subprojects: p.subprojects ? insertAfter(p.subprojects) : []
        }))
      }
      setProjects(insertAfter(cleaned))
    },
    [setProjects]
  )

  const performProjectDropInside = useCallback(
    (sourceProjectId: string, targetProjectId: string): void => {
      const { projects: cleaned, extracted } = removeProjectFromTree(
        [...projectsRef.current],
        sourceProjectId
      )
      if (!extracted) return
      const insertInto = (projs: Project[]): Project[] => {
        return projs.map((p) => {
          if (p.id === targetProjectId)
            return { ...p, isExpanded: true, subprojects: [...(p.subprojects || []), extracted!] }
          if (p.subprojects && p.subprojects.length > 0)
            return { ...p, subprojects: insertInto(p.subprojects) }
          return p
        })
      }
      setProjects(insertInto(cleaned))
    },
    [setProjects]
  )

  const findTaskTextById = useCallback((taskId: string): string | null => {
    const searchTasks = (tasks: TaskItem[]): string | null => {
      for (const t of tasks) {
        if (t.id === taskId) return t.text
        if (t.subtasks) {
          const found = searchTasks(t.subtasks)
          if (found) return found
        }
      }
      return null
    }
    for (const p of projectsRef.current) {
      const found = searchTasks(p.tasks || [])
      if (found) return found
      const searchInSubprojects = (subs: Project[] | undefined): string | null => {
        if (!subs) return null
        for (const sub of subs) {
          const f = searchTasks(sub.tasks || [])
          if (f) return f
          const deeper = searchInSubprojects(sub.subprojects)
          if (deeper) return deeper
        }
        return null
      }
      const subResult = searchInSubprojects(p.subprojects)
      if (subResult) return subResult
    }
    return null
  }, [])

  const finishDrag = useCallback((): void => {
    const source = dragDataRef.current
    const target = dropTargetRef.current
    dragDataRef.current = null
    dropTargetRef.current = null
    setDropIndicator(null)
    setIsDragging(null)

    document
      .querySelectorAll('.timer-card.drag-over-timer')
      .forEach((el) => el.classList.remove('drag-over-timer'))
    document
      .querySelectorAll('.timeline-add-btn.drag-over-btn')
      .forEach((el) => el.classList.remove('drag-over-btn'))

    if (!source) return

    if (target && target.action === 'timeline' && target.timelineDate) {
      const taskText = findTaskTextById(source.taskId)
      if (taskText) {
        const customEvent = new CustomEvent('task-dropped-on-timeline', {
          detail: {
            date: target.timelineDate,
            projectId: target.projectId,
            taskText,
            taskId: source.taskId
          }
        })
        window.dispatchEvent(customEvent)
      }
      return
    }

    if (target && target.action === 'timer' && target.timerId) {
      const taskText = findTaskTextById(source.taskId)
      if (taskText && onAssignTaskToTimer) onAssignTaskToTimer(target.timerId, taskText)
      return
    }

    if (target && target.action === 'alarm' && target.alarmId) {
      const taskText = findTaskTextById(source.taskId)
      if (taskText && onAssignTaskToAlarm) onAssignTaskToAlarm(target.alarmId, taskText)
      return
    }

    if (!target) return

    if (source.type === 'project') {
      if (target.projectIdTarget && source.projectId === target.projectIdTarget) return
      if (target.action === 'before' && target.projectIdTarget)
        performProjectDropBefore(source.projectId, target.projectIdTarget)
      else if (target.action === 'after' && target.projectIdTarget)
        performProjectDropAfter(source.projectId, target.projectIdTarget)
      else if (target.action === 'inside' && target.projectIdTarget)
        performProjectDropInside(source.projectId, target.projectIdTarget)
      return
    }

    if (target.action === 'before' && target.taskId)
      performDropBefore(source.taskId, target.projectId, target.taskId)
    else if (target.action === 'after' && target.taskId)
      performDropAfter(source.taskId, target.projectId, target.taskId)
    else if (target.action === 'inside' && target.taskId)
      performDropInside(source.taskId, target.projectId, target.taskId)
    else if (target.action === 'project') performDropOnProject(source.taskId, target.projectId)
  }, [
    findTaskTextById,
    onAssignTaskToTimer,
    onAssignTaskToAlarm,
    performProjectDropBefore,
    performProjectDropAfter,
    performProjectDropInside,
    performDropBefore,
    performDropAfter,
    performDropInside,
    performDropOnProject,
    setIsDragging
  ])

  const startMouseDrag = useCallback(
    (
      e: React.MouseEvent,
      idOrData: string | { type: 'task' | 'project'; projectId: string; taskId: string }
    ): void => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()

      let dragData: { type: 'task' | 'project'; projectId: string; taskId: string }
      if (typeof idOrData === 'string') {
        dragData = { type: 'project', projectId: idOrData, taskId: '' }
      } else {
        dragData = idOrData
      }

      dragDataRef.current = dragData
      setIsDragging(dragData.type === 'project' ? dragData.projectId : dragData.taskId)

      const handleMouseMove = (ev: MouseEvent): void => {
        const el = document.elementFromPoint(ev.clientX, ev.clientY)
        if (!el) {
          dropTargetRef.current = null
          setDropIndicator(null)
          return
        }

        // Check for DropZone
        const dz = el.closest('[data-dropzone]') as HTMLElement | null
        if (dz) {
          const action = dz.dataset.dzAction as 'inside' | 'project'
          const projectId = dz.dataset.dzProject || ''
          const taskId = dz.dataset.dzTask || undefined
          dropTargetRef.current = { action, projectId, taskId: taskId || undefined }
          setDropIndicator(null)
          return
        }

        const dragData = dragDataRef.current
        if (!dragData) return

        // Check for project item
        const projectItem = el.closest('[data-project-id]') as HTMLElement | null
        if (projectItem && dragData.type === 'project') {
          const targetProjectId = projectItem.dataset.projectId || ''
          if (targetProjectId === dragData.projectId) {
            dropTargetRef.current = null
            setDropIndicator(null)
            return
          }

          const rect = projectItem.getBoundingClientRect()
          const ratio = (ev.clientY - rect.top) / rect.height
          let pos: 'before' | 'inside' | 'after'
          if (ratio < 0.25) pos = 'before'
          else if (ratio > 0.75) pos = 'after'
          else pos = 'inside'

          dropTargetRef.current = {
            action: pos,
            projectId: targetProjectId,
            projectIdTarget: targetProjectId,
            type: 'project'
          }

          setDropIndicator({ id: targetProjectId, position: pos, type: 'project' })
          return
        }

        // Check for task card
        const taskCard = el.closest('[data-task-id]') as HTMLElement | null
        if (taskCard) {
          const targetTaskId = taskCard.dataset.taskId || ''
          const targetProjectId = taskCard.dataset.projectId || ''
          const targetDepth = parseInt(taskCard.dataset.depth || '0', 10)

          if (dragData.type === 'task' && targetTaskId === dragData.taskId) {
            dropTargetRef.current = null
            setDropIndicator(null)
            return
          }

          const rect = taskCard.getBoundingClientRect()
          const ratio = (ev.clientY - rect.top) / rect.height
          let pos: 'before' | 'inside' | 'after'
          if (ratio < 0.25) pos = 'before'
          else if (ratio > 0.75) pos = 'after'
          else if (targetDepth < 2) pos = 'inside'
          else pos = 'before'

          dropTargetRef.current = {
            action: pos,
            projectId: targetProjectId,
            taskId: targetTaskId,
            type: 'task'
          }
          setDropIndicator({ id: targetTaskId, position: pos, type: 'task' })
          return
        }

        // Check for project-tasks container
        const projectContainer = el.closest('[data-project-container]') as HTMLElement | null
        if (projectContainer && dragData.type === 'task') {
          const projectId = projectContainer.dataset.projectContainer || ''
          dropTargetRef.current = { action: 'project', projectId, type: 'task' }
          setDropIndicator(null)
          return
        }

        // Check for timer card
        const timerCard = el.closest('.timer-card') as HTMLElement | null
        if (timerCard && dragData.type === 'task') {
          // Determine if it's an alarm card or a standard timer
          const alarmId = timerCard.dataset.alarmId
          const timerId = timerCard.dataset.timerId

          if (alarmId) {
            dropTargetRef.current = {
              action: 'alarm',
              projectId: '',
              taskId: undefined,
              alarmId: alarmId,
              type: 'task'
            }
          } else if (timerId) {
            dropTargetRef.current = {
              action: 'timer',
              projectId: '',
              taskId: undefined,
              timerId: timerId,
              type: 'task'
            }
          }

          setDropIndicator(null)
          document.querySelectorAll('.timer-card.drag-over-timer, .timer-card.drag-over-alarm').forEach((tc) => {
            tc.classList.remove('drag-over-timer', 'drag-over-alarm')
          })

          if (alarmId) {
            timerCard.classList.add('drag-over-alarm')
          } else {
            timerCard.classList.add('drag-over-timer')
          }

          document.querySelectorAll('.timeline-add-btn.drag-over-btn').forEach((tc) => {
            tc.classList.remove('drag-over-btn')
          })
          return
        }

        // Check for timeline cell add button
        const timelineAddBtn = el.closest('.timeline-add-btn') as HTMLElement | null
        if (timelineAddBtn && dragData.type === 'task') {
          const tdCell = timelineAddBtn.closest('td.timeline-cell') as HTMLElement | null
          if (tdCell) {
            const projectId = tdCell.dataset.projectId || ''
            const date = tdCell.dataset.date || ''

            if (projectId !== dragData.projectId) {
              dropTargetRef.current = null
              setDropIndicator(null)
              document
                .querySelectorAll('.timeline-add-btn.drag-over-btn, .timeline-add-btn.drag-over-invalid')
                .forEach((tc) => {
                  tc.classList.remove('drag-over-btn', 'drag-over-invalid')
                })
              timelineAddBtn.classList.add('drag-over-invalid')
              document.querySelectorAll('.timer-card.drag-over-timer').forEach((tc) => {
                tc.classList.remove('drag-over-timer')
              })
              return
            }

            dropTargetRef.current = {
              action: 'timeline',
              projectId,
              timelineDate: date,
              type: 'task'
            }
            setDropIndicator(null)
            document
              .querySelectorAll('.timeline-add-btn.drag-over-btn, .timeline-add-btn.drag-over-invalid')
              .forEach((tc) => {
                tc.classList.remove('drag-over-btn', 'drag-over-invalid')
              })
            timelineAddBtn.classList.add('drag-over-btn')
            document.querySelectorAll('.timer-card.drag-over-timer').forEach((tc) => {
              tc.classList.remove('drag-over-timer')
            })
            return
          }
        }

        // Remove highlights if not over a target
        document.querySelectorAll('.timer-card.drag-over-timer').forEach((tc) => {
          tc.classList.remove('drag-over-timer')
        })
        document
          .querySelectorAll('.timeline-add-btn.drag-over-btn, .timeline-add-btn.drag-over-invalid')
          .forEach((tc) => {
            tc.classList.remove('drag-over-btn', 'drag-over-invalid')
          })

        dropTargetRef.current = null
        setDropIndicator(null)
      }

      const handleMouseUp = (): void => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        finishDrag()
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'
    },
    [finishDrag, setIsDragging]
  )


  return (
    <>
      <div className={`task-sidebar ${isOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-content">
          <div
            className="sidebar-block has-resizer-after"
            style={{
              flex: '1 1 0%',
              display: 'flex',
              flexDirection: 'column',
              minHeight: '100px',
              transition: (isResizingSidebar || isInitialLoading) ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                padding: '0',
                flexShrink: 0,
                position: 'relative',
                zIndex: 10,
                overflow: 'visible',
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0',
                  padding: isOpen ? '16px' : '12px 0',
                  flexShrink: 0
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: isOpen ? 1 : 'none', justifyContent: isOpen ? 'flex-start' : 'center', width: isOpen ? 'auto' : '100%' }}>
                  {isOpen ? (
                    <h3 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', opacity: 0.5, margin: 0, fontWeight: 700, paddingLeft: '4px' }}>
                      Projects
                    </h3>
                  ) : (
                    <div
                      className="sidebar-header-icon"
                      title="Projects"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        height: '26px',
                        color: 'var(--text-secondary)',
                        opacity: 0.8
                      }}
                    >
                      <Folder size={18} />
                    </div>
                  )}
                </div>
                {isOpen && (
                  <button
                    onClick={async () => {
                      const result = await handleAddProject('New Project')
                      if (result) {
                        startEditing(result.id, result.name)
                      }
                    }}
                    className="task-add-btn premium-sidebar-btn"
                    title="Add Project"
                    style={{
                      width: '26px',
                      height: '26px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'none',
                      border: 'none',
                      borderRadius: '6px',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
              <div
                className="task-list custom-scrollbar"
                style={{
                  marginBottom: isOpen ? '8px' : '16px',
                  flex: 1,
                  minHeight: 0,
                  maxHeight: 'none',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  scrollbarGutter: 'stable',
                  padding: isOpen ? '0 12px' : '0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isOpen ? 'stretch' : 'center',
                  transition: (isResizingSidebar || isInitialLoading) ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                {projects.length === 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      padding: '24px 20px',
                      color: 'var(--text-secondary)',
                      opacity: 0.3,
                      fontSize: '11px',
                      fontStyle: 'italic'
                    }}
                  >
                    No projects planned
                  </div>
                ) : (
                  projects.map((project) => (
                    <ProjectItem
                      key={project.id}
                      project={project}
                      level={0}
                      selectedProjectId={selectedProjectId}
                      setSelectedProjectId={setSelectedProjectId}
                      editingId={editingId}
                      editingValue={editingValue}
                      setEditingValue={setEditingValue}
                      saveProjectName={saveProjectName}
                      saveTaskName={saveTaskName}
                      cancelEditing={cancelEditing}
                      activeDropdown={activeDropdown}
                      setActiveDropdown={setActiveDropdown}
                      updateProjectColor={updateProjectColor}
                      startEditing={startEditing}
                      deleteProject={handleDeleteProject}
                      toggleProjectExpansion={toggleProjectExpansion}
                      addSubProject={addSubProject}
                      quickAddTask={quickAddTask}
                      onDragStart={startMouseDrag}
                      dropIndicator={dropIndicator}
                      isDragging={isDragging}
                      openColorPickerFor={openColorPickerFor}
                      showTaskCounts={showTaskCounts}
                      showColoredDots={showColoredDots}
                      isOpen={isOpen}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          <div
            className={`sidebar-resizer projects-resizer is-resizable ${isResizingSidebar ? 'is-resizing' : ''}`}
            style={{
              height: '12px',
              marginTop: '-6px',
              marginBottom: '-6px',
              cursor: 'row-resize',
              zIndex: 10,
              position: 'relative',
              background: 'transparent'
            }}
            onMouseDown={(e) => {
              e.preventDefault()
              setResizeStartY(e.clientY)
              setResizeStartHeight(projectsHeight)
              setIsResizingSidebar(true)
            }}
          />
          <div
            ref={detailBlockRef}
            className="sidebar-block detail-block"
            style={{
              height: `${projectsHeight}px`,
              display: 'flex',
              flexDirection: 'column',
              transition: (isResizingSidebar || isResizingTasks || isInitialLoading) ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              overflow: 'hidden',
              paddingBottom: '0px',
              flexShrink: 0
            }}
          >
            {selectedProject ? (
              <>
                {/* --- TASKS SECTION --- */}
                <div className="sidebar-section-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: isOpen ? 'auto' : '100%', justifyContent: isOpen ? 'flex-start' : 'center' }}>
                    {isOpen ? (
                      <h3>
                        {isArchiveView ? 'Archive' : 'Temp Tasks'}
                      </h3>
                    ) : (
                      <div
                        className="sidebar-header-icon"
                        title={isArchiveView ? 'Archive' : 'Tasks'}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '100%',
                          height: '26px',
                          color: 'var(--text-secondary)',
                          opacity: 0.8
                        }}
                      >
                        {isArchiveView ? <Archive size={18} /> : <CheckSquare size={18} />}
                      </div>
                    )}
                  </div>
                  {isOpen && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        onClick={() => {
                          setIsArchiveView(!isArchiveView)
                        }}
                        className={`premium-sidebar-btn ${isArchiveView ? 'active' : ''}`}
                        title={isArchiveView ? 'View Active Tasks' : 'View Archive'}
                        style={{
                          width: '26px',
                          height: '26px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isArchiveView ? 'rgba(255,255,255,0.1)' : 'none',
                          border: 'none',
                          borderRadius: '6px',
                          color: isArchiveView ? 'var(--text-primary)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          padding: 0
                        }}
                      >
                        <Archive size={14} />
                      </button>
                      {isArchiveView ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            clearArchive(selectedProject.id)
                          }}
                          className="premium-sidebar-btn"
                          title="Clear Archive"
                          style={{
                            width: '26px',
                            height: '26px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'none',
                            border: 'none',
                            borderRadius: '6px',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            padding: 0
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (isTasksExpanded) quickAddTask(selectedProject.id)
                          }}
                          className="task-add-btn premium-sidebar-btn"
                          title="Add Task"
                          disabled={!isTasksExpanded}
                          style={{
                            width: '26px',
                            height: '26px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'none',
                            border: 'none',
                            borderRadius: '6px',
                            color: 'var(--text-secondary)',
                            cursor: isTasksExpanded ? 'pointer' : 'default',
                            transition: 'all 0.2s ease',
                            padding: 0,
                            opacity: isTasksExpanded ? 1 : 0.3,
                            pointerEvents: isTasksExpanded ? 'auto' : 'none'
                          }}
                        >
                          <Plus size={14} />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setIsTransitioning(true)

                          // If collapsing Tasks AND Events is already collapsed, Projects will expand
                          if (isTasksExpanded && !isEventsExpanded && detailBlockRef.current) {
                            // This is handled by projectsHeight transition if we set it
                            setProjectsHeight(window.innerHeight - 150)
                          } else if (!isTasksExpanded) {
                            // If re-expanding tasks, set a reasonable project height first
                            setProjectsHeight(Math.min(projectsHeight, 400))
                          }

                          setIsTasksExpanded(!isTasksExpanded)
                          setTimeout(() => setIsTransitioning(false), 300)
                        }}
                        className="premium-sidebar-btn"
                        title={isTasksExpanded ? 'Collapse Tasks' : 'Expand Tasks'}
                        style={{
                          width: '26px',
                          height: '26px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'none',
                          border: 'none',
                          borderRadius: '6px',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          padding: 0
                        }}
                      >
                        {isTasksExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    </div>
                  )}
                </div>

                {isTasksExpanded && (
                  <div
                    className="tasks-list custom-scrollbar"
                    style={{
                      flex: isEventsExpanded ? `0 1 ${tasksHeight}px` : '1 1 0px',
                      padding: '0 12px 20px 12px',
                      gap: '8px',
                      transition: (isResizingTasks || isInitialLoading)
                        ? 'none'
                        : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      opacity: 1,
                      pointerEvents: 'all'
                    }}
                  >
                    <TaskTree
                      project={selectedProject}
                      isRoot={true}
                      isArchiveView={isArchiveView}
                      toggleTask={toggleTask}
                      toggleTaskExpansion={toggleTaskExpansion}
                      editingId={editingId}
                      editingValue={editingValue}
                      setEditingValue={setEditingValue}
                      saveTaskName={saveTaskName}
                      cancelEditing={cancelEditing}
                      startEditing={startEditing}
                      deleteTask={deleteTask}
                      getTaskTimelineDate={getTaskTimelineDate}
                      onTaskAdded={onTaskAdded}
                      isDragging={isDragging}
                      dropIndicator={dropIndicator}
                      startMouseDrag={startMouseDrag}
                      showTaskCounts={showTaskCounts}
                    />
                    {(!selectedProject.tasks || selectedProject.tasks.length === 0) && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          padding: '12px 20px',
                          color: 'var(--text-secondary)',
                          opacity: 0.3,
                          fontSize: '11px',
                          fontStyle: 'italic'
                        }}
                      >
                        No tasks planned
                      </div>
                    )}
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: isEventsExpanded ? '80px' : (isOpen ? '40px' : '65px'),
                    flex: isEventsExpanded ? '1 1 auto' : '0 0 auto',
                    transition: (isResizingTasks || isInitialLoading) ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    overflow: 'visible'
                  }}
                >
                  {/* --- TASKS RESIZER --- */}
                  {isTasksExpanded && isEventsExpanded && (
                    <div
                      className="sidebar-resizer"
                      style={{
                        height: '12px',
                        marginTop: '-6px',
                        marginBottom: '-6px',
                        cursor: 'row-resize',
                        zIndex: 10,
                        position: 'relative',
                        background: 'transparent'
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setResizeTasksStartY(e.clientY)
                        setResizeTasksStartHeight(tasksHeight)
                        setIsResizingTasks(true)
                      }}
                    />
                  )}

                  {/* --- EVENTS SECTION --- */}
                  <div className="sidebar-section-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: isOpen ? 'auto' : '100%', justifyContent: isOpen ? 'flex-start' : 'center' }}>
                      {isOpen ? (
                        <h3>
                          Events
                        </h3>
                      ) : (
                        <div
                          className="sidebar-header-icon"
                          title="Events"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            height: '26px',
                            color: 'var(--text-secondary)',
                            opacity: 0.8
                          }}
                        >
                          <CalendarIcon size={18} />
                        </div>
                      )}
                    </div>
                    {isOpen && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (isEventsExpanded) quickAddEvent(selectedProject.id)
                          }}
                          className="event-add-btn premium-sidebar-btn"
                          title="Add Event"
                          disabled={!isEventsExpanded}
                          style={{
                            width: '26px',
                            height: '26px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'none',
                            border: 'none',
                            borderRadius: '6px',
                            color: 'var(--text-secondary)',
                            cursor: isEventsExpanded ? 'pointer' : 'default',
                            transition: 'all 0.2s ease',
                            padding: 0,
                            opacity: isEventsExpanded ? 1 : 0.3,
                            pointerEvents: isEventsExpanded ? 'auto' : 'none'
                          }}
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setIsTransitioning(true)

                            // If collapsing Events, Tasks should expand to the full height
                            if (isEventsExpanded && detailBlockRef.current) {
                              const containerHeight = detailBlockRef.current.getBoundingClientRect().height
                              setTasksHeight(containerHeight - 50)
                            } else if (!isEventsExpanded && detailBlockRef.current) {
                              // If expanding Events, we need to ensure the starting height is correct
                              // so it can animate back from "full" to its share
                              const containerHeight = detailBlockRef.current.getBoundingClientRect().height
                              setTasksHeight(containerHeight - 50)
                              // We'll let the next frame or the natural flex-basis take over
                              // Actually, let's just set it to a reasonable split like 50/50 for a moment
                              setTimeout(() => setTasksHeight(Math.min(350, (containerHeight - 100))), 10);
                            }

                            setIsEventsExpanded(!isEventsExpanded)
                            setTimeout(() => setIsTransitioning(false), 300)
                          }}
                          className="premium-sidebar-btn"
                          title={isEventsExpanded ? 'Collapse Events' : 'Expand Events'}
                          style={{
                            width: '26px',
                            height: '26px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'none',
                            border: 'none',
                            borderRadius: '6px',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            padding: 0
                          }}
                        >
                          {isEventsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </div>
                    )}
                  </div>

                  {isEventsExpanded && (
                    <div
                      className="events-list custom-scrollbar"
                      style={{
                        flex: '1 1 0px',
                        padding: '0 12px 24px 12px',
                        gap: '10px',
                        transition: (isResizingTasks || isInitialLoading)
                          ? 'none'
                          : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        opacity: 1,
                        pointerEvents: 'all'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0 }}>
                        {selectedProject.events?.map((event) => (
                          <EventItem
                            key={event.id}
                            event={event}
                            selectedProjectId={selectedProject.id}
                            editingId={editingId}
                            editingValue={editingValue}
                            cancelEditing={cancelEditing}
                            deleteEvent={handleDeleteEvent}
                            updateEvent={handleUpdateEvent}
                            setEditingValue={setEditingValue}
                            saveEventName={saveEventName}
                            isExpanded={expandedEventId === event.id}
                            setExpandedEventId={setExpandedEventId}
                            projectColor={selectedProject.color}
                          />
                        ))}
                        {(!selectedProject.events || selectedProject.events.length === 0) && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textAlign: 'center',
                              padding: '12px 20px',
                              color: 'var(--text-secondary)',
                              opacity: 0.3,
                              fontSize: '11px',
                              fontStyle: 'italic'
                            }}
                          >
                            No events planned
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: 'var(--text-secondary)',
                  opacity: 0.5,
                  fontSize: '13px'
                }}
              >
                Select a project to view tasks & events
              </div>
            )}
          </div>
        </div>
      </div>

      {colorPickerState && (
        <ColorPicker
          anchorRect={colorPickerState.anchorRect}
          onClose={() => setColorPickerState(null)}
          onChange={handleColorChange}
          color={
            projects.find((p) => p.id === colorPickerState.projectId)?.color || 'var(--accent)'
          }
        />
      )}

      {/* DRAG PREVIEW (Simple dot/indicator) */}
      {isDragging && (
        <div
          style={{
            position: 'fixed',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--accent)',
            pointerEvents: 'none',
            zIndex: 10000,
            boxShadow: '0 0 10px var(--accent)',
            left: 'var(--drag-x)',
            top: 'var(--drag-y)',
            transform: 'translate(-50%, -50%)'
          }}
          ref={(el): void => {
            if (el) {
              const handleMove = (ev: MouseEvent): void => {
                el.style.setProperty('--drag-x', `${ev.clientX}px`)
                el.style.setProperty('--drag-y', `${ev.clientY}px`)
              }
              document.addEventListener('mousemove', handleMove)
            }
          }}
        />
      )}
    </>
  )
})
