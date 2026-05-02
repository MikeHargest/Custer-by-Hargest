import React from 'react'
import * as LucideIcons from 'lucide-react'

interface CalendarEventItemProps {
  event: {
    id: string
    title: string
    projectId: string
    projectColor?: string
  }
  onContextMenu: (e: React.MouseEvent, event: any) => void
  onDelete?: (e: React.MouseEvent, eventId: string) => void
  compact?: boolean
}

export default function CalendarEventItem({
  event,
  onContextMenu,
  onDelete,
  compact = false
}: CalendarEventItemProps): React.ReactElement {
  const iconSize = compact ? 10 : 12
  const padding = compact ? '2px 6px' : '4px 8px'
  const fontSize = compact ? '11px' : '12px'
  const height = '24px'
  const borderLeftWidth = compact ? '2px' : '3px'

  return (
    <div
      key={event.id}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onContextMenu(e, event)
      }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          'text/plain',
          JSON.stringify({ type: 'move_event', id: event.id, projectId: event.projectId })
        )
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? '4px' : '8px',
        padding,
        background: 'var(--calendar-event-bg)',
        borderRadius: 'var(--radius-sm)',
        fontSize,
        border: '1px solid rgba(255,255,255,0.05)',
        borderLeft: `${borderLeftWidth} solid ${event.projectColor || 'var(--accent)'}`,
        cursor: 'grab',
        height,
        maxWidth: '200px',
        flexShrink: 0
      }}
      title={`Event: ${event.title}\n(Drag to move instance)`}
    >
      <LucideIcons.Calendar size={iconSize} style={{ flexShrink: 0, opacity: 0.7, color: event.projectColor || 'var(--accent)' }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)', flex: 1 }}>
        {event.title}
      </span>
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(e, event.id)
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.2)',
            cursor: 'pointer',
            padding: '0 2px',
            display: 'flex',
            alignItems: 'center'
          }}
          title="Delete instance"
        >
          <LucideIcons.X size={iconSize} />
        </button>
      )}
    </div>
  )
}
