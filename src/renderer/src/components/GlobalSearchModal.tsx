import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Search, Folder, CheckCircle, FileText, X, Command } from 'lucide-react'
import { Project, TaskItem, AppNote } from '../types'

interface SearchResult {
  id: string
  type: 'project' | 'task' | 'note'
  title: string
  subtitle?: string
  projectId?: string
  noteId?: string
}

interface GlobalSearchModalProps {
  projects: Project[]
  notes: AppNote[]
  onClose: () => void
  onSelectProject: (id: string) => void
  onSelectNote: (id: string) => void
  onSelectTask: (taskId: string, projectId: string) => void
}

export default function GlobalSearchModal({
  projects,
  notes,
  onClose,
  onSelectProject,
  onSelectNote,
  onSelectTask
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const results = useMemo(() => {
    if (!query.trim()) return []

    const q = query.toLowerCase()
    const found: SearchResult[] = []

    // 1. Search Projects
    projects.forEach(p => {
      if (p.name.toLowerCase().includes(q)) {
        found.push({
          id: p.id,
          type: 'project',
          title: p.name,
          subtitle: 'Project'
        })
      }

      // 2. Search Tasks (Deep)
      const searchTasksRecursive = (tasks: TaskItem[], projectName: string, projId: string) => {
        tasks.forEach(t => {
          if (t.text.toLowerCase().includes(q)) {
            found.push({
              id: t.id,
              type: 'task',
              title: t.text,
              subtitle: `Task in ${projectName}`,
              projectId: projId
            })
          }
          if (t.subtasks) searchTasksRecursive(t.subtasks, projectName, projId)
        })
      }
      if (p.tasks) searchTasksRecursive(p.tasks, p.name, p.id)
      
      // Also search subprojects
      const searchSubprojects = (subs: Project[]) => {
        subs.forEach(sub => {
          if (sub.name.toLowerCase().includes(q)) {
            found.push({ id: sub.id, type: 'project', title: sub.name, subtitle: `Subproject of ${p.name}` })
          }
          if (sub.tasks) searchTasksRecursive(sub.tasks, sub.name, sub.id)
          if (sub.subprojects) searchSubprojects(sub.subprojects)
        })
      }
      if (p.subprojects) searchSubprojects(p.subprojects)
    })

    // 3. Search Notes
    notes.forEach(n => {
      if (n.title.toLowerCase().includes(q) || (n.content && n.content.toLowerCase().includes(q))) {
        found.push({
          id: n.id,
          type: 'note',
          title: n.title,
          subtitle: 'Note',
          noteId: n.id
        })
      }
    })

    return found.slice(0, 15) // Limit results
  }, [query, projects, notes])

  useEffect(() => {
    setSelectedIndex(0)
  }, [results])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length)
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      confirmSelection(results[selectedIndex])
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const confirmSelection = (res: SearchResult) => {
    if (res.type === 'project') {
      onSelectProject(res.id)
    } else if (res.type === 'note') {
      onSelectNote(res.id)
    } else if (res.type === 'task') {
      onSelectTask(res.id, res.projectId!)
    }
    onClose()
  }

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh'
      }}
    >
      <div 
        className="search-modal"
        onClick={e => e.stopPropagation()}
        style={{
          width: '600px',
          background: 'var(--card-bg)',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div style={{
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          borderBottom: '1px solid rgba(255,255,255,0.05)'
        }}>
          <Search size={20} style={{ color: 'var(--text-secondary)' }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search projects, tasks, notes..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '16px',
              outline: 'none'
            }}
          />
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(255,255,255,0.05)',
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '10px',
            color: 'var(--text-secondary)'
          }}>
            <Command size={10} />
            <span>K</span>
          </div>
        </div>

        <div 
          className="search-results custom-scrollbar"
          style={{
            maxHeight: '400px',
            overflowY: 'auto',
            padding: '8px'
          }}
        >
          {!query.trim() ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', opacity: 0.5 }}>
              <p style={{ fontSize: '13px' }}>Type something to search...</p>
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', opacity: 0.5 }}>
              <p style={{ fontSize: '13px' }}>No matches found</p>
            </div>
          ) : (
            results.map((res, idx) => (
              <div
                key={`${res.type}-${res.id}`}
                onClick={() => confirmSelection(res)}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  background: idx === selectedIndex ? 'rgba(255,255,255,0.06)' : 'transparent',
                  transition: 'background 0.1s'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: idx === selectedIndex ? 'var(--accent)' : 'rgba(255,255,255,0.03)',
                  color: idx === selectedIndex ? 'white' : 'var(--text-secondary)',
                  transition: 'all 0.1s'
                }}>
                  {res.type === 'project' && <Folder size={18} />}
                  {res.type === 'task' && <CheckCircle size={18} />}
                  {res.type === 'note' && <FileText size={18} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontSize: '14px', 
                    fontWeight: 500, 
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {res.title}
                  </div>
                  <div style={{ 
                    fontSize: '11px', 
                    color: 'var(--text-secondary)', 
                    opacity: 0.6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {res.subtitle}
                  </div>
                </div>
                {idx === selectedIndex && (
                  <div style={{ color: 'var(--text-secondary)', opacity: 0.3 }}>
                    <Command size={14} />
                    <span style={{ fontSize: '11px', marginLeft: '4px' }}>↵</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(255,255,255,0.01)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>
              <span style={{ padding: '2px 4px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>↑↓</span>
              <span>Navigate</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>
              <span style={{ padding: '2px 4px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>Enter</span>
              <span>Select</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--text-secondary)', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px'
            }}
          >
            <X size={12} /> Close
          </button>
        </div>
      </div>
    </div>
  )
}
