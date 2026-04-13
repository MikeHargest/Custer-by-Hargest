import React from 'react'
import { HardDrive, Loader2 } from 'lucide-react'

const BOARD_CSS = `
  @keyframes sync-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .sync-animate-spin {
    animation: sync-spin 1s linear infinite;
  }
`

interface BoardBottomBarProps {
  elementsCount: number
  scale: number
  isSyncing: boolean
}

const BoardBottomBar = React.memo(({ elementsCount, scale, isSyncing }: BoardBottomBarProps) => {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '18px',
        left: '18px',
        background: 'var(--card-bg)',
        padding: '5px 12px',
        borderRadius: '11px',
        color: '#efefef',
        fontSize: '11px',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        pointerEvents: 'auto',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.08)',
        zIndex: 1100
      }}
    >
      <style>{BOARD_CSS}</style>
      <span style={{ opacity: 0.8 }}>{elementsCount} components</span>
      <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.1)' }} />
      <span style={{ opacity: 0.8 }}>{Math.round(scale * 100)}%</span>
      <div
        title={isSyncing ? 'Saving assets to disk...' : 'All assets saved to disk'}
        style={{
          display: 'flex',
          alignItems: 'center',
          color: isSyncing ? '#3b82f6' : '#10b981',
          transition: 'color 0.3s ease'
        }}
      >
        {isSyncing ? (
          <Loader2 size={13} className="sync-animate-spin" />
        ) : (
          <HardDrive size={13} />
        )}
      </div>
    </div>
  )
})

BoardBottomBar.displayName = 'BoardBottomBar'

export default BoardBottomBar
