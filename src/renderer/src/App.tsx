import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  PlusCircle,
  Timer as TimerIcon,
  Pin,
  PanelLeft,
  User,
  X as CloseIcon,
  Minus as MinimizeIcon,
  Maximize2 as MaximizeIcon,
  Search
} from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import TimerCard from './components/TimerCard'
import TaskSidebar from './components/sidebar/TaskSidebar'
import MiniTimer from './components/MiniTimer'
import CalendarView from './components/CalendarView'
import NotesView from './components/NotesView'
import WelcomeScreen from './components/WelcomeScreen'
import SettingsModal from './components/SettingsModal'
import WindowResizeHandles from './components/WindowResizeHandles'
import ProjectOverview from './components/ProjectOverview'
import PipelineView from './components/PipelineView'
import NotificationCenter from './components/NotificationCenter'
import GlobalSearchModal from './components/GlobalSearchModal'
import AlarmCard from './components/AlarmCard'
import { Bell } from 'lucide-react'

import {
  TimerData,
  AlarmData,
  TimelineTask,
  AppNote,
  UITheme,
  Project,
  TaskItem,
  AppEvent,
  AppNotification,
  DEFAULT_THEME
} from './types'

function HeaderTimer({ currentView }: { currentView: string }) {
  const [activeTimers, setActiveTimers] = useState<Record<string, any>>({})

  useEffect(() => {
    // @ts-ignore
    const cleanup = window.api.onSyncTimerState((id: string, state: any) => {
      setActiveTimers((prev) => {
        if (!state.isRunning && !state.isFinished && !state.isPinned) {
          const newMap = { ...prev }
          delete newMap[id]
          return newMap
        }
        return { ...prev, [id]: { ...state, id } }
      })
    })
    return cleanup
  }, [])

  // 1. Find the first timer that is MANUALLY pinned to header
  // If we are in 'clock' view, we don't show it as requested
  if (currentView === 'clock') return null

  const pinnedTimer = Object.values(activeTimers)
    .filter((t) => t.isHeaderPinned)
    .sort((a, b) => b.timeLeft - a.timeLeft)[0]

  if (!pinnedTimer) return null

  const displayHours = Math.floor(pinnedTimer.timeLeft / 3600)
  const displayMinutes = Math.floor((pinnedTimer.timeLeft % 3600) / 60)
  const displaySeconds = pinnedTimer.timeLeft % 60
  const pad = (num: number) => num.toString().padStart(2, '0')

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '0',
        background: 'transparent',
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--text-secondary)',
        marginRight: '12px',
        cursor: 'default',
        userSelect: 'none',
        zIndex: 1000,
        transition: 'all 0.3s'
      }}
    >
      <TimerIcon size={14} style={{ opacity: 0.7 }} />
      <span style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '0.2px' }}>
        {displayHours > 0 ? `${pad(displayHours)}:` : ''}
        {pad(displayMinutes)}:{pad(displaySeconds)}
      </span>
      {pinnedTimer.taskName && (
        <span
          style={{
            opacity: 0.5,
            maxWidth: '100px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '11px',
            marginLeft: '4px'
          }}
        >
          • {pinnedTimer.taskName}
        </span>
      )}
    </div>
  )
}

function App() {
  const [timers, setTimers] = useState<TimerData[]>([])
  const [alarms, setAlarms] = useState<AlarmData[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [timelineTasks, setTimelineTasks] = useState<TimelineTask[]>([])
  const [notes, setNotes] = useState<AppNote[]>([])
  const [theme, setTheme] = useState<UITheme>(() => {
    try {
      const raw = localStorage.getItem('cluster-ui-theme-cache')
      if (raw) {
        const cached = JSON.parse(raw) as UITheme
        // Merge with defaults so any missing keys fall back gracefully
        return { ...DEFAULT_THEME, ...cached }
      }
    } catch { /* ignore */ }
    return DEFAULT_THEME
  })
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<
    'overview' | 'clock' | 'timeline' | 'notes' | 'pipeline'
  >('overview')
  const [showSettings, setShowSettings] = useState(false)
  const [showFPS, setShowFPS] = useState(false)
  const [showTaskCounts, setShowTaskCounts] = useState(false)
  const [showColoredDots, setShowColoredDots] = useState(() => {
    try {
      const v = localStorage.getItem('cluster-ui-colored-dots')
      if (v !== null) return JSON.parse(v)
    } catch { /* ignore */ }
    return false
  })
  const [useGPU, setUseGPU] = useState(true)
  const [workspacePath, setWorkspacePath] = useState<string | null>(null)
  const [workspaceAvatarMap, setWorkspaceAvatarMap] = useState<Record<string, string>>({})
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(true)
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false)
  const [timerVolume, setTimerVolume] = useState<number>(0.5)
  const [previousWorkspacePath, setPreviousWorkspacePath] = useState<string | null>(null)
  const [hiddenTimelineProjectIds, setHiddenTimelineProjectIds] = useState<string[]>([])
  const [backupIntervalMinutes, setBackupIntervalMinutes] = useState(10)
  const [boardBackupIntervalMinutes, setBoardBackupIntervalMinutes] = useState(10)
  const [enableBoardBackups, setEnableBoardBackups] = useState(true)
  const [enableBoardAutosave, setEnableBoardAutosave] = useState(false)
  const [calendarTimezone, setCalendarTimezone] = useState(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return 'UTC' }
  })
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)

  // Undo implementation
  const [, setHistory] = useState<{ projects: Project[]; timelineTasks: TimelineTask[] }[]>([])

  // Use refs to always capture latest state for history snapshots
  const projectsRef = useRef(projects)
  const timelineTasksRef = useRef(timelineTasks)
  const focusedAreaRef = useRef<'app' | 'board' | 'notes'>('app')
  const notificationRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    projectsRef.current = projects
  }, [projects])

  useEffect(() => {
    timelineTasksRef.current = timelineTasks
  }, [timelineTasks])

  const pushToHistory = useCallback(() => {
    setHistory((prev) => {
      // Keep only last 30 states
      const newHistory = [
        ...prev,
        {
          projects: JSON.parse(JSON.stringify(projectsRef.current)),
          timelineTasks: [...timelineTasksRef.current]
        }
      ]
      if (newHistory.length > 30) return newHistory.slice(1)
      return newHistory
    })
  }, [])

  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev
      const lastState = prev[prev.length - 1]
      const newHistory = prev.slice(0, -1)

      // Apply the state
      setProjects(lastState.projects)
      setTimelineTasks(lastState.timelineTasks)

      return newHistory
    })
  }, [])

  const handleSyncWorkspaceEvents = async () => {
    if (isSyncingCalendar) return
    setIsSyncingCalendar(true)
    
    // Check if auth is valid
    const authStatus = await (window as any).api.checkGoogleAuth()
    if (!authStatus) {
      alert('Please connect your Google Account in Settings -> Sync & Integrations first.')
      setIsSyncingCalendar(false)
      return
    }

    // Sync all un-archived projects
    let currentProjects = JSON.parse(JSON.stringify(projectsRef.current))
    
    const syncRecursive = async (projs: any[]) => {
      for (const project of projs) {
         // Sync any project that has a name (to match with calendar)
         // Even if project.events is empty, we want to pull events from Google
         if (project.id) {
            try {
               const resolvedEvents = await (window as any).api.syncProjectEvents(project.id, project.name, project.events || [])
               if (Array.isArray(resolvedEvents)) {
                 console.log(`[Sync] Project "${project.name}" synced. Events count: ${resolvedEvents.length}`)
                 project.events = resolvedEvents
               } else {
                 console.warn(`[Sync] Project "${project.name}" returned non-array result:`, resolvedEvents)
               }
            } catch(e) {
               console.error(`Failed to sync calendar events for project ${project.id}`, e)
            }
         }
         if (project.subprojects && project.subprojects.length > 0) {
            await syncRecursive(project.subprojects)
         }
      }
    }
    
    await syncRecursive(currentProjects)
    
    // Update state to trigger JSON save automatically if we hooked it to projects
    setProjects(currentProjects)
    setIsSyncingCalendar(false)
  }

  // Click outside notifications to close
  useEffect(() => {
    if (!showNotifications) return

    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showNotifications])

  const allProjects = useMemo((): Project[] => {
    const flat: Project[] = []
    const traverse = (projs: Project[], depth = 0): void => {
      projs.forEach((p) => {
        flat.push({ ...p, depth })
        if (p.subprojects) traverse(p.subprojects, depth + 1)
      })
    }
    traverse(projects)
    return flat
  }, [projects])

  const selectedProject = useMemo((): Project | undefined => {
    return allProjects.find((p) => p.id === selectedProjectId)
  }, [allProjects, selectedProjectId])

  const getUniqueProjectName = (baseName: string, currentProjects: Project[]): string => {
    const allNames = new Set<string>()
    const traverse = (projs: Project[]): void => {
      projs.forEach((p) => {
        allNames.add(p.name.toLowerCase())
        if (p.subprojects) traverse(p.subprojects)
      })
    }
    traverse(currentProjects)

    let name = baseName
    let counter = 1
    while (allNames.has(name.toLowerCase())) {
      name = `${baseName} ${counter}`
      counter++
    }
    return name
  }

  const addProject = async (
    name: string,
    parentId?: string
  ): Promise<{ id: string; name: string } | undefined> => {
    pushToHistory()
    const newId = uuidv4()

    let basePath = workspacePath
    let parentColor = '#969696'

    if (parentId) {
      const parent = allProjects.find((p) => p.id === parentId)
      if (parent && parent.path) {
        basePath = parent.path
        parentColor = parent.color || parentColor
      }
    }

    if (!basePath) return

    const uniqueName = getUniqueProjectName(name, projects)

    // Initialize project folder via IPC
    const projectPath = await (window as any).api.initProjectFolder(basePath, uniqueName)
    const finalName = projectPath ? projectPath.split(/[/\\]/).pop() || uniqueName : uniqueName
    const notesPath = projectPath ? projectPath + '/notes' : ''
    const boardsPath = projectPath ? projectPath + '/boards' : ''

    const newProject: Project = {
      id: newId,
      name: finalName,
      isExpanded: true,
      tasks: [],
      path: projectPath || '',
      notesPath: notesPath,
      boardsPath: boardsPath,
      color: parentId ? parentColor : undefined,
      subprojects: []
    }

    setProjects((prev) => {
      if (!parentId) {
        return [...prev, newProject]
      }
      const updateRecursive = (projs: Project[]): Project[] => {
        return projs.map((p) => {
          if (p.id === parentId) {
            return {
              ...p,
              isExpanded: true,
              subprojects: [...(p.subprojects || []), newProject]
            }
          }
          if (p.subprojects) {
            return { ...p, subprojects: updateRecursive(p.subprojects) }
          }
          return p
        })
      }
      return updateRecursive(prev)
    })

    setSelectedProjectId(newId)
    return { id: newId, name: finalName }
  }

  const onAddProjectItem = (
    projectId: string,
    text: string,
    parentId?: string,
    forceId?: string
  ) => {
    pushToHistory()
    const newItem: TaskItem = {
      id: forceId || uuidv4(),
      text,
      completed: false,
      isExpanded: false,
      subtasks: []
    }

    const updateTasksRecursive = (tasks: TaskItem[]): TaskItem[] => {
      if (!parentId) {
        return [...tasks, newItem]
      }
      return tasks.map((task) => {
        if (task.id === parentId) {
          return {
            ...task,
            isExpanded: true,
            subtasks: [...(task.subtasks || []), newItem]
          }
        }
        if (task.subtasks && task.subtasks.length > 0) {
          return { ...task, subtasks: updateTasksRecursive(task.subtasks) }
        }
        return task
      })
    }

    const updateProjectsRecursive = (projs: Project[]): Project[] => {
      return projs.map((p) => {
        if (p.id === projectId) {
          return { ...p, tasks: updateTasksRecursive(p.tasks) }
        }
        if (p.subprojects) {
          return { ...p, subprojects: updateProjectsRecursive(p.subprojects) }
        }
        return p
      })
    }

    setProjects((prev) => updateProjectsRecursive(prev))
  }

  const deleteProject = (id: string) => {
    pushToHistory()

    const findProject = (projs: Project[], targetId: string): Project | undefined => {
      for (const p of projs) {
        if (p.id === targetId) return p
        if (p.subprojects) {
          const found = findProject(p.subprojects, targetId)
          if (found) return found
        }
      }
      return undefined
    }

    const projectToDelete = findProject(projects, id)
    if (projectToDelete?.path) {
      ; (window as any).api.deleteProjectFolder(projectToDelete.path)
    }

    const deleteRecursive = (projs: Project[]): Project[] => {
      return projs
        .filter((p) => p.id !== id)
        .map((p) => {
          if (p.subprojects) {
            return { ...p, subprojects: deleteRecursive(p.subprojects) }
          }
          return p
        })
    }
    setProjects((prev) => deleteRecursive(prev))
    if (selectedProjectId === id) setSelectedProjectId(null)
    setTimelineTasks((prev) => prev.filter((t) => t.projectId !== id))
  }

  const updateProject = (projectId: string, updates: Partial<Project>) => {
    pushToHistory()
    const updateRecursive = (projs: Project[]): Project[] => {
      return projs.map((p) => {
        if (p.id === projectId) return { ...p, ...updates }
        if (p.subprojects) return { ...p, subprojects: updateRecursive(p.subprojects) }
        return p
      })
    }
    setProjects((prev) => updateRecursive(prev))
  }

  const loadData = useCallback(async () => {
    const api = (window as any).api
    // Load avatars in background; avatar loading must not block app bootstrap.
    Promise.resolve(api.getStoreValue('workspace-avatar-map'))
      .then((storedAvatarMap: unknown) => {
        if (storedAvatarMap && typeof storedAvatarMap === 'object') {
          setWorkspaceAvatarMap(storedAvatarMap as Record<string, string>)
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to load workspace avatars from store:', error)
      })
    const savedWorkspace = await api.getStoreValue('workspace-path')
    if (savedWorkspace) {
      setWorkspacePath(savedWorkspace)

      // Try reading data from workspace file
      const workspaceFile = savedWorkspace + '/workspace_data.json'
      const workspaceData = await api.readWorkspaceJson(workspaceFile)

      if (workspaceData) {
        if (workspaceData.timers) setTimers(workspaceData.timers)
        if (workspaceData.alarms) setAlarms(workspaceData.alarms)
        if (workspaceData.projects) {
          const ensurePathsRecursive = (projs: Project[]): Project[] => {
            return projs.map((p) => ({
              ...p,
              notesPath: p.notesPath || (p.path ? p.path + '/notes' : ''),
              boardsPath: p.boardsPath || (p.path ? p.path + '/boards' : ''),
              subprojects: p.subprojects ? ensurePathsRecursive(p.subprojects) : []
            }))
          }
          setProjects(ensurePathsRecursive(workspaceData.projects))
        }
        if (workspaceData.timelineTasks) setTimelineTasks(workspaceData.timelineTasks)
        if (workspaceData.theme) setTheme(workspaceData.theme)

        // SCANNED NOTES - Consolidated Logic
        // @ts-ignore
        const scannedNotes = await api.scanAllNotes(savedWorkspace)
        setNotes(scannedNotes)

        if (workspaceData.showFPS !== undefined) setShowFPS(workspaceData.showFPS)
        if (workspaceData.showTaskCounts !== undefined)
          setShowTaskCounts(workspaceData.showTaskCounts)
        if (workspaceData.useGPU !== undefined) setUseGPU(workspaceData.useGPU)
        if (workspaceData.timerVolume !== undefined) setTimerVolume(workspaceData.timerVolume)
        if (workspaceData.hiddenTimelineProjectIds !== undefined)
          setHiddenTimelineProjectIds(workspaceData.hiddenTimelineProjectIds)
        if (workspaceData.backupIntervalMinutes !== undefined)
          setBackupIntervalMinutes(workspaceData.backupIntervalMinutes)
        if (workspaceData.boardBackupIntervalMinutes !== undefined)
          setBoardBackupIntervalMinutes(workspaceData.boardBackupIntervalMinutes)
        if (workspaceData.enableBoardBackups !== undefined)
          setEnableBoardBackups(workspaceData.enableBoardBackups)
        if (workspaceData.enableBoardAutosave !== undefined)
          setEnableBoardAutosave(workspaceData.enableBoardAutosave)
        if (workspaceData.showColoredDots !== undefined)
          setShowColoredDots(workspaceData.showColoredDots)

        // Auto-restore last session
        const lastView = await api.getStoreValue('last-view')
        const lastProj = await api.getStoreValue('last-project-id')
        const lastNote = await api.getStoreValue('last-note-id')

        if (lastView) setCurrentView(lastView)
        if (lastProj) setSelectedProjectId(lastProj)
        if (lastNote) setActiveNoteId(lastNote)

        const savedSidebarOpen = await api.getStoreValue('sidebar-is-open')
        if (savedSidebarOpen !== undefined && savedSidebarOpen !== null) {
          setIsSidebarOpen(savedSidebarOpen)
        }
      } else {
        // Fresh start for a new workspace
        // Initialize default project folder
        const defaultProjectPath = await (window as any).api.initProject(
          savedWorkspace,
          'My Project'
        )
        const defaultNotesPath = defaultProjectPath + '/notes'
        const defaultBoardsPath = defaultProjectPath + '/boards'

        setProjects([
          {
            id: 'default',
            name: 'My Project',
            isExpanded: true,
            path: defaultProjectPath,
            notesPath: defaultNotesPath,
            boardsPath: defaultBoardsPath,
            tasks: [
              {
                id: 'default-task-1',
                text: 'Main Task',
                completed: false,
                isExpanded: true,
                subtasks: []
              }
            ]
          }
        ])
        setTimers([])
        setTimelineTasks([])
        setNotes([])
      }

      setIsLoadingWorkspace(false)

      // Clear legacy global data to fulfill "delete everything" request
      // This only runs once when a workspace is first detected/set
      const keysToClear = [
        'timers',
        'task-projects',
        'timeline-tasks',
        'markdown-notes',
        'notes-directory',
        'projects-export-path'
      ]
      for (const key of keysToClear) {
        // @ts-ignore - preload api
        window.api.setStoreValue(key, null)
      }
      return
    }

    setWorkspacePath(null)
    setIsLoadingWorkspace(false)
  }, [])

  // Load from store on mount
  useEffect((): void => {
    const sync = async (): Promise<void> => {
      const loadingGuard = window.setTimeout(() => {
        setIsLoadingWorkspace(false)
      }, 5000)
      try {
        await loadData()
      } catch (error) {
        console.error('Failed to load app data:', error)
        setIsLoadingWorkspace(false)
      } finally {
        window.clearTimeout(loadingGuard)
      }
    }
    void sync()
  }, [loadData])

  useEffect((): (() => void) => {
    const handleGlobalMouseDown = (e: MouseEvent): void => {
      const target = e.target as HTMLElement
      if (target.closest('.boards-view-container')) {
        focusedAreaRef.current = 'board'
      } else if (target.closest('.notes-view-container')) {
        focusedAreaRef.current = 'notes'
      } else {
        focusedAreaRef.current = 'app'
      }
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (focusedAreaRef.current !== 'app') return // Isolated board/notes handle their own

        const active = document.activeElement as HTMLElement
        if (
          active?.tagName === 'INPUT' ||
          active?.tagName === 'TEXTAREA' ||
          active?.isContentEditable ||
          e.defaultPrevented
        ) {
          return
        }
        e.preventDefault()
        handleUndo()
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearchModal((prev) => !prev)
      }
    }

    // NOTE: Focus-reload removed intentionally. It called loadData() which replaces
    // ALL in-memory notes with disk state, silently wiping any unsaved edits.
    // Auto-save (500ms debounce) already persists changes, so reload is unnecessary.

    const handleEventDropped = (e: Event): void => {
      const customEvent = e as CustomEvent<{
        eventId: string
        projectId: string
        newDate: string
      }>
      const { eventId, projectId, newDate } = customEvent.detail

      setProjects((prev) => {
        const updateRecursive = (projs: Project[]): Project[] => {
          return projs.map((p) => {
            if (p.id === projectId && p.events) {
              const isVirtual = eventId.includes('_inst_')
              if (isVirtual) {
                const baseId = eventId.split('_inst_')[0]
                const originalDate = eventId.split('_inst_')[1]
                const baseEvent = p.events.find((e) => e.id === baseId)
                if (baseEvent) {
                  const newExceptionId = uuidv4()
                  const newEvent: AppEvent = {
                    ...baseEvent,
                    id: newExceptionId,
                    date: newDate,
                    originalEventId: baseId,
                    originalDate: originalDate,
                    recurrence: undefined,
                    exceptions: undefined,
                    syncStatus: 'pending_push' as any,
                    updatedAt: Date.now()
                  }
                  return {
                    ...p,
                    events: [
                      ...p.events.map((ev) =>
                        ev.id === baseId
                          ? {
                            ...ev,
                            syncStatus: 'pending_push' as const,
                            updatedAt: Date.now(),
                            exceptions: {
                              ...(ev.exceptions || {}),
                              [originalDate]: { deleted: true, editedEventId: newExceptionId }
                            }
                          }
                          : ev
                      ),
                      newEvent
                    ]
                  }
                }
              } else {
                return {
                  ...p,
                  events: p.events.map((ev) => (ev.id === eventId ? { ...ev, date: newDate, syncStatus: 'pending_push' as const, updatedAt: Date.now() } : ev))
                }
              }
            }
            if (p.subprojects) {
              return { ...p, subprojects: updateRecursive(p.subprojects) }
            }
            return p
          })
        }
        return updateRecursive(prev)
      })
    }

    const handleDeleteEventInstance = (e: Event): void => {
      const customEvent = e as CustomEvent<{
        eventId: string
        projectId: string
      }>
      const { eventId, projectId } = customEvent.detail

      let choice: 'instance' | 'series' | null = null
      const isVirtual = eventId.includes('_inst_')

      if (isVirtual) {
        if (window.confirm('Delete the entire series? (Click Cancel to delete only this instance)')) {
          choice = 'series'
        } else {
          choice = 'instance'
        }
      } else {
        if (!window.confirm('Delete this event?')) return
        choice = 'series' // Non-virtual is always "the event itself"
      }

      setProjects((prev) => {
        const updateRecursive = (projs: Project[]): Project[] => {
          return projs.map((p) => {
            if (p.id === projectId && p.events) {
              const realEventId = isVirtual ? eventId.split('_inst_')[0] : eventId

              if (choice === 'series') {
                return {
                  ...p,
                  events: p.events.map(ev => 
                    ev.id === realEventId ? { ...ev, syncStatus: 'pending_delete', updatedAt: Date.now() } : ev
                  ).filter(ev => ev.syncStatus === 'pending_delete' ? !!ev.externalId : true)
                }
              } else {
                // Instance only
                const originalDate = eventId.split('_inst_')[1]
                return {
                  ...p,
                  events: p.events.map((ev) =>
                    ev.id === realEventId
                      ? {
                        ...ev,
                        syncStatus: 'pending_push',
                        updatedAt: Date.now(),
                        exceptions: {
                          ...(ev.exceptions || {}),
                          [originalDate]: { deleted: true }
                        }
                      }
                      : ev
                  )
                }
              }
            }
            if (p.subprojects) {
              return { ...p, subprojects: updateRecursive(p.subprojects) }
            }
            return p
          })
        }
        return updateRecursive(prev)
      })
    }

    window.addEventListener('mousedown', handleGlobalMouseDown)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('event-dropped-on-calendar', handleEventDropped)
    window.addEventListener('delete-event-instance', handleDeleteEventInstance)

    return () => {
      window.removeEventListener('mousedown', handleGlobalMouseDown)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('event-dropped-on-calendar', handleEventDropped)
      window.removeEventListener('delete-event-instance', handleDeleteEventInstance)
    }
  }, [handleUndo])

  // Notification Polling logic
  useEffect(() => {
    const checkReminders = () => {
      const now = Date.now()
      const d = new Date()
      const pad = (n: number) => n.toString().padStart(2, '0')
      const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`
      const newNotifications: AppNotification[] = []

      // 1. Check PROJECT EVENTS
      setProjects(prevProjs => {
        let updated = false
        const updateRecursive = (projs: Project[]): Project[] => {
          return projs.map(p => {
            let projectEventsUpdated = false
            const newEvents = p.events?.map(ev => {
              if (ev.date && ev.time && ev.reminder && !ev.reminder.isNotified) {
                const eventDate = new Date(`${ev.date}T${ev.time}:00`)
                const eventTs = eventDate.getTime()
                const reminderTs = eventTs - (ev.reminder.minutesBefore * 60000)

                if (now >= reminderTs && now < eventTs + 60000) {
                  newNotifications.push({
                    id: uuidv4(),
                    type: 'reminder',
                    title: `Reminder: ${ev.title}`,
                    message: `Starts in ${ev.reminder.minutesBefore} minutes`,
                    timestamp: now,
                    isRead: false,
                    relatedId: ev.id
                  })
                  projectEventsUpdated = true
                  updated = true
                  return { ...ev, reminder: { ...ev.reminder, isNotified: true } }
                }
              }
              return ev
            })

            const finalEvents = projectEventsUpdated ? newEvents : p.events
            let subprojects = p.subprojects
            let subprojectsUpdated = false
            if (p.subprojects) {
              const updatedSubs = updateRecursive(p.subprojects)
              if (updatedSubs !== p.subprojects) {
                subprojects = updatedSubs
                subprojectsUpdated = true
              }
            }

            if (projectEventsUpdated || subprojectsUpdated) {
              return { ...p, events: finalEvents, subprojects }
            }
            return p
          })
        }

        const nextProjs = updateRecursive(prevProjs)
        return updated ? nextProjs : prevProjs
      })

      // 2. Check STANDALONE ALARMS
      setAlarms(prevAlarms => {
        let updated = false
        const nextAlarms = prevAlarms.map(alarm => {
          if (alarm.isEnabled && !alarm.isNotified) {
            // Use string matching to avoid timezone issues
            if (alarm.date === dateStr && alarm.time === timeStr) {
              newNotifications.push({
                id: uuidv4(),
                type: 'reminder',
                title: `Alarm: ${alarm.title}`,
                message: alarm.taskName || 'Time is up!',
                timestamp: now,
                isRead: false,
                relatedId: alarm.id
              })

              // Play Sound
              const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
              audio.volume = timerVolume
              audio.play().catch(e => console.error('Alarm sound failed:', e))

              updated = true
              return { ...alarm, isNotified: true }
            }
          }
          return alarm
        })
        return updated ? nextAlarms : prevAlarms
      })

      if (newNotifications.length > 0) {
        setNotifications(prev => [...newNotifications, ...prev].slice(0, 50))
      }
    }

    const interval = setInterval(checkReminders, 1000) // Much more responsive (1s)
    return () => clearInterval(interval)
  }, [projects, alarms])

  // Capture Timer completion
  useEffect(() => {
    // @ts-ignore
    const cleanup = window.api.onTimerFinished((timerId: string, title: string) => {
      setNotifications(prev => [{
        id: uuidv4(),
        type: 'timer' as const,
        title: 'Timer Finished',
        message: title || 'A timer has completed.',
        timestamp: Date.now(),
        isRead: false,
        relatedId: timerId
      }, ...prev].slice(0, 50))
    })
    return cleanup
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--bg-color', theme.bgColor)
    root.style.setProperty('--card-bg', theme.cardBg)
    root.style.setProperty('--accent', theme.accent)
    root.style.setProperty('--text-primary', theme.textPrimary)
    const boardAccent = theme.boardAccent || DEFAULT_THEME.boardAccent
    root.style.setProperty('--board-accent', boardAccent)
    root.style.setProperty('--board-accent-glow', `${boardAccent}40`)
    root.style.setProperty('--board-bg', theme.boardBg || DEFAULT_THEME.boardBg)
    root.style.setProperty('--calendar-task-bg', theme.calendarTaskBg || DEFAULT_THEME.calendarTaskBg || '#2a2a2a')
    root.style.setProperty('--calendar-event-bg', theme.calendarEventBg || DEFAULT_THEME.calendarEventBg || 'rgba(255,255,255,0.03)')

    if (theme.timerBg) {
      root.style.setProperty('--timer-bg', theme.timerBg)
    } else {
      root.style.setProperty('--timer-bg', DEFAULT_THEME.timerBg || '#171717')
    }

    try {
      localStorage.setItem('cluster-ui-theme-cache', JSON.stringify(theme))
    } catch {
      // Ignore cache write errors (e.g. storage restrictions).
    }
  }, [theme])


  // Cache showColoredDots so the next reload initializes correctly without icon flash
  useEffect(() => {
    try {
      localStorage.setItem('cluster-ui-colored-dots', JSON.stringify(showColoredDots))
    } catch { /* ignore */ }
  }, [showColoredDots])

  // Save to workspace file when any data changes
  useEffect(() => {
    if (!workspacePath || isLoadingWorkspace) return

    const saveData = async () => {
      const workspaceFile = workspacePath + '/workspace_data.json'

      const workspaceData = {
        timers,
        alarms,
        projects,
        timelineTasks,
        theme,
        showFPS,
        showTaskCounts,
        useGPU,
        timerVolume,
        hiddenTimelineProjectIds,
        backupIntervalMinutes,
        boardBackupIntervalMinutes,
        enableBoardBackups,
        enableBoardAutosave,
        showColoredDots,
        isCleanedV1: true // Mark as clean
      }
      // @ts-ignore - preload api
      await window.api.writeWorkspaceJson(workspaceFile, workspaceData)
    }

    // Small delay to debounce saves if many changes happen at once
    const timeout = setTimeout(saveData, 500)
    return () => clearTimeout(timeout)
  }, [
    workspacePath,
    timers,
    alarms,
    projects,
    timelineTasks,
    theme,
    notes,
    showFPS,
    showTaskCounts,
    useGPU,
    timerVolume,
    hiddenTimelineProjectIds,
    backupIntervalMinutes,
    boardBackupIntervalMinutes,
    enableBoardAutosave,
    showColoredDots,
    isLoadingWorkspace
  ])

  // Keep workspace-path in electron-store for session persistence
  useEffect(() => {
    if (workspacePath) {
      // @ts-ignore - preload api
      window.api.setStoreValue('workspace-path', workspacePath)
    }
  }, [workspacePath])

  // Session persistence
  useEffect(() => {
    if (!workspacePath || isLoadingWorkspace) return
    // @ts-ignore
    window.api.setStoreValue('last-view', currentView)
    // @ts-ignore
    window.api.setStoreValue('last-project-id', selectedProjectId)
    // @ts-ignore
    window.api.setStoreValue('last-note-id', activeNoteId)
    // @ts-ignore
    window.api.setStoreValue('sidebar-is-open', isSidebarOpen)
  }, [currentView, selectedProjectId, activeNoteId, isSidebarOpen, workspacePath, isLoadingWorkspace])

  const addTimer = () => {
    setTimers((prev) => [
      ...prev,
      {
        id: uuidv4(),
        title: `Timer ${prev.length + 1}`,
        taskName: null,
        hours: 0,
        minutes: 5,
        seconds: 0,
        soundPath: null,
        soundName: null,
        isStopwatch: false
      }
    ])
  }

  const addStopwatch = () => {
    setTimers((prev) => [
      ...prev,
      {
        id: uuidv4(),
        title: `Stopwatch ${prev.filter((t) => t.isStopwatch).length + 1}`,
        taskName: null,
        hours: 0,
        minutes: 0,
        seconds: 0,
        soundPath: null,
        soundName: null,
        isStopwatch: true
      }
    ])
  }

  const deleteTimer = (id: string) => {
    setTimers((prev) => prev.filter((t) => t.id !== id))
  }

  const updateTimer = (id: string, updates: Partial<TimerData>) => {
    setTimers((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)))
  }

  const addAlarm = () => {
    const now = new Date()
    const future = new Date(now.getTime() + 60000) // +1 minute
    const pad = (n: number) => n.toString().padStart(2, '0')
    const dateStr = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}`
    const timeStr = `${pad(future.getHours())}:${pad(future.getMinutes())}`

    setAlarms((prev) => [
      ...prev,
      {
        id: uuidv4(),
        title: `Alarm ${prev.length + 1}`,
        taskName: null,
        date: dateStr,
        time: timeStr,
        isEnabled: false,
        isNotified: false
      }
    ])
  }

  const deleteAlarm = (id: string) => {
    setAlarms((prev) => prev.filter((a) => a.id !== id))
  }

  const updateAlarm = (id: string, updates: Partial<AlarmData>) => {
    setAlarms((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)))
  }

  const handleCreateTimelineTask = (
    projectId: string,
    name: string,
    parentTaskId?: string,
    explicitTaskId?: string
  ): string => {
    pushToHistory()
    const newTaskId = explicitTaskId || uuidv4()

    const updateTasks = (tasks: any[]): any[] => {
      if (!parentTaskId) {
        return [
          ...tasks,
          { id: newTaskId, text: name, completed: false, isExpanded: false, subtasks: [] }
        ]
      } else {
        return tasks.map((task) => {
          if (task.id === parentTaskId) {
            return {
              ...task,
              isExpanded: true,
              subtasks: [
                ...(task.subtasks || []),
                { id: newTaskId, text: name, completed: false, subtasks: [] }
              ]
            }
          }
          if (task.subtasks && task.subtasks.length > 0) {
            return { ...task, subtasks: updateTasks(task.subtasks) }
          }
          return task
        })
      }
    }

    const updateProjectsRecursive = (projs: Project[]): Project[] => {
      return projs.map((p) => {
        if (p.id === projectId) {
          return { ...p, tasks: updateTasks(p.tasks) }
        }
        if (p.subprojects) {
          return { ...p, subprojects: updateProjectsRecursive(p.subprojects) }
        }
        return p
      })
    }

    setProjects((prev) => updateProjectsRecursive(prev))
    return newTaskId
  }

  const toggleAlwaysOnTop = async () => {
    const newState = !isAlwaysOnTop
    setIsAlwaysOnTop(newState)
    // @ts-ignore
    await window.api.toggleAlwaysOnTop(newState)
  }

  const handleWorkspaceSelected = useCallback(
    (path: string): void => {
      // Clear current data to avoid leakage before loading new workspace
      setProjects([])
      setTimelineTasks([])
      setTimers([])
      setNotes([])

      setWorkspacePath(path)
      setPreviousWorkspacePath(null)
      // Reload everything from the new workspace file
      loadData()
    },
    [loadData]
  )

  // Route to MiniTimer if launched with ?mini=...
  const urlParams = new URLSearchParams(window.location.search)
  const miniTimerId = urlParams.get('mini')

  const handleSetProjects = useCallback(
    (action: React.SetStateAction<Project[]>, skipHistory?: boolean) => {
      if (!skipHistory) pushToHistory()
      setProjects(action)
    },
    [pushToHistory, setProjects]
  )

  const handleSetTheme = useCallback((action: React.SetStateAction<UITheme>) => {
    setTheme(action)
  }, [])

  if (miniTimerId) {
    return <MiniTimer timerId={miniTimerId} />
  }

  if (!workspacePath && !previousWorkspacePath) {
    return (
      <WelcomeScreen
        onWorkspaceSelected={handleWorkspaceSelected}
      />
    )
  }

    const handleAddEvent = (projectId: string, title: string, date: string) => {
      pushToHistory()
      setProjects((prev) => {
        const updateRecursive = (projs: Project[]): Project[] => {
          return projs.map((p) => {
            if (p.id === projectId) {
              const newEvent: AppEvent = {
                id: uuidv4(),
                title,
                date,
                time: '12:00',
                syncStatus: 'pending_push',
                updatedAt: Date.now()
              }
              return { ...p, events: [...(p.events || []), newEvent] }
            }
            if (p.subprojects) return { ...p, subprojects: updateRecursive(p.subprojects) }
            return p
          })
        }
        return updateRecursive(prev)
      })
    }

    const handleAddAlarm = (date: string, time: string, title: string) => {
      setAlarms((prev) => [
        ...prev,
        {
          id: uuidv4(),
          title,
          taskName: null,
          date,
          time,
          isEnabled: true,
          isNotified: false
        }
      ])
    }

  const profileDisplayName = workspacePath ? workspacePath.split(/[\\/]/).pop() || 'No Workspace' : 'No Workspace'
  const profileAvatarUrl = workspacePath ? workspaceAvatarMap[workspacePath] || null : null

  const handleProfileAvatarChange = async (avatarPath: string | null) => {
    if (!workspacePath) return
    const nextMap = { ...workspaceAvatarMap }
    if (avatarPath) {
      nextMap[workspacePath] = avatarPath
    } else {
      delete nextMap[workspacePath]
    }
    setWorkspaceAvatarMap(nextMap)
    await (window as any).api.setStoreValue('workspace-avatar-map', nextMap)
  }

  return (
    <div className="app-container">
      <WindowResizeHandles />
      <header className="header">
        {/* Profile trigger */}
        <button
          className="header-profile-trigger"
          onClick={() => { setShowSettings(true); }}
          title="Profile & Workspace"
        >
          <span className={`header-profile-avatar ${profileAvatarUrl ? 'has-avatar' : ''}`}>
            {profileAvatarUrl ? (
              <img className="header-profile-avatar-img" src={profileAvatarUrl} alt={profileDisplayName} />
            ) : (
              <User size={16} />
            )}
          </span>
          <span className="header-profile-name">{profileDisplayName}</span>
        </button>

        <div className="header-divider" />

        {/* Left actions: Bell + Search */}
        <div ref={notificationRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <button
            className="pin-btn"
            onClick={() => setShowNotifications(!showNotifications)}
            style={{
              background: 'transparent',
              border: 'none',
              color: notifications.some((n) => !n.isRead) ? 'var(--accent)' : 'var(--text-secondary)',
              position: 'relative'
            }}
          >
            <Bell size={18} />
            {notifications.some((n) => !n.isRead) && (
              <span style={{ position: 'absolute', top: '6px', right: '6px', width: '6px', height: '6px', background: 'var(--accent)', borderRadius: '50%', border: '2px solid var(--bg-color)' }} />
            )}
          </button>
          {showNotifications && (
            <NotificationCenter
              notifications={notifications}
              onMarkAsRead={(id) => setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))}
              onMarkAllAsRead={() => setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))}
              onClearAll={() => { setNotifications([]); setShowNotifications(false) }}
              onClose={() => setShowNotifications(false)}
            />
          )}
        </div>

        <button
          className="pin-btn"
          onClick={() => setShowSearchModal(true)}
          title="Global Search (Ctrl+K)"
          style={{ background: 'transparent', border: 'none' }}
        >
          <Search size={18} />
        </button>

        <div className="header-divider" />

        {/* View Toggle */}
        <div className="view-toggle">
          {selectedProject && (
            <div
              className="view-toggle-indicator"
              style={{
                backgroundColor: selectedProject.color || 'var(--accent)'
              }}
            />
          )}
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'pipeline', label: 'Pipeline' },
            { id: 'notes', label: 'Notes' },
            { id: 'timeline', label: 'Calendar' },
            { id: 'clock', label: 'Clock' }
          ].map((view) => (
            <button
              key={view.id}
              className={`view-tab ${currentView === view.id ? 'active' : ''}`}
              onClick={() => setCurrentView(view.id as any)}
            >
              <span className="view-tab-label">{view.label}</span>
            </button>
          ))}
        </div>

        {/* Right side */}
        <div className="header-right">
          <HeaderTimer currentView={currentView} />

          <button
            className={`pin-btn ${isAlwaysOnTop ? 'active' : ''}`}
            onClick={toggleAlwaysOnTop}
            title={isAlwaysOnTop ? 'Unpin window' : 'Always on top'}
            style={{
              background: isAlwaysOnTop ? 'rgba(255,255,255,0.08)' : 'transparent',
              border: 'none',
              color: isAlwaysOnTop ? 'var(--accent)' : 'var(--text-secondary)'
            }}
          >
            <Pin size={18} />
          </button>

          <div className="window-controls-group">
            <button className="window-control-btn minimize" onClick={() => (window as any).api.minimizeWindow()} title="Minimize"><MinimizeIcon size={8} strokeWidth={4} /></button>
            <button className="window-control-btn maximize" onClick={() => (window as any).api.maximizeWindow()} title="Maximize"><MaximizeIcon size={8} strokeWidth={4} /></button>
            <button className="window-control-btn close" onClick={() => (window as any).api.closeWindow()} title="Close"><CloseIcon size={8} strokeWidth={4} /></button>
          </div>
        </div>
      </header>

      <div className="app-body">
        <TaskSidebar
          isOpen={isSidebarOpen}
          projects={projects}
          setProjects={handleSetProjects}
          timelineTasks={timelineTasks}
          selectedProjectId={selectedProjectId}
          setSelectedProjectId={setSelectedProjectId}
          onAddProject={addProject}
          onDeleteProject={deleteProject}
          onTaskAdded={(projectId, name, parentId, explicitId) => {
            onAddProjectItem(projectId, name, parentId, explicitId)
          }}
          onTaskDeleted={(taskName, taskId) => {
            pushToHistory()
            setTimelineTasks((prev) => prev.filter((t) => t.taskId !== taskId))
            setTimers((prev) => prev.filter((t) => t.taskName !== taskName))
          }}
          onAssignTaskToTimer={(timerId, taskText) => {
            updateTimer(timerId, { taskName: taskText })
          }}
          onAssignTaskToAlarm={(alarmId, taskText) => {
            updateAlarm(alarmId, { taskName: taskText })
          }}
          showTaskCounts={showTaskCounts}
          showColoredDots={showColoredDots}
        />
        <div className="main-content">

          <div className="views-wrapper">
            {/* All views always rendered — hidden ones use display:none so timers keep running */}
            <div style={{ display: currentView === 'overview' ? 'contents' : 'none' }}>
              {selectedProject ? (
                <ProjectOverview
                  key={selectedProject.id}
                  project={selectedProject}
                  allProjects={allProjects}
                  onUpdate={updateProject}
                  notes={notes}
                  onNoteClick={(noteId) => {
                    setCurrentView('notes')
                    setActiveNoteId(noteId)
                  }}
                  onProjectClick={(projectId) => setSelectedProjectId(projectId)}
                  isSidebarOpen={isSidebarOpen}
                  onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                  onNavigateToPipeline={() => setCurrentView('pipeline')}
                />
              ) : (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0.5
                  }}
                >
                  <p>Select a project to see overview</p>
                </div>
              )}
            </div>
            <div style={{ display: currentView === 'pipeline' ? 'contents' : 'none' }}>
              {selectedProject ? (
                <PipelineView
                  project={selectedProject}
                  onUpdate={updateProject}
                  isSidebarOpen={isSidebarOpen}
                  onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                  isVisible={currentView === 'pipeline'}
                />
              ) : (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0.5
                  }}
                >
                  <p>Select a project to see its pipeline</p>
                </div>
              )}
            </div>
            <div style={{ display: currentView === 'timeline' ? 'contents' : 'none' }}>
              <CalendarView
                projects={projects}
                timelineTasks={timelineTasks}
                setTimelineTasks={(action: React.SetStateAction<TimelineTask[]>) => {
                  pushToHistory()
                  setTimelineTasks(action)
                }}
                onAddProjectItem={handleCreateTimelineTask}
                onAddEvent={handleAddEvent}
                onAddAlarm={handleAddAlarm}
                hiddenProjectIds={hiddenTimelineProjectIds}
                setHiddenProjectIds={setHiddenTimelineProjectIds}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                onSyncWorkspaceEvents={handleSyncWorkspaceEvents}
                isSyncing={isSyncingCalendar}
                selectedProjectId={selectedProjectId}
                setProjects={handleSetProjects}
              />
            </div>
            <div style={{ display: currentView === 'notes' ? 'contents' : 'none' }}>
              <NotesView
                notes={notes}
                setNotes={setNotes}
                projects={allProjects}
                workspacePath={workspacePath || ''}
                selectedProjectId={selectedProjectId}
                activeNoteId={activeNoteId}
                setActiveNoteId={setActiveNoteId}
                theme={theme}
                setTheme={handleSetTheme}
                showFPS={showFPS}
                setCurrentView={setCurrentView}
                backupIntervalMinutes={backupIntervalMinutes}
                boardBackupIntervalMinutes={boardBackupIntervalMinutes}
                enableBoardBackups={enableBoardBackups}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
              />
            </div>
            <div
              className="clock-view-container"
              style={{
                display: currentView === 'clock' ? 'grid' : 'none',
                gridTemplateRows: 'auto 1fr',
                height: '100%',
                maxHeight: '100%',
                minHeight: 0,
                overflow: 'hidden'
              }}
            >
              <div
                className="clock-actions"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: '45px',
                  boxSizing: 'border-box',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  flexShrink: 0,
                  padding: '0 10px',
                  gap: '8px'
                }}
              >
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
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
                <button
                  onClick={addTimer}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--text-primary)',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 500,
                    transition: 'all 0.2s'
                  }}
                >
                  <PlusCircle size={14} />
                  Timer
                </button>
                <button
                  onClick={addStopwatch}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--text-primary)',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 500,
                    transition: 'all 0.2s'
                  }}
                >
                  <TimerIcon size={14} />
                  Stopwatch
                </button>
                <button
                  onClick={addAlarm}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--text-primary)',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 500,
                    transition: 'all 0.2s'
                  }}
                >
                  <Bell size={14} />
                  Alarm
                </button>
              </div>
              <div
                className="timers-list"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', // auto-fill чтобы один таймер не растягивался
                  gridAutoRows: 'min-content',
                  justifyContent: 'start',
                  gap: '10px',
                  padding: '10px',
                  paddingBottom: '80px',
                  overflowY: 'auto',
                  minHeight: 0
                }}
              >
                {timers.length === 0 && alarms.length === 0 ? (
                  <div className="empty-state" style={{ padding: '60px 0' }}>
                    <TimerIcon size={64} />
                    <p>
                      No active timers or alarms.
                      <br />
                      Click the buttons above to add one.
                    </p>
                  </div>
                ) : (
                  <>
                    {timers.map((timer) => (
                      <TimerCard
                        key={timer.id}
                        data={timer}
                        theme={theme}
                        isActiveView={currentView === 'clock'}
                        timerVolume={timerVolume}
                        onUpdate={(updates) => updateTimer(timer.id, updates)}
                        onDelete={() => deleteTimer(timer.id)}
                      />
                    ))}
                    {alarms.map((alarm) => (
                      <AlarmCard
                        key={alarm.id}
                        data={alarm}
                        theme={theme}
                        onUpdate={(updates) => updateAlarm(alarm.id, updates)}
                        onDelete={() => deleteAlarm(alarm.id)}
                      />
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        workspacePath={workspacePath}
        projectCount={allProjects.length}
        onWorkspaceSelected={handleWorkspaceSelected}
        avatarUrl={profileAvatarUrl}
        onAvatarChange={handleProfileAvatarChange}
        theme={theme}
        setTheme={handleSetTheme}
        showFPS={showFPS}
        setShowFPS={setShowFPS}
        showTaskCounts={showTaskCounts}
        setShowTaskCounts={setShowTaskCounts}
        showColoredDots={showColoredDots}
        setShowColoredDots={setShowColoredDots}
        useGPU={useGPU}
        setUseGPU={setUseGPU}
        timerVolume={timerVolume}
        setTimerVolume={setTimerVolume}
        backupIntervalMinutes={backupIntervalMinutes}
        setBackupIntervalMinutes={setBackupIntervalMinutes}
        boardBackupIntervalMinutes={boardBackupIntervalMinutes}
        setBoardBackupIntervalMinutes={setBoardBackupIntervalMinutes}
        enableBoardBackups={enableBoardBackups}
        setEnableBoardBackups={setEnableBoardBackups}
        enableBoardAutosave={enableBoardAutosave}
        setEnableBoardAutosave={setEnableBoardAutosave}
                calendarTimezone={calendarTimezone}
        setCalendarTimezone={setCalendarTimezone}
        onSaveThemeAsDefault={async () => {
          // @ts-ignore
          await window.api.setStoreValue('ui-theme', theme)
          // @ts-ignore
          window.api.showNotification('Тема сохранена', 'Текущие цвета установлены по умолчанию.')
        }}
      />

      {!workspacePath && previousWorkspacePath && (
        <WelcomeScreen
          onWorkspaceSelected={handleWorkspaceSelected}
          onCancel={() => setWorkspacePath(previousWorkspacePath)}
          isOverlay
        />
      )}

      {showSearchModal && (
        <GlobalSearchModal
          projects={allProjects}
          notes={notes}
          onClose={() => setShowSearchModal(false)}
          onSelectProject={(id) => {
            setSelectedProjectId(id)
            setCurrentView('overview')
          }}
          onSelectNote={(id) => {
            setActiveNoteId(id)
            setCurrentView('notes')
          }}
          onSelectTask={(_taskId, projectId) => {
            setSelectedProjectId(projectId)
            setCurrentView('overview')
            // Option: expand project or highlight task
          }}
        />
      )}
    </div>
  )
}

export default App
