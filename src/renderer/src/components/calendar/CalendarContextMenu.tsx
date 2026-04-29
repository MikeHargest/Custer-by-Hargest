import { useState, useEffect, useRef, useMemo } from 'react'
import { Pencil, Trash2, FolderSync, X, Check } from 'lucide-react'
import { Project } from '../../types'

interface CalendarContextMenuProps {
  type: 'task' | 'event'
  item: {
    id: string
    title: string
    projectId: string
  }
  projects: Project[]
  position: { x: number; y: number }
  onClose: () => void
  onRename: (newName: string) => void
  onDelete: () => void
  onChangeProject: (newProjectId: string) => void
}

export default function CalendarContextMenu({
  type,
  item,
  projects,
  position,
  onClose,
  onRename,
  onDelete,
  onChangeProject
}: CalendarContextMenuProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState(item.title)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const adjustedPosition = useMemo(() => {
    const width = 180
    const height = isRenaming ? 120 : 160
    let x = position.x
    let y = position.y

    if (x + width > window.innerWidth) x = window.innerWidth - width - 10
    if (y + height > window.innerHeight) y = window.innerHeight - height - 10
    
    return { x, y }
  }, [position, isRenaming])

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isRenaming])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const handleRenameSubmit = () => {
    if (newName.trim() && newName.trim() !== item.title) {
      onRename(newName.trim())
    }
    setIsRenaming(false)
    onClose()
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 11000,
      background: 'transparent'
    }}>
      <div
        ref={menuRef}
        className="project-dropdown"
        style={{
          position: 'absolute',
          top: `${adjustedPosition.y}px`,
          left: `${adjustedPosition.x}px`,
          width: '180px',
          padding: '4px',
          animation: 'popupFadeIn 0.15s ease-out',
          marginTop: 0
        }}
      >
        {!isRenaming ? (
          <>
            <div style={{ padding: '6px 10px', fontSize: '10px', color: 'var(--text-secondary)', opacity: 0.5, textTransform: 'uppercase', fontWeight: 700 }}>
                {type === 'task' ? 'Task Actions' : 'Event Actions'}
            </div>
            <button className="project-dropdown-item" onClick={() => setIsRenaming(true)}>
              <Pencil size={14} />
              <span>Rename</span>
            </button>
            
            <div style={{ position: 'relative', display: 'flex', width: '100%' }}>
                 <div className="project-dropdown-item" style={{ cursor: 'default' }}>
                    <FolderSync size={14} />
                    <span>Project</span>
                    <select
                        value={item.projectId}
                        onChange={(e) => {
                            onChangeProject(e.target.value)
                            onClose()
                        }}
                        style={{
                            position: 'absolute',
                            top: 0, left: 0, width: '100%', height: '100%',
                            opacity: 0,
                            cursor: 'pointer'
                        }}
                    >
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>
                                {'\u00A0'.repeat((p.depth || 0) * 3)}{p.name}
                            </option>
                        ))}
                    </select>
                 </div>
            </div>

            <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />
            
            <button className="project-dropdown-item danger" onClick={() => { onDelete(); onClose(); }}>
              <Trash2 size={14} />
              <span>Delete</span>
            </button>
          </>
        ) : (
          <div style={{ padding: '4px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', padding: '4px 8px', opacity: 0.5 }}>RENAME</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px' }}>
                <input
                    ref={inputRef}
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') handleRenameSubmit()
                        if (e.key === 'Escape') setIsRenaming(false)
                    }}
                    style={{
                        flex: 1,
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid var(--accent)',
                        borderRadius: '4px',
                        color: 'var(--text-primary)',
                        padding: '4px 8px',
                        fontSize: '12px',
                        outline: 'none'
                    }}
                />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', marginTop: '4px' }}>
                <button 
                    onClick={() => setIsRenaming(false)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '4px', cursor: 'pointer' }}
                >
                    <X size={14} />
                </button>
                <button 
                    onClick={handleRenameSubmit}
                    style={{ background: 'var(--accent)', border: 'none', color: 'white', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                    <Check size={14} />
                </button>
            </div>
          </div>
        )}
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
