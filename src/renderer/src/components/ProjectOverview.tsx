import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  Image as ImageIcon,
  Calendar,
  Flag,
  CheckCircle2,
  Clock,
  Edit2,
  Save,
  FileText,
  ChevronDown,
  ChevronUp,
  Trash2,
  Link as LinkIcon,
  Paperclip,
  ExternalLink,
  Folder as FolderIcon
} from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { Project, TaskItem, AppNote } from '../types'

// --- STYLES (Keep logic clean by moving objects down) ---
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
  transition:
    'height 0.3s cubic-bezier(0.4, 0, 0.2, 1), min-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  overflow: 'hidden'
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
const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '200px',
  background: 'rgba(0,0,0,0.2)',
  borderRadius: '10px',
  padding: '16px',
  color: 'var(--text-primary)',
  border: '1px solid'
}
const dividerStyle: React.CSSProperties = {
  border: 'none',
  borderTop: '1px solid rgba(255,255,255,0.05)',
  marginTop: '16px',
  marginBottom: '16px'
}
const sidebarDividerStyle: React.CSSProperties = {
  ...dividerStyle,
  marginLeft: '-24px',
  marginRight: '-24px',
  width: 'auto',
  display: 'block'
}
const mainDividerStyle: React.CSSProperties = {
  ...dividerStyle,
  marginLeft: '-24px',
  marginRight: '-24px',
  width: 'auto',
  display: 'block'
}
const labelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '12px',
  color: 'var(--text-secondary)',
  fontWeight: 600
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
const editBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  borderRadius: '6px',
  padding: '6px 12px',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '12px',
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
}
const descriptionViewStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: '14px',
  lineHeight: 1.7,
  whiteSpace: 'pre-wrap'
}
const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '6px 0',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  border: 'none',
  borderRadius: '6px',
  background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
})

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

// --- HELPER COMPONENTS (Internal to file for brevity) ---

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

const MetaField = ({
  icon,
  label,
  children,
  flex
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
  flex?: boolean
}): React.ReactElement => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      flex: flex ? 1 : 'none',
      width: '100%',
      minHeight: '36px',
      padding: '0'
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: 'var(--text-secondary)',
        fontSize: '13px',
        fontWeight: 500
      }}
    >
      <div
        style={{
          display: 'flex',
          width: '24px',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {icon}
      </div>
      {label}
    </div>
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'flex-end', flex: 1 }}>
      {children}
    </div>
  </div>
)

const CustomSelect = ({
  value,
  onChange,
  options
}: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  options: string[]
}): React.ReactElement => {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      style={{
        position: 'relative',
        width: '120px',
        display: 'flex',
        alignItems: 'center'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <select
        value={value}
        onChange={onChange}
        style={{
          ...editBtnStyle,
          width: '100%',
          appearance: 'none',
          paddingRight: '32px',
          background: isHovered ? 'rgba(255,255,255,0.06)' : 'transparent',
          color: isHovered ? 'var(--text-primary)' : 'var(--text-secondary)',
          outline: 'none'
        }}
      >
        {options.map((opt) => (
          <option key={opt} value={opt} style={{ background: '#1a1a1a', color: 'white' }}>
            {opt}
          </option>
        ))}
      </select>
      <div
        style={{
          position: 'absolute',
          right: '10px',
          pointerEvents: 'none',
          color: isHovered ? 'var(--text-primary)' : 'var(--text-secondary)',
          display: 'flex',
          transition: 'all 0.2s ease'
        }}
      >
        <ChevronDown size={14} />
      </div>
    </div>
  )
}

const CustomDateInput = ({
  value,
  onChange
}: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}): React.ReactElement => {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      style={{
        position: 'relative',
        width: '120px',
        display: 'flex',
        alignItems: 'center'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <input
        type="date"
        value={value}
        onChange={onChange}
        style={{
          ...editBtnStyle,
          width: '100%',
          padding: '6px 12px',
          textAlign: 'center',
          background: isHovered ? 'rgba(255,255,255,0.06)' : 'transparent',
          colorScheme: 'dark',
          position: 'relative',
          zIndex: 1,
          color: isHovered ? 'var(--text-primary)' : 'var(--text-secondary)',
          outline: 'none'
        }}
      />
      <style>{`
        input[type="date"]::-webkit-calendar-picker-indicator {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          cursor: pointer;
          opacity: 0;
          z-index: 3;
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
}

const MONOCHROME_ICONS = [
  'Briefcase',
  'Folder',
  'FolderOpen',
  'Star',
  'Heart',
  'Zap',
  'Target',
  'Rocket',
  'Globe',
  'Book',
  'Code',
  'Music',
  'Camera',
  'Film',
  'Cpu',
  'Database',
  'HardDrive',
  'Shield',
  'Award',
  'Coffee',
  'Gamepad2',
  'Palette',
  'Lightbulb',
  'PenTool',
  'Compass',
  'Anchor',
  'Box',
  'Layers',
  'Grid3X3',
  'Terminal'
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
            onClick={(e) => {
              e.stopPropagation()
              onSelect(name)
            }}
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
              const DynamicIcon = LucideIcons[
                name as keyof typeof LucideIcons
              ] as LucideIcons.LucideIcon
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
  onNoteClick
}: ProjectOverviewProps): React.ReactElement | null {
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [descriptionValue, setDescriptionValue] = useState(project.description || '')
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(project.name || '')
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [isAddingResource, setIsAddingResource] = useState(false)
  const [resourceType, setResourceType] = useState<'file' | 'link' | 'folder'>('file')
  const [resourcePath, setResourcePath] = useState('')
  const [resourceName, setResourceName] = useState('')

  useEffect(() => {
    setDescriptionValue(project.description || '')
  }, [project.description, project.id])

  useEffect(() => {
    setNameValue(project.name || '')
  }, [project.name, project.id])

  // Memoized Task Calculations
  const stats = useMemo(() => {
    let total = 0
    let completed = 0
    const traverse = (p: Project): void => {
      const processTasks = (taskItems: TaskItem[]): void => {
        taskItems.forEach((t) => {
          total++
          if (t.completed) completed++
          if (t.subtasks && t.subtasks.length > 0) {
            processTasks(t.subtasks)
          }
        })
      }
      if (p.tasks) processTasks(p.tasks)
      p.subprojects?.forEach(traverse)
    }
    traverse(project)
    return { total, completed }
  }, [project])

  const pipelineStats = useMemo(() => {
    let total = 0
    let completed = 0

    // Use active pipeline if available
    // , otherwise fallback to legacy field
    const activePipeline = project.activePipelineId
      ? project.pipelines?.find((p) => p.id === project.activePipelineId)
      : project.pipelines?.[0]

    const stages = activePipeline?.stages || project.pipeline || []

    stages.forEach((stage) => {
      stage.items.forEach((item) => {
        total++
        if (item.completed) completed++
      })
    })
    return { total, completed }
  }, [project.pipelines, project.activePipelineId, project.pipeline])

  const progressPercent = useMemo(() => {
    if (project.progressMode === 'manual') return project.manualProgress || 0
    if (project.progressMode === 'pipeline') {
      if (pipelineStats.total === 0) return 0
      return Math.round((pipelineStats.completed / pipelineStats.total) * 100)
    }
    if (stats.total === 0) return 0
    return Math.round((stats.completed / stats.total) * 100)
  }, [project, stats, pipelineStats])

  // Handlers
  const handleBannerChange = async (): Promise<void> => {
    // @ts-ignore - Electron API
    const path = await window.api.selectImageFile()
    if (path) {
      const normalizedPath = path.replace(/\\/g, '/')
      const fileUrl = `file://${normalizedPath.startsWith('/') ? '' : '/'}${encodeURI(normalizedPath)}`
      onUpdate(project.id, { banner: fileUrl })
    }
  }

  const saveDescription = (): void => {
    onUpdate(project.id, { description: descriptionValue })
    setIsEditingDescription(false)
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

    // Check for duplicates in allProjects
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
          {/* --- BANNER SECTION --- */}
          <div
            className="banner"
            style={{
              ...bannerStyle,
              height: project.bannerCollapsed || !project.banner ? '0px' : '280px',
              minHeight: project.bannerCollapsed || !project.banner ? '0px' : '280px',
              background: project.banner
                ? `url("${project.banner}") center/cover no-repeat`
                : `linear-gradient(135deg, ${project.color || 'var(--accent)'}, var(--bg-surface))`
            }}
          />
          <hr style={{ ...dividerStyle, margin: 0, width: '100%' }} />

          <div style={{ display: 'flex', flexShrink: 0, minHeight: 'min-content' }}>
            {/* --- SIDEBAR (METADATA) --- */}
            <aside style={{ ...sidebarStyle, flexShrink: 0 }}>
              <div style={{ height: '64px' }} />
              <hr style={{ ...sidebarDividerStyle, marginTop: '16px', marginBottom: '16px' }} />
              <MetaField icon={<CheckCircle2 size={14} color={project.color} />} label="Status">
                <CustomSelect
                  value={project.status || 'Active'}
                  onChange={(e) => onUpdate(project.id, { status: e.target.value })}
                  options={['Planning', 'Active', 'On Hold', 'Completed']}
                />
              </MetaField>

              <hr style={sidebarDividerStyle} />

              <MetaField
                icon={
                  <Flag
                    size={14}
                    color={project.priority === 'Urgent' ? 'var(--danger)' : project.color}
                  />
                }
                label="Priority"
              >
                <CustomSelect
                  value={project.priority || 'Medium'}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onChange={(e) => onUpdate(project.id, { priority: e.target.value as any })}
                  options={['Low', 'Medium', 'High', 'Urgent']}
                />
              </MetaField>

              <hr style={sidebarDividerStyle} />

              <MetaField icon={<Calendar size={14} />} label="Start Date">
                <CustomDateInput
                  value={project.startDate || ''}
                  onChange={(e) => onUpdate(project.id, { startDate: e.target.value })}
                />
              </MetaField>

              <div style={{ height: '16px' }} />

              <MetaField icon={<Calendar size={14} />} label="End Date">
                <CustomDateInput
                  value={project.endDate || ''}
                  onChange={(e) => onUpdate(project.id, { endDate: e.target.value })}
                />
              </MetaField>

              <hr style={sidebarDividerStyle} />

              <div className="progress-module">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '10px'
                  }}
                >
                  <span style={labelStyle}>
                    <Clock size={14} /> Progress
                  </span>
                  <span
                    style={{
                      fontWeight: 800,
                      fontSize: '14px',
                      color: project.color || 'var(--danger)'
                    }}
                  >
                    {progressPercent}%
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                  <button
                    onClick={() => onUpdate(project.id, { progressMode: 'tasks' })}
                    style={toggleBtnStyle(
                      project.progressMode === 'tasks' || !project.progressMode
                    )}
                  >
                    Tasks
                  </button>
                  <button
                    onClick={() => onUpdate(project.id, { progressMode: 'pipeline' })}
                    style={toggleBtnStyle(project.progressMode === 'pipeline')}
                  >
                    Pipeline
                  </button>
                  <button
                    onClick={() => onUpdate(project.id, { progressMode: 'manual' })}
                    style={toggleBtnStyle(project.progressMode === 'manual')}
                  >
                    Manual
                  </button>
                </div>
                {(() => {
                  const sliderVal =
                    project.progressMode === 'manual'
                      ? project.manualProgress || 0
                      : progressPercent
                  const fillColor = project.color || 'var(--accent)'
                  return (
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={sliderVal}
                      onChange={(e) =>
                        onUpdate(project.id, { manualProgress: Number(e.target.value) })
                      }
                      disabled={project.progressMode !== 'manual'}
                      className="progress-slider"
                      style={{
                        width: '100%',
                        ['--slider-color' as string]: fillColor,
                        background: `linear-gradient(to right, ${fillColor} 0%, ${fillColor} ${sliderVal}%, #2a2a2a ${sliderVal}%, #2a2a2a 100%)`
                      }}
                    />
                  )
                })()}
              </div>
            </aside>

            {/* --- MAIN CONTENT --- */}
            <main style={{ ...mainContentStyle, overflowY: 'visible', flex: 1 }}>
              <header
                style={{ display: 'flex', alignItems: 'center', gap: '24px', position: 'relative' }}
              >
                <div
                  style={{ ...iconBoxStyle, color: project.color }}
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <ProjectIcon iconName={project.icon} />
                  {showIconPicker && (
                    <IconPicker
                      onSelect={(icon) => {
                        onUpdate(project.id, { icon })
                        setShowIconPicker(false)
                      }}
                      onClose={() => setShowIconPicker(false)}
                    />
                  )}
                </div>
                <div
                  style={{
                    flex: 1,
                    height: '64px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}
                >
                  {isEditingName ? (
                    <input
                      autoFocus
                      onFocus={(e) => e.target.select()}
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      onBlur={saveName}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveName()
                        if (e.key === 'Escape') {
                          setNameValue(project.name)
                          setIsEditingName(false)
                        }
                      }}
                      style={{
                        ...titleStyle,
                        background: 'transparent',
                        border: 'none',
                        width: '100%',
                        outline: 'none',
                        color: 'var(--text-primary)',
                        caretColor: project.color || 'var(--accent)',
                        fontFamily: 'inherit'
                      }}
                    />
                  ) : (
                    <h1
                      onClick={() => setIsEditingName(true)}
                      style={{
                        ...titleStyle,
                        cursor: 'text',
                        borderRadius: '4px',
                        transition: 'color 0.2s',
                        userSelect: 'none'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                      title="Click to rename project"
                    >
                      {project.name}
                    </h1>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '6px',
                    alignSelf: 'flex-start'
                  }}
                >
                  {/* Banner Action (Select or Remove) */}
                  <button
                    onClick={
                      project.banner
                        ? () => onUpdate(project.id, { banner: undefined })
                        : handleBannerChange
                    }
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      background: 'rgba(255,255,255,0.03)',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                      e.currentTarget.style.color = project.banner
                        ? 'var(--danger)'
                        : 'var(--text-primary)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                      e.currentTarget.style.color = 'var(--text-secondary)'
                    }}
                  >
                    {project.banner ? <Trash2 size={10} /> : <ImageIcon size={10} />}
                  </button>

                  <button
                    disabled={!project.banner}
                    onClick={() =>
                      onUpdate(project.id, { bannerCollapsed: !project.bannerCollapsed })
                    }
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      background: 'rgba(255,255,255,0.03)',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: project.banner ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                      outline: 'none',
                      opacity: project.banner ? 1 : 0.3
                    }}
                    onMouseEnter={(e) => {
                      if (!project.banner) return
                      e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                      e.currentTarget.style.color = 'var(--text-primary)'
                    }}
                    onMouseLeave={(e) => {
                      if (!project.banner) return
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                      e.currentTarget.style.color = 'var(--text-secondary)'
                    }}
                    title={project.bannerCollapsed ? 'Show Banner' : 'Hide Banner'}
                  >
                    {project.bannerCollapsed ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
                  </button>
                </div>
              </header>

              <hr style={mainDividerStyle} />

              <section>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px'
                  }}
                >
                  <SectionLabel>Description</SectionLabel>
                  <button
                    onClick={() =>
                      isEditingDescription ? saveDescription() : setIsEditingDescription(true)
                    }
                    style={editBtnStyle}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                      e.currentTarget.style.color = 'var(--text-primary)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'var(--text-secondary)'
                    }}
                  >
                    {isEditingDescription ? (
                      <>
                        <Save size={12} /> Save
                      </>
                    ) : (
                      <>
                        <Edit2 size={12} /> Edit
                      </>
                    )}
                  </button>
                </div>
                {isEditingDescription ? (
                  <textarea
                    autoFocus
                    value={descriptionValue}
                    onChange={(e) => setDescriptionValue(e.target.value)}
                    style={{ ...textareaStyle, borderColor: project.color + '55' }}
                    placeholder="Describe your goals..."
                  />
                ) : (
                  <div
                    style={{
                      ...descriptionViewStyle,
                      color: project.description
                        ? 'var(--text-secondary)'
                        : 'rgba(255, 255, 255, 0.25)'
                    }}
                  >
                    {project.description || 'No description provided yet.'}
                  </div>
                )}
              </section>
              
              <hr style={mainDividerStyle} />

              {/* --- ATTACHMENTS SECTION --- */}
              <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <SectionLabel>Resources & Attachments</SectionLabel>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '10px' }}>
                      {project.attachments?.length || 0}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => {
                        setResourceType('file')
                        setIsAddingResource(true)
                      }}
                      style={editBtnStyle}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                    >
                      <Paperclip size={12} /> Add File
                    </button>
                    <button
                      onClick={() => {
                        setResourceType('link')
                        setIsAddingResource(true)
                      }}
                      style={editBtnStyle}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                    >
                      <LinkIcon size={12} /> Add Link
                    </button>
                  </div>
                </div>

                {isAddingResource && (
                  <div style={{ 
                    padding: '16px', 
                    background: 'rgba(255,255,255,0.04)', 
                    borderRadius: '10px', 
                    marginBottom: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    border: '1px solid rgba(255,255,255,0.06)'
                  }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '4px' }}>
                      <SectionLabel>Add {resourceType === 'file' ? 'Local File' : 'Web Link'}</SectionLabel>
                      <div style={{ flex: 1 }} />
                      <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '2px' }}>
                         <button 
                          onClick={() => setResourceType('file')}
                          style={{ ...editBtnStyle, background: resourceType === 'file' ? 'rgba(255,255,255,0.1)' : 'transparent', color: resourceType === 'file' ? 'white' : 'var(--text-secondary)' }}
                         >File</button>
                         <button 
                          onClick={() => setResourceType('folder')}
                          style={{ ...editBtnStyle, background: resourceType === 'folder' ? 'rgba(255,255,255,0.1)' : 'transparent', color: resourceType === 'folder' ? 'white' : 'var(--text-secondary)' }}
                         >Folder</button>
                         <button 
                          onClick={() => setResourceType('link')}
                          style={{ ...editBtnStyle, background: resourceType === 'link' ? 'rgba(255,255,255,0.1)' : 'transparent', color: resourceType === 'link' ? 'white' : 'var(--text-secondary)' }}
                         >Link</button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>{resourceType === 'link' ? 'URL' : 'PATH'}</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input 
                          autoFocus
                          value={resourcePath}
                          onChange={(e) => setResourcePath(e.target.value)}
                          placeholder={resourceType === 'link' ? 'https://example.com' : 'C:\\Projects\\MyFolder'}
                          style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px', color: 'white', fontSize: '13px' }}
                        />
                        {resourceType !== 'link' && (
                          <button
                            onClick={async () => {
                              try {
                                // @ts-ignore
                                const path = resourceType === 'file' ? await window.api.selectFile() : await window.api.selectFolder()
                                if (path) {
                                  setResourcePath(path)
                                  if (!resourceName) {
                                    const name = path.split(/[/\\]/).pop() || ''
                                    setResourceName(name)
                                  }
                                }
                              } catch (err) {
                                console.error('Browse failed:', err)
                              }
                            }}
                            title={`Browse ${resourceType} locally`}
                            style={{ ...editBtnStyle, background: 'rgba(255,255,255,0.05)', padding: '0 12px' }}
                          >
                             <LucideIcons.Search size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>DISPLAY NAME</span>
                      <input 
                        value={resourceName}
                        onChange={(e) => setResourceName(e.target.value)}
                        placeholder="My Document"
                        style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px', color: 'white', fontSize: '13px' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                       <button
                        onClick={() => { setIsAddingResource(false); setResourcePath(''); setResourceName(''); }}
                        style={{ ...editBtnStyle, background: 'rgba(255,255,255,0.05)' }}
                      >
                        Cancel
                      </button>
                      <button
                        disabled={!resourcePath}
                        onClick={() => {
                          if (resourcePath) {
                            // Clean up file:// prefix if pasted from browser
                            let finalPath = resourcePath.trim()
                            if (finalPath.startsWith('file:///')) {
                              finalPath = decodeURI(finalPath.replace('file:///', ''))
                              // On Windows, paths starting with file:/// results in /C:/... 
                              // we need to remove leading slash if it exists before C:
                              if (finalPath.match(/^\/[A-Za-z]:/)) {
                                finalPath = finalPath.substring(1)
                              }
                            } else if (finalPath.startsWith('file://')) {
                              finalPath = decodeURI(finalPath.replace('file://', ''))
                            }
                            // Replace forward slashes with backslashes for Windows if it's a path
                            if (resourceType !== 'link') {
                              finalPath = finalPath.replace(/\//g, '\\')
                            }

                            const name = resourceName || (resourceType === 'link' ? finalPath : finalPath.split(/[/\\]/).pop()) || 'New Resource'
                            const newAttachments = [...(project.attachments || []), { id: Date.now().toString(), name, path: finalPath, type: resourceType }]
                            onUpdate(project.id, { attachments: newAttachments })
                            setIsAddingResource(false)
                            setResourcePath('')
                            setResourceName('')
                          }
                        }}
                        style={{ ...editBtnStyle, background: resourcePath ? (project.color || 'var(--accent)') : 'rgba(255,255,255,0.05)', color: resourcePath ? 'white' : 'rgba(255,255,255,0.2)', cursor: resourcePath ? 'pointer' : 'not-allowed' }}
                      >
                        Add {resourceType === 'file' ? 'File' : 'Link'}
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {!project.attachments || project.attachments.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px dashed rgba(255,255,255,0.05)' }}>
                       <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.2)' }}>No attachments yet</span>
                    </div>
                  ) : (
                    project.attachments.map((att) => (
                      <div
                        key={att.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: 'rgba(255,255,255,0.03)',
                          borderRadius: '10px',
                          border: '1px solid rgba(255,255,255,0.04)',
                          transition: 'all 0.2s ease',
                          cursor: 'pointer'
                        }}
                        onClick={async (e) => {
                          if ((e.target as HTMLElement).closest('.delete-btn')) return
                          try {
                            if (att.type === 'file' || att.type === 'folder') {
                              // @ts-ignore
                              const error = await window.api.openPath(att.path)
                              if (error) {
                                console.error('Failed to open path:', error)
                                alert(`Could not open resource: ${error}`)
                              }
                            } else {
                              // @ts-ignore
                              await window.api.openExternal(att.path)
                            }
                          } catch (err) {
                            console.error('Attachment open error:', err)
                          }
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                          e.currentTarget.style.borderColor = (project.color || 'var(--accent)') + '44'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                          <div style={{ color: project.color || 'var(--text-secondary)', display: 'flex' }}>
                            {att.type === 'file' && <Paperclip size={14} />}
                            {att.type === 'folder' && <FolderIcon size={14} />}
                            {att.type === 'link' && <LinkIcon size={14} />}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {att.name}
                            </span>
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {att.path}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <ExternalLink size={12} style={{ opacity: 0.3 }} />
                          <button
                            className="delete-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (window.confirm('Remove attachment?')) {
                                const newAtts = project.attachments?.filter(a => a.id !== att.id)
                                onUpdate(project.id, { attachments: newAtts })
                              }
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'rgba(255,255,255,0.15)',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              transition: 'color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.15)'}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </main>
          </div>

          <div
            style={{
              padding: '0 24px 24px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0'
            }}
          >
            {/* --- SUBPROJECTS SECTION --- */}
            {project.subprojects && project.subprojects.length > 0 && (
              <section style={{ padding: '0 0 24px 0' }}>
                <hr style={{ ...mainDividerStyle, marginTop: '0', marginBottom: '24px' }} />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px'
                  }}
                >
                  <SectionLabel>Subprojects</SectionLabel>
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'var(--text-secondary)',
                      background: 'rgba(255,255,255,0.05)',
                      padding: '2px 6px',
                      borderRadius: '10px'
                    }}
                  >
                    {project.subprojects.length}
                  </span>
                </div>
                <div
                  style={{
                    ...subprojectsGridStyle,
                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                    gap: '16px'
                  }}
                >
                  {project.subprojects.map((sub) => (
                    <div
                      key={sub.id}
                      style={{
                        ...noteCardStyle,
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.style.borderColor = (sub.color || 'var(--accent)') + '44'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.background = '#171717'
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'
                      }}
                    >
                      <div
                        style={{
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              color: sub.color || 'var(--text-primary)',
                              display: 'flex'
                            }}
                          >
                            <ProjectIcon iconName={sub.icon} size={20} />
                          </div>
                          <span
                            style={{
                              ...subprojectTitleStyle,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {sub.name}
                          </span>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '4px 8px',
                              borderRadius: '6px',
                              background: (sub.color || 'var(--accent)') + '15',
                              color: sub.color || 'var(--accent)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em'
                            }}
                          >
                            {sub.status || 'Active'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* --- PROJECT NOTES SECTION --- */}
            <section style={{ padding: '0 0 24px 0' }}>
              <hr style={{ ...mainDividerStyle, marginTop: '0', marginBottom: '24px' }} />
              <div style={{ marginBottom: '8px' }}>
                <SectionLabel>Project Notes</SectionLabel>
              </div>
              {(() => {
                const projectNotes = notes.filter((n) => n.projectId === project.id && !n.isTrash)
                if (projectNotes.length === 0) {
                  return (
                    <div
                      style={{
                        padding: '16px',
                        textAlign: 'center',
                        background: 'transparent',
                        borderRadius: '10px',
                        border: 'none',
                        color: 'rgba(255, 255, 255, 0.25)',
                        fontSize: '13px'
                      }}
                    >
                      No notes associated with this project.
                    </div>
                  )
                }
                return (
                  <div
                    style={{
                      ...subprojectsGridStyle,
                      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))'
                    }}
                  >
                    {projectNotes.map((note) => (
                      <div
                        key={note.id}
                        style={{
                          ...noteCardStyle,
                          cursor: onNoteClick ? 'pointer' : 'default',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                        onClick={() => onNoteClick?.(note.id)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)'
                          e.currentTarget.style.borderColor =
                            (project.color || 'var(--accent)') + '44'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'
                        }}
                      >
                        <div
                          style={{
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{ color: project.color || 'var(--accent)', display: 'flex' }}
                            >
                              {note.type === 'board' ? (
                                <ImageIcon size={20} />
                              ) : (
                                <FileText size={20} />
                              )}
                            </div>
                            <span
                              style={{
                                ...subprojectTitleStyle,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
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
