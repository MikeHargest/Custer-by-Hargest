import React from 'react'
import { X, FolderOpen, CheckSquare } from 'lucide-react'
import { Project, TimelineTask } from '../../types'

interface CalendarTaskItemProps {
  task: TimelineTask
  project?: Project
  taskName: string
  isParent?: boolean
  compact?: boolean
  minCellWidth?: number
  isDraggingResize?: boolean
  isTimeline?: boolean
  onContextMenu: (e: React.MouseEvent, task: TimelineTask) => void
  onDelete?: (e: React.MouseEvent, taskId: string) => void
  onDragStart?: (e: React.DragEvent, task: TimelineTask, isStart: boolean) => void
  onResizeStart?: (e: React.MouseEvent, task: TimelineTask) => void
}

export default function CalendarTaskItem({
  task,
  project,
  taskName,
  isParent = false,
  compact = false,
  minCellWidth = 150,
  isDraggingResize = false,
  isTimeline = false,
  onContextMenu,
  onDelete,
  onDragStart,
  onResizeStart
}: CalendarTaskItemProps): React.ReactElement {
  const isStart = true
  const padding = compact ? '2px 6px' : '5px 9px'
  const fontSize = compact ? '11px' : '12px'
  const height = '24px'
  const borderLeftWidth = compact ? '2px' : (isTimeline ? '3px' : '4px')
  const fontWeight = isParent ? 600 : 400

  // Calculate span width for multi-day tasks (timeline mode)
  let spanDays = 1
  let spanWidthPx = '100%'
  
  if (isTimeline && task.endDate) {
    const start = new Date(task.date)
    const end = new Date(task.endDate)
    const diffTime = end.getTime() - start.getTime()
    spanDays = Math.max(1, Math.round(diffTime / (1000 * 3600 * 24)) + 1)
    spanWidthPx = spanDays > 1 ? `${spanDays * minCellWidth - 1}px` : '100%'
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onContextMenu(e, task)
  }

  const handleDragStart = (e: React.DragEvent) => {
    if (onDragStart && isStart) {
      e.dataTransfer.setData(
        'text/plain',
        JSON.stringify({ type: 'move_timeline_task', id: task.id, projectId: task.projectId })
      )
      onDragStart(e, task, isStart)
    } else {
      e.preventDefault()
    }
  }

  // Compact mode for Day/Week/Month views
  if (compact) {
    return (
      <div
        onContextMenu={handleContextMenu}
        draggable
        onDragStart={handleDragStart}
        style={{
          background: 'var(--calendar-task-bg)',
          color: 'var(--text-primary)',
          padding,
          borderRadius: 'var(--radius-md)',
          fontSize,
          height,
          fontWeight,
          border: '1px solid rgba(255,255,255,0.05)',
          borderLeft: `${borderLeftWidth} solid ${project?.color || 'var(--accent)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '4px',
          overflow: 'hidden',
          flexShrink: 0
        }}
        title={`Task: ${taskName} (${project?.name || 'Unknown'})`}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {taskName}
        </span>
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(e, task.id)
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
        )}
      </div>
    )
  }

  // Timeline mode with multi-day support
  if (isTimeline) {
    return (
      <div
        style={{
          position: 'relative',
          height,
          flexShrink: 0,
          zIndex: spanDays > 1 ? 5 : 2,
          pointerEvents: isDraggingResize && spanDays > 1 ? 'none' : 'auto'
        }}
      >
        <div
          onContextMenu={handleContextMenu}
          onDoubleClick={(e) => e.stopPropagation()}
          draggable={isStart}
          onDragStart={handleDragStart}
          style={{
            background: 'var(--calendar-task-bg)',
            color: 'var(--text-primary)',
            padding,
            borderRadius: 'var(--radius-md)',
            fontSize,
            fontWeight,
            position: 'absolute',
            top: 0,
            left: 0,
            width: spanWidthPx,
            height,
            boxSizing: 'border-box',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            border: `1px solid rgba(255,255,255,0.05)`,
            borderLeft: isStart ? `${borderLeftWidth} solid ${project?.color || 'var(--accent)'}` : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '6px',
            opacity: 0.95,
            minHeight: height,
            zIndex: 2
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
                    color: project?.color || 'var(--accent)'
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
        {task.endDate && (
          <div
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (onResizeStart) onResizeStart(e, task)
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

  // Default mode (non-compact, non-timeline) - for future use
  return (
    <div
      onContextMenu={handleContextMenu}
      draggable
      onDragStart={handleDragStart}
      style={{
        background: 'var(--calendar-task-bg)',
        color: 'var(--text-primary)',
        padding,
        borderRadius: 'var(--radius-md)',
        fontSize,
        height,
        fontWeight,
        border: '1px solid rgba(255,255,255,0.05)',
        borderLeft: `${borderLeftWidth} solid ${project?.color || 'var(--accent)'}`,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        overflow: 'hidden',
        flexShrink: 0
      }}
      title={`Task: ${taskName} (${project?.name || 'Unknown'})`}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {taskName}
      </span>
    </div>
  )
}
