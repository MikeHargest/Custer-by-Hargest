import { useState, useCallback } from 'react'
import { X, RotateCcw, Save, Settings, Compass, Hand, Layout } from 'lucide-react'
import { UITheme } from '../types'
import { motion, AnimatePresence } from 'framer-motion'
import { DEFAULT_THEME } from '../App'
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
  setShowTaskCounts
}: SettingsModalProps): React.ReactElement | null {
  const [activePicker, setActivePicker] = useState<keyof UITheme | null>(null)
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null)
  const [activeTab, setActiveTab] = useState<'general' | 'canvas' | 'projects' | 'shortcuts'>(
    'general'
  )

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

  if (!isOpen) return null

  return (
    <div
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
        backdropFilter: 'blur(4px)'
      }}
    >
      <div
        style={{
          background: 'var(--card-bg)',
          width: '750px',
          height: '550px',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
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
              App Settings
            </div>

            {[
              { id: 'general', label: 'General', icon: <Settings size={16} /> },
              { id: 'projects', label: 'Projects', icon: <Layout size={16} /> },
              { id: 'canvas', label: 'Canvas', icon: <Compass size={16} /> },
              { id: 'shortcuts', label: 'Shortcuts', icon: <Hand size={16} /> }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
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
              {activeTab === 'general' && (
                <motion.div
                  key="general"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 600 }}>
                    General Settings
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
                                    : key === 'timelineTaskBg'
                                      ? 'Timeline'
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
                          borderRadius: '8px',
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
