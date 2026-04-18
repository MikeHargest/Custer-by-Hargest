import React, { useRef, useEffect } from 'react'
import { HardDrive, Loader2, ImagePlus } from 'lucide-react'

const BOARD_CSS = `
  @keyframes sync-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .sync-animate-spin {
    animation: sync-spin 1s linear infinite;
  }
  @keyframes pulse-opacity {
    0% { opacity: 0.6; }
    50% { opacity: 1; }
    100% { opacity: 0.6; }
  }
  .animate-pulse-opacity {
    animation: pulse-opacity 2s ease-in-out infinite;
  }
`

interface BoardBottomBarProps {
  elementsCount: number
  scale: number
  isSyncing: boolean
  processingCount?: number
}

const BoardBottomBar = React.memo(({ elementsCount, scale, isSyncing, processingCount = 0 }: BoardBottomBarProps) => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handleWheel = (e: WheelEvent) => e.stopPropagation()
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  return (
    <div
      ref={containerRef}
      data-context-menu="true"
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
      <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.1)' }} />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {processingCount > 0 && (
          <div 
            className="animate-pulse-opacity"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              color: '#3b82f6',
              background: 'rgba(59, 130, 246, 0.1)',
              padding: '2px 8px',
              borderRadius: '6px'
            }}
          >
            <ImagePlus size={12} />
            <span>Loading {processingCount}...</span>
          </div>
        )}

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
    </div>
  )
})

BoardBottomBar.displayName = 'BoardBottomBar'

export default BoardBottomBar
