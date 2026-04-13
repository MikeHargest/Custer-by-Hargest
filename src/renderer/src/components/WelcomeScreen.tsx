import { useState } from 'react'
import { FolderOpen, FolderPlus, Briefcase, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface WelcomeScreenProps {
  onWorkspaceSelected: (path: string) => void
  onCancel?: () => void
  isOverlay?: boolean
}

function WelcomeScreen({
  onWorkspaceSelected,
  onCancel,
  isOverlay = false
}: WelcomeScreenProps): React.ReactElement {
  const [isLoading, setIsLoading] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('Cluster')

  const handleOpenExisting = async (): Promise<void> => {
    setIsLoading(true)
    try {
      // @ts-ignore - preload api
      const path = await window.api.selectWorkspace()
      if (path) {
        // @ts-ignore - preload api
        await window.api.setStoreValue('workspace-path', path)
        onWorkspaceSelected(path)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateNew = async (): Promise<void> => {
    setIsLoading(true)
    try {
      // @ts-ignore - preload api
      const parentPath = await window.api.selectWorkspace()
      if (parentPath) {
        const name = workspaceName.trim() || 'Cluster'
        // @ts-ignore - preload api
        const workspacePath = await window.api.createWorkspace(parentPath, name)
        if (workspacePath) {
          // @ts-ignore - preload api
          await window.api.setStoreValue('workspace-path', workspacePath)
          onWorkspaceSelected(workspacePath)
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="welcome-screen-root"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={isOverlay && onCancel ? onCancel : undefined}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: isOverlay
            ? 'rgba(0, 0, 0, 0.6)'
            : 'radial-gradient(circle at center, #1a1a1a 0%, #0d0d0d 100%)',
          backdropFilter: isOverlay ? 'blur(4px)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9998,
          overflow: 'hidden',
          cursor: isOverlay && onCancel ? 'pointer' : 'default'
        }}
      >
        {/* Main Card - Styled like WorkspaceProfile/SettingsModal (Flat, No Shadow) */}
        <motion.div
          onClick={(e) => isOverlay && e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            background: 'var(--card-bg)',
            width: '100%',
            maxWidth: '550px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid rgba(255,255,255,0.08)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'none',
            cursor: 'default'
          }}
        >
          {/* Header (Same as WorkspaceProfile/Settings Header Design) */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255,255,255,0.02)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Briefcase size={18} style={{ color: 'var(--text-secondary)' }} />
              <h2
                style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'var(--text-primary)'
                }}
              >
                Workspace Selection
              </h2>
            </div>
            {onCancel && (
              <button
                onClick={onCancel}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  padding: 4,
                  borderRadius: '50%'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text-primary)'
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary)'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Body (Same Padding/Containers as WorkspaceProfile) */}
          <div style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Open Section */}
            <div
              style={{
                padding: '24px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.04)',
                textAlign: 'center'
              }}
            >
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  marginBottom: '8px'
                }}
              >
                Cluster
              </div>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  marginBottom: '24px',
                  opacity: 0.8
                }}
              >
                Choose a workspace folder to store your project data.
              </p>

              <button
                onClick={handleOpenExisting}
                disabled={isLoading}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px 20px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-primary)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                  justifyContent: 'center',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                }}
              >
                <FolderOpen size={18} />
                Open Existing Folder
              </button>
            </div>

            {/* Create Section */}
            <div
              style={{
                padding: '24px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.04)'
              }}
            >
              <div style={{ marginBottom: '20px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: '8px',
                    fontWeight: 700,
                    opacity: 0.8
                  }}
                >
                  Workspace Name
                </label>
                <input
                  type="text"
                  placeholder="Enter workspace name..."
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
              </div>
              <button
                onClick={handleCreateNew}
                disabled={isLoading || !workspaceName.trim()}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: '14px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.filter = 'brightness(1)')}
              >
                <FolderPlus size={18} />
                Create New Workspace
              </button>
            </div>
          </div>

          {/* Footer (Same as WorkspaceProfile Footer Design) */}
          <div
            style={{
              padding: '12px 20px',
              background: 'rgba(0,0,0,0.1)',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              justifyContent: 'flex-end'
            }}
          >
            <p
              style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                opacity: 0.5,
                margin: 0,
                alignSelf: 'center',
                marginRight: 'auto'
              }}
            >
              All data is stored locally in your chosen folder.
            </p>
            {onCancel && (
              <button
                onClick={onCancel}
                style={{
                  padding: '6px 20px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-primary)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              >
                Close
              </button>
            )}
          </div>
        </motion.div>

        {/* Window Controls (Top-right of whole screen) - Only for Intro Mode */}
        {!isOverlay && (
          <div
            className="welcome-window-controls"
            style={
              {
                position: 'absolute',
                top: '22px',
                right: '25px',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                zIndex: 10000,
                WebkitAppRegion: 'no-drag'
              } as any
            }
          >
            <button
              onClick={() => (window as any).api.minimizeWindow()}
              style={{
                width: '12px',
                height: '12px',
                background: '#febc2e',
                border: 'none',
                borderRadius: '50%',
                cursor: 'pointer',
                padding: 0
              }}
            />
            <button
              onClick={() => (window as any).api.maximizeWindow()}
              style={{
                width: '12px',
                height: '12px',
                background: '#28c840',
                border: 'none',
                borderRadius: '50%',
                cursor: 'pointer',
                padding: 0
              }}
            />
            <button
              onClick={() => (window as any).api.closeWindow()}
              style={{
                width: '12px',
                height: '12px',
                background: '#ff5f57',
                border: 'none',
                borderRadius: '50%',
                cursor: 'pointer',
                padding: 0
              }}
            />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

export default WelcomeScreen
