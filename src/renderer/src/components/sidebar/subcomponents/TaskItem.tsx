import React, { memo, useState, useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Circle, Pencil, Trash2, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import { Project, TaskItem } from '../../../types'
import SidebarDropZone from './SidebarDropZone'

interface TaskItemProps {
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
  isArchiveView: boolean
}

const TaskItemRenderer: React.FC<TaskItemProps> = memo(function TaskItemRenderer({
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
  showTaskCounts,
  isArchiveView
}) {
  const isSubtask = depth > 0

  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!contextMenuPos) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) {
        return
      }
      setContextMenuPos(null)
    }
    window.addEventListener('mousedown', handleClickOutside, true)
    window.addEventListener('contextmenu', handleClickOutside, true)
    return () => {
      window.removeEventListener('mousedown', handleClickOutside, true)
      window.removeEventListener('contextmenu', handleClickOutside, true)
    }
  }, [contextMenuPos])

  return (
    <div key={task.id}>
      <div
        className={`${isSubtask ? 'premium-subtask-item' : 'premium-task-card'} depth-${depth} ${task.completed ? 'completed' : ''
          } ${(task.completed && !isArchiveView) || (!task.completed && isArchiveView) ? 'archiving-out' : ''} ${dropIndicator?.id === task.id &&
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
        <div
          className="task-row"
          style={{ padding: '8px 8px 8px 8px', display: 'flex', alignItems: 'flex-start' }}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setContextMenuPos({ x: Math.min(e.clientX, window.innerWidth - 180), y: Math.min(e.clientY, window.innerHeight - 150) })
          }}
        >
          <button
            className="task-checkbox"
            style={{
              marginLeft: '-4px',
              marginRight: '4px',
              marginTop: '0px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: task.completed ? 'var(--success)' : 'var(--text-secondary)',
              flexShrink: 0,
              padding: '4px',
              background: 'none',
              border: 'none',
              cursor: 'pointer'
            }}
            onClick={() => toggleTask(project.id, task.id)}
          >
            {task.completed ? (
              <div
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  border: '1px solid var(--success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: 'var(--success)'
                  }}
                />
              </div>
            ) : (
              <Circle size={14} />
            )}
          </button>

          <div
            className="task-content"
            onClick={() => {
              if (task.subtasks && task.subtasks.length > 0) {
                toggleTaskExpansion(project.id, task.id)
              }
            }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'flex-start',
              textAlign: 'left',
              cursor: 'pointer',
              minWidth: 0,
              marginRight: '2px'
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
                  display: 'block',
                  boxSizing: 'border-box',
                  resize: 'none',
                  minHeight: '20px',
                  fontFamily: 'inherit',
                  lineHeight: '1.4',
                  padding: '1px 8px 1px 0',
                  margin: '0',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'inherit'
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
                  wordBreak: 'break-word',
                  marginTop: '1px',
                  color: '#BDBDBD'
                }}
              >
                {task.text}
              </span>
            )}
          </div>

          <div
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}
          >
            {getTaskTimelineDate(project.id, task.id) && (
              <span
                style={{
                  fontSize: '10px',
                  background: 'rgba(255,255,255,0.06)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap'
                }}
              >
                {getTaskTimelineDate(project.id, task.id)}
              </span>
            )}
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
            {task.isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={14} />}
          </button>
        )}

        {task.isExpanded && task.subtasks && task.subtasks.length > 0 && (
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
                  isArchiveView={isArchiveView}
                />
              ))}
            <SidebarDropZone dzAction="inside" dzProject={project.id} dzTask={task.id} />
          </div>
        )}

        {contextMenuPos && (
          <div
            ref={menuRef}
            className="project-dropdown"
            style={{
              position: 'fixed',
              left: contextMenuPos.x,
              top: contextMenuPos.y,
              right: 'auto',
              minWidth: '160px',
              zIndex: 9999
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {depth < 2 && (
              <button
                className="project-dropdown-item"
                onClick={(e) => {
                  setContextMenuPos(null)
                  e.stopPropagation()
                  const subtaskName = `Subtask ${(task.subtasks?.length || 0) + 1}`
                  const subtaskId = uuidv4()
                  onTaskAdded(project.id, subtaskName, task.id, subtaskId)
                  setTimeout(() => startEditing(subtaskId, subtaskName), 0)
                }}
              >
                <Plus size={14} />
                <span>Add Subtask</span>
              </button>
            )}
            <button
              className="project-dropdown-item"
              onClick={(e) => {
                setContextMenuPos(null)
                e.stopPropagation()
                startEditing(task.id, task.text)
              }}
            >
              <Pencil size={14} />
              <span>Edit Task</span>
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
              onClick={(e) => {
                setContextMenuPos(null)
                e.stopPropagation()
                deleteTask(project.id, task.id)
              }}
            >
              <Trash2 size={14} />
              <span>Delete Task</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
})

export default TaskItemRenderer
