import { forwardRef, useState, useEffect, useRef } from 'react'
import {
  Plus,
  Folder,
  CheckSquare,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronRight,
  Archive,
  Trash2
} from 'lucide-react'
import type { Project, TaskItem, AppEvent } from '../../types'
import ProjectItem from './subcomponents/ProjectItem'
import TaskTree from './subcomponents/TaskTree'
import EventItem from './subcomponents/EventItem'
import ColorPicker from '../ColorPicker'
import { removeTaskFromTree, removeTaskFromProjects, migrateProjectTasks } from './utils'

interface LeftSidebarProps {
  projects: Project[]
  setProjects: (projects: Project[]) => void
  timelineTasks: any[]
  selectedProjectId: string | null
  setSelectedProjectId: (id: string | null) => void
  onAddProject: (name: string) => Promise<Project | null>
  onDeleteProject: (id: string) => void
  onTaskAdded: (projectId: string, name: string, parentId: string | null | undefined, explicitId?: string) => void
  onTaskDeleted: (taskName: string, taskId: string) => void
  onAssignTaskToTimer: (timerId: string, taskText: string) => void
  onAssignTaskToAlarm: (alarmId: string, taskText: string) => void
  isOpen: boolean
  showTaskCounts: boolean
  showColoredDots: boolean
}

const LeftSidebar = forwardRef<HTMLDivElement, LeftSidebarProps>((props, _ref) => {
  const {
    projects = [],
    setProjects,
    selectedProjectId,
    setSelectedProjectId,
    onAddProject,
    onDeleteProject,
    onTaskAdded,
    onTaskDeleted,
    isOpen,
    showTaskCounts,
    showColoredDots
  } = props

  // Local state for editing
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [colorPickerState, setColorPickerState] = useState<{
    projectId: string
    anchorRect: DOMRect
  } | null>(null)
  const [isArchiveView, setIsArchiveView] = useState(false)

  // Section expansion states
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(true)
  const [isTasksExpanded, setIsTasksExpanded] = useState(true)
  const [isEventsExpanded, setIsEventsExpanded] = useState(true)
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)

  // Resizer states
  const [tasksHeight, setTasksHeight] = useState(250)
  const [eventsHeight, setEventsHeight] = useState(200)
  const [isResizingTasks, setIsResizingTasks] = useState(false)
  const [isResizingEvents, setIsResizingEvents] = useState(false)
  const [resizeStartY, setResizeStartY] = useState(0)
  const [resizeStartHeight, setResizeStartHeight] = useState(250)

  const [isInitialLoading, setIsInitialLoading] = useState(true)

  // Refs
  const sidebarRef = useRef<HTMLDivElement>(null)
  const hasMigrated = useRef(false)

  // Migration for old completed tasks
  useEffect(() => {
    if (!isInitialLoading && projects.length > 0 && !hasMigrated.current) {
      const migrated = projects.map(migrateProjectTasks)
      // Simple check to see if anything actually changed
      if (JSON.stringify(migrated) !== JSON.stringify(projects)) {
        setProjects(migrated)
      }
      hasMigrated.current = true
    }
  }, [isInitialLoading, projects, setProjects])

  // Persistence: Load on Mount
  useEffect(() => {
    const loadSidebarState = async () => {
      try {
        // @ts-ignore
        const savedProjectsExp = await window.api.getStoreValue('sidebar-projects-expanded')
        // @ts-ignore
        const savedTasksExp = await window.api.getStoreValue('sidebar-tasks-expanded')
        // @ts-ignore
        const savedEventsExp = await window.api.getStoreValue('sidebar-events-expanded')
        // @ts-ignore
        const savedTasksH = await window.api.getStoreValue('sidebar-tasks-height')
        // @ts-ignore
        const savedEventsH = await window.api.getStoreValue('sidebar-events-height')

        if (savedProjectsExp !== null && savedProjectsExp !== undefined) setIsProjectsExpanded(savedProjectsExp)
        if (savedTasksExp !== null && savedTasksExp !== undefined) setIsTasksExpanded(savedTasksExp)
        if (savedEventsExp !== null && savedEventsExp !== undefined) setIsEventsExpanded(savedEventsExp)
        if (savedTasksH) setTasksHeight(savedTasksH)
        if (savedEventsH) setEventsHeight(savedEventsH)
      } catch (err) {
        console.error('Failed to load sidebar state:', err)
      } finally {
        setTimeout(() => setIsInitialLoading(false), 50)
      }
    }
    loadSidebarState()
  }, [])

  // Persistence: Save on Change
  useEffect(() => {
    const saveSidebarState = () => {
      if (!isResizingTasks && !isResizingEvents) {
        try {
          // @ts-ignore
          window.api.setStoreValue('sidebar-projects-expanded', isProjectsExpanded)
          // @ts-ignore
          window.api.setStoreValue('sidebar-tasks-expanded', isTasksExpanded)
          // @ts-ignore
          window.api.setStoreValue('sidebar-events-expanded', isEventsExpanded)
          // @ts-ignore
          window.api.setStoreValue('sidebar-tasks-height', tasksHeight)
          // @ts-ignore
          window.api.setStoreValue('sidebar-events-height', eventsHeight)
        } catch (err) {
          console.error('Failed to save sidebar state:', err)
        }
      }
    }
    const timeout = setTimeout(saveSidebarState, 500)
    return () => clearTimeout(timeout)
  }, [isProjectsExpanded, isTasksExpanded, isEventsExpanded, tasksHeight, eventsHeight, isResizingTasks, isResizingEvents])

  // Resizing logic
  useEffect(() => {
    if (!isResizingTasks && !isResizingEvents) return
    const handleMouseMove = (e: MouseEvent): void => {
      const deltaY = resizeStartY - e.clientY
      const newHeight = resizeStartHeight + deltaY
      if (isResizingTasks) {
        if (newHeight < 60) {
          if (isTasksExpanded) setIsTasksExpanded(false)
          setTasksHeight(0)
        } else {
          if (!isTasksExpanded && newHeight > 80) setIsTasksExpanded(true)
          setTasksHeight(Math.max(100, Math.min(newHeight, window.innerHeight * 0.8)))
        }
      } else if (isResizingEvents) {
        if (newHeight < 60) {
          if (isEventsExpanded) setIsEventsExpanded(false)
          setEventsHeight(0)
        } else {
          if (!isEventsExpanded && newHeight > 80) setIsEventsExpanded(true)
          setEventsHeight(Math.max(100, Math.min(newHeight, window.innerHeight * 0.8)))
        }
      }
    }
    const handleMouseUp = (): void => {
      setIsResizingTasks(false)
      setIsResizingEvents(false)
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizingTasks, isResizingEvents, resizeStartY, resizeStartHeight, isTasksExpanded, isEventsExpanded])

  // Auto-collapse projects
  useEffect(() => {
    if (!sidebarRef.current) return
    const sidebarHeight = sidebarRef.current.clientHeight
    const tasksH = isTasksExpanded ? tasksHeight : 40
    const eventsH = isEventsExpanded ? eventsHeight : 40
    const remainingForProjects = sidebarHeight - tasksH - eventsH
    if (remainingForProjects < 100 && isProjectsExpanded) setIsProjectsExpanded(false)
    else if (remainingForProjects > 150 && !isProjectsExpanded && isOpen) setIsProjectsExpanded(true)
  }, [tasksHeight, eventsHeight, isTasksExpanded, isEventsExpanded, isProjectsExpanded, isOpen])

  // Horizontal collapse sync
  useEffect(() => {
    if (!isOpen) {
      setIsTasksExpanded(false)
      setIsEventsExpanded(false)
      // Note: We no longer force isProjectsExpanded to false here 
      // to allow the compact project list to show in collapsed mode.
    }
  }, [isOpen])

  // Handlers
  const onUpdateProject = (id: string, updates: Partial<Project>) => {
    const updateRecursive = (list: Project[]): Project[] => {
      return list.map(p => {
        if (p.id === id) return { ...p, ...updates }
        if (p.subprojects && p.subprojects.length > 0) {
          return { ...p, subprojects: updateRecursive(p.subprojects) }
        }
        return p
      })
    }
    setProjects(updateRecursive(projects))
  }

  const handleColorChange = (color: string) => {
    if (colorPickerState) {
      onUpdateProject(colorPickerState.projectId, { color })
    }
  }
  const onUpdateTask = (projectId: string, taskId: string, updates: Partial<TaskItem>) => {
    // 1. Immediate update for UI responsiveness (toggle checkbox, rename, etc.)
    setProjects(prev => {
      const updateRecursive = (list: Project[]): Project[] => {
        return list.map(p => {
          if (p.id === projectId) {
            const upTask = (tasks: TaskItem[]): TaskItem[] =>
              tasks.map(t => {
                if (t.id === taskId) return { ...t, ...updates }
                if (t.subtasks) return { ...t, subtasks: upTask(t.subtasks) }
                return t
              })
            return {
              ...p,
              tasks: upTask(p.tasks || []),
              archivedTasks: upTask(p.archivedTasks || [])
            }
          }
          if (p.subprojects) return { ...p, subprojects: updateRecursive(p.subprojects) }
          return p
        })
      }
      return updateRecursive(prev)
    })

    // 2. Handle delayed archiving/unarchiving if completion state changed
    if (updates.completed !== undefined) {
      const isArchiving = updates.completed === true && !isArchiveView
      const isUnarchiving = updates.completed === false && isArchiveView

      if (isArchiving || isUnarchiving) {
        setTimeout(() => {
          setProjects(prev => {
            const moveRecursive = (list: Project[]): Project[] => {
              return list.map(p => {
                if (p.id === projectId) {
                  if (isArchiving) {
                    const { remaining, extracted } = removeTaskFromTree(p.tasks || [], taskId)
                    if (extracted) {
                      return {
                        ...p,
                        tasks: remaining,
                        archivedTasks: [...(p.archivedTasks || []), { ...extracted, completed: true }]
                      }
                    }
                  } else if (isUnarchiving) {
                    const { remaining, extracted } = removeTaskFromTree(p.archivedTasks || [], taskId)
                    if (extracted) {
                      return {
                        ...p,
                        archivedTasks: remaining,
                        tasks: [...(p.tasks || []), { ...extracted, completed: false }]
                      }
                    }
                  }
                }
                if (p.subprojects) return { ...p, subprojects: moveRecursive(p.subprojects) }
                return p
              })
            }
            return moveRecursive(prev)
          })
        }, 1000)
      }
    }
  }
  const onUpdateEvent = (projectId: string, eventId: string, updates: Partial<AppEvent>) => {
    // @ts-ignore
    setProjects(projects.map(p => p.id === projectId ? { ...p, events: (p.events || []).map(e => e.id === eventId ? { ...e, ...updates } : e) } : p))
  }
  const onAddEvent = (projectId: string, title: string) => {
    const newEvent: AppEvent = { id: Date.now().toString(), title }
    // @ts-ignore
    setProjects(projects.map(p => p.id === projectId ? { ...p, events: [...(p.events || []), newEvent] } : p))
  }
  const onDeleteEvent = (projectId: string, eventId: string) => {
    // @ts-ignore
    setProjects(projects.map(p => p.id === projectId ? { ...p, events: (p.events || []).filter(e => e.id !== eventId) } : p))
  }

  const onClearArchive = (projectId: string) => {
    setProjects(prev => {
      const updateRecursive = (list: Project[]): Project[] => {
        return list.map(p => {
          if (p.id === projectId) return { ...p, archivedTasks: [] }
          if (p.subprojects) return { ...p, subprojects: updateRecursive(p.subprojects) }
          return p
        })
      }
      return updateRecursive(prev)
    })
  }

  const findProjectRecursive = (list: Project[], id: string | null): Project | undefined => {
    if (!id) return undefined
    for (const p of list) {
      if (p.id === id) return p
      if (p.subprojects) {
        const found = findProjectRecursive(p.subprojects, id)
        if (found) return found
      }
    }
    return undefined
  }
  const selectedProject = findProjectRecursive(projects, selectedProjectId)

  if (!projects) return null

  return (
    <>
      <div ref={sidebarRef} className={`task-sidebar ${isOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* --- PROJECTS SECTION (Flexible, stays at top) --- */}
          <div className="sidebar-block" style={{ flex: '1 1 0%', display: 'flex', flexDirection: 'column', minHeight: '40px', transition: isInitialLoading ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', overflow: 'hidden' }}>
            <div className="sidebar-section-header" style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
              {isOpen ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 16px', height: '100%' }}>
                  <h3>Projects</h3>
                  <button 
                    onClick={async () => { const res = await onAddProject('New Project'); if (res) { setEditingId(res.id); setEditingValue(res.name) } }} 
                    className="task-add-btn premium-sidebar-btn" 
                    title="Add Project" 
                    style={{ 
                      width: '28px', 
                      height: '28px', 
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
                </div>
              ) : (
                <div className="sidebar-header-icon" title="Projects" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', color: 'var(--text-secondary)', opacity: 0.8 }}><Folder size={18} /></div>
              )}
            </div>
            {(isProjectsExpanded || !isOpen) && (
              <div className="task-list custom-scrollbar" style={{ marginBottom: isOpen ? '8px' : '16px', flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', scrollbarGutter: 'stable', padding: isOpen ? '0 12px' : '0', display: 'flex', flexDirection: 'column', alignItems: isOpen ? 'stretch' : 'center' }}>
                {projects.map((project) => (
                  <ProjectItem 
                    key={project.id} 
                    project={project} 
                    level={0} 
                    selectedProjectId={selectedProjectId} 
                    setSelectedProjectId={setSelectedProjectId} 
                    editingId={editingId} 
                    editingValue={editingValue} 
                    setEditingValue={setEditingValue} 
                    saveProjectName={(id) => { onUpdateProject(id, { name: editingValue }); setEditingId(null) }} 
                    saveTaskName={(pid, tid) => { onUpdateTask(pid, tid, { text: editingValue }); setEditingId(null) }} 
                    cancelEditing={() => setEditingId(null)} 
                    activeDropdown={activeDropdown} 
                    setActiveDropdown={setActiveDropdown} 
                    updateProjectColor={(id, col) => onUpdateProject(id, { color: col })} 
                    startEditing={(id, val) => { setEditingId(id); setEditingValue(val) }} 
                    deleteProject={onDeleteProject} 
                    toggleProjectExpansion={(id) => {
                      const findProjectRecursive = (list: Project[]): Project | undefined => {
                        for (const p of list) {
                          if (p.id === id) return p
                          if (p.subprojects) {
                            const found = findProjectRecursive(p.subprojects)
                            if (found) return found
                          }
                        }
                        return undefined
                      }
                      const project = findProjectRecursive(projects)
                      onUpdateProject(id, { isExpanded: !project?.isExpanded })
                    }} 
                    addSubProject={async (id) => { 
                      const res = await onAddProject('New Sub-project'); 
                      if (res) {
                        const findProjectRecursive = (list: Project[]): Project | undefined => {
                          for (const p of list) {
                            if (p.id === id) return p
                            if (p.subprojects) {
                              const found = findProjectRecursive(p.subprojects)
                              if (found) return found
                            }
                          }
                          return undefined
                        }
                        const targetProject = findProjectRecursive(projects);
                        onUpdateProject(id, { subprojects: [...(targetProject?.subprojects || []), res] })
                      }
                    }} 
                    quickAddTask={(id) => onTaskAdded(id, 'New Task', undefined)} 
                    onDragStart={() => {}} 
                    dropIndicator={null} 
                    isDragging={null} 
                    openColorPickerFor={(id, rect) => setColorPickerState({ projectId: id, anchorRect: rect })} 
                    showTaskCounts={showTaskCounts} 
                    showColoredDots={showColoredDots} 
                    isOpen={isOpen} 
                  />
                ))}
              </div>
            )}
          </div>

          {/* --- BOTTOM ANCHORED AREA (Tasks and Events) --- */}
          <div className="sidebar-bottom-area" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--card-bg)' }}>
            {/* --- TASKS SECTION --- */}
            <div 
              className={`sidebar-resizer section-divider is-resizable ${isResizingTasks ? 'is-resizing' : ''}`} 
              style={{ height: '12px', zIndex: 100 }}
              onMouseDown={(e) => { 
                if (!isOpen) return;
                e.preventDefault(); 
                setResizeStartY(e.clientY); 
                setResizeStartHeight(isTasksExpanded ? tasksHeight : 0); 
                setIsResizingTasks(true) 
              }} 
            />
            <div className="sidebar-block" style={{ height: isTasksExpanded ? `${tasksHeight}px` : '40px', display: 'flex', flexDirection: 'column', transition: (isResizingTasks || isInitialLoading) ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', overflow: 'hidden', flexShrink: 0 }}>
              <div className="sidebar-section-header" style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                {isOpen ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 16px', height: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3>{isArchiveView ? 'Archive' : 'Tasks'}</h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button 
                      onClick={() => setIsArchiveView(!isArchiveView)} 
                      className={`premium-sidebar-btn ${isArchiveView ? 'active' : ''}`} 
                      title={isArchiveView ? 'View Active Tasks' : 'View Archive'} 
                      style={{ 
                        width: '28px', 
                        height: '28px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        background: isArchiveView ? 'rgba(255,255,255,0.1)' : 'none', 
                        border: 'none', 
                        borderRadius: '6px', 
                        color: isArchiveView ? 'var(--text-primary)' : 'var(--text-secondary)', 
                        cursor: 'pointer', 
                        padding: 0 
                      }}
                    >
                      <Archive size={14} />
                    </button>
                    {isArchiveView ? (
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (selectedProject && window.confirm('Are you sure you want to clear the archive for this project? This action cannot be undone.')) {
                            onClearArchive(selectedProject.id) 
                          }
                        }} 
                        className="task-clear-btn premium-sidebar-btn" 
                        title="Clear Archive" 
                        disabled={!selectedProject || !selectedProject.archivedTasks || selectedProject.archivedTasks.length === 0} 
                        style={{ 
                          width: '28px', 
                          height: '28px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          background: 'none', 
                          border: 'none', 
                          borderRadius: '6px', 
                          color: 'var(--text-secondary)', 
                          cursor: (selectedProject?.archivedTasks?.length || 0) > 0 ? 'pointer' : 'default', 
                          padding: 0, 
                          opacity: (selectedProject?.archivedTasks?.length || 0) > 0 ? 1 : 0.3 
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <button 
                        onClick={(e) => { e.stopPropagation(); if (isTasksExpanded && selectedProject) onTaskAdded(selectedProject.id, 'New Task', undefined) }} 
                        className="task-add-btn premium-sidebar-btn" 
                        title="Add Task" 
                        disabled={!isTasksExpanded || !selectedProject} 
                        style={{ 
                          width: '28px', 
                          height: '28px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          background: 'none', 
                          border: 'none', 
                          borderRadius: '6px', 
                          color: 'var(--text-secondary)', 
                          cursor: isTasksExpanded ? 'pointer' : 'default', 
                          padding: 0, 
                          opacity: isTasksExpanded ? 1 : 0.3 
                        }}
                      >
                        <Plus size={14} />
                      </button>
                    )}
                      <button 
                        onClick={(e) => { e.stopPropagation(); setIsTasksExpanded(!isTasksExpanded) }} 
                        className="premium-sidebar-btn" 
                        title={isTasksExpanded ? 'Collapse Tasks' : 'Expand Tasks'} 
                        style={{ 
                          width: '28px', 
                          height: '28px', 
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
                        {isTasksExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="sidebar-header-icon" title={isArchiveView ? 'Archive' : 'Tasks'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', color: 'var(--text-secondary)', opacity: 0.8 }}>
                    {isArchiveView ? <Archive size={18} /> : <CheckSquare size={18} />}
                  </div>
                )}
              </div>
              {isTasksExpanded && selectedProject && (
                <div className="tasks-list custom-scrollbar" style={{ flex: 1, padding: '0 12px 12px 12px', overflowY: 'auto' }}>
                  <TaskTree 
                    project={selectedProject} 
                    isRoot={true} 
                    isArchiveView={isArchiveView} 
                    toggleTask={(pid, tid) => {
                      const findTaskInTree = (p: Project): TaskItem | null => {
                        const search = (list: TaskItem[]): TaskItem | null => {
                          for (const t of list) {
                            if (t.id === tid) return t
                            if (t.subtasks) {
                              const f = search(t.subtasks)
                              if (f) return f
                            }
                          }
                          return null
                        }
                        const f1 = search(p.tasks || [])
                        if (f1) return f1
                        const f2 = search(p.archivedTasks || [])
                        if (f2) return f2
                        if (p.subprojects) {
                          for (const sub of p.subprojects) {
                            const f3 = findTaskInTree(sub)
                            if (f3) return f3
                          }
                        }
                        return null
                      }
                      if (!selectedProject) return
                      const task = findTaskInTree(selectedProject)
                      onUpdateTask(pid, tid, { completed: !task?.completed })
                    }}
                    toggleTaskExpansion={(pid, tid) => {
                      const findTaskInTree = (p: Project): TaskItem | null => {
                        const search = (list: TaskItem[]): TaskItem | null => {
                          for (const t of list) {
                            if (t.id === tid) return t
                            if (t.subtasks) {
                              const f = search(t.subtasks)
                              if (f) return f
                            }
                          }
                          return null
                        }
                        const f1 = search(p.tasks || [])
                        if (f1) return f1
                        const f2 = search(p.archivedTasks || [])
                        if (f2) return f2
                        if (p.subprojects) {
                          for (const sub of p.subprojects) {
                            const f3 = findTaskInTree(sub)
                            if (f3) return f3
                          }
                        }
                        return null
                      }
                      if (!selectedProject) return
                      const task = findTaskInTree(selectedProject)
                      onUpdateTask(pid, tid, { isExpanded: !task?.isExpanded })
                    }}
                    editingId={editingId} 
                    editingValue={editingValue} 
                    setEditingValue={setEditingValue} 
                    saveTaskName={(pid, tid) => { onUpdateTask(pid, tid, { text: editingValue }); setEditingId(null) }} 
                    cancelEditing={() => setEditingId(null)} 
                    startEditing={(id, val) => { setEditingId(id); setEditingValue(val) }} 
                    deleteTask={(_pid, tid) => {
                      const findTaskInTree = (p: Project): TaskItem | null => {
                        const search = (list: TaskItem[]): TaskItem | null => {
                          for (const t of list) {
                            if (t.id === tid) return t
                            if (t.subtasks) {
                              const f = search(t.subtasks)
                              if (f) return f
                            }
                          }
                          return null
                        }
                        const f1 = search(p.tasks || [])
                        if (f1) return f1
                        const f2 = search(p.archivedTasks || [])
                        if (f2) return f2
                        if (p.subprojects) {
                          for (const sub of p.subprojects) {
                            const f3 = findTaskInTree(sub)
                            if (f3) return f3
                          }
                        }
                        return null
                      }
                      if (!selectedProject) return
                      const task = findTaskInTree(selectedProject)
                      onTaskDeleted(task?.text || '', tid)
                      
                      // Also remove from project tree
                      setProjects(removeTaskFromProjects(projects, tid).projects)
                    }} 
                    getTaskTimelineDate={() => null} 
                    onTaskAdded={onTaskAdded} 
                    isDragging={null} 
                    dropIndicator={null} 
                    startMouseDrag={() => {}} 
                    showTaskCounts={showTaskCounts} 
                  />
                </div>
              )}
            </div>

            {/* --- EVENTS SECTION --- */}
            <div 
              className={`sidebar-resizer section-divider is-resizable ${isResizingEvents ? 'is-resizing' : ''}`} 
              style={{ height: '12px', zIndex: 100 }}
              onMouseDown={(e) => { 
                if (!isOpen) return;
                e.preventDefault(); 
                setResizeStartY(e.clientY); 
                setResizeStartHeight(isEventsExpanded ? eventsHeight : 0); 
                setIsResizingEvents(true) 
              }} 
            />
            <div className="sidebar-block" style={{ height: isEventsExpanded ? `${eventsHeight}px` : '40px', display: 'flex', flexDirection: 'column', transition: (isResizingEvents || isInitialLoading) ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', overflow: 'hidden', flexShrink: 0 }}>
              <div className="sidebar-section-header" style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                {isOpen ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 16px', height: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3>Events</h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); if (isEventsExpanded && selectedProject) onAddEvent(selectedProject.id, 'New Event') }} 
                        className="event-add-btn premium-sidebar-btn" 
                        title="Add Event" 
                        disabled={!isEventsExpanded || !selectedProject} 
                        style={{ 
                          width: '28px', 
                          height: '28px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          background: 'none', 
                          border: 'none', 
                          borderRadius: '6px', 
                          color: 'var(--text-secondary)', 
                          cursor: isEventsExpanded ? 'pointer' : 'default', 
                          padding: 0, 
                          opacity: isEventsExpanded ? 1 : 0.3 
                        }}
                      >
                        <Plus size={14} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setIsEventsExpanded(!isEventsExpanded) }} 
                        className="premium-sidebar-btn" 
                        title={isEventsExpanded ? 'Collapse Events' : 'Expand Events'} 
                        style={{ 
                          width: '28px', 
                          height: '28px', 
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
                        {isEventsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="sidebar-header-icon" title="Events" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', color: 'var(--text-secondary)', opacity: 0.8 }}>
                    <CalendarIcon size={18} />
                  </div>
                )}
              </div>
              {isEventsExpanded && selectedProject && (
                <div className="events-list custom-scrollbar" style={{ flex: 1, padding: '0 12px 12px 12px', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {selectedProject.events?.map((event) => (
                      <EventItem 
                        key={event.id} 
                        selectedProjectId={selectedProject.id} 
                        event={event} 
                        editingId={editingId} 
                        editingValue={editingValue} 
                        setEditingValue={setEditingValue} 
                        saveEventName={(pid, eid) => { onUpdateEvent(pid, eid, { title: editingValue }); setEditingId(null) }} 
                        cancelEditing={() => setEditingId(null)} 
                        startEditing={(id, val) => { setEditingId(id); setEditingValue(val) }} 
                        deleteEvent={onDeleteEvent} 
                        updateEvent={onUpdateEvent} 
                        isExpanded={expandedEventId === event.id} 
                        setExpandedEventId={setExpandedEventId} 
                        projectColor={selectedProject.color}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="section-divider" />
          </div>
        </div>
      </div>
      {colorPickerState && (
        <ColorPicker anchorRect={colorPickerState.anchorRect} onClose={() => setColorPickerState(null)} onChange={handleColorChange} color={projects.find((p) => p.id === colorPickerState.projectId)?.color || 'var(--accent)'} />
      )}
    </>
  )
})

export default LeftSidebar
