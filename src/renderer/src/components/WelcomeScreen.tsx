import { useState } from 'react'
import { FolderOpen, FolderPlus, Briefcase } from 'lucide-react'

interface WelcomeScreenProps {
  onWorkspaceSelected: (path: string) => void
}

function WelcomeScreen({ onWorkspaceSelected }: WelcomeScreenProps): React.ReactElement {
  const [isLoading, setIsLoading] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('project manager')

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
        const name = workspaceName.trim() || 'project manager'
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
    <div className="welcome-screen">
      <div
        className="welcome-window-controls"
        style={
          {
            position: 'absolute',
            top: '22px',
            right: '16px',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            zIndex: 10,
            WebkitAppRegion: 'no-drag'
          } as React.CSSProperties
        }
      >
        <button
          onClick={() => {
            // @ts-ignore - preload api
            window.api.minimizeWindow()
          }}
          title="Minimize"
          style={{
            width: '12px',
            height: '12px',
            background: '#febc2e',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '50%',
            padding: 0
          }}
        />
        <button
          onClick={() => {
            // @ts-ignore - preload api
            window.api.maximizeWindow()
          }}
          title="Maximize"
          style={{
            width: '12px',
            height: '12px',
            background: '#28c840',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '50%',
            padding: 0
          }}
        />
        <button
          onClick={() => {
            // @ts-ignore - preload api
            window.api.closeWindow()
          }}
          title="Close"
          style={{
            width: '12px',
            height: '12px',
            background: '#ff5f57',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '50%',
            padding: 0
          }}
        />
      </div>
      <div className="welcome-content">
        <div className="welcome-icon">
          <Briefcase size={48} strokeWidth={1.5} />
        </div>

        <h1 className="welcome-title">Time Builder</h1>
        <p className="welcome-subtitle">
          Choose a workspace folder to store your projects, notes, and attachments.
        </p>

        <div className="welcome-actions">
          <button
            className="welcome-btn welcome-btn-primary"
            onClick={handleOpenExisting}
            disabled={isLoading}
          >
            <FolderOpen size={20} />
            <div className="welcome-btn-text">
              <span className="welcome-btn-label">Open Existing Folder</span>
              <span className="welcome-btn-hint">Select a folder with your workspace data</span>
            </div>
          </button>

          <div className="welcome-create-group">
            <div className="welcome-input-wrapper">
              <label htmlFor="workspace-name" className="welcome-input-label">
                Workspace Name
              </label>
              <input
                id="workspace-name"
                type="text"
                className="welcome-input"
                placeholder="Enter workspace name..."
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                disabled={isLoading}
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              />
            </div>
            <button
              className="welcome-btn welcome-btn-secondary"
              onClick={handleCreateNew}
              disabled={isLoading || !workspaceName.trim()}
            >
              <FolderPlus size={20} />
              <div className="welcome-btn-text">
                <span className="welcome-btn-label">Create New Workspace</span>
                <span className="welcome-btn-hint">
                  Pick a parent folder to create this workspace
                </span>
              </div>
            </button>
          </div>
        </div>

        <p className="welcome-footer">
          Each project will get its own folder with notes, tasks, and attachments.
        </p>
      </div>
    </div>
  )
}

export default WelcomeScreen
