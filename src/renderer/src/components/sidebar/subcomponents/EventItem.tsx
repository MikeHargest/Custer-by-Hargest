import { memo, useState, useRef, useEffect } from 'react'
import { ChevronRight, ChevronDown, Trash2, Calendar, Clock } from 'lucide-react'
import { AppEvent } from '../../../types'

interface EventItemProps {
  event: AppEvent
  selectedProjectId: string
  editingId: string | null
  editingValue: string
  cancelEditing: () => void
  deleteEvent: (projectId: string, eventId: string) => void
  updateEvent: (
    projectId: string,
    eventId: string,
    updates: Partial<AppEvent>
  ) => void
  setEditingValue: (val: string) => void
  saveEventName: (projectId: string, eventId: string) => void
  isExpanded: boolean
  setExpandedEventId: (id: string | null) => void
  projectColor?: string
}

const EventItem = memo(function EventItem({
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
}: EventItemProps) {
  const [activeSelect, setActiveSelect] = useState<string | null>(null) // 'reminder', 'frequency', 'ends'
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = () => {
      // If we are here, it means the click was NOT on a toggle or menu item
      // (because those stop propagation of mousedown)
      setActiveSelect(null)
    }
    if (activeSelect) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [activeSelect])

  // Reusable Custom Dropdown Component
  const CustomSelect = ({
    label,
    value,
    options,
    onSelect,
    id
  }: {
    label: string,
    value: any,
    options: { val: any, label: string }[],
    onSelect: (val: any) => void,
    id: string
  }) => {
    const isOpen = activeSelect === id
    const selectedOption = options.find(o => o.val === value) || options[0]

    return (
      <div style={{ position: 'relative', flex: 1 }} className="custom-select-container">
        <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>{label}</label>
        <button
          onMouseDown={(e) => {
            e.stopPropagation() // Prevent document mousedown from firing
            setActiveSelect(isOpen ? null : id)
          }}
          className="inline-edit-input custom-select-toggle"
          style={{
            width: '100%',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            textAlign: 'left',
            padding: '0 8px',
            background: 'rgba(0,0,0,0.2)'
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{selectedOption.label}</span>
          <ChevronDown size={12} style={{ opacity: 0.5, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>

        {isOpen && (
          <div
            className="custom-select-menu"
            onMouseDown={(e) => e.stopPropagation()} // Prevent closure when clicking background of menu
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              background: '#2d2d2d',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              zIndex: 100,
              overflow: 'hidden',
              padding: '4px'
            }}
          >
            {options.map((opt) => {
              const isSelected = value === opt.val
              return (
                <div
                  key={opt.val}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    onSelect(opt.val)
                    setActiveSelect(null)
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent'
                  }}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    color: isSelected ? 'white' : 'var(--text-secondary)',
                    background: isSelected ? '#3b82f6' : 'transparent',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    fontWeight: isSelected ? 600 : 400
                  }}
                >
                  {opt.label}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      key={event.id}
      className="event-card premium-event-item"
      ref={containerRef}
      style={{
        position: 'relative',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '10px',
        border: isExpanded ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
        transition: 'all 0.2s',
        overflow: 'visible'
      }}
    >
      {/* Clipped background/strip container */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: '10px', overflow: 'hidden', pointerEvents: 'none' }}>
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
      </div>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(
            'text/plain',
            JSON.stringify({
              type: 'move_event',
              id: event.id,
              projectId: selectedProjectId
            })
          )
        }}
        style={{
          padding: '8px 10px 8px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer'
        }}
        onClick={() => {
          setActiveSelect(null);
          setExpandedEventId(isExpanded ? null : event.id);
        }}
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
          tabIndex={-1}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            // Only blur if the user clicked the background, not another input or button
            if (target.tagName !== 'INPUT' && target.tagName !== 'BUTTON' && !target.closest('.custom-select-container')) {
              if (document.activeElement instanceof HTMLElement && document.activeElement.tagName === 'INPUT') {
                document.activeElement.blur();
              }
            }
          }}
          style={{
            padding: '0 8px 12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            borderTop: '1px solid rgba(255,255,255,0.04)',
            outline: 'none'
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
              onChange={(e) => updateEvent(selectedProjectId, event.id, { title: e.target.value })}
              style={{ width: '100%' }}
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
                onChange={(e) => updateEvent(selectedProjectId, event.id, { date: e.target.value })}
                style={{ width: '100%' }}
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
                onChange={(e) => updateEvent(selectedProjectId, event.id, { time: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Recurrence Settings */}
          <div style={{ marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <input
                type="checkbox"
                id={`repeat-${event.id}`}
                checked={!!event.recurrence}
                onChange={(e) => {
                  if (e.target.checked) {
                    updateEvent(selectedProjectId, event.id, {
                      recurrence: {
                        frequency: 'daily',
                        interval: 1,
                        endType: 'never'
                      }
                    })
                  } else {
                    updateEvent(selectedProjectId, event.id, { recurrence: undefined })
                  }
                }}
              />
              <label htmlFor={`repeat-${event.id}`} style={{ fontSize: '12px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                Repeat
              </label>
            </div>

            {event.recurrence && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '20px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <CustomSelect
                    id="frequency"
                    label="Frequency"
                    value={event.recurrence.frequency}
                    onSelect={(val) => updateEvent(selectedProjectId, event.id, {
                      recurrence: { ...event.recurrence!, frequency: val as any }
                    })}
                    options={[
                      { val: 'daily', label: 'Daily' },
                      { val: 'weekly', label: 'Weekly' },
                      { val: 'monthly', label: 'Monthly' },
                      { val: 'yearly', label: 'Yearly' }
                    ]}
                  />
                  <div style={{ width: '60px' }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Every</label>
                    <input
                      type="number"
                      min="1"
                      className="inline-edit-input"
                      value={event.recurrence.interval}
                      onChange={(e) => updateEvent(selectedProjectId, event.id, {
                        recurrence: { ...event.recurrence!, interval: parseInt(e.target.value) || 1 }
                      })}
                      style={{ width: '100%', height: '28px' }}
                    />
                  </div>
                </div>

                {event.recurrence.frequency === 'weekly' && (
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>On Days</label>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            const days = event.recurrence!.daysOfWeek || []
                            const newDays = days.includes(i) ? days.filter(d => d !== i) : [...days, i]
                            updateEvent(selectedProjectId, event.id, {
                              recurrence: { ...event.recurrence!, daysOfWeek: newDays }
                            })
                          }}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '4px',
                            border: 'none',
                            fontSize: '10px',
                            background: event.recurrence!.daysOfWeek?.includes(i) ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                            color: 'white',
                            cursor: 'pointer'
                          }}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <CustomSelect
                  id="ends"
                  label="Ends"
                  value={event.recurrence.endType}
                  onSelect={(val) => updateEvent(selectedProjectId, event.id, {
                    recurrence: { ...event.recurrence!, endType: val as any }
                  })}
                  options={[
                    { val: 'never', label: 'Never' },
                    { val: 'until', label: 'On Date' },
                    { val: 'count', label: 'After occurrences' }
                  ]}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {event.recurrence.endType === 'until' && (
                    <input
                      type="date"
                      className="inline-edit-input"
                      value={event.recurrence.endDate || ''}
                      onChange={(e) => updateEvent(selectedProjectId, event.id, {
                        recurrence: { ...event.recurrence!, endDate: e.target.value }
                      })}
                      style={{ width: '100%' }}
                    />
                  )}

                  {event.recurrence.endType === 'count' && (
                    <input
                      type="number"
                      min="1"
                      className="inline-edit-input"
                      value={event.recurrence.count || 1}
                      onChange={(e) => updateEvent(selectedProjectId, event.id, {
                        recurrence: { ...event.recurrence!, count: parseInt(e.target.value) || 1 }
                      })}
                      style={{ width: '100%' }}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Reminder Settings */}
            <div style={{ marginTop: '12px' }}>
              <CustomSelect
                id="reminder"
                label="Reminder"
                value={event.reminder ? event.reminder.minutesBefore : -1}
                onSelect={(val) => {
                  if (val === -1) {
                    updateEvent(selectedProjectId, event.id, { reminder: undefined })
                  } else {
                    updateEvent(selectedProjectId, event.id, {
                      reminder: { minutesBefore: val, isNotified: false }
                    })
                  }
                }}
                options={[
                  { val: -1, label: 'None' },
                  { val: 0, label: 'At time of event' },
                  { val: 5, label: '5 minutes before' },
                  { val: 15, label: '15 minutes before' },
                  { val: 30, label: '30 minutes before' },
                  { val: 60, label: '1 hour before' },
                  { val: 1440, label: '1 day before' }
                ]}
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

export default EventItem
