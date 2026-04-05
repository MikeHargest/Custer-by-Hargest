import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  PlusCircle,
  Timer as TimerIcon,
  Settings as SettingsIcon,
  Pin,
  PanelLeft,
  FolderOpen,
  User
} from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import TimerCard from './components/TimerCard'
import TaskSidebar from './components/TaskSidebar'
import MiniTimer from './components/MiniTimer'
import TimelineView from './components/TimelineView'
import NotesView from './components/NotesView'
import WelcomeScreen from './components/WelcomeScreen'
import SettingsModal from './components/SettingsModal'
import WorkspaceProfile from './components/WorkspaceProfile'
import WindowResizeHandles from './components/WindowResizeHandles'
import ProjectOverview from './components/ProjectOverview'

import { TimerData, TimelineTask, AppNote, UITheme, Project, TaskItem } from './types'
export const DEFAULT_THEME: UITheme = {
  bgColor: '#292929',
  cardBg: '#121212',
  accent: '#525252',
  textPrimary: '#EAEAEA',
  boardAccent: '#71717a',
  boardBg: '#1b1b1b',
  timelineTaskBg: '#0f0f0f',
  timerBg: '#121212'
}

function App() {
  const [timers, setTimers] = useState<TimerData[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [timelineTasks, setTimelineTasks] = useState<TimelineTask[]>([])
  const [notes, setNotes] = useState<AppNote[]>([])
  const [theme, setTheme] = useState<UITheme>(DEFAULT_THEME)
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<'overview' | 'clock' | 'timeline' | 'notes'>(
    'overview'
  )
  const [showSettings, setShowSettings] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showFPS, setShowFPS] = useState(false)
  const [showTaskCounts, setShowTaskCounts] = useState(true)
  const [useGPU, setUseGPU] = useState(true)
  const [workspacePath, setWorkspacePath] = useState<string | null>(null)
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(true)

  // Undo implementation
  const [, setHistory] = useState<{ projects: Project[]; timelineTasks: TimelineTask[] }[]>([])

  // Use refs to always capture latest state for history snapshots
  const projectsRef = useRef(projects)
  const timelineTasksRef = useRef(timelineTasks)
  const focusedAreaRef = useRef<'app' | 'board' | 'notes'>('app')

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

  const addProject = async (name: string, parentId?: string): Promise<string | undefined> => {
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

    // Initialize project folder via IPC
    const projectPath = await (window as any).api.initProjectFolder(basePath, name)
    const notesPath = projectPath ? projectPath + '/notes' : ''
    const boardsPath = projectPath ? projectPath + '/boards' : ''

    const newProject: Project = {
      id: newId,
      name,
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
    return newId
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
      ;(window as any).api.deleteProjectFolder(projectToDelete.path)
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
    const savedWorkspace = await api.getStoreValue('workspace-path')
    if (savedWorkspace) {
      setWorkspacePath(savedWorkspace)

      // Try reading data from workspace file
      const workspaceFile = savedWorkspace + '/workspace_data.json'
      const workspaceData = await api.readWorkspaceJson(workspaceFile)

      if (workspaceData) {
        // Force cleanup of legacy data if not already done for this workspace
        if (!workspaceData.isCleanedV1) {
          setProjects([
            {
              id: 'default',
              name: 'My Project',
              isExpanded: true,
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
          // Note: isCleanedV1 will be saved by the auto-save effect
        } else {
          if (workspaceData.timers) setTimers(workspaceData.timers)
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
          if (workspaceData.notes) setNotes(workspaceData.notes)
          if (workspaceData.showFPS !== undefined) setShowFPS(workspaceData.showFPS)
          if (workspaceData.showTaskCounts !== undefined)
            setShowTaskCounts(workspaceData.showTaskCounts)
          if (workspaceData.useGPU !== undefined) setUseGPU(workspaceData.useGPU)

          // Auto-restore last session
          const lastView = await api.getStoreValue('last-view')
          const lastProj = await api.getStoreValue('last-project-id')
          const lastNote = await api.getStoreValue('last-note-id')

          if (lastView) setCurrentView(lastView)
          if (lastProj) setSelectedProjectId(lastProj)
          if (lastNote) setActiveNoteId(lastNote)
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
      await loadData()
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
    }

    const onFocus = (): void => {
      void loadData()
    }

    window.addEventListener('mousedown', handleGlobalMouseDown)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('focus', onFocus)

    return () => {
      window.removeEventListener('mousedown', handleGlobalMouseDown)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('focus', onFocus)
    }
  }, [handleUndo, loadData])

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

    if (theme.timelineTaskBg) {
      root.style.setProperty('--timeline-task-bg', theme.timelineTaskBg)
    } else {
      root.style.removeProperty('--timeline-task-bg')
    }
    if (theme.timerBg) {
      root.style.setProperty('--timer-bg', theme.timerBg)
    } else {
      root.style.setProperty('--timer-bg', DEFAULT_THEME.timerBg || '#121212')
    }
  }, [theme])

  // Save to workspace file when any data changes
  useEffect(() => {
    if (!workspacePath || isLoadingWorkspace) return

    const saveData = async () => {
      const workspaceFile = workspacePath + '/workspace_data.json'
      // Strip 'content' from notes to avoid bloated global save (content is saved individually)
      const lightweightNotes = notes.map((n) => {
        const { content: _, ...metaOnly } = n
        return metaOnly
      })

      const workspaceData = {
        timers,
        projects,
        timelineTasks,
        theme,
        notes: lightweightNotes,
        showFPS,
        showTaskCounts,
        useGPU,
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
    projects,
    timelineTasks,
    theme,
    notes,
    showFPS,
    showTaskCounts,
    useGPU,
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
  }, [currentView, selectedProjectId, activeNoteId, workspacePath, isLoadingWorkspace])

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

  if (isLoadingWorkspace) {
    return <div style={{ background: 'var(--bg-color)', width: '100%', height: '100vh' }} />
  }

  if (!workspacePath) {
    return <WelcomeScreen onWorkspaceSelected={handleWorkspaceSelected} />
  }

  return (
    <div className="app-container">
      <WindowResizeHandles />
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
        showTaskCounts={showTaskCounts}
      />
      <div className="main-content">
        <header className="header">
          <div
            className="header-left"
            style={
              {
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                WebkitAppRegion: 'no-drag'
              } as any
            }
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '2px'
              }}
            >
              <button
                className="sidebar-toggle-btn"
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
                  width: '32px',
                  height: '32px'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.opacity = isSidebarOpen ? '0.6' : '0.4')
                }
              >
                <PanelLeft size={18} />
              </button>
            </div>

            {/* View Toggle - Segmented Control Style */}
            <div
              className="view-toggle"
              style={{
                display: 'flex',
                background: 'transparent',
                padding: '2px',
                position: 'relative',
                borderRadius: 'var(--radius-md)'
              }}
            >
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'notes', label: 'Notes' },
                { id: 'timeline', label: 'Timeline' },
                { id: 'clock', label: 'Clock' }
              ].map((view) => (
                <button
                  key={view.id}
                  className={`view-tab ${currentView === view.id ? 'active' : ''}`}
                  onClick={() => setCurrentView(view.id as any)}
                >
                  {view.label}
                </button>
              ))}
            </div>
          </div>

          <div
            className="header-right"
            style={
              {
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                WebkitAppRegion: 'no-drag'
              } as any
            }
          >
            {/* Consolidated Action Menu */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '2px'
              }}
            >
              <button
                className="pin-btn"
                onClick={() => setShowProfile(true)}
                title="Profile & Workspace"
                style={{ background: 'transparent', border: 'none' }}
              >
                <User size={18} />
              </button>
              <button
                className="pin-btn"
                onClick={() => setShowSettings(true)}
                title="Settings"
                style={{ background: 'transparent', border: 'none' }}
              >
                <SettingsIcon size={18} />
              </button>
              <button
                className="pin-btn"
                onClick={() => setWorkspacePath(null)}
                title="Change Workspace"
                style={{ background: 'transparent', border: 'none' }}
              >
                <FolderOpen size={18} />
              </button>
              <button
                className={`pin-btn ${isAlwaysOnTop ? 'active' : ''}`}
                onClick={toggleAlwaysOnTop}
                title={isAlwaysOnTop ? 'Unpin window' : 'Always on top'}
                style={{
                  background: isAlwaysOnTop ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: 'none',
                  color: isAlwaysOnTop ? 'var(--accent)' : 'inherit'
                }}
              >
                <Pin size={18} />
              </button>
            </div>

            {/* Window controls */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center'
              }}
            >
              <button
                onClick={() => (window as any).api.minimizeWindow()}
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#febc2e',
                  cursor: 'pointer',
                  border: 'none',
                  padding: 0
                }}
                title="Minimize"
              />
              <button
                onClick={() => (window as any).api.maximizeWindow()}
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#28c840',
                  cursor: 'pointer',
                  border: 'none',
                  padding: 0
                }}
                title="Maximize"
              />
              <button
                onClick={() => (window as any).api.closeWindow()}
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#ff5f57',
                  cursor: 'pointer',
                  border: 'none',
                  padding: 0
                }}
                title="Close"
              />
            </div>
          </div>
        </header>

        <WorkspaceProfile
          isOpen={showProfile}
          onClose={() => setShowProfile(false)}
          workspacePath={workspacePath}
          projectCount={allProjects.length}
        />

        <div className="views-wrapper">
          {/* All views always rendered — hidden ones use display:none so timers keep running */}
          <div style={{ display: currentView === 'overview' ? 'contents' : 'none' }}>
            {selectedProject ? (
              <ProjectOverview
                project={selectedProject}
                onUpdate={updateProject}
                notes={notes}
                onNoteClick={(noteId) => {
                  setCurrentView('notes')
                  setActiveNoteId(noteId)
                }}
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
          <div style={{ display: currentView === 'timeline' ? 'contents' : 'none' }}>
            <TimelineView
              projects={allProjects}
              timelineTasks={timelineTasks}
              setTimelineTasks={(action: React.SetStateAction<TimelineTask[]>) => {
                pushToHistory()
                setTimelineTasks(action)
              }}
              onAddProjectItem={handleCreateTimelineTask}
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
            />
          </div>
          <div
            className="clock-view-container"
            style={{
              display: currentView === 'clock' ? 'flex' : 'none',
              flexDirection: 'column',
              flex: 1,
              padding: '10px 10px 0 10px',
              overflowY: 'auto'
            }}
          >
            <div
              className="clock-actions"
              style={{ padding: '0 0 16px 0', display: 'flex', gap: '16px', flexShrink: 0 }}
            >
              <button className="add-btn" onClick={addTimer}>
                <PlusCircle size={18} />
                Add a timer
              </button>
              <button className="add-btn" onClick={addStopwatch}>
                <TimerIcon size={18} /> Stopwatch
              </button>
            </div>

            <main className="timers-list" style={{ padding: '0 0 16px 0' }}>
              {timers.length === 0 ? (
                <div className="empty-state" style={{ padding: '60px 0' }}>
                  <TimerIcon size={64} />
                  <p>
                    No active timers.
                    <br />
                    Click the button above to add your first timer.
                  </p>
                </div>
              ) : (
                timers.map((timer) => (
                  <TimerCard
                    key={timer.id}
                    data={timer}
                    theme={theme}
                    onUpdate={(updates) => updateTimer(timer.id, updates)}
                    onDelete={() => deleteTimer(timer.id)}
                  />
                ))
              )}
            </main>
          </div>
        </div>
      </div>

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        theme={theme}
        setTheme={handleSetTheme}
        showFPS={showFPS}
        setShowFPS={setShowFPS}
        showTaskCounts={showTaskCounts}
        setShowTaskCounts={setShowTaskCounts}
        useGPU={useGPU}
        setUseGPU={setUseGPU}
        onSaveThemeAsDefault={async () => {
          // @ts-ignore
          await window.api.setStoreValue('ui-theme', theme)
          // @ts-ignore
          window.api.showNotification('Тема сохранена', 'Текущие цвета установлены по умолчанию.')
        }}
      />
    </div>
  )
}

export default App
