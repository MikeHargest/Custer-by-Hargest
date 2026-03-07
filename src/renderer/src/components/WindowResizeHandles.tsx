import React from 'react'

const BORDER = 8

type Direction = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

interface HandleProps {
  direction: Direction
  style: React.CSSProperties
}

function ResizeHandle({ direction, style }: HandleProps) {
  const cursorMap: Record<Direction, string> = {
    n: 'n-resize',
    ne: 'ne-resize',
    e: 'e-resize',
    se: 'se-resize',
    s: 's-resize',
    sw: 'sw-resize',
    w: 'w-resize',
    nw: 'nw-resize'
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    // @ts-ignore
    window.api.windowResizeStart(direction)

    const onUp = () => {
      // @ts-ignore
      window.api.windowResizeEnd()
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      style={
        {
          position: 'fixed',
          cursor: cursorMap[direction],
          zIndex: 9999,
          WebkitAppRegion: 'no-drag',
          ...style
        } as React.CSSProperties
      }
    />
  )
}

export default function WindowResizeHandles() {
  return (
    <>
      {/* Edges */}
      <ResizeHandle direction="n" style={{ top: 0, left: BORDER, right: BORDER, height: BORDER }} />
      <ResizeHandle
        direction="s"
        style={{ bottom: 0, left: BORDER, right: BORDER, height: BORDER }}
      />
      <ResizeHandle direction="w" style={{ left: 0, top: BORDER, bottom: BORDER, width: BORDER }} />
      <ResizeHandle
        direction="e"
        style={{ right: 0, top: BORDER, bottom: BORDER, width: BORDER }}
      />
      {/* Corners */}
      <ResizeHandle
        direction="nw"
        style={{ top: 0, left: 0, width: BORDER * 2, height: BORDER * 2 }}
      />
      <ResizeHandle
        direction="ne"
        style={{ top: 0, right: 0, width: BORDER * 2, height: BORDER * 2 }}
      />
      <ResizeHandle
        direction="sw"
        style={{ bottom: 0, left: 0, width: BORDER * 2, height: BORDER * 2 }}
      />
      <ResizeHandle
        direction="se"
        style={{ bottom: 0, right: 0, width: BORDER * 2, height: BORDER * 2 }}
      />
    </>
  )
}
