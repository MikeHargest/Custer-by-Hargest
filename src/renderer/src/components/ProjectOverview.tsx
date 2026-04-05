import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Image as ImageIcon,
  X,
  Calendar,
  Flag,
  CheckCircle2,
  Clock,
  ListTodo,
  Edit2,
  Briefcase,
  Save,
  ChevronUp,
  ChevronDown,
  Star,
  FileText
} from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { Project, TaskItem, AppNote } from '../types'

interface ProjectOverviewProps {
  project: Project
  onUpdate: (id: string, updates: Partial<Project>) => void
  notes: AppNote[]
  onNoteClick?: (noteId: string) => void
}

const MONOCHROME_ICONS = [
  'Briefcase',
  'Folder',
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
}) => {
  const [hovered, setHovered] = useState<string | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
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
        borderRadius: '8px',
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
              borderRadius: '8px',
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
              const DynamicIcon = (LucideIcons as any)[name] || LucideIcons.Briefcase
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
  onUpdate,
  notes,
  onNoteClick
}: ProjectOverviewProps) {
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [descriptionValue, setDescriptionValue] = useState(project.description || '')
  const [showIconPicker, setShowIconPicker] = useState(false)

  useEffect(() => {
    setDescriptionValue(project.description || '')
  }, [project.description, project.id])

  // Memoized Task Calculations
  const stats = useMemo(() => {
    let total = 0
    let completed = 0
    const traverse = (p: Project) => {
      const processTasks = (taskItems: TaskItem[]) => {
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

  const progressPercent = useMemo(() => {
    if (project.progressMode === 'manual') return project.manualProgress || 0
    if (stats.total === 0) return 0
    return Math.round((stats.completed / stats.total) * 100)
  }, [project, stats])

  // Handlers
  const handleBannerChange = async () => {
    // @ts-ignore - Electron API
    const path = await window.api.selectImageFile()
    if (path) {
      const normalizedPath = path.replace(/\\/g, '/')
      const fileUrl = `file://${normalizedPath.startsWith('/') ? '' : '/'}${encodeURI(normalizedPath)}`
      onUpdate(project.id, { banner: fileUrl })
    }
  }

  const saveDescription = () => {
    onUpdate(project.id, { description: descriptionValue })
    setIsEditingDescription(false)
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
              height: project.bannerCollapsed ? '0px' : '180px',
              minHeight: project.bannerCollapsed ? '0px' : '180px',
              borderBottom: project.bannerCollapsed ? 'none' : '1px solid rgba(255,255,255,0.05)',
              background: project.banner
                ? `url("${project.banner}") center/cover no-repeat`
                : `linear-gradient(135deg, ${project.color || 'var(--accent)'}, var(--bg-surface))`
            }}
          >
            <div style={bannerOverlayStyle}>
              {project.banner && (
                <button
                  onClick={() => onUpdate(project.id, { banner: undefined })}
                  style={bannerBtnStyle}
                  title="Remove Banner"
                >
                  <X size={16} />
                </button>
              )}
              <button onClick={handleBannerChange} style={bannerBtnStyle} title="Change Banner">
                <ImageIcon size={16} />
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexShrink: 0, minHeight: 'min-content' }}>
            {/* --- SIDEBAR (METADATA) --- */}
            <aside style={{ ...sidebarStyle, flexShrink: 0 }}>
              <SectionLabel>Details</SectionLabel>

              <MetaField icon={<CheckCircle2 size={14} color={project.color} />} label="Status">
                <select
                  value={project.status || 'Active'}
                  onChange={(e) => onUpdate(project.id, { status: e.target.value })}
                  style={inputStyle}
                >
                  {['Planning', 'Active', 'On Hold', 'Completed'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </MetaField>

              <hr style={{ ...dividerStyle, marginLeft: '-24px', marginRight: '-24px' }} />

              <MetaField
                icon={
                  <Flag
                    size={14}
                    color={project.priority === 'Urgent' ? 'var(--danger)' : project.color}
                  />
                }
                label="Priority"
              >
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['Low', 'Medium', 'High', 'Urgent'].map((p) => (
                    <button
                      key={p}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      onClick={() => onUpdate(project.id, { priority: p as any })}
                      style={priorityBtnStyle(
                        project.priority === p,
                        p === 'Urgent' ? '#c0392b' : project.color || 'var(--accent)'
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </MetaField>

              <hr style={{ ...dividerStyle, marginLeft: '-24px', marginRight: '-24px' }} />

              <MetaField icon={<Calendar size={14} />} label="Start Date">
                <input
                  type="date"
                  value={project.startDate || ''}
                  onChange={(e) => onUpdate(project.id, { startDate: e.target.value })}
                  style={inputStyle}
                />
              </MetaField>

              <MetaField icon={<Calendar size={14} />} label="End Date">
                <input
                  type="date"
                  value={project.endDate || ''}
                  onChange={(e) => onUpdate(project.id, { endDate: e.target.value })}
                  style={inputStyle}
                />
              </MetaField>

              <hr style={{ ...dividerStyle, marginLeft: '-24px', marginRight: '-24px' }} />

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
                    style={toggleBtnStyle(project.progressMode !== 'manual')}
                  >
                    Tasks
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

              <hr style={{ ...dividerStyle, marginLeft: '-24px', marginRight: '-24px' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <StatLine icon={<ListTodo size={14} />} label="Total Tasks:" value={stats.total} />
                <StatLine
                  icon={<CheckCircle2 size={14} />}
                  label="Completed:"
                  value={stats.completed}
                />
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
                <div style={{ flex: 1 }}>
                  <h1 style={titleStyle}>{project.name}</h1>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                    Project Overview •{' '}
                    <span style={{ color: project.color }}>{project.status}</span>
                  </p>
                </div>

                {/* Relocated Banner Toggle */}
                <button
                  onClick={() =>
                    onUpdate(project.id, { bannerCollapsed: !project.bannerCollapsed })
                  }
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    outline: 'none',
                    alignSelf: 'flex-start',
                    marginTop: '4px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                    e.currentTarget.style.color = 'var(--text-primary)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                    e.currentTarget.style.color = 'var(--text-secondary)'
                  }}
                  title={project.bannerCollapsed ? 'Show Banner' : 'Hide Banner'}
                >
                  {project.bannerCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
              </header>

              <hr style={{ ...dividerStyle, marginLeft: '-16px', marginRight: '-16px' }} />

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
                  <div style={descriptionViewStyle}>
                    {project.description || 'No description provided yet.'}
                  </div>
                )}
              </section>

              {project.subprojects && project.subprojects.length > 0 && (
                <>
                  <hr style={{ ...dividerStyle, marginLeft: '-16px', marginRight: '-16px' }} />
                  <section>
                    <div style={{ marginBottom: '16px' }}>
                      <SectionLabel>Subprojects</SectionLabel>
                    </div>
                    <div style={subprojectsGridStyle}>
                      {project.subprojects.map((sub) => {
                        const subNotes = notes.filter((n) => n.projectId === sub.id)
                        return (
                          <div key={sub.id} style={subprojectCardStyle}>
                            <div style={subprojectHeaderStyle}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div
                                  style={{
                                    color: sub.color || 'var(--text-primary)',
                                    display: 'flex'
                                  }}
                                >
                                  <ProjectIcon iconName={sub.icon} size={18} />
                                </div>
                                <span style={subprojectTitleStyle}>{sub.name}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <div
                                  style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.05)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  <Star size={10} color="var(--text-secondary)" />
                                </div>
                              </div>
                            </div>

                            <div style={subprojectContentStyle}>
                              <p style={subprojectDescStyle}>
                                {sub.description
                                  ? sub.description.length > 60
                                    ? sub.description.substring(0, 60) + '...'
                                    : sub.description
                                  : 'No description'}
                              </p>

                              {subNotes.length > 0 && (
                                <div style={thumbnailsContainerStyle}>
                                  {subNotes.slice(0, 3).map((note) => (
                                    <div
                                      key={note.id}
                                      style={{
                                        ...thumbnailStyle,
                                        cursor: onNoteClick ? 'pointer' : 'default'
                                      }}
                                      title={note.title}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        onNoteClick?.(note.id)
                                      }}
                                    >
                                      {note.type === 'tldraw' ? (
                                        <ImageIcon size={10} style={{ marginRight: 4 }} />
                                      ) : (
                                        <FileText size={10} style={{ marginRight: 4 }} />
                                      )}
                                      <span
                                        style={{
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap'
                                        }}
                                      >
                                        {note.title || 'Untitled'}
                                      </span>
                                    </div>
                                  ))}
                                  {subNotes.length > 3 && (
                                    <div
                                      style={{
                                        ...thumbnailStyle,
                                        background: 'transparent',
                                        border: '1px dashed rgba(255,255,255,0.2)'
                                      }}
                                    >
                                      +{subNotes.length - 3}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            <div style={subprojectFooterStyle}>
                              <span
                                style={{
                                  ...subprojectTagStyle,
                                  background: (sub.color || 'var(--accent)') + '22',
                                  color: sub.color || 'var(--accent)'
                                }}
                              >
                                {sub.status || 'Active'}
                              </span>
                              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                {subNotes.length} note{subNotes.length !== 1 && 's'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                </>
              )}
            </main>
          </div>

          {/* --- NOTES SECTION (FULL WIDTH) --- */}
          {(() => {
            const projectNotes = notes.filter((n) => n.projectId === project.id && !n.isTrash)

            return (
              <section style={{ padding: '0 16px 16px 16px' }}>
                <hr
                  style={{
                    ...dividerStyle,
                    marginLeft: '-16px',
                    marginRight: '-16px',
                    marginBottom: '24px'
                  }}
                />
                <div style={{ marginBottom: '16px' }}>
                  <SectionLabel>Project Notes</SectionLabel>
                </div>
                {projectNotes.length === 0 ? (
                  <div
                    style={{
                      padding: '16px',
                      textAlign: 'center',
                      background: 'rgba(255,255,255,0.02)',
                      borderRadius: '12px',
                      border: '1px dashed rgba(255,255,255,0.1)',
                      color: 'var(--text-secondary)',
                      fontSize: '13px'
                    }}
                  >
                    No notes associated with this project.
                  </div>
                ) : (
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
                          ...subprojectCardStyle,
                          cursor: onNoteClick ? 'pointer' : 'default',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                        onClick={() => onNoteClick?.(note.id)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)'
                          e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.3)'
                          e.currentTarget.style.borderColor =
                            (project.color || 'var(--accent)') + '44'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = 'none'
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'
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
                              {note.type === 'tldraw' ? (
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
                )}
              </section>
            )
          })()}
        </div>
      </div>
    </div>
  )
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

const MetaField = ({ icon, label, children, flex }: any) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: flex ? 1 : 'none' }}>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        color: 'var(--text-secondary)',
        fontSize: '12px'
      }}
    >
      {icon} {label}
    </div>
    {children}
  </div>
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StatLine = ({ icon, label, value }: any): React.ReactElement => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      fontSize: '13px',
      color: 'var(--text-secondary)'
    }}
  >
    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {icon} {label}
    </span>
    <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--text-primary)' }}>
      {value}
    </span>
  </div>
)

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
  const Icon = (LucideIcons as any)[iconName || 'Briefcase'] || Briefcase
  return <Icon size={size} />
}

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
  height: '180px',
  flexShrink: 0,
  position: 'relative',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  overflow: 'hidden'
}
const bannerOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: '12px',
  right: '12px',
  display: 'flex',
  gap: '8px'
}
const bannerBtnStyle: React.CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: '6px',
  background: 'rgba(0,0,0,0.4)',
  backdropFilter: 'blur(4px)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'white',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}
const sidebarStyle: React.CSSProperties = {
  width: '280px',
  padding: '24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
  borderRight: '1px solid rgba(255,255,255,0.06)',
  background: 'rgba(255,255,255,0.01)'
}
const mainContentStyle: React.CSSProperties = {
  flex: 1,
  padding: '16px',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '24px'
}
const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '4px',
  padding: '8px',
  color: 'var(--text-primary)',
  fontSize: '12px',
  width: '100%'
}
const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '36px',
  fontWeight: 800,
  color: 'var(--text-primary)',
  letterSpacing: '-0.02em'
}
const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '200px',
  background: 'rgba(0,0,0,0.2)',
  borderRadius: '8px',
  padding: '16px',
  color: 'var(--text-primary)',
  border: '1px solid'
}
const dividerStyle: React.CSSProperties = {
  border: 'none',
  borderTop: '1px solid rgba(255,255,255,0.06)',
  margin: 0
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
  borderRadius: '12px',
  background: 'rgba(255,255,255,0.04)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  position: 'relative',
  border: '1px solid rgba(255,255,255,0.08)'
}
const editBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '6px',
  padding: '6px 12px',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '12px'
}
const descriptionViewStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: '14px',
  lineHeight: 1.7,
  whiteSpace: 'pre-wrap'
}
const priorityBtnStyle = (active: boolean, color: string): React.CSSProperties => ({
  padding: '4px 10px',
  fontSize: '11px',
  borderRadius: '4px',
  cursor: 'pointer',
  border: active ? `1px solid ${color}` : '1px solid rgba(255,255,255,0.08)',
  background: active ? color + '22' : 'transparent',
  color: active ? color : 'var(--text-secondary)',
  fontWeight: active ? 700 : 400
})
const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '6px 0',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  border: active ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.08)',
  borderRadius: '4px',
  background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
  color: active ? 'var(--text-primary)' : 'var(--text-secondary)'
})

const subprojectsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: '16px'
}
const subprojectCardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '12px',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  transition: 'transform 0.2s, background 0.2s',
  cursor: 'pointer'
}
const subprojectHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: '1px solid rgba(255,255,255,0.04)'
}
const subprojectTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  color: 'var(--text-primary)'
}
const subprojectContentStyle: React.CSSProperties = {
  padding: '12px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  flex: 1
}
const subprojectDescStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--text-secondary)',
  margin: 0,
  lineHeight: 1.4
}
const thumbnailsContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px'
}
const thumbnailStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  fontSize: '10px',
  padding: '4px 8px',
  background: 'rgba(255,255,255,0.05)',
  borderRadius: '6px',
  color: 'var(--text-secondary)',
  maxWidth: '120px'
}
const subprojectFooterStyle: React.CSSProperties = {
  padding: '10px 16px',
  background: 'rgba(0,0,0,0.1)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
}
const subprojectTagStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  padding: '2px 6px',
  borderRadius: '4px'
}
