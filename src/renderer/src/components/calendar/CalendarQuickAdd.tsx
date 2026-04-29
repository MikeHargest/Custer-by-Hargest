import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Plus, Calendar, Search } from 'lucide-react'
import { Project, TaskItem } from '../../types'

interface CalendarQuickAddProps {
  projects: Project[]
  initialDate: string
  initialProjectId?: string
  position: { x: number; y: number }
  onClose: () => void
  onAddTask: (projectId: string, taskName: string, date: string, taskId?: string) => void
  onAddEvent: (projectId: string, eventName: string, date: string) => void
  onAddAlarm?: (date: string, time: string, title: string) => void
  showProjectSelector?: boolean
}

export default function CalendarQuickAdd({
  projects,
  initialDate,
  initialProjectId,
  position,
  onClose,
  onAddTask,
  onAddEvent,
  onAddAlarm: _,
  showProjectSelector = true
}: CalendarQuickAddProps) {
  const [query, setQuery] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId || (projects[0]?.id || ''))
  const [selectedIndex, setSelectedIndex] = useState(-1) // -1 means input is focused
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)

  // Adjust position to stay within viewport
  const adjustedPosition = useMemo(() => {
    const width = 200
    const height = 300 // estimating
    let x = position.x
    let y = position.y

    if (x + width > window.innerWidth) x = window.innerWidth - width - 20
    if (y + height > window.innerHeight) y = window.innerHeight - height - 20

    // Ensure not off-screen top/left
    x = Math.max(10, x)
    y = Math.max(10, y)

    return { x, y }
  }, [position])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const searchResults = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    const found: { id: string; text: string; projectId: string; projectName: string }[] = []

    const traverse = (tasks: TaskItem[], p: Project) => {
      tasks.forEach(t => {
        if (t.text.toLowerCase().includes(q)) {
          found.push({ id: t.id, text: t.text, projectId: p.id, projectName: p.name })
        }
        if (t.subtasks) traverse(t.subtasks, p)
      })
    }

    if (!showProjectSelector) {
      // Timeline mode: search only in the specific project
      const currentProj = projects.find(p => p.id === selectedProjectId)
      if (currentProj) traverse(currentProj.tasks || [], currentProj)
    } else {
      // Month mode: search globally
      projects.forEach(p => {
        if (p.tasks) traverse(p.tasks, p)
        if (p.subprojects) {
          const traverseSubs = (subs: Project[]) => {
            subs.forEach(s => {
              if (s.tasks) traverse(s.tasks, s)
              if (s.subprojects) traverseSubs(s.subprojects)
            })
          }
          traverseSubs(p.subprojects)
        }
      })
    }

    return found.slice(0, 3)
  }, [query, projects])

  const totalActions = searchResults.length + 2

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1 >= totalActions ? 0 : prev + 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 < 0 ? totalActions - 1 : prev - 1))
    }
    if (e.key === 'Enter') {
      if (selectedIndex === -1) {
        // If query matches exactly or just enter in input, create task
        if (query.trim()) handleCreateTask()
      } else if (selectedIndex < searchResults.length) {
        const res = searchResults[selectedIndex]
        onAddTask(res.projectId, res.text, initialDate, res.id)
        onClose()
      } else {
        const actionIdx = selectedIndex - searchResults.length
        if (actionIdx === 0) handleCreateTask()
        if (actionIdx === 1) handleCreateEvent()
      }
    }
  }

  const handleCreateTask = () => {
    const name = query.trim() || 'New Task'
    onAddTask(selectedProjectId, name, initialDate)
    onClose()
  }

  const handleCreateEvent = () => {
    const name = query.trim() || 'New Event'
    onAddEvent(selectedProjectId, name, initialDate)
    onClose()
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 10000,
      background: 'transparent'
    }}>
      <div
        ref={menuRef}
        className="project-dropdown"
        style={{
          position: 'absolute',
          top: `${adjustedPosition.y}px`,
          left: `${adjustedPosition.x}px`,
          width: '150px',
          padding: '0',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          animation: 'popupFadeIn 0.15s ease-out',
          marginTop: 0,
          background: 'var(--card-bg)',
          borderRadius: 'var(--radius-md)',
          zIndex: 1000
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Project Selector (TOP) */}
        {showProjectSelector && (
          <div style={{
            padding: '0 6px 0 12px', // Perfect symmetry since container padding is 0
            height: '36px', // Slightly taller for 6px gaps (36 = 6 + 24 + 6)
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'transparent',
            position: 'relative'
          }}>
            <span style={{
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 600,
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              opacity: 0.9
            }}>
              {projects.find(p => p.id === selectedProjectId)?.name || 'Project'}
            </span>

            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '4px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative',
              flexShrink: 0
            }} onClick={() => setShowProjectDropdown(!showProjectDropdown)}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>

              {showProjectDropdown && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  right: 0,
                  width: '164px',
                  maxHeight: '300px',
                  background: 'var(--card-bg)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  zIndex: 10000,
                  overflow: 'hidden', // Forces clipping of everything inside, including scrollbars
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div style={{
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    padding: '4px 0',
                    width: '100%',
                    height: '100%'
                  }}>
                    <style>{`
                      .project-dropdown div::-webkit-scrollbar {
                        width: 6px;
                      }
                      .project-dropdown div::-webkit-scrollbar-track {
                        background: transparent;
                      }
                      .project-dropdown div::-webkit-scrollbar-thumb {
                        background: rgba(255,255,255,0.12);
                        border-radius: 10px;
                      }
                    `}</style>
                    {projects.map((p) => (
                      <button
                        key={p.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedProjectId(p.id)
                          setShowProjectDropdown(false)
                        }}
                        onMouseEnter={(e) => {
                          if (selectedProjectId !== p.id) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                        }}
                        onMouseLeave={(e) => {
                          if (selectedProjectId !== p.id) e.currentTarget.style.background = 'transparent'
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          width: 'calc(100% - 8px)',
                          margin: '3px 4px',
                          padding: '4px 8px',
                          background: selectedProjectId === p.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                          border: 'none',
                          borderRadius: '6px',
                          color: 'var(--text-primary)',
                          fontSize: '12px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          position: 'relative',
                          transition: 'background 0.2s'
                        }}
                      >
                      {/* Vertical lines for hierarchy - centered behind dots */}
                      {Array.from({ length: p.depth || 0 }).map((_, idx) => (
                        <div
                          key={idx}
                          style={{
                            position: 'absolute',
                            left: `${8 + idx * 12 + 6 + 3}px`,
                            top: '-3px', // Extend to bridge the margin gap
                            bottom: '-3px', // Extend to bridge the margin gap
                            width: '1px',
                            background: '#262626', // Perfect middle grey
                            zIndex: 1
                          }}
                        />
                      ))}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginLeft: `${(p.depth || 0) * 12}px`,
                        paddingLeft: '6px',
                        overflow: 'hidden',
                        zIndex: 2
                      }}>
                        <div style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: p.color || 'var(--accent)',
                          flexShrink: 0
                        }} />
                        <span style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {p.name}
                        </span>
                      </div>
                    </button>
                  ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search Input */}
        <div style={{
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '0 12px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          marginBottom: '4px'
        }}>
          <Search size={12} style={{ opacity: 0.4 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setSelectedIndex(-1)
            }}
            placeholder="Search or name..."
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '12px',
              outline: 'none',
              width: '100%',
              fontWeight: 500
            }}
          />
        </div>

        {/* Existing Results */}
        {searchResults.length > 0 && (
          <>
            <div style={{ padding: '4px 10px', fontSize: '10px', color: 'var(--text-secondary)', opacity: 0.5, textTransform: 'uppercase', fontWeight: 700 }}>Suggestions</div>
            {searchResults.map((res, idx) => (
              <button
                key={res.id}
                className="project-dropdown-item"
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => {
                  onAddTask(res.projectId, res.text, initialDate, res.id)
                  onClose()
                }}
                style={{
                  width: 'calc(100% - 8px)',
                  margin: '0 4px',
                  background: selectedIndex === idx ? 'rgba(255,255,255,0.05)' : 'transparent',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '1px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: 'none',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ fontSize: '12px', color: 'var(--text-primary)', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{res.text}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', opacity: 0.4 }}>{res.projectName}</div>
              </button>
            ))}
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />
          </>
        )}

        {/* Action Buttons */}
        <div style={{ paddingBottom: '4px' }}> {/* Bottom space for the rounded islands */}
          <button
            onClick={handleCreateTask}
            onMouseEnter={() => setSelectedIndex(searchResults.length)}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: 'calc(100% - 8px)', // 4px margin from each side
              margin: '0 4px',
              padding: '0 8px',
              height: '35px',
              background: selectedIndex === searchResults.length ? 'rgba(255,255,255,0.05)' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.2s'
            }}
          >
            <Plus size={16} style={{ 
              marginRight: '12px',
              opacity: 0.6,
              color: 'var(--accent)'
            }} />
            <span style={{ fontSize: '13px', fontWeight: 500 }}>
              {query.trim() ? `Task "${query}"` : 'New Task'}
            </span>
          </button>

          <button
            onClick={handleCreateEvent}
            onMouseEnter={() => setSelectedIndex(totalActions - 1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: 'calc(100% - 8px)', // 4px margin from each side
              margin: '0 4px',
              padding: '0 8px',
              height: '35px',
              background: selectedIndex === totalActions - 1 ? 'rgba(255,255,255,0.05)' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.2s'
            }}
          >
            <Calendar size={16} style={{ 
              marginRight: '12px',
              opacity: 0.6,
              color: 'var(--blue)'
            }} />
            <span style={{ fontSize: '13px', fontWeight: 500 }}>
              {query.trim() ? `Event "${query}"` : 'New Event'}
            </span>
          </button>
        </div>
      </div>
      <style>{`
        @keyframes popupFadeIn {
          from { opacity: 0; transform: translateY(-5px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
