import { memo } from 'react'
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
  return (
    <div
      key={event.id}
      className="event-card premium-event-item"
      style={{
        position: 'relative',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '10px',
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
              onChange={(e) => updateEvent(selectedProjectId, event.id, { title: e.target.value })}
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
                onChange={(e) => updateEvent(selectedProjectId, event.id, { date: e.target.value })}
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
                onChange={(e) => updateEvent(selectedProjectId, event.id, { time: e.target.value })}
                style={{ width: '100%' }}
                onClick={(e) => e.stopPropagation()}
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
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Frequency</label>
                      <select 
                        className="inline-edit-input"
                        value={event.recurrence.frequency}
                        onChange={(e) => updateEvent(selectedProjectId, event.id, { 
                          recurrence: { ...event.recurrence!, frequency: e.target.value as any } 
                        })}
                        style={{ width: '100%', height: '28px' }}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                    <div style={{ width: '60px' }}>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Every</label>
                      <input 
                        type="number"
                        min="1"
                        className="inline-edit-input"
                        value={event.recurrence.interval}
                        onChange={(e) => updateEvent(selectedProjectId, event.id, { 
                          recurrence: { ...event.recurrence!, interval: parseInt(e.target.value) || 1 } 
                        })}
                        style={{ width: '100%' }}
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

                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Ends</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <select 
                        className="inline-edit-input"
                        value={event.recurrence.endType}
                        onChange={(e) => updateEvent(selectedProjectId, event.id, { 
                          recurrence: { ...event.recurrence!, endType: e.target.value as any } 
                        })}
                        style={{ width: '100%', height: '28px' }}
                      >
                        <option value="never">Never</option>
                        <option value="until">On Date</option>
                        <option value="count">After occurrences</option>
                      </select>
                      
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
               </div>
             )}

             {/* Reminder Settings */}
             <div style={{ marginTop: '12px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Reminder</label>
                <select
                  className="inline-edit-input"
                  value={event.reminder ? event.reminder.minutesBefore : -1}
                  onChange={(e) => {
                    const val = parseInt(e.target.value)
                    if (val === -1) {
                      updateEvent(selectedProjectId, event.id, { reminder: undefined })
                    } else {
                      updateEvent(selectedProjectId, event.id, { 
                        reminder: { minutesBefore: val, isNotified: false } 
                      })
                    }
                  }}
                  style={{ width: '100%', height: '28px' }}
                >
                  <option value={-1}>None</option>
                  <option value={0}>At time of event</option>
                  <option value={5}>5 minutes before</option>
                  <option value={15}>15 minutes before</option>
                  <option value={30}>30 minutes before</option>
                  <option value={60}>1 hour before</option>
                  <option value={1440}>1 day before</option>
                </select>
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
