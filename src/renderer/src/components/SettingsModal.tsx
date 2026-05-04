import { useState, useCallback, useEffect } from 'react'
import { X, RotateCcw, Save, Settings, Compass, Hand, Layout, Timer, FileText, CalendarDays, Palette, Info, User, HardDrive, LayoutGrid, FolderOpen, FolderPlus, ImagePlus, Trash2 } from 'lucide-react'
import { UITheme, DEFAULT_THEME } from '../types'
import { motion, AnimatePresence } from 'framer-motion'
import ColorPicker from './ColorPicker'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  theme: UITheme
  setTheme: React.Dispatch<React.SetStateAction<UITheme>>
  onSaveThemeAsDefault?: () => void
  showFPS: boolean
  setShowFPS: (show: boolean) => void
  useGPU: boolean
  setUseGPU: (use: boolean) => void
  showTaskCounts: boolean
  setShowTaskCounts: (show: boolean) => void
  showColoredDots: boolean
  setShowColoredDots: (show: boolean) => void
  timerVolume: number
  setTimerVolume: (volume: number) => void
  backupIntervalMinutes: number
  setBackupIntervalMinutes: (val: number) => void
  boardBackupIntervalMinutes: number
  setBoardBackupIntervalMinutes: (val: number) => void
  calendarTimezone: string
  setCalendarTimezone: (tz: string) => void
  // Profile props
  workspacePath: string | null
  projectCount: number
  onWorkspaceSelected: (path: string) => void
  avatarUrl: string | null
  onAvatarChange: (avatarPath: string | null) => Promise<void>
  initialTab?: 'profile' | 'general' | 'canvas' | 'projects' | 'shortcuts' | 'timers' | 'notes' | 'calendar' | 'about'
}

export default function SettingsModal({
  isOpen,
  onClose,
  theme,
  setTheme,
  onSaveThemeAsDefault,
  showFPS,
  setShowFPS,
  useGPU,
  setUseGPU,
  showTaskCounts,
  setShowTaskCounts,
  showColoredDots,
  setShowColoredDots,
  timerVolume,
  setTimerVolume,
  backupIntervalMinutes,
  setBackupIntervalMinutes,
  boardBackupIntervalMinutes,
  setBoardBackupIntervalMinutes,
  calendarTimezone,
  setCalendarTimezone,
  workspacePath,
  projectCount,
  onWorkspaceSelected,
  avatarUrl,
  onAvatarChange,
  initialTab = 'profile'
}: SettingsModalProps): React.ReactElement | null {
  const [activePicker, setActivePicker] = useState<keyof UITheme | null>(null)
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null)
  const [activeTab, setActiveTab] = useState<'profile' | 'general' | 'canvas' | 'projects' | 'shortcuts' | 'timers' | 'notes' | 'calendar' | 'about'>(initialTab)

  const handleUpdate = useCallback(
    (key: keyof UITheme, value: string): void => {
      setTheme((prev) => ({ ...prev, [key]: value }))
    },
    [setTheme]
  )

  const handleReset = useCallback((): void => {
    setTheme(DEFAULT_THEME)
  }, [setTheme])

  const handleOpenPicker = (key: keyof UITheme, rect: DOMRect): void => {
    setActivePicker(key)
    setPickerAnchor(rect)
  }


  // Profile helpers
  const [folderSize, setFolderSize] = useState<string>('Calculating...')
  const [isLoadingWs, setIsLoadingWs] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('Cluster')

  useEffect(() => {
    if (isOpen) setActiveTab(initialTab)
  }, [isOpen])

  useEffect(() => {
    if (isOpen && activeTab === 'profile' && workspacePath) {
      ;(window as any).api.getFolderSize(workspacePath)
        .then((bytes: number) => {
          if (bytes === 0) { setFolderSize('0 Bytes'); return }
          const k = 1024, sizes = ['Bytes','KB','MB','GB','TB']
          const i = Math.floor(Math.log(bytes) / Math.log(k))
          setFolderSize(parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i])
        })
        .catch(() => setFolderSize('Error'))
    }
  }, [isOpen, activeTab, workspacePath])

  const toFileUrl = (path: string): string => {
    const normalized = path.replace(/\\/g, '/')
    return `file://${normalized.startsWith('/') ? '' : '/'}${encodeURI(normalized)}`
  }

  const handleSelectAvatar = async (): Promise<void> => {
    try {
      const selectedPath = await (window as any).api.selectImageFile()
      if (!selectedPath) return
      await onAvatarChange(toFileUrl(selectedPath))
    } catch (e) { console.error(e) }
  }

  const handleOpenExistingWs = async (): Promise<void> => {
    setIsLoadingWs(true)
    try {
      const path = await (window as any).api.selectWorkspace()
      if (path) {
        await (window as any).api.setStoreValue('workspace-path', path)
        onWorkspaceSelected(path)
        onClose()
      }
    } finally { setIsLoadingWs(false) }
  }

  const handleCreateNewWs = async (): Promise<void> => {
    setIsLoadingWs(true)
    try {
      const parentPath = await (window as any).api.selectWorkspace()
      if (parentPath) {
        const name = newWorkspaceName.trim() || 'Cluster'
        const newPath = await (window as any).api.createWorkspace(parentPath, name)
        if (newPath) {
          await (window as any).api.setStoreValue('workspace-path', newPath)
          onWorkspaceSelected(newPath)
          onClose()
        }
      }
    } finally { setIsLoadingWs(false) }
  }

  const handleOpenWorkspaceFolder = async (): Promise<void> => {
    if (!workspacePath) return
    try { await (window as any).api.openPath(workspacePath) } catch(e) { console.error(e) }
  }

  if (!isOpen) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)',
        cursor: 'pointer'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--card-bg)',
          width: '890px',
          height: '590px',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'default'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Settings size={18} style={{ color: 'var(--text-secondary)' }} />
            <h2
              style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}
            >
              Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Layout Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Sidebar */}
          <div
            style={{
              width: '200px',
              background: 'rgba(0,0,0,0.15)',
              borderRight: '1px solid rgba(255,255,255,0.05)',
              padding: '20px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div
              style={{
                padding: '0 12px 10px 12px',
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              Workspace
            </div>

            {[
              { id: 'profile', label: 'Profile', icon: <User size={16} /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  textAlign: 'left',
                  background: activeTab === tab.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s',
                  fontWeight: activeTab === tab.id ? 500 : 400
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}

            <div
              style={{
                padding: '12px 12px 6px 12px',
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              App Settings
            </div>

            {[
              { id: 'general', label: 'Theme', icon: <Palette size={16} /> },
              { id: 'projects', label: 'Projects', icon: <Layout size={16} /> },
              { id: 'notes', label: 'Notes', icon: <FileText size={16} /> },
              { id: 'calendar', label: 'Calendar', icon: <CalendarDays size={16} /> },
              { id: 'timers', label: 'Timers', icon: <Timer size={16} /> },
              { id: 'canvas', label: 'Canvas', icon: <Compass size={16} /> },
              { id: 'shortcuts', label: 'Shortcuts', icon: <Hand size={16} /> },
              { id: 'about', label: 'About', icon: <Info size={16} /> }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  textAlign: 'left',
                  background: activeTab === tab.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s',
                  fontWeight: activeTab === tab.id ? 500 : 400
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
            <AnimatePresence mode="wait">
              {activeTab === 'profile' && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                >
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 600 }}>Profile</h3>
                    <p style={{ margin: '0 0 20px 0', color: 'var(--text-secondary)', fontSize: '13px' }}>Manage your workspace and identity.</p>
                  </div>

                  {/* Avatar + Name */}
                  <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button onClick={handleSelectAvatar} title="Choose avatar" style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', border: avatarUrl ? '2px solid rgba(255,255,255,0.2)' : 'none', padding: 0, overflow: 'hidden', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'filter 0.2s' }} onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.15)')} onMouseLeave={e => (e.currentTarget.style.filter = 'brightness(1)')}>
                      {avatarUrl ? (<img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />) : (<User size={26} />)}
                      <span style={{ position: 'absolute', right: '2px', bottom: '2px', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ImagePlus size={10} /></span>
                    </button>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '18px', fontWeight: 600 }}>{workspacePath ? workspacePath.split(/[\\/]/).pop() : 'No Workspace'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', wordBreak: 'break-all' }}>{workspacePath}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                        {avatarUrl && (<button onClick={() => onAvatarChange(null)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', color: 'var(--text-primary)', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}><Trash2 size={12} /> Remove</button>)}
                        {workspacePath && (<button onClick={handleOpenWorkspaceFolder} title="Open workspace folder" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px', background: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}><FolderOpen size={16} /></button>)}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}><HardDrive size={14} /> Workspace Size</div>
                      <div style={{ fontSize: '16px', fontWeight: 600 }}>{folderSize}</div>
                    </div>
                    <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}><LayoutGrid size={14} /> Total Projects</div>
                      <div style={{ fontSize: '16px', fontWeight: 600 }}>{projectCount}</div>
                    </div>
                  </div>

                  {/* Switch workspace */}
                  <div style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', color: 'var(--text-primary)' }}><FolderOpen size={16} /><span style={{ fontSize: '14px', fontWeight: 600 }}>Switch Workspace</span></div>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', opacity: 0.6, margin: 0 }}>Load data from another existing directory.</p>
                    </div>
                    <button onClick={handleOpenExistingWs} disabled={isLoadingWs} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}>Select Folder</button>
                  </div>

                  {/* Create new workspace */}
                  <div style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}><FolderPlus size={16} /><span style={{ fontSize: '14px', fontWeight: 600 }}>Create New Workspace</span></div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="text" placeholder="Workspace name..." value={newWorkspaceName} onChange={e => setNewWorkspaceName(e.target.value)} disabled={isLoadingWs} style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', transition: 'border-color 0.2s' }} onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')} onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')} />
                      <button onClick={handleCreateNewWs} disabled={isLoadingWs || !newWorkspaceName.trim()} style={{ padding: '0 20px', borderRadius: '8px', background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px', transition: 'filter 0.2s' }} onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.1)')} onMouseLeave={e => (e.currentTarget.style.filter = 'brightness(1)')}>Create</button>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'general' && (
                <motion.div
                  key="general"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 600 }}>
                    Theme Settings
                  </h3>
                  <p
                    style={{
                      margin: '0 0 24px 0',
                      color: 'var(--text-secondary)',
                      fontSize: '13px'
                    }}
                  >
                    Configure visual themes and core preferences.
                  </p>

                   <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '16px'
                    }}
                  >
                    <h4
                      style={{
                        margin: 0,
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                        fontWeight: 500
                      }}
                    >
                      Theme Colors
                    </h4>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={onSaveThemeAsDefault}
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: 'var(--text-primary)',
                          fontSize: '11px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Save size={12} /> Save Default
                      </button>
                      <button
                        onClick={handleReset}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          fontSize: '11px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <RotateCcw size={12} /> Reset
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {(Object.keys(DEFAULT_THEME) as Array<keyof UITheme>)
                      .filter((key) => key !== 'boardAccent' && key !== 'boardBg')
                      .map((key) => (
                        <ColorPickerItem
                          key={key}
                          label={
                            key === 'bgColor'
                              ? 'Background'
                              : key === 'cardBg'
                                ? 'Cards'
                                : key === 'accent'
                                  ? 'Accent'
                                  : key === 'textPrimary'
                                    ? 'Text'
                                    : key === 'calendarTaskBg'
                                      ? 'Calendar Tasks'
                                    : key === 'calendarEventBg'
                                      ? 'Calendar Events'
                                      : key === 'timerBg'
                                        ? 'Timers'
                                        : key
                          }
                          value={(theme[key] || DEFAULT_THEME[key] || '') as string}
                          onOpenPicker={(rect) => handleOpenPicker(key, rect)}
                        />
                      ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'timers' && (
                <motion.div
                  key="timers"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 600 }}>
                    Timer Settings
                  </h3>
                  <p
                    style={{
                      margin: '0 0 24px 0',
                      color: 'var(--text-secondary)',
                      fontSize: '13px'
                    }}
                  >
                    Adjust volume and other timer behavior.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        padding: '16px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '10px'
                      }}
                    >
                      <div
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <div style={{ fontSize: '14px', fontWeight: 500 }}>Global Volume</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {Math.round(timerVolume * 100)}%
                        </div>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={timerVolume}
                        onChange={(e) => setTimerVolume(parseFloat(e.target.value))}
                        style={{
                          width: '100%',
                          accentColor: 'var(--accent)',
                          cursor: 'pointer'
                        }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'canvas' && (
                <motion.div
                  key="canvas"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 600 }}>
                    Canvas Settings
                  </h3>
                  <p
                    style={{
                      margin: '0 0 24px 0',
                      color: 'var(--text-secondary)',
                      fontSize: '13px'
                    }}
                  >
                    Workspace behavior and drawing aids.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                      <h4
                        style={{
                          margin: '0 0 12px 0',
                          fontSize: '14px',
                          color: 'var(--text-secondary)',
                          fontWeight: 500
                        }}
                      >
                        Visual Style
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <ColorPickerItem
                          label="Selection Color"
                          value={(theme.boardAccent || DEFAULT_THEME.boardAccent || '') as string}
                          onOpenPicker={(rect) => handleOpenPicker('boardAccent', rect)}
                        />
                        <ColorPickerItem
                          label="Canvas Background"
                          value={(theme.boardBg || DEFAULT_THEME.boardBg || '') as string}
                          onOpenPicker={(rect) => handleOpenPicker('boardBg', rect)}
                        />
                      </div>
                    </div>

                    <div style={{ padding: '1px 0', background: 'rgba(255,255,255,0.05)' }} />

                    <div style={{
                      background: 'rgba(255,255,255,0.02)',
                      padding: '16px',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Board Backups
                      </h4>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 500 }}>Board Auto-Backup Interval</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Create backup snapshots of the active board at a fixed interval.</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="number"
                            min="1"
                            max="60"
                            value={boardBackupIntervalMinutes}
                            onChange={(e) => setBoardBackupIntervalMinutes(Math.max(1, parseInt(e.target.value) || 10))}
                            style={{
                              width: '50px',
                              background: 'rgba(0,0,0,0.2)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              color: 'var(--text-primary)',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              fontSize: '13px'
                            }}
                          />
                          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>min</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4
                        style={{
                          margin: '0 0 12px 0',
                          fontSize: '14px',
                          color: 'var(--text-secondary)',
                          fontWeight: 500
                        }}
                      >
                        Advanced
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* GPU Toggle */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: '10px',
                            cursor: 'pointer'
                          }}
                          onClick={() => setUseGPU(!useGPU)}
                        >
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 500 }}>
                              GPU Acceleration
                            </div>
                            <div
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-secondary)',
                                marginTop: '2px'
                              }}
                            >
                              High-performance rendering layers.
                            </div>
                          </div>
                          <button
                            style={{
                              width: '36px',
                              height: '20px',
                              borderRadius: '10px',
                              background: useGPU ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                              border: 'none',
                              position: 'relative',
                              transition: 'all 0.2s'
                            }}
                          >
                            <motion.div
                              animate={{ x: useGPU ? 16 : 2 }}
                              style={{
                                width: '14px',
                                height: '14px',
                                background: '#fff',
                                borderRadius: '50%',
                                position: 'absolute',
                                top: '3px'
                              }}
                            />
                          </button>
                        </div>

                        {/* FPS Toggle */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: '10px',
                            cursor: 'pointer'
                          }}
                          onClick={() => setShowFPS(!showFPS)}
                        >
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 500 }}>
                              Show FPS Indicator
                            </div>
                            <div
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-secondary)',
                                marginTop: '2px'
                              }}
                            >
                              Monitor frame rates on canvas.
                            </div>
                          </div>
                          <button
                            style={{
                              width: '36px',
                              height: '20px',
                              borderRadius: '10px',
                              background: showFPS ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                              border: 'none',
                              position: 'relative',
                              transition: 'all 0.2s'
                            }}
                          >
                            <motion.div
                              animate={{ x: showFPS ? 16 : 2 }}
                              style={{
                                width: '14px',
                                height: '14px',
                                background: '#fff',
                                borderRadius: '50%',
                                position: 'absolute',
                                top: '3px'
                              }}
                            />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '10px'
                      }}
                    >
                      <span style={{ fontSize: '14px' }}>Snap to grid</span>
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--accent)',
                          background: 'rgba(var(--accent-rgb), 0.1)',
                          padding: '2px 8px',
                          borderRadius: '10px'
                        }}
                      >
                        Soon
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'projects' && (
                <motion.div
                  key="projects"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 600 }}>
                    Project Settings
                  </h3>
                  <p
                    style={{
                      margin: '0 0 24px 0',
                      color: 'var(--text-secondary)',
                      fontSize: '13px'
                    }}
                  >
                    Manage project display and general behavior.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '10px',
                        cursor: 'pointer'
                      }}
                      onClick={() => setShowTaskCounts(!showTaskCounts)}
                    >
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 500 }}>Show Task Count</div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-secondary)',
                            marginTop: '2px'
                          }}
                        >
                          Display total tasks and subtasks for each project.
                        </div>
                      </div>
                      <button
                        style={{
                          width: '36px',
                          height: '20px',
                          borderRadius: '10px',
                          background: showTaskCounts ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                          border: 'none',
                          position: 'relative',
                          transition: 'all 0.2s'
                        }}
                      >
                        <motion.div
                          animate={{ x: showTaskCounts ? 16 : 2 }}
                          style={{
                            width: '14px',
                            height: '14px',
                            background: '#fff',
                            borderRadius: '50%',
                            position: 'absolute',
                            top: '3px'
                          }}
                        />
                      </button>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '10px',
                        cursor: 'pointer'
                      }}
                      onClick={() => setShowColoredDots(!showColoredDots)}
                    >
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 500 }}>Colored Dots for Projects</div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-secondary)',
                            marginTop: '2px'
                          }}
                        >
                          Replace project icons with colored dots in the sidebar.
                        </div>
                      </div>
                      <button
                        style={{
                          width: '36px',
                          height: '20px',
                          borderRadius: '10px',
                          background: showColoredDots ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                          border: 'none',
                          position: 'relative',
                          transition: 'all 0.2s'
                        }}
                      >
                        <motion.div
                          animate={{ x: showColoredDots ? 16 : 2 }}
                          style={{
                            width: '14px',
                            height: '14px',
                            background: '#fff',
                            borderRadius: '50%',
                            position: 'absolute',
                            top: '3px'
                          }}
                        />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'shortcuts' && (
                <motion.div
                  key="keys"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 600 }}>
                    Shortcuts
                  </h3>
                  <p
                    style={{
                      margin: '0 0 24px 0',
                      color: 'var(--text-secondary)',
                      fontSize: '13px'
                    }}
                  >
                    Master the workflow with keys.
                  </p>

                  <div style={{ display: 'grid', gap: '8px' }}>
                    {[
                      { key: 'Space + Drag', action: 'Pan Canvas' },
                      { key: 'Ctrl + Scroll', action: 'Zoom Canvas' },
                      { key: 'Ctrl + Z', action: 'Undo' },
                      { key: 'Ctrl + Shift+Z', action: 'Redo' },
                      { key: 'V / H / D / T', action: 'Tools Selection' }
                    ].map((s, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: 'rgba(255,255,255,0.02)',
                          borderRadius: '10px',
                          border: '1px solid rgba(255,255,255,0.03)'
                        }}
                      >
                        <span style={{ fontSize: '13px' }}>{s.action}</span>
                        <code
                          style={{
                            fontSize: '11px',
                            background: 'rgba(0,0,0,0.3)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: '1px solid rgba(255,255,255,0.1)'
                          }}
                        >
                          {s.key}
                        </code>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
               {activeTab === 'notes' && (
                <motion.div
                  key="notes"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 600 }}>
                    Notes Settings
                  </h3>
                  <p
                    style={{
                      margin: '0 0 24px 0',
                      color: 'var(--text-secondary)',
                      fontSize: '13px'
                    }}
                  >
                    Configure note-taking behavior and data safety.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ 
                      background: 'rgba(255,255,255,0.02)', 
                      padding: '16px', 
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Data Protection & Backups
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 500 }}>Auto-Backup Interval</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Automatically save snapshots of active notes to avoid data loss.</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input 
                              type="number"
                              min="1"
                              max="60"
                              value={backupIntervalMinutes}
                              onChange={(e) => setBackupIntervalMinutes(Math.max(1, parseInt(e.target.value) || 10))}
                              style={{
                                width: '50px',
                                background: 'rgba(0,0,0,0.2)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: 'var(--text-primary)',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '13px'
                              }}
                            />
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>min</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'calendar' && (
                <motion.div
                  key="calendar"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 600 }}>
                    Calendar Settings
                  </h3>
                  <p
                    style={{
                      margin: '0 0 24px 0',
                      color: 'var(--text-secondary)',
                      fontSize: '13px'
                    }}
                  >
                    Configure how events are displayed and parsed.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{
                      background: 'rgba(255,255,255,0.02)',
                      padding: '16px',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Time Zone
                      </h4>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                        Used for displaying event dates correctly. If events appear on wrong days, set this to your local timezone.
                      </div>
                      <select
                        value={calendarTimezone}
                        onChange={(e) => setCalendarTimezone(e.target.value)}
                        style={{
                          width: '100%',
                          background: 'rgba(0,0,0,0.2)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: 'var(--text-primary)',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          fontSize: '13px',
                          cursor: 'pointer',
                          outline: 'none',
                          appearance: 'none',
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 12px center',
                          paddingRight: '32px'
                        }}
                      >
                        {Intl.supportedValuesOf('timeZone').map((tz) => (
                          <option key={tz} value={tz} style={{ background: '#1a1a2e' }}>{tz}</option>
                        ))}
                      </select>
                      <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Current offset: {new Date().toLocaleTimeString('en', { timeZoneName: 'short', timeZone: calendarTimezone }).split(' ').pop()}
                      </div>
                    </div>

                    {/* Google Calendar Sync */}
                    <div style={{
                      background: 'rgba(255,255,255,0.02)',
                      padding: '16px',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Google Calendar
                          </h4>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Bidirectional sync for tasks &amp; events</div>
                        </div>
                        <button
                          onClick={async () => {
                            // @ts-ignore
                            await window.api.googleAuth();
                            alert('Check your browser to complete Google Auth!');
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 500,
                            transition: 'all 0.2s'
                          }}
                        >
                          Connect Account
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'about' && (
                <motion.div
                  key="about"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 600 }}>
                    About Cluster
                  </h3>
                  <p
                    style={{
                      margin: '0 0 24px 0',
                      color: 'var(--text-secondary)',
                      fontSize: '13px'
                    }}
                  >
                    Version information
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{
                      background: 'rgba(255,255,255,0.02)',
                      padding: '16px',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        App Version
                      </h4>
                      <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent)' }}>
                        BETA {(window as any).api?.appVersion ?? '0.3.35'}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            background: 'rgba(0,0,0,0.2)',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            justifyContent: 'flex-end'
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '6px 20px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px'
            }}
          >
            Done
          </button>
        </div>
      </div>

      {activePicker && (
        <ColorPicker
          color={(theme[activePicker] || DEFAULT_THEME[activePicker] || '#000000') as string}
          onChange={(c) => handleUpdate(activePicker, c)}
          onClose={() => {
            setActivePicker(null)
            setPickerAnchor(null)
          }}
          anchorRect={pickerAnchor}
        />
      )}
    </div>
  )
}

function ColorPickerItem({
  label,
  value,
  onOpenPicker
}: {
  label: string
  value: string
  onOpenPicker: (rect: DOMRect) => void
}): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={(e) => onOpenPicker(e.currentTarget.getBoundingClientRect())}
          style={{
            width: '32px',
            height: '32px',
            padding: 0,
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            background: value,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            flexShrink: 0
          }}
        />
        <div
          style={{
            flex: 1,
            background: 'rgba(0,0,0,0.2)',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '6px 10px',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            fontSize: '12px',
            fontFamily: 'monospace',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          {value.toUpperCase()}
        </div>
      </div>
    </div>
  )
}
