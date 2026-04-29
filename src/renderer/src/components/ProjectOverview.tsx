import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  Image as ImageIcon,
  FileText,
  ChevronDown,
  ChevronUp,
  Trash2,
  PanelLeft,
  Settings,
  Move,
  Check,
  X,
  ArrowRight
} from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { Project, TaskItem, AppNote } from '../types'
import OverviewEditor from './OverviewEditor'

// --- STYLES ---
const topMenuStyle: React.CSSProperties = {
  height: '45px',
  display: 'flex',
  alignItems: 'center',
  padding: '0 10px',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  flexShrink: 0,
  gap: '12px',
  background: 'transparent'
}
const containerStyle: React.CSSProperties = {
  flex: 1,
  padding: '0',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  boxSizing: 'border-box'
}
const cardStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  background: 'var(--card-bg)'
}
const bannerStyle: React.CSSProperties = {
  width: '100%',
  height: '280px',
  flexShrink: 0,
  position: 'relative',
  transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1), min-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  overflow: 'hidden',
  borderRadius: 0,
  margin: 0
}
const sidebarStyle: React.CSSProperties = {
  width: '280px',
  padding: '16px 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '0',
  borderRight: '1px solid rgba(255,255,255,0.06)',
  background: 'transparent',
  overflowY: 'auto'
}
const mainContentStyle: React.CSSProperties = {
  flex: 1,
  padding: '16px 24px',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '0',
  minWidth: 0
}
const titleStyle: React.CSSProperties = {
  margin: 0,
  padding: 0,
  fontSize: '36px',
  fontWeight: 700,
  color: 'var(--text-primary)',
  letterSpacing: '-0.02em',
  lineHeight: '44px',
  height: '44px',
  display: 'flex',
  alignItems: 'center'
}
const dividerStyle: React.CSSProperties = {
  border: 'none',
  borderTop: '1px solid rgba(255,255,255,0.05)',
  marginTop: '16px',
  marginBottom: '16px'
}

const mainDividerStyle: React.CSSProperties = {
  ...dividerStyle,
  marginLeft: '-24px',
  marginRight: '-24px',
  width: 'auto',
  display: 'block'
}
const iconBoxStyle: React.CSSProperties = {
  width: '64px',
  height: '64px',
  borderRadius: '10px',
  background: 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  position: 'relative',
  border: '1px solid transparent',
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
}

const bannerActionBtnStyle: React.CSSProperties = {
  width: '30px',
  height: '30px',
  background: 'transparent',
  border: 'none',
  borderRadius: '6px',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  opacity: 0.6,
  transition: 'all 0.2s',
  padding: 0
}

const subprojectsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: '16px'
}
const noteCardStyle: React.CSSProperties = {
  background: '#171717',
  border: '1px solid rgba(255,255,255,0.04)',
  borderRadius: '10px',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  transition: 'transform 0.2s, background 0.2s',
  cursor: 'pointer',
  minHeight: '110px'
}
const subprojectTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  color: 'var(--text-primary)'
}

// --- HELPER COMPONENTS ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SectionLabel = ({ children }: any): React.ReactElement => (
  <h3
    style={{
      margin: 0,
      fontSize: '10px',
      color: 'var(--text-secondary)',
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      fontWeight: 700
    }}
  >
    {children}
  </h3>
)



const CustomSelect = ({
  icon,
  label,
  value,
  onChange,
  options,
  color
}: {
  icon: React.ReactNode
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  options: string[]
  color?: string
}): React.ReactElement => {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 10px',
        borderRadius: '6px',
        border: '1px solid transparent',
        backgroundColor: isHovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
        {icon}
        <span style={{ fontSize: '13px', fontWeight: 400 }}>{label}</span>
      </div>
      <div style={{ color: color || (isHovered ? 'var(--text-primary)' : 'var(--text-secondary)'), fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
        {value}
        <LucideIcons.ChevronDown size={14} style={{ opacity: isHovered ? 1 : 0.5 }} />
      </div>
      <select
        value={value}
        onChange={onChange}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer'
        }}
      >
        {options.map((opt) => (
          <option key={opt} value={opt} style={{ background: '#1a1a1a', color: 'white' }}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  )
}

const CustomDateInput = ({
  icon,
  label,
  value,
  onChange
}: {
  icon: React.ReactNode
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}): React.ReactElement => {
  const [isHovered, setIsHovered] = useState(false)

  const displayValue = useMemo(() => {
    if (!value) return 'mm/dd/yyyy'
    const parts = value.split('-')
    if (parts.length === 3) return `${parts[1]}/${parts[2]}/${parts[0]}`
    return value
  }, [value])

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 10px',
        borderRadius: '6px',
        border: '1px solid transparent',
        backgroundColor: isHovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
        {icon}
        <span style={{ fontSize: '13px', fontWeight: 400 }}>{label}</span>
      </div>
      <div style={{ color: isHovered ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>
        {displayValue}
      </div>
      <input
        type="date"
        value={value}
        onChange={onChange}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer'
        }}
      />
      <style>{`
        input[type="date"]::-webkit-calendar-picker-indicator {
          position: absolute; left: 0; top: 0;
          width: 100%; height: 100%;
          margin: 0; padding: 0;
          cursor: pointer; opacity: 0; z-index: 3;
        }
      `}</style>
    </div>
  )
}

const ProjectIcon = ({
  iconName,
  size = 40
}: {
  iconName?: string
  size?: number
}): React.ReactElement => {
  if (iconName?.startsWith('file')) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '4px',
          background: `url("${iconName}") center/cover`
        }}
      />
    )
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icon = (LucideIcons as any)[iconName || 'FolderOpen'] || LucideIcons.FolderOpen
  return <Icon size={size} />
}

interface ProjectOverviewProps {
  project: Project
  allProjects: Project[]
  onUpdate: (id: string, updates: Partial<Project>) => void
  notes: AppNote[]
  onNoteClick?: (noteId: string) => void
  onProjectClick?: (projectId: string) => void
  isSidebarOpen: boolean
  onToggleSidebar: () => void
  onNavigateToPipeline?: () => void
}

const MONOCHROME_ICONS = [
  'Briefcase', 'Folder', 'FolderOpen', 'Star', 'Heart', 'Zap', 'Target',
  'Rocket', 'Globe', 'Book', 'Code', 'Music', 'Camera', 'Film', 'Cpu',
  'Database', 'HardDrive', 'Shield', 'Award', 'Coffee', 'Gamepad2',
  'Palette', 'Lightbulb', 'Pencil', 'Compass', 'Anchor', 'Box',
  'Layers', 'Grid3X3', 'Terminal'
]

const IconPicker = ({
  onSelect,
  onClose
}: {
  onSelect: (icon: string) => void
  onClose: () => void
}): React.ReactElement | null => {
  const [hovered, setHovered] = useState<string | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
    }
  }, [onClose])

  return (
    <div
      ref={pickerRef}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        left: 0,
        zIndex: 1000,
        background: 'var(--card-bg)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '10px',
        padding: '12px',
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 32px)',
        gap: '6px',
        width: 'fit-content',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        userSelect: 'none'
      }}
    >
      {MONOCHROME_ICONS.map((name) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Icon = (LucideIcons as any)[name]
        const isHovered = hovered === name
        return Icon ? (
          <button
            key={name}
            onClick={(e) => { e.stopPropagation(); onSelect(name) }}
            onMouseEnter={() => setHovered(name)}
            onMouseLeave={() => setHovered(null)}
            style={{
              background: isHovered ? 'rgba(255,255,255,0.1)' : 'transparent',
              border: 'none',
              borderRadius: '10px',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              color: isHovered ? 'var(--text-primary)' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: isHovered ? 'scale(1.1)' : 'scale(1)'
            }}
          >
            {(() => {
              const DynamicIcon = LucideIcons[name as keyof typeof LucideIcons] as LucideIcons.LucideIcon
              return <DynamicIcon size={18} strokeWidth={2.5} />
            })()}
          </button>
        ) : null
      })}
    </div>
  )
}

export default function ProjectOverview({
  project,
  allProjects,
  onUpdate,
  notes,
  onNoteClick,
  onProjectClick,
  isSidebarOpen,
  onToggleSidebar,
  onNavigateToPipeline
}: ProjectOverviewProps): React.ReactElement | null {
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(project.name || '')
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [showBannerMenu, setShowBannerMenu] = useState(false)
  const bannerMenuRef = useRef<HTMLDivElement>(null)

  const [isRepositioning, setIsRepositioning] = useState(false)
  const [tempPosition, setTempPosition] = useState(project.bannerPosition ?? 50)
  const [isDragging, setIsDragging] = useState(false)
  const [startY, setStartY] = useState(0)
  const [startPos, setStartPos] = useState(0)

  useEffect(() => {
    setNameValue(project.name || '')
  }, [project.name, project.id])

  useEffect(() => {
    setTempPosition(project.bannerPosition ?? 50)
  }, [project.bannerPosition, project.id])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bannerMenuRef.current && !bannerMenuRef.current.contains(event.target as Node)) {
        setShowBannerMenu(false)
      }
    }
    if (showBannerMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showBannerMenu])

  const stats = useMemo(() => {
    let total = 0
    let completed = 0
    const traverse = (p: Project): void => {
      const processTasks = (taskItems: TaskItem[]): void => {
        taskItems.forEach((t) => {
          total++
          if (t.completed) completed++
          if (t.subtasks && t.subtasks.length > 0) processTasks(t.subtasks)
        })
      }
      if (p.tasks) processTasks(p.tasks)
      p.subprojects?.forEach(traverse)
    }
    traverse(project)
    return { total, completed }
  }, [project])

  const parentProject = useMemo(() => {
    return allProjects.find((p) => p.subprojects?.some((sub) => sub.id === project.id))
  }, [allProjects, project.id])

  const progressPercent = useMemo(() => {
    if (project.progressMode === 'manual') return project.manualProgress || 0
    if (stats.total === 0) return 0
    return Math.round((stats.completed / stats.total) * 100)
  }, [project, stats])

  const { pipelineProgress, activePipeline } = useMemo(() => {
    if (!project.pipelines || project.pipelines.length === 0) return { pipelineProgress: null, activePipeline: null }

    const activeId = project.activePipelineId || project.pipelines[0].id
    const active = project.pipelines.find(p => p.id === activeId)
    if (!active) return { pipelineProgress: null, activePipeline: null }

    if (project.activePipelineStageId) {
      const stage = active.stages.find(s => s.id === project.activePipelineStageId)
      if (stage) {
        const total = stage.items.length
        const completed = stage.items.filter(i => i.completed).length
        return { pipelineProgress: total === 0 ? 0 : Math.round((completed / total) * 100), activePipeline: active }
      }
    }

    let total = 0
    let completed = 0
    active.stages.forEach(s => {
      s.items.forEach(i => {
        total++
        if (i.completed) completed++
      })
    })
    return { pipelineProgress: total === 0 ? 0 : Math.round((completed / total) * 100), activePipeline: active }
  }, [project.pipelines, project.activePipelineId, project.activePipelineStageId])

  const displayProgress = pipelineProgress !== null ? pipelineProgress : progressPercent

  const handleBannerChange = async (): Promise<void> => {
    // @ts-ignore - Electron API
    const path = await window.api.selectImageFile()
    if (path) {
      const normalizedPath = path.replace(/\\/g, '/')
      const fileUrl = `file://${normalizedPath.startsWith('/') ? '' : '/'}${encodeURI(normalizedPath)}`
      onUpdate(project.id, { banner: fileUrl })
    }
  }

  const handleStartReposition = () => {
    setIsRepositioning(true)
    setShowBannerMenu(false)
    setTempPosition(project.bannerPosition ?? 50)
  }

  const handleBannerMouseDown = (e: React.MouseEvent) => {
    if (!isRepositioning) return
    setIsDragging(true)
    setStartY(e.clientY)
    setStartPos(tempPosition)
  }

  const handleBannerMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !isRepositioning) return
    const deltaY = e.clientY - startY
    const sensitivity = 0.4
    let nextPos = startPos - deltaY * sensitivity
    nextPos = Math.max(0, Math.min(100, nextPos))
    setTempPosition(nextPos)
  }

  const handleBannerMouseUp = () => setIsDragging(false)

  const saveReposition = () => {
    onUpdate(project.id, { bannerPosition: tempPosition })
    setIsRepositioning(false)
  }

  const cancelReposition = () => {
    setTempPosition(project.bannerPosition ?? 50)
    setIsRepositioning(false)
  }

  const saveName = (): void => {
    const trimmed = nameValue.trim()
    if (!trimmed) {
      setNameValue(project.name)
      setIsEditingName(false)
      return
    }
    if (trimmed === project.name) {
      setIsEditingName(false)
      return
    }
    const isDuplicate = allProjects.some(
      (p) => p.id !== project.id && p.name.toLowerCase() === trimmed.toLowerCase()
    )
    if (isDuplicate) {
      setNameValue(project.name)
      setIsEditingName(false)
      return
    }
    onUpdate(project.id, { name: trimmed })
    setIsEditingName(false)
  }

  return (
    <div className="project-overview-container" style={containerStyle}>
      <div className="project-card" style={cardStyle}>

        {/* --- TOP MENU --- */}
        <div className="project-top-menu" style={topMenuStyle}>
          <button
            onClick={onToggleSidebar}
            title={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            style={{
              background: 'transparent',
              border: 'none',
              color: isSidebarOpen ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isSidebarOpen ? 0.6 : 0.4,
              transition: 'opacity 0.2s',
              width: '30px',
              height: '30px',
              marginRight: '8px'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = isSidebarOpen ? '0.6' : '0.4')}
          >
            <PanelLeft size={18} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
            <div ref={bannerMenuRef} style={{ position: 'relative', display: 'flex' }}>
              <button
                onClick={() => setShowBannerMenu(!showBannerMenu)}
                style={{
                  ...bannerActionBtnStyle,
                  background: showBannerMenu ? 'rgba(255,255,255,0.08)' : 'transparent',
                  opacity: showBannerMenu ? 1 : 0.6
                }}
                title="Banner Settings"
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => { if (!showBannerMenu) e.currentTarget.style.opacity = '0.6' }}
              >
                <Settings size={18} />
              </button>

              {showBannerMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    background: '#1a1a1a',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '10px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    padding: '6px',
                    minWidth: '180px',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}
                >
                  <button
                    onClick={() => { handleBannerChange(); setShowBannerMenu(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 12px', background: 'transparent', border: 'none',
                      borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px',
                      fontWeight: 500, cursor: 'pointer', width: '100%', textAlign: 'left',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <ImageIcon size={14} style={{ opacity: 0.7 }} />
                    Select Banner Image
                  </button>

                  <button
                    disabled={!project.banner}
                    onClick={handleStartReposition}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 12px', background: 'transparent', border: 'none',
                      borderRadius: '6px',
                      color: project.banner ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize: '13px', fontWeight: 500,
                      cursor: project.banner ? 'pointer' : 'not-allowed',
                      opacity: project.banner ? 1 : 0.4,
                      width: '100%', textAlign: 'left', transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => { if (project.banner) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Move size={14} style={{ opacity: 0.7 }} />
                    Reposition Banner
                  </button>

                  <button
                    disabled={!project.banner}
                    onClick={() => { onUpdate(project.id, { banner: undefined }); setShowBannerMenu(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 12px', background: 'transparent', border: 'none',
                      borderRadius: '6px',
                      color: project.banner ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize: '13px', fontWeight: 500,
                      cursor: project.banner ? 'pointer' : 'not-allowed',
                      opacity: project.banner ? 1 : 0.4,
                      width: '100%', textAlign: 'left', transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => { if (project.banner) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Trash2 size={14} style={{ opacity: 0.7 }} />
                    Remove Banner
                  </button>
                </div>
              )}
            </div>

            <button
              disabled={!project.banner}
              onClick={() => onUpdate(project.id, { bannerCollapsed: !project.bannerCollapsed })}
              style={{
                ...bannerActionBtnStyle,
                opacity: project.banner ? 0.6 : 0.2,
                cursor: project.banner ? 'pointer' : 'not-allowed',
                marginLeft: '4px'
              }}
              title={project.bannerCollapsed ? 'Expand Banner' : 'Collapse Banner'}
              onMouseEnter={(e) => { if (project.banner) e.currentTarget.style.opacity = '1' }}
              onMouseLeave={(e) => { if (project.banner) e.currentTarget.style.opacity = '0.6' }}
            >
              {project.bannerCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            scrollbarGutter: 'stable'
          }}
        >
          {/* --- BANNER --- */}
          <div
            className="banner"
            onMouseDown={handleBannerMouseDown}
            onMouseMove={handleBannerMouseMove}
            onMouseUp={handleBannerMouseUp}
            onMouseLeave={handleBannerMouseUp}
            style={{
              ...bannerStyle,
              height: project.bannerCollapsed || !project.banner ? '0px' : '280px',
              minHeight: project.bannerCollapsed || !project.banner ? '0px' : '280px',
              cursor: isRepositioning ? 'ns-resize' : 'default',
              userSelect: 'none',
              background: project.banner
                ? `url("${project.banner}")`
                : `linear-gradient(135deg, ${project.color || 'var(--accent)'}, var(--bg-surface))`,
              backgroundSize: 'cover',
              backgroundPosition: `50% ${tempPosition}%`,
              backgroundRepeat: 'no-repeat'
            }}
          >
            {isRepositioning && (
              <div
                style={{
                  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: '20px', zIndex: 10
                }}
              >
                <div style={{
                  padding: '8px 16px', background: 'rgba(0,0,0,0.8)',
                  borderRadius: '20px', color: 'white', fontSize: '12px', fontWeight: 600,
                  backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  Drag up or down to reposition
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); saveReposition() }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 20px', borderRadius: '8px', background: 'var(--accent)',
                      color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}
                  >
                    <Check size={16} /> Save
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); cancelReposition() }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 20px', borderRadius: '8px',
                      background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none',
                      cursor: 'pointer', fontWeight: 600, backdropFilter: 'blur(5px)'
                    }}
                  >
                    <X size={16} /> Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
          <hr style={{ ...dividerStyle, margin: 0, width: '100%' }} />

          <div style={{ display: 'flex', flexShrink: 0, minHeight: 'min-content' }}>

            {/* --- SIDEBAR --- */}
            <aside style={{ ...sidebarStyle, flexShrink: 0 }}>
              <div
                className="progress-module"
                style={{ height: '64px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <SectionLabel>Progress</SectionLabel>
                  <span
                    style={{
                      fontWeight: 900, fontSize: '24px', lineHeight: '1',
                      color: project.color || '#FACC15', letterSpacing: '-0.04em'
                    }}
                  >
                    {displayProgress}
                    <span style={{ fontSize: '12px', opacity: 0.5, marginLeft: '2px', fontWeight: 600 }}>%</span>
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={displayProgress}
                  onChange={(e) => {
                    if (pipelineProgress === null) {
                      onUpdate(project.id, { manualProgress: parseInt(e.target.value), progressMode: 'manual' })
                    }
                  }}
                  style={{
                    width: '100%', height: '14px', appearance: 'none',
                    background: 'transparent', cursor: pipelineProgress !== null ? 'default' : 'pointer', outline: 'none', margin: 0
                  }}
                  className="progress-slider"
                />
                <style>{`
                  .progress-slider::-webkit-slider-runnable-track {
                    background: linear-gradient(to right,
                      ${project.color || '#FACC15'} 0%,
                      ${project.color || '#FACC15'} ${displayProgress}%,
                      rgba(255,255,255,0.08) ${displayProgress}%,
                      rgba(255,255,255,0.08) 100%);
                    height: 4px; border-radius: 2px;
                  }
                  .progress-slider::-webkit-slider-thumb {
                    appearance: none; height: 14px; width: 14px; border-radius: 50%;
                    background: ${project.color || '#FACC15'}; cursor: ${pipelineProgress !== null ? 'default' : 'pointer'};
                    margin-top: -5px; box-shadow: 0 0 10px rgba(0,0,0,0.5);
                    border: 2px solid #1a1a1a;
                  }
                `}</style>
              </div>

              {/* PIPELINE TABS & STAGES */}
              {project.pipelines && project.pipelines.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* TABS */}
                  <div
                    style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}
                    onWheel={(e) => {
                      if (e.deltaY !== 0) {
                        e.currentTarget.scrollLeft += e.deltaY
                      }
                    }}
                  >
                    {project.pipelines.map(p => {
                      const isActive = p.id === (project.activePipelineId || project.pipelines?.[0]?.id)
                      return (
                        <button
                          key={p.id}
                          onClick={() => onUpdate(project.id, { activePipelineId: p.id })}
                          title={p.name}
                          style={{
                            flexShrink: 0,
                            maxWidth: '140px',
                            background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                            border: `1px solid ${isActive ? 'rgba(255,255,255,0.1)' : 'transparent'}`,
                            borderRadius: '6px',
                            padding: '6px 12px',
                            color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--text-primary)' }}
                          onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)' }}
                        >
                          {p.name}
                        </button>
                      )
                    })}
                  </div>

                  {/* STAGES */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {activePipeline?.stages?.map(stage => {
                      const isSelected = project.activePipelineStageId === stage.id
                      return (
                        <div
                          key={stage.id}
                          onClick={() => {
                            onUpdate(project.id, { activePipelineStageId: stage.id })
                          }}
                          style={{
                            background: 'transparent',
                            border: `1px solid ${isSelected ? (project.color || 'var(--accent)') : 'rgba(255,255,255,0.08)'}`,
                            borderRadius: '8px',
                            padding: '8px 12px 8px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            gap: '8px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                            if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.borderColor = isSelected ? (project.color || 'var(--accent)') : 'rgba(255,255,255,0.08)'
                          }}
                        >
                          <span
                            title={stage.name}
                            style={{
                              fontSize: '13px',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              flex: 1
                            }}
                          >
                            {stage.name}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onUpdate(project.id, { activePipelineStageId: stage.id })
                              if (onNavigateToPipeline) onNavigateToPipeline()
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              padding: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '6px',
                              transition: 'all 0.2s',
                              color: 'var(--text-secondary)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                              e.currentTarget.style.color = 'var(--text-primary)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent'
                              e.currentTarget.style.color = 'var(--text-secondary)'
                            }}
                            title="Go to Pipeline"
                          >
                            <ArrowRight size={14} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </aside>

            {/* --- MAIN CONTENT --- */}
            <main style={{ ...mainContentStyle, overflowY: 'visible', flex: 1 }}>
              <header style={{ display: 'flex', alignItems: 'center', gap: '24px', position: 'relative', marginBottom: '8px' }}>
                <div
                  style={{ ...iconBoxStyle, color: project.color }}
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <ProjectIcon iconName={project.icon} />
                  {showIconPicker && (
                    <IconPicker
                      onSelect={(icon) => { onUpdate(project.id, { icon }); setShowIconPicker(false) }}
                      onClose={() => setShowIconPicker(false)}
                    />
                  )}
                </div>
                <div style={{ flex: 1, height: '64px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  {isEditingName ? (
                    <input
                      autoFocus
                      onFocus={(e) => e.target.select()}
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      onBlur={saveName}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveName()
                        if (e.key === 'Escape') { setNameValue(project.name); setIsEditingName(false) }
                      }}
                      style={{
                        ...titleStyle, background: 'transparent', border: 'none',
                        width: '100%', outline: 'none', color: 'var(--text-primary)',
                        caretColor: project.color || 'var(--accent)', fontFamily: 'inherit'
                      }}
                    />
                  ) : (
                    <h1
                      onClick={() => setIsEditingName(true)}
                      style={{ ...titleStyle, cursor: 'text', borderRadius: '4px', transition: 'color 0.2s', userSelect: 'none' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                      title="Click to rename project"
                    >
                      {project.name}
                    </h1>
                  )}
                </div>
              </header>

              {/* PROJECT METADATA */}
              <section style={{ marginBottom: '0', display: 'flex', alignItems: 'center', gap: '8px', padding: '0', flexWrap: 'wrap' }}>
                <CustomSelect
                  icon={<LucideIcons.Clock size={14} />}
                  label="Status"
                  value={project.status || 'Active'}
                  onChange={(e) => onUpdate(project.id, { status: e.target.value })}
                  options={['Planning', 'Active', 'On Hold', 'Completed']}
                  color={project.status === 'Active' ? '#4ade80' : undefined}
                />

                <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.08)' }} />

                <CustomSelect
                  icon={<LucideIcons.Flag size={14} />}
                  label="Priority"
                  value={project.priority || 'Medium'}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onChange={(e) => onUpdate(project.id, { priority: e.target.value as any })}
                  options={['Low', 'Medium', 'High', 'Urgent']}
                />

                <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.08)' }} />

                <CustomDateInput
                  icon={<LucideIcons.Calendar size={14} />}
                  label="Start Date"
                  value={project.startDate || ''}
                  onChange={(e) => onUpdate(project.id, { startDate: e.target.value })}
                />

                <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.08)' }} />

                <CustomDateInput
                  icon={<LucideIcons.Calendar size={14} />}
                  label="End Date"
                  value={project.endDate || ''}
                  onChange={(e) => onUpdate(project.id, { endDate: e.target.value })}
                />
              </section>

              <hr style={{ ...mainDividerStyle, marginTop: '16px', marginBottom: '24px' }} />
              {/* ── конец исправления ── */}

              {project.path && (
                <section>
                  <OverviewEditor
                    projectPath={project.path}
                    projectColor={project.color}
                    projectId={project.id}
                  />
                </section>
              )}
            </main>
          </div>

          <div style={{ padding: '0 24px 24px 24px', display: 'flex', flexDirection: 'column', gap: '0' }}>

            {/* --- SUBPROJECTS --- */}
            {((project.subprojects && project.subprojects.length > 0) || parentProject) && (
              <section style={{ padding: '0 0 24px 0' }}>
                <hr style={{ ...mainDividerStyle, marginTop: '0', marginBottom: '24px' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <SectionLabel>Subprojects</SectionLabel>
                    {parentProject && (
                      <button
                        onClick={() => onProjectClick?.(parentProject.id)}
                        title={`Up to ${parentProject.name}`}
                        style={{
                          background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '6px',
                          width: '24px', height: '24px', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                      >
                        <LucideIcons.ArrowUpToLine size={14} />
                      </button>
                    )}
                  </div>
                  {project.subprojects && project.subprojects.length > 0 && (
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '10px' }}>
                      {project.subprojects.length}
                    </span>
                  )}
                </div>
                <div style={{ ...subprojectsGridStyle, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
                  {project.subprojects?.map((sub) => (
                    <div
                      key={sub.id}
                      style={{ ...noteCardStyle, cursor: onProjectClick ? 'pointer' : 'default', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
                      onClick={() => onProjectClick?.(sub.id)}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = (sub.color || 'var(--accent)') + '44' }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = '#171717'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)' }}
                    >
                      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ color: sub.color || 'var(--text-primary)', display: 'flex' }}>
                            <ProjectIcon iconName={sub.icon} size={20} />
                          </div>
                          <span style={{ ...subprojectTitleStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {sub.name}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{
                            fontSize: '10px', fontWeight: 700, padding: '4px 8px', borderRadius: '6px',
                            background: (sub.color || 'var(--accent)') + '15', color: sub.color || 'var(--accent)',
                            textTransform: 'uppercase', letterSpacing: '0.05em'
                          }}>
                            {sub.status || 'Active'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* --- PROJECT NOTES --- */}
            <section style={{ padding: '0 0 24px 0' }}>
              <hr style={{ ...mainDividerStyle, marginTop: '0', marginBottom: '24px' }} />
              <div style={{ marginBottom: '8px' }}>
                <SectionLabel>Project Notes</SectionLabel>
              </div>
              {(() => {
                const projectNotes = notes.filter((n) => n.projectId === project.id && !n.isTrash)
                if (projectNotes.length === 0) {
                  return (
                    <div style={{
                      padding: '16px', textAlign: 'center', background: 'transparent',
                      borderRadius: '10px', border: 'none', color: 'rgba(255, 255, 255, 0.25)', fontSize: '13px'
                    }}>
                      No notes associated with this project.
                    </div>
                  )
                }
                return (
                  <div style={{ ...subprojectsGridStyle, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                    {projectNotes.map((note) => (
                      <div
                        key={note.id}
                        style={{ ...noteCardStyle, cursor: onNoteClick ? 'pointer' : 'default', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
                        onClick={() => onNoteClick?.(note.id)}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = (project.color || 'var(--accent)') + '44' }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)' }}
                      >
                        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ color: project.color || 'var(--accent)', display: 'flex' }}>
                              {note.type === 'board' ? <ImageIcon size={20} /> : <FileText size={20} />}
                            </div>
                            <span style={{ ...subprojectTitleStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {note.title || 'Untitled Note'}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            Last modified: {new Date(note.lastModified).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </section>

          </div>
        </div>
      </div>
    </div>
  )
}
