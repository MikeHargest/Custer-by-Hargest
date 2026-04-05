import { useState, useEffect, useRef, memo, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import * as LucideIcons from 'lucide-react'
import {
  CheckSquare,
  Square,
  Trash2,
  Plus,
  Pencil,
  MoreVertical,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock
} from 'lucide-react'
import { Project, TaskItem, TimelineTask, AppEvent } from '../types'
import ColorPicker from './ColorPicker'

const DropZone = ({
  dzAction,
  dzProject,
  dzTask
}: {
  dzAction: string
  dzProject: string
  dzTask?: string
}): React.ReactElement => {
  return (
    <div
      data-dropzone="true"
      data-dz-action={dzAction}
      data-dz-project={dzProject}
      data-dz-task={dzTask || ''}
      style={{
        height: '20px',
        margin: '-10px 0',
        position: 'relative',
        zIndex: 100
      }}
    />
  )
}

const findProjectRecursive = (projects: Project[], id: string | null): Project | undefined => {
  if (!id) return undefined
  for (const p of projects) {
    if (p.id === id) return p
    if (p.subprojects) {
      const found = findProjectRecursive(p.subprojects, id)
      if (found) return found
    }
  }
  return undefined
}

const getTreeDepth = (task: TaskItem): number => {
  if (!task.subtasks || task.subtasks.length === 0) return 0
  return 1 + Math.max(...task.subtasks.map((s) => getTreeDepth(s)))
}

const flattenTree = (task: TaskItem): TaskItem[] => {
  const result: TaskItem[] = [{ ...task, subtasks: [] }]
  if (task.subtasks) {
    for (const sub of task.subtasks) {
      result.push(...flattenTree(sub))
    }
  }
  return result
}

const removeTaskFromTree = (
  tasks: TaskItem[],
  taskId: string
): { remaining: TaskItem[]; extracted: TaskItem | null } => {
  let extracted: TaskItem | null = null
  const remaining = tasks.reduce((acc: TaskItem[], t) => {
    if (t.id === taskId) {
      extracted = { ...t, subtasks: t.subtasks ? [...t.subtasks] : [] }
      return acc
    }
    if (t.subtasks && t.subtasks.length > 0) {
      const childResult = removeTaskFromTree(t.subtasks, taskId)
      if (childResult.extracted) extracted = childResult.extracted
      acc.push({ ...t, subtasks: childResult.remaining })
    } else {
      acc.push(t)
    }
    return acc
  }, [])
  return { remaining, extracted }
}

const removeTaskFromProjects = (
  projs: Project[],
  taskId: string
): { projects: Project[]; extracted: TaskItem | null } => {
  let extracted: TaskItem | null = null
  const projects = projs.map((p) => {
    const result = removeTaskFromTree(p.tasks || [], taskId)
    if (result.extracted) extracted = result.extracted
    return {
      ...p,
      tasks: result.remaining,
      subprojects: (() => {
        if (!p.subprojects) return []
        const subResult = removeTaskFromProjects(p.subprojects, taskId)
        if (subResult.extracted) extracted = subResult.extracted
        return subResult.projects
      })()
    }
  })
  return { projects, extracted }
}

const enforceDepthLimit = (task: TaskItem, availableDepth: number): TaskItem => {
  if (availableDepth <= 0) {
    return { ...task, subtasks: [] }
  }
  if (!task.subtasks || task.subtasks.length === 0) return task

  const treeDepth = getTreeDepth(task)
  if (treeDepth <= availableDepth) {
    return task
  }

  const allDescendants = flattenTree(task).slice(1)
  return { ...task, subtasks: allDescendants }
}

const getDepthOfTaskInList = (
  tasks: TaskItem[],
  targetId: string,
  currentDepth: number
): number | null => {
  for (const t of tasks) {
    if (t.id === targetId) return currentDepth
    if (t.subtasks && t.subtasks.length > 0) {
      const d = getDepthOfTaskInList(t.subtasks, targetId, currentDepth + 1)
      if (d !== null) return d
    }
  }
  return null
}

const removeProjectFromTree = (
  projs: Project[],
  projectId: string
): { projects: Project[]; extracted: Project | null } => {
  let extracted: Project | null = null
  const projects = projs.reduce((acc: Project[], p) => {
    if (p.id === projectId) {
      extracted = p
      return acc
    }
    if (p.subprojects && p.subprojects.length > 0) {
      const childResult = removeProjectFromTree(p.subprojects, projectId)
      if (childResult.extracted) extracted = childResult.extracted
      acc.push({ ...p, subprojects: childResult.projects })
    } else {
      acc.push(p)
    }
    return acc
  }, [])
  return { projects, extracted }
}

interface EventRendererProps {
  event: AppEvent
  selectedProjectId: string
  editingId: string | null
  editingValue: string
  cancelEditing: () => void
  deleteEvent: (projectId: string, eventId: string) => void
  updateEvent: (
    projectId: string,
    eventId: string,
    field: 'title' | 'date' | 'time',
    value: string
  ) => void
  setEditingValue: (val: string) => void
  saveEventName: (projectId: string, eventId: string) => void
  isExpanded: boolean
  setExpandedEventId: (id: string | null) => void
  projectColor?: string
}

const EventRenderer = memo(function EventRenderer({
  event,
  selectedProjectId,
  editingId,
  editingValue,
  cancelEditing,
  deleteEvent,
  updateEvent,
  setEditingValue,
  saveEventName,
  isExpanded,
  setExpandedEventId,
  projectColor
}: EventRendererProps) {
  return (
    <div
      key={event.id}
      className="event-card premium-event-item"
      style={{
        position: 'relative',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '14px',
        border: isExpanded ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
        transition: 'all 0.2s',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '3px',
          background: projectColor || 'var(--accent)'
        }}
      />
      <div
        style={{
          padding: '8px 10px 8px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer'
        }}
        onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flex: 1,
            minWidth: 0
          }}
        >
          {isExpanded ? (
            <ChevronDown size={12} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
          ) : (
            <ChevronRight size={12} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
          )}
          {editingId === event.id ? (
            <textarea
              className="inline-edit-input"
              value={editingValue}
              onChange={(e) => {
                setEditingValue(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${e.target.scrollHeight}px`
              }}
              onBlur={() => saveEventName(selectedProjectId, event.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  saveEventName(selectedProjectId, event.id)
                }
                if (e.key === 'Escape') cancelEditing()
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              ref={(el) => {
                if (el) {
                  el.style.height = 'auto'
                  el.style.height = `${el.scrollHeight}px`
                }
              }}
              style={{
                width: '100%',
                resize: 'none',
                minHeight: '20px',
                fontFamily: 'inherit',
                lineHeight: '1.4',
                padding: '2px 4px',
                margin: '-3px 0'
              }}
            />
          ) : (
            <span
              style={{
                fontSize: '13px',
                fontWeight: 400,
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {event.title}
            </span>
          )}
          {!isExpanded && (event.date || event.time) && (
            <span
              style={{
                fontSize: '10px',
                color: 'var(--text-secondary)',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {event.date && (
                <>
                  <Calendar size={9} />{' '}
                  {new Date(event.date + 'T00:00:00').toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric'
                  })}
                </>
              )}
              {event.time && (
                <>
                  <Clock size={9} /> {event.time}
                </>
              )}
            </span>
          )}
        </div>
        <button
          className="task-delete-btn"
          onClick={(e) => {
            e.stopPropagation()
            deleteEvent(selectedProjectId, event.id)
          }}
          style={{ opacity: 0.5, flexShrink: 0 }}
        >
          <Trash2 size={12} />
        </button>
      </div>
      {isExpanded && (
        <div
          style={{
            padding: '0 8px 12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            borderTop: '1px solid rgba(255,255,255,0.04)'
          }}
        >
          <div style={{ paddingTop: '8px' }}>
            <label
              style={{
                fontSize: '10px',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '4px',
                display: 'block'
              }}
            >
              Title
            </label>
            <input
              className="inline-edit-input"
              value={event.title || ''}
              onChange={(e) => updateEvent(selectedProjectId, event.id, 'title', e.target.value)}
              style={{ width: '100%' }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  fontSize: '10px',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '4px',
                  display: 'block'
                }}
              >
                Date
              </label>
              <input
                type="date"
                className="inline-edit-input"
                value={event.date || ''}
                onChange={(e) => updateEvent(selectedProjectId, event.id, 'date', e.target.value)}
                style={{ width: '100%' }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  fontSize: '10px',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '4px',
                  display: 'block'
                }}
              >
                Time
              </label>
              <input
                type="time"
                className="inline-edit-input"
                value={event.time || ''}
                onChange={(e) => updateEvent(selectedProjectId, event.id, 'time', e.target.value)}
                style={{ width: '100%' }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              marginTop: '8px'
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                setExpandedEventId(null)
              }}
              style={{
                background: 'var(--accent)',
                border: 'none',
                color: 'white',
                padding: '4px 12px',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
})

interface TaskItemRendererProps {
  task: TaskItem
  project: Project
  depth: number
  toggleTask: (projectId: string, taskId: string) => void
  toggleTaskExpansion: (projectId: string, taskId: string) => void
  editingId: string | null
  editingValue: string
  setEditingValue: (val: string) => void
  saveTaskName: (projectId: string, taskId: string) => void
  cancelEditing: () => void
  startEditing: (id: string, value: string) => void
  deleteTask: (projectId: string, taskId: string) => void
  getTaskTimelineDate: (projectId: string, taskId: string) => string | null
  onTaskAdded: (projectId: string, name: string, parentId?: string, explicitId?: string) => void
  isDragging: string | null
  dropIndicator: any
  startMouseDrag: (e: React.MouseEvent, info: any) => void
  showTaskCounts: boolean
}

const TaskItemRenderer = memo(function TaskItemRenderer({
  task,
  project,
  depth,
  toggleTask,
  toggleTaskExpansion,
  editingId,
  editingValue,
  setEditingValue,
  saveTaskName,
  cancelEditing,
  startEditing,
  deleteTask,
  getTaskTimelineDate,
  onTaskAdded,
  isDragging,
  dropIndicator,
  startMouseDrag,
  showTaskCounts
}: TaskItemRendererProps) {
  const isSubtask = depth > 0

  return (
    <div key={task.id}>
      <div
        className={`${isSubtask ? 'premium-subtask-item' : 'premium-task-card'} depth-${depth} ${
          task.completed ? 'completed' : ''
        } ${
          dropIndicator?.id === task.id &&
          dropIndicator.position === 'inside' &&
          dropIndicator.type === 'task'
            ? 'drag-over-nest'
            : ''
        }`}
        data-task-id={task.id}
        data-project-id={project.id}
        data-depth={depth}
        onMouseDown={(e) => {
          const target = e.target as HTMLElement
          if (
            target.closest('button') ||
            target.closest('input') ||
            target.closest('textarea') ||
            target.closest('a')
          )
            return
          startMouseDrag(e, { type: 'task', projectId: project.id, taskId: task.id })
        }}
        style={{
          position: 'relative',
          cursor: isDragging ? 'grabbing' : 'grab',
          opacity: isDragging === task.id ? 0.4 : 1,
          borderTop:
            dropIndicator?.id === task.id &&
            dropIndicator.position === 'before' &&
            dropIndicator.type === 'task'
              ? '2px solid var(--accent)'
              : undefined,
          borderBottom:
            dropIndicator?.id === task.id &&
            dropIndicator.position === 'after' &&
            dropIndicator.type === 'task'
              ? '2px solid var(--accent)'
              : undefined
        }}
      >
        <div className="task-row">
          <button
            className="task-checkbox"
            style={{
              marginRight: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: task.completed ? 'var(--success)' : 'var(--text-secondary)'
            }}
            onClick={() => toggleTask(project.id, task.id)}
          >
            {task.completed ? <CheckSquare size={14} /> : <Square size={14} />}
          </button>

          <div
            className="task-content"
            onClick={() => toggleTaskExpansion(project.id, task.id)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              textAlign: 'left',
              cursor: 'pointer',
              minWidth: 0
            }}
          >
            {editingId === task.id ? (
              <textarea
                className="inline-edit-input"
                value={editingValue}
                onChange={(e) => {
                  setEditingValue(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = `${e.target.scrollHeight}px`
                }}
                onBlur={() => saveTaskName(project.id, task.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    saveTaskName(project.id, task.id)
                  }
                  if (e.key === 'Escape') cancelEditing()
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                ref={(el) => {
                  if (el) {
                    el.style.height = 'auto'
                    el.style.height = `${el.scrollHeight}px`
                  }
                }}
                style={{
                  width: '100%',
                  resize: 'none',
                  minHeight: '20px',
                  fontFamily: 'inherit',
                  lineHeight: '1.4',
                  padding: '2px 4px',
                  margin: '-3px 0'
                }}
              />
            ) : (
              <span
                className="task-text"
                style={{
                  fontSize: '13px',
                  fontWeight: 400,
                  flex: 1,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}
              >
                {task.text}
              </span>
            )}
          </div>

          {getTaskTimelineDate(project.id, task.id) && (
            <span
              style={{
                fontSize: '10px',
                background: 'rgba(255,255,255,0.06)',
                padding: '2px 6px',
                borderRadius: '4px',
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                marginRight: '4px'
              }}
            >
              {getTaskTimelineDate(project.id, task.id)}
            </span>
          )}

          <div
            className="task-actions"
            style={{ display: 'flex', alignItems: 'center', gap: '2px' }}
          >
            {depth < 2 && (
              <button
                className="task-edit-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  const subtaskName = `Subtask ${(task.subtasks?.length || 0) + 1}`
                  const subtaskId = uuidv4()
                  onTaskAdded(project.id, subtaskName, task.id, subtaskId)
                  setTimeout(() => startEditing(subtaskId, subtaskName), 0)
                }}
                title="Add Subtask"
              >
                <Plus size={14} />
              </button>
            )}
            <button
              className="task-edit-btn"
              onClick={(e) => {
                e.stopPropagation()
                startEditing(task.id, task.text)
              }}
              title="Edit Task"
            >
              <Pencil size={12} />
            </button>
            <button
              className="task-delete-btn"
              onClick={(e) => {
                e.stopPropagation()
                deleteTask(project.id, task.id)
              }}
              title="Delete Task"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {task.subtasks && task.subtasks.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleTaskExpansion(project.id, task.id)
            }}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '4px',
              padding: '0px 8px',
              height: '14px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              opacity: 0.7,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: '2px'
            }}
            title={task.isExpanded ? 'Свернуть' : 'Развернуть'}
          >
            {task.isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}

        {task.isExpanded && (
          <div className="subtasks-container">
            {task.subtasks &&
              task.subtasks.map((subtask) => (
                <TaskItemRenderer
                  key={subtask.id}
                  task={subtask}
                  project={project}
                  depth={depth + 1}
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
              ))}
            <DropZone dzAction="inside" dzProject={project.id} dzTask={task.id} />
          </div>
        )}
      </div>
    </div>
  )
})

interface TaskRendererProps {
  project: Project
  isRoot: boolean
  toggleTask: (projectId: string, taskId: string) => void
  toggleTaskExpansion: (projectId: string, taskId: string) => void
  editingId: string | null
  editingValue: string
  setEditingValue: (val: string) => void
  saveTaskName: (projectId: string, taskId: string) => void
  cancelEditing: () => void
  startEditing: (id: string, value: string) => void
  deleteTask: (projectId: string, taskId: string) => void
  getTaskTimelineDate: (projectId: string, taskId: string) => string | null
  onTaskAdded: (projectId: string, name: string, parentId?: string, explicitId?: string) => void
  isDragging: string | null
  dropIndicator: any
  startMouseDrag: (e: React.MouseEvent, info: any) => void
  showTaskCounts: boolean
}

const TaskRenderer = memo(function TaskRenderer({
  project,
  isRoot,
  toggleTask,
  toggleTaskExpansion,
  editingId,
  editingValue,
  setEditingValue,
  saveTaskName,
  cancelEditing,
  startEditing,
  deleteTask,
  getTaskTimelineDate,
  onTaskAdded,
  isDragging,
  dropIndicator,
  startMouseDrag,
  showTaskCounts
}: TaskRendererProps) {
  const projectTasks = project.tasks || []
  return (
    <div key={project.id}>
      {!isRoot && projectTasks.length > 0 && (
        <div
          style={{
            fontSize: '11px',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
            marginTop: '16px',
            marginBottom: '8px',
            paddingLeft: '4px',
            opacity: 0.8,
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            paddingBottom: '4px'
          }}
        >
          {project.name}
        </div>
      )}
      {projectTasks.map((task) => (
        <TaskItemRenderer
          key={task.id}
          task={task}
          project={project}
          depth={0}
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
      ))}
      {project.subprojects?.map((sub) => (
        <TaskRenderer
          key={sub.id}
          project={sub}
          isRoot={false}
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
      ))}
      {projectTasks.length > 0 && <DropZone dzAction="project" dzProject={project.id} />}
    </div>
  )
})

interface ProjectRendererProps {
  project: Project
  level: number
  selectedProjectId: string | null
  setSelectedProjectId: (id: string | null) => void
  editingId: string | null
  editingValue: string
  setEditingValue: (val: string) => void
  saveProjectName: (id: string, newValue?: string) => void
  saveTaskName: (projectId: string, taskId: string) => void
  cancelEditing: () => void
  activeDropdown: string | null
  setActiveDropdown: (id: string | null) => void
  updateProjectColor: (id: string, color: string) => void
  startEditing: (id: string, val: string) => void
  deleteProject: (id: string) => void
  toggleProjectExpansion: (id: string, e: React.MouseEvent) => void
  addSubProject: (id: string, e?: React.MouseEvent) => Promise<void>
  quickAddTask: (id: string) => void
  onDragStart: (
    e: React.MouseEvent,
    idOrData: string | { type: 'task' | 'project'; projectId: string; taskId: string }
  ) => void
  dropIndicator: {
    id: string
    position: 'before' | 'inside' | 'after'
    type: 'project' | 'task'
  } | null
  isDragging: string | null
  parentColor?: string
  openColorPickerFor: (projectId: string, rect: DOMRect) => void
  showTaskCounts: boolean
}

const ProjectRenderer = memo(function ProjectRenderer({
  project,
  level,
  selectedProjectId,
  setSelectedProjectId,
  editingId,
  editingValue,
  setEditingValue,
  saveProjectName,
  saveTaskName,
  cancelEditing,
  activeDropdown,
  setActiveDropdown,
  updateProjectColor,
  startEditing,
  deleteProject,
  toggleProjectExpansion,
  addSubProject,
  quickAddTask,
  onDragStart,
  dropIndicator,
  isDragging,
  parentColor,
  openColorPickerFor,
  showTaskCounts
}: ProjectRendererProps): React.ReactElement {
  const isSelected = selectedProjectId === project.id
  const displayColor = project.color || parentColor || 'var(--accent)'

  return (
    <div key={project.id}>
      <div
        className={`premium-project-item ${isSelected ? 'selected' : ''} ${
          activeDropdown === project.id ? 'has-dropdown' : ''
        } ${editingId === project.id ? 'is-editing' : ''} ${
          dropIndicator?.id === project.id && dropIndicator.position === 'inside'
            ? 'drag-over-nest'
            : ''
        }`}
        data-project-id={project.id}
        data-level={level}
        style={{
          marginLeft: `${level * 16}px`,
          zIndex:
            activeDropdown === project.id || editingId === project.id || isDragging === project.id
              ? 9990
              : undefined,
          opacity: isDragging === project.id ? 0.4 : 1,
          borderTop:
            dropIndicator?.id === project.id &&
            dropIndicator.position === 'before' &&
            dropIndicator.type === 'project'
              ? '2px solid var(--accent)'
              : undefined,
          borderBottom:
            dropIndicator?.id === project.id &&
            dropIndicator.position === 'after' &&
            dropIndicator.type === 'project'
              ? '2px solid var(--accent)'
              : undefined
        }}
        onClick={() => {
          if (editingId === project.id) return
          setSelectedProjectId(project.id)
        }}
        onMouseDown={(e) => {
          if (editingId === project.id) return
          const target = e.target as HTMLElement
          if (
            target.closest('button') ||
            target.closest('input') ||
            target.closest('textarea') ||
            target.closest('a')
          )
            return
          onDragStart(e, { type: 'project', projectId: project.id, taskId: '' })
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 6px 4px 8px'
          }}
        >
          {/* Move the chevron button down below the name */}

          {(() => {
            if (project.icon?.startsWith('file')) {
              return (
                <img
                  src={project.icon}
                  alt=""
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: 'var(--radius-sm)',
                    objectFit: 'cover',
                    flexShrink: 0
                  }}
                />
              )
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const IconComponent = (LucideIcons as any)[project.icon || 'Briefcase']
            if (IconComponent) {
              return <IconComponent size={16} style={{ color: displayColor, flexShrink: 0 }} />
            }
            return (
              <span
                style={{
                  fontSize: '14px',
                  width: '16px',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '2px'
                }}
              >
                {project.icon}
              </span>
            )
          })()}

          {editingId === project.id ? (
            <input
              className="inline-edit-input"
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onBlur={(e) => {
                const currentValue = e.target.value
                setEditingValue(currentValue)
                setTimeout(() => saveProjectName(project.id, currentValue), 0)
              }}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') {
                  const currentValue = e.currentTarget.value
                  setEditingValue(currentValue)
                  setTimeout(() => saveProjectName(project.id, currentValue), 0)
                }
                if (e.key === 'Escape') cancelEditing()
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                minWidth: 0,
                overflow: 'hidden'
              }}
            >
              <span
                className="task-text"
                style={{
                  fontSize: '13px',
                  fontWeight: isSelected ? 600 : 400,
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {project.name}
              </span>
              {showTaskCounts &&
                ((): React.ReactNode => {
                  let count = 0
                  const traverse = (tasks: TaskItem[]): void => {
                    count += tasks.length
                    tasks.forEach((t) => {
                      if (t.subtasks) traverse(t.subtasks)
                    })
                  }
                  if (project.tasks) traverse(project.tasks)
                  if (count === 0) return null
                  return (
                    <span
                      style={{
                        marginLeft: '8px',
                        fontSize: '11px',
                        color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                        opacity: 0.6,
                        fontWeight: 500,
                        flexShrink: 0
                      }}
                    >
                      {count}
                    </span>
                  )
                })()}
            </div>
          )}

          <div
            style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '2px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Direct Add Task button in the sidebar list */}

            <button
              onClick={(e) => toggleProjectExpansion(project.id, e)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '2px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                visibility:
                  project.subprojects && project.subprojects.length > 0 ? 'visible' : 'hidden'
              }}
            >
              {project.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            <div style={{ position: 'relative' }}>
              <button
                className={`task-edit-btn ${activeDropdown === project.id ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveDropdown(activeDropdown === project.id ? null : project.id)
                }}
                title="Project Settings"
                style={{ padding: '2px' }}
              >
                <MoreVertical size={12} />
              </button>
              {activeDropdown === project.id && (
                <div
                  className="project-dropdown"
                  style={{ right: 0, left: 'auto' }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {level === 0 && (
                    <button
                      className="project-dropdown-item"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        setActiveDropdown(null)
                        openColorPickerFor(project.id, rect)
                      }}
                    >
                      <div
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          background: project.color || 'var(--accent)',
                          border: '1px solid rgba(255,255,255,0.2)'
                        }}
                      />
                      <span>Project Color</span>
                    </button>
                  )}
                  <button
                    className="project-dropdown-item"
                    onClick={() => {
                      setActiveDropdown(null)
                      setTimeout(() => startEditing(project.id, project.name), 0)
                    }}
                  >
                    <Pencil size={14} />
                    <span>Rename Project</span>
                  </button>
                  <button
                    className="project-dropdown-item"
                    onClick={() => {
                      setActiveDropdown(null)
                      addSubProject(project.id)
                    }}
                  >
                    <Plus size={14} />
                    <span>Add Subproject</span>
                  </button>
                  <div
                    style={{
                      height: '1px',
                      background: 'rgba(255,255,255,0.1)',
                      margin: '2px 0'
                    }}
                  />
                  <button
                    className="project-dropdown-item danger"
                    onClick={() => {
                      setActiveDropdown(null)
                      deleteProject(project.id)
                      if (selectedProjectId === project.id) setSelectedProjectId(null)
                    }}
                  >
                    <Trash2 size={14} />
                    <span>Delete Project</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {project.isExpanded && project.subprojects && (
        <div>
          {project.subprojects.map((sub) => (
            <ProjectRenderer
              key={sub.id}
              project={sub}
              level={level + 1}
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
              deleteProject={deleteProject}
              toggleProjectExpansion={toggleProjectExpansion}
              addSubProject={addSubProject}
              quickAddTask={quickAddTask}
              onDragStart={onDragStart}
              dropIndicator={dropIndicator}
              isDragging={isDragging}
              parentColor={displayColor}
              openColorPickerFor={openColorPickerFor}
              showTaskCounts={showTaskCounts}
            />
          ))}
        </div>
      )}
    </div>
  )
})

interface TaskSidebarProps {
  isOpen: boolean
  projects: Project[]
  setProjects: (action: React.SetStateAction<Project[]>, skipHistory?: boolean) => void
  timelineTasks: TimelineTask[]
  selectedProjectId: string | null
  setSelectedProjectId: React.Dispatch<React.SetStateAction<string | null>>
  onAddProject: (name: string, parentId?: string) => Promise<string | void>
  onDeleteProject: (id: string) => void
  onTaskAdded: (projectId: string, name: string, parentId?: string, explicitId?: string) => void
  onTaskDeleted?: (taskName: string, taskId: string) => void
  onAssignTaskToTimer?: (timerId: string, taskText: string) => void
  showTaskCounts: boolean
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
  showTaskCounts
}: TaskSidebarProps): React.ReactElement {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [dropIndicator, setDropIndicator] = useState<{
    id: string
    position: 'before' | 'inside' | 'after'
    type: 'project' | 'task'
  } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const editingValueRef = useRef(editingValue)

  // Resizer state
  const [projectsHeight, setProjectsHeight] = useState(300)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false)
  const [resizeStartY, setResizeStartY] = useState(0)
  const [resizeStartHeight, setResizeStartHeight] = useState(300)

  useEffect(() => {
    editingValueRef.current = editingValue
  }, [editingValue])

  useEffect(() => {
    if (!isResizingSidebar) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - resizeStartY
      const newHeight = resizeStartHeight + deltaY

      // Constraints
      if (newHeight > 60 && newHeight < 650) {
        setProjectsHeight(newHeight)
      }
    }

    const handleMouseUp = () => {
      setIsResizingSidebar(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizingSidebar, resizeStartY, resizeStartHeight])

  const projectsRef = useRef(projects)
  useEffect(() => {
    projectsRef.current = projects
  }, [projects])

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
  // Removed activeTab state because it was unused
  // Event creation form state
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
  const [isEventsExpanded, setIsEventsExpanded] = useState(true)

  // ===== EVENTS LOGIC =====
  const handleAddEvent = (projectId: string, title: string, eventId: string): void => {
    if (!title.trim()) return

    const newEvent: AppEvent = {
      id: eventId,
      title: title.trim(),
      date: undefined,
      time: undefined
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
    setProjects(updateRecursive(projects))
  }

  const handleDeleteEvent = (projectId: string, eventId: string): void => {
    const updateRecursive = (projs: Project[]): Project[] => {
      return projs.map((p): Project => {
        if (p.id === projectId) {
          return { ...p, events: p.events?.filter((e) => e.id !== eventId) || [] }
        }
        if (p.subprojects) return { ...p, subprojects: updateRecursive(p.subprojects) }
        return p
      })
    }
    setProjects(updateRecursive(projects))
  }

  const handleUpdateEvent = (
    projectId: string,
    eventId: string,
    field: 'title' | 'date' | 'time',
    value: string
  ): void => {
    const updateRecursive = (projs: Project[]): Project[] => {
      return projs.map((p): Project => {
        if (p.id === projectId) {
          return {
            ...p,
            events: p.events?.map((ev) =>
              ev.id === eventId ? { ...ev, [field]: value || undefined } : ev
            )
          }
        }
        if (p.subprojects) return { ...p, subprojects: updateRecursive(p.subprojects) }
        return p
      })
    }
    setProjects(updateRecursive(projects))
  }

  const saveEventName = (projectId: string, eventId: string): void => {
    if (!editingValue.trim()) {
      cancelEditing()
      return
    }
    handleUpdateEvent(projectId, eventId, 'title', editingValue.trim())
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
    action: 'before' | 'after' | 'inside' | 'project' | 'timer' | 'timeline'
    projectId: string
    taskId?: string
    projectIdTarget?: string
    timerId?: string
    timelineDate?: string
    type?: 'task' | 'project'
  } | null>(null)
  const [isDragging, setIsDragging] = useState<string | null>(null) // taskId or projectId of dragged item

  // Color picker state
  const [colorPickerState, setColorPickerState] = useState<{
    projectId: string
    anchorRect: DOMRect
  } | null>(null)

  const openColorPickerFor = useCallback((projectId: string, rect: DOMRect) => {
    setColorPickerState({ projectId, anchorRect: rect })
  }, [])

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
      const currentName =
        typeof newValue === 'string' ? newValue.trim() : editingValueRef.current.trim()
      if (!currentName) {
        cancelEditing()
        return
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

      if (targetProject.name !== currentName && targetProject.path) {
        try {
          // @ts-ignore - window.api is injected by Electron preload
          const renamedPath = await window.api.renameProjectFolder(targetProject.path, currentName)
          if (renamedPath) {
            newPath = renamedPath
            newNotesPath = renamedPath + '/notes'
          }
        } catch (err) {
          console.error('Failed to rename project folder:', err)
        }
      }

      const updateRecursive = (projs: Project[]): Project[] => {
        return projs.map((p) => {
          if (p.id === projectId)
            return { ...p, name: currentName, path: newPath, notesPath: newNotesPath }
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
    [colorPickerState?.projectId, updateProjectColor]
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
      const newId = await onAddProject('New Subproject', parentProjectId)
      if (newId) {
        startEditing(newId, 'New Subproject')
      }
    },
    [onAddProject, startEditing]
  )

  const quickAddTask = useCallback(
    (projectId: string): void => {
      setProjects((prevProjects) => {
        const taskNumber = (prevProjects.find((p) => p.id === projectId)?.tasks?.length || 0) + 1
        const autoName = `Task ${taskNumber} `
        const explicitId = uuidv4()
        onTaskAdded(projectId, autoName, undefined, explicitId)
        setTimeout(() => startEditing(explicitId, autoName), 0)
        return prevProjects // projects is updated via onTaskAdded callback anyway
      })
    },
    [onTaskAdded, startEditing, setProjects]
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
          findTaskAndNotify(p.tasks || [])
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
          return { ...p, tasks: removeTaskRecursive(p.tasks || []) }
        }
        if (p.subprojects) return { ...p, subprojects: updateProjectsRecursive(p.subprojects) }
        return p
      })
    }
    setProjects(updateProjectsRecursive(projects))
  }

  const toggleTask = (projectId: string, taskId: string): void => {
    const updateTasksRecursive = (tasks: TaskItem[]): TaskItem[] => {
      return tasks.map((t) => {
        if (t.id === taskId) return { ...t, completed: !t.completed }
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
        if (!dragData) return // Should not happen if drag started

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
          dropTargetRef.current = {
            action: 'timer',
            projectId: '',
            taskId: undefined,
            timerId: timerCard.dataset.timerId || '',
            type: 'task'
          }
          setDropIndicator(null)
          // Add visual highlight
          document.querySelectorAll('.timer-card.drag-over-timer').forEach((tc) => {
            tc.classList.remove('drag-over-timer')
          })
          timerCard.classList.add('drag-over-timer')

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
                .querySelectorAll(
                  '.timeline-add-btn.drag-over-btn, .timeline-add-btn.drag-over-invalid'
                )
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
              .querySelectorAll(
                '.timeline-add-btn.drag-over-btn, .timeline-add-btn.drag-over-invalid'
              )
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

        // Remove highlights if not over a timer or timeline add button
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

  const selectedProject = findProjectRecursive(projects, selectedProjectId)

  return (
    <>
      <div className={`task-sidebar ${isOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-content">
          <div className="sidebar-block has-resizer-after">
            <div
              style={{
                padding: '16px 12px 16px 20px',
                flexShrink: 0,
                position: 'relative',
                zIndex: 10,
                overflow: 'visible'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '4px',
                  padding: '4px 8px 4px 0'
                }}
              >
                <h3
                  style={{
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--text-secondary)',
                    opacity: 0.8,
                    margin: 0,
                    fontWeight: 600,
                    paddingLeft: '8px'
                  }}
                >
                  Projects
                </h3>
                <button
                  onClick={async () => {
                    const newId = await handleAddProject('New Project')
                    if (newId) {
                      startEditing(newId, 'New Project')
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
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '6px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    padding: 0
                  }}
                >
                  <Plus size={14} />
                </button>
              </div>
              <div
                className="task-list custom-scrollbar"
                style={{
                  marginBottom: '8px',
                  height: `${projectsHeight}px`,
                  maxHeight: '70vh',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  scrollbarGutter: 'stable'
                }}
              >
                {projects.length === 0 ? (
                  <div className="empty-tasks">No projects yet.</div>
                ) : (
                  projects.map((project) => (
                    <ProjectRenderer
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
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* SIDEBAR RESIZER */}
          <div
            className={`sidebar-resizer ${isResizingSidebar ? 'is-resizing' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault()
              setResizeStartY(e.clientY)
              setResizeStartHeight(projectsHeight)
              setIsResizingSidebar(true)
            }}
          />

          {/* TASKS / EVENTS SECTION */}
          <div
            className="sidebar-block"
            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'visible' }}
          >
            <div
              style={{
                padding: '16px 8px 16px 16px',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'visible'
              }}
            >
              {/* TASKS SECTION */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                  paddingRight: '8px'
                }}
              >
                <h3
                  style={{
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--text-secondary)',
                    opacity: 0.8,
                    margin: 0,
                    fontWeight: 600,
                    paddingLeft: '8px'
                  }}
                >
                  Tasks
                </h3>
                <button
                  className="task-add-btn premium-sidebar-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    const taskId = uuidv4()
                    onTaskAdded(selectedProjectId!, 'New task', undefined, taskId)
                    setTimeout(() => startEditing(taskId, 'New task'), 0)
                  }}
                  title="Add task"
                  disabled={!selectedProjectId}
                  style={{
                    width: '26px',
                    height: '26px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '6px',
                    color: 'var(--text-secondary)',
                    cursor: selectedProjectId ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s ease',
                    padding: 0,
                    opacity: selectedProjectId ? 1 : 0.4
                  }}
                >
                  <Plus size={14} />
                </button>
              </div>

              <div
                className="custom-scrollbar"
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  minHeight: '100px',
                  scrollbarGutter: 'stable'
                }}
              >
                <DropZone dzAction="project" dzProject="default" />
                {selectedProject ? (
                  <div
                    className="project-tasks"
                    style={{
                      minHeight: '20px'
                    }}
                    data-project-container={selectedProject.id}
                  >
                    <TaskRenderer
                      project={selectedProject}
                      isRoot={true}
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
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '24px 12px',
                      textAlign: 'center',
                      color: 'var(--text-secondary)',
                      fontSize: '13px',
                      fontStyle: 'italic',
                      opacity: 0.5
                    }}
                  >
                    Select a project to view tasks
                  </div>
                )}
                <DropZone dzAction="project" dzProject="default" />
              </div>

              {/* SEPARATOR */}
              <div
                style={{
                  height: '1px',
                  background: 'rgba(255,255,255,0.05)',
                  margin: '16px -8px 16px -16px'
                }}
              />

              {/* EVENTS SECTION */}
              <div
                onClick={() => setIsEventsExpanded((prev) => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                  paddingRight: '8px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: '0',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {isEventsExpanded ? (
                      <div style={{ width: 14, display: 'flex', justifyContent: 'center' }}>
                        <ChevronDown size={14} />
                      </div>
                    ) : (
                      <div style={{ width: 14, display: 'flex', justifyContent: 'center' }}>
                        <ChevronRight size={14} />
                      </div>
                    )}
                  </button>
                  <h3
                    style={{
                      fontSize: '13px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'var(--text-secondary)',
                      opacity: 0.8,
                      margin: 0,
                      fontWeight: 600,
                      paddingLeft: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    Events
                    {selectedProject?.events && selectedProject.events.length > 0 && (
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-secondary)',
                          opacity: 0.6,
                          fontWeight: 500,
                          flexShrink: 0
                        }}
                      >
                        {selectedProject.events.length}
                      </span>
                    )}
                  </h3>
                </div>
                <button
                  className="task-add-btn premium-sidebar-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    const eventId = uuidv4()
                    handleAddEvent(selectedProjectId!, 'New Event', eventId)
                    setTimeout(() => startEditing(eventId, 'New Event'), 0)
                  }}
                  title="Add event"
                  disabled={!selectedProjectId}
                  style={{
                    width: '26px',
                    height: '26px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '6px',
                    color: 'var(--text-secondary)',
                    cursor: selectedProjectId ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s ease',
                    padding: 0,
                    opacity: selectedProjectId ? 1 : 0.4
                  }}
                >
                  <Plus size={14} />
                </button>
              </div>

              {isEventsExpanded && (
                <div
                  className="custom-scrollbar"
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    minHeight: '100px',
                    paddingBottom: '32px',
                    scrollbarGutter: 'stable'
                  }}
                >
                  {selectedProjectId ? (
                    (() => {
                      const sortedEvents = selectedProject?.events
                        ? [...selectedProject.events].sort((a, b) => {
                            const dateA = a.date
                              ? new Date(`${a.date}T${a.time || '00:00'}`)
                              : new Date(8640000000000000)
                            const dateB = b.date
                              ? new Date(`${b.date}T${b.time || '00:00'}`)
                              : new Date(8640000000000000)
                            return dateA.getTime() - dateB.getTime()
                          })
                        : []

                      if (sortedEvents.length === 0) {
                        return (
                          <div
                            style={{
                              padding: '24px 12px',
                              textAlign: 'center',
                              color: 'var(--text-secondary)',
                              fontSize: '13px',
                              fontStyle: 'italic',
                              opacity: 0.5
                            }}
                          >
                            No events yet
                          </div>
                        )
                      }

                      return (
                        <div
                          className="events-list"
                          style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                        >
                          {sortedEvents.map((event) => {
                            const isExpanded = expandedEventId === event.id
                            return (
                              <EventRenderer
                                key={event.id}
                                event={event}
                                selectedProjectId={selectedProjectId!}
                                editingId={editingId}
                                editingValue={editingValue}
                                cancelEditing={cancelEditing}
                                deleteEvent={handleDeleteEvent}
                                updateEvent={handleUpdateEvent}
                                setEditingValue={setEditingValue}
                                saveEventName={saveEventName}
                                isExpanded={isExpanded}
                                setExpandedEventId={setExpandedEventId}
                                projectColor={selectedProject?.color}
                              />
                            )
                          })}
                        </div>
                      )
                    })()
                  ) : (
                    <div
                      style={{
                        padding: '24px 12px',
                        textAlign: 'center',
                        color: 'var(--text-secondary)',
                        fontSize: '13px',
                        fontStyle: 'italic',
                        opacity: 0.5
                      }}
                    >
                      Select a project to view events
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Color Picker Popup */}
      {colorPickerState && (
        <ColorPicker
          color={findProjectRecursive(projects, colorPickerState.projectId)?.color || '#ff3e6c'}
          onChange={handleColorChange}
          onClose={() => setColorPickerState(null)}
          anchorRect={colorPickerState.anchorRect}
        />
      )}
    </>
  )
})
