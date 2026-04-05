import { useEffect, useState } from 'react'
import { X, User, HardDrive, LayoutGrid } from 'lucide-react'
import { motion } from 'framer-motion'

interface WorkspaceProfileProps {
  isOpen: boolean
  onClose: () => void
  workspacePath: string | null
  projectCount: number
}

export default function WorkspaceProfile({
  isOpen,
  onClose,
  workspacePath,
  projectCount
}: WorkspaceProfileProps) {
  const [folderSize, setFolderSize] = useState<string>('Calculating...')

  useEffect(() => {
    if (isOpen && workspacePath) {
      const fetchSize = async () => {
        try {
          // @ts-ignore
          const sizeInBytes = await window.api.getFolderSize(workspacePath)
          setFolderSize(formatBytes(sizeInBytes))
        } catch (error) {
          console.error('Failed to get folder size:', error)
          setFolderSize('Error')
        }
      }
      fetchSize()
    }
  }, [isOpen, workspacePath])

  if (!isOpen) return null

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }

  const workspaceName = workspacePath ? workspacePath.split(/[\\/]/).pop() : 'No Workspace'

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
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          background: 'var(--card-bg)',
          width: '500px',
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
            <User size={18} style={{ color: 'var(--text-secondary)' }} />
            <h2
              style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}
            >
              Workspace Profile
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

        {/* Body */}
        <div style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              padding: '20px',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white'
                }}
              >
                <User size={24} />
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 600 }}>{workspaceName}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {workspacePath}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div
                style={{
                  padding: '16px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'var(--text-secondary)',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase'
                  }}
                >
                  <HardDrive size={14} /> Workspace Size
                </div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>{folderSize}</div>
              </div>

              <div
                style={{
                  padding: '16px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'var(--text-secondary)',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase'
                  }}
                >
                  <LayoutGrid size={14} /> Total Projects
                </div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>{projectCount}</div>
              </div>
            </div>
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
            Close
          </button>
        </div>
      </motion.div>
    </div>
  )
}
