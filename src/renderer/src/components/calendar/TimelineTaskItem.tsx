import React from 'react'
import { FolderOpen, CheckSquare } from 'lucide-react'
import { Project, TimelineTask } from '../../types'

interface TimelineTaskItemProps {
  task: TimelineTask
  project: Project
  taskName: string
  isParent: boolean
  minCellWidth: number
  isDraggingResize: boolean
  onContextMenu: (e: React.MouseEvent, task: TimelineTask) => void
  onDragStart: (e: React.DragEvent, task: TimelineTask, isStart: boolean) => void
  onDoubleClick: (e: React.MouseEvent) => void
}

export default function TimelineTaskItem({
  task,
  project,
  taskName,
  isParent,
  minCellWidth,
  isDraggingResize,
  onContextMenu,
  onDragStart,
  onDoubleClick
}: TimelineTaskItemProps): React.ReactElement {
  const isStart = true // We only render on start date now
  const isEnd = true // Resize handle always visible since we render from start

  // Calculate span width in pixels
  let spanDays = 1
  if (task.endDate) {
    const start = new Date(task.date)
    const end = new Date(task.endDate)
    const diffTime = end.getTime() - start.getTime()
    spanDays = Math.max(1, Math.round(diffTime / (1000 * 3600 * 24)) + 1)
  }
  // Width in pixels: each cell = minCellWidth, minus padding
  const spanWidthPx = spanDays > 1 ? `${spanDays * minCellWidth - 1}px` : '100%'

  return (
    <div
      key={task.id}
      style={{
        position: 'relative',
        height: '24px',
        flexShrink: 0,
        zIndex: spanDays > 1 ? 5 : 2,
        // During resize drag, let pointer events pass through to td cells
        pointerEvents: isDraggingResize && spanDays > 1 ? 'none' : 'auto'
      }}
    >
      <div
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onContextMenu(e, task)
        }}
        onDoubleClick={(e) => onDoubleClick(e)}
        draggable={isStart}
        onDragStart={(e) => onDragStart(e, task, isStart)}
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
          borderLeft: isStart ? `3px solid ${project.color || 'var(--accent)'}` : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          opacity: 0.95,
          minHeight: '24px',
          zIndex: 2 // relative to the slot's z-index
        }}
        title={`Task: ${taskName}\nDates: ${new Date(task.date).toLocaleDateString()} - ${task.endDate ? new Date(task.endDate).toLocaleDateString() : 'Single day'}`}
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
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1
              }}
            >
              {taskName}
            </div>
          </>
        )}
      </div>

      {/* Resize Handle */}
      {isEnd && (
        <div
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            // Dispatch custom event for resize
            const resizeEvent = new CustomEvent('task-resize-start', {
              detail: { taskId: task.id, projectId: task.projectId }
            })
            window.dispatchEvent(resizeEvent)
          }}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '6px',
            cursor: 'col-resize',
            zIndex: 10,
            background: 'transparent',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
          title="Drag to resize task duration"
        />
      )}
    </div>
  )
}
