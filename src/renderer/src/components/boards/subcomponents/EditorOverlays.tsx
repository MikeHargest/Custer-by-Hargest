import React, { useEffect, useRef } from 'react'
import { Pin } from 'lucide-react'
import ColorPicker from '../../ColorPicker'
import { BoardElement, Viewport } from '../types'

interface EditorOverlaysProps {
  editingTextId: string | null
  elements: BoardElement[]
  viewport: Viewport
  setElements: React.Dispatch<React.SetStateAction<BoardElement[]>>
  setEditingTextId: (id: string | null) => void
  selectionRect: { x: number; y: number; w: number; h: number } | null
  showPenSettings: boolean
  penSettingsAnchor: DOMRect | null
  mode: string
  textSize: number
  setTextSize: (size: number) => void
  penSize: number
  setPenSize: (size: number) => void
  penColor: string
  setPenColor: (color: string) => void
  selectedIds: string[]
  showEraserSettings: boolean
  eraserSettingsAnchor: DOMRect | null
  eraserSize: number
  setEraserSize: (size: number) => void
  pushToHistory: () => void
  isSettingsPinned: boolean
  setIsSettingsPinned: (val: boolean) => void
}

const EditorOverlays: React.FC<EditorOverlaysProps> = ({
  editingTextId,
  elements,
  viewport,
  setElements,
  setEditingTextId,
  selectionRect,
  showPenSettings,
  penSettingsAnchor,
  mode,
  textSize,
  setTextSize,
  penSize,
  setPenSize,
  penColor,
  setPenColor,
  selectedIds,
  showEraserSettings,
  eraserSettingsAnchor,
  eraserSize,
  setEraserSize,
  pushToHistory,
  isSettingsPinned,
  setIsSettingsPinned
}) => {
  const penSettingsRef = useRef<HTMLDivElement>(null)
  const eraserSettingsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => e.stopPropagation()
    const penEl = penSettingsRef.current
    const eraserEl = eraserSettingsRef.current

    if (penEl) penEl.addEventListener('wheel', handleWheel, { passive: false })
    if (eraserEl) eraserEl.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      if (penEl) penEl.removeEventListener('wheel', handleWheel)
      if (eraserEl) eraserEl.removeEventListener('wheel', handleWheel)
    }
  }, [showPenSettings, showEraserSettings])

  useEffect(() => {
    if (mode !== 'eraser') return
    const moveCursor = (e: MouseEvent) => {
      const el = document.getElementById('eraser-cursor')
      if (el) {
        el.style.left = `${e.clientX}px`
        el.style.top = `${e.clientY}px`
      }
    }
    // Fire once to position immediately
    window.addEventListener('mousemove', moveCursor)
    return () => window.removeEventListener('mousemove', moveCursor)
  }, [mode])

  return (
    <>
      {/* Inline Text Editor Overlay */}
      {(() => {
        if (!editingTextId) return null
        const el = elements.find((e) => e.id === editingTextId)
        if (!el || el.type !== 'text') return null

        const P = (el.fontSize || 24) * 0.25
        // Add +5 pixels to innerW to match PIXI's wordWrapWidth leniency buffer and prevent wrap flickering
        const innerW = Math.max(0, el.width - P * 2 + 5)
        const innerH = Math.max(0, el.height - P * 2)

        const align = el.textAlign || 'left'
        let localX = -innerW / 2
        if (align === 'left') localX = -(el.width || 0) / 2 + P
        else if (align === 'right') localX = (el.width || 0) / 2 - P - innerW
        
        const screenX = (el.x + localX) * viewport.scale + viewport.x
        // Apply a -2px baseline alignment offset proportional to the zoom scale to sync DOM and WebGL
        const screenY = (el.y - innerH / 2) * viewport.scale + viewport.y - (2 * viewport.scale)
        const screenW = innerW * viewport.scale
        const screenH = innerH * viewport.scale

        return (
          <textarea
            ref={(node) => {
              if (node) {
                if (!node.dataset.initFocused) {
                  node.dataset.initFocused = 'true'
                  setTimeout(() => {
                    node.focus()
                    node.selectionStart = node.value.length
                    node.selectionEnd = node.value.length
                  }, 10)
                }
                // Pre-emptively match the height to the text content before browser paint
                // to prevent the browser from scrolling the internal textarea when wrapping 
                // or creating new lines (which causes the text to visually jump upwards).
                if (node.value) {
                  node.style.height = '0px' // Temporarily collapse to read accurate scrollHeight
                  const actualScroll = node.scrollHeight
                  node.style.height = `${Math.max(screenH, actualScroll)}px`
                }
              }
            }}
            value={el.text || ''}
            onChange={(e) => {
              const val = e.target.value
              setElements((prev) =>
                prev.map((p) => (p.id === el.id ? { ...p, text: val } : p))
              )
            }}
            onBlur={(e) => {
              const finalVal = e.target.value
              // Sync immediately without setTimeout to ensure handleManualSave captures it
              setElements((prev) =>
                prev.map((p) => {
                  if (p.id === el.id) {
                    return { ...p, text: finalVal.trim() || 'text' }
                  }
                  return p
                })
              )
              // Only delay closing the editor to prevent race conditions with UI clicks
              setTimeout(() => {
                setEditingTextId(null)
              }, 100)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                setEditingTextId(null)
                if (!el.text?.trim()) {
                  setElements((prev) =>
                    prev.map((p) => (p.id === el.id ? { ...p, text: 'text' } : p))
                  )
                }
                document.body.focus()
              }
              e.stopPropagation()
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseMove={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              left: screenX,
              top: screenY,
              width: screenW,
              height: screenH,
              minHeight: `${(el.fontSize || 24) * 1.5 * viewport.scale}px`,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: el.color || '#ffffff',
              fontSize: `${(el.fontSize || 24) * viewport.scale}px`,
              fontWeight: el.fontWeight || 400,
              fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
              textAlign: el.textAlign || 'left',
              lineHeight: 1.4,
              resize: 'none',
              padding: 0,
              margin: 0,
              overflow: 'hidden',
              zIndex: 1000,
              transformOrigin: 'top left',
              boxSizing: 'border-box'
            }}
          />
        )
      })()}

      {selectionRect && (
        <div
          style={{
            position: 'absolute',
            left: selectionRect.x,
            top: selectionRect.y,
            width: selectionRect.w,
            height: selectionRect.h,
            background: 'rgba(0, 122, 255, 0.08)',
            border: '1px solid rgba(0, 122, 255, 0.4)',
            borderRadius: '2px',
            pointerEvents: 'none',
            zIndex: 1000
          }}
        />
      )}

      {/* Pen Settings Menu */}
      {showPenSettings && penSettingsAnchor && (
        <div ref={penSettingsRef} data-context-menu="true" onWheel={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
          <div
            style={{
              position: 'absolute',
              zIndex: 99999,
              top: penSettingsAnchor.top,
              left: penSettingsAnchor.right + 12,
              background: 'var(--card-bg)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              padding: '16px',
              boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
              width: '280px',
              backdropFilter: 'blur(20px)'
            }}
          >
            <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setIsSettingsPinned(!isSettingsPinned) }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: isSettingsPinned ? '#fff' : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                }}
                title={isSettingsPinned ? "Unpin settings" : "Pin settings"}
              >
                <Pin size={14} />
              </button>
            </div>
            <div style={{ marginBottom: '16px', paddingRight: '20px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: 'rgba(255,255,255,0.4)',
                  letterSpacing: '0.05em',
                  marginBottom: '10px'
                }}
              >
                {mode === 'text' ? 'TEXT SIZE' : mode === 'rect' ? 'BORDER WIDTH' : 'PEN SIZE'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} onPointerDownCapture={() => pushToHistory()}>
                <input
                  type="range"
                  min={mode === 'text' ? '8' : '1'}
                  max={mode === 'text' ? '144' : '100'}
                  value={mode === 'text' ? textSize : penSize}
                  onChange={(e): void => {
                    const val = parseInt(e.target.value)
                    if (mode === 'text') {
                      setTextSize(val)
                    } else {
                      setPenSize(val)
                    }
                  }}
                  style={{ flex: 1, cursor: 'pointer', accentColor: '#d1d1d1' }}
                />
                <div
                  style={{
                    width: '34px',
                    textAlign: 'right',
                    fontSize: '12px',
                    color: '#fff',
                    fontWeight: 600,
                    fontFamily: 'monospace'
                  }}
                >
                  {mode === 'text' ? textSize : penSize}px
                </div>
              </div>
            </div>

            <div
              style={{
                height: '1px',
                background: 'rgba(255,255,255,0.06)',
                margin: '0 -16px 16px -16px'
              }}
            />

            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.05em',
                marginBottom: '10px'
              }}
            >
              {mode === 'text' ? 'TEXT COLOR' : mode === 'rect' ? 'BORDER COLOR' : 'PEN COLOR'}
            </div>
            <div style={{ position: 'relative', width: '100%' }} onPointerDownCapture={() => pushToHistory()}>
              <ColorPicker
                color={penColor}
                onChange={(c) => {
                  setPenColor(c)
                  if (selectedIds.length > 0) {
                    setElements((prev) =>
                      prev.map((el) => {
                        if (selectedIds.includes(el.id)) {
                          if (el.type === 'text') return { ...el, color: c }
                          if (el.type === 'rect') return { ...el, strokeColor: c }
                          if (el.type === 'path') return { ...el, color: c }
                        }
                        return el
                      })
                    )
                  }
                }}
                onClose={() => { }}
                inline={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* Eraser Settings Menu */}
      {showEraserSettings && eraserSettingsAnchor && (
        <div ref={eraserSettingsRef} data-context-menu="true" onWheel={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
          <div
            style={{
              position: 'absolute',
              zIndex: 99999,
              top: eraserSettingsAnchor.top,
              left: eraserSettingsAnchor.right + 12,
              background: 'var(--card-bg)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              padding: '16px',
              boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
              width: '240px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              backdropFilter: 'blur(20px)'
            }}
          >
            <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
              <button
                onClick={() => setIsSettingsPinned(!isSettingsPinned)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: isSettingsPinned ? '#fff' : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                }}
                title={isSettingsPinned ? "Unpin settings" : "Pin settings"}
              >
                <Pin size={14} />
              </button>
            </div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.05em',
                paddingRight: '20px'
              }}
            >
              ERASER SIZE
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} onPointerDownCapture={() => pushToHistory()}>
              <input
                type="range"
                min="4"
                max="100"
                value={eraserSize}
                onChange={(e): void => setEraserSize(parseInt(e.target.value))}
                style={{ flex: 1, cursor: 'pointer', accentColor: '#d1d1d1' }}
              />
              <div
                style={{
                  width: '34px',
                  textAlign: 'right',
                  fontSize: '12px',
                  color: '#fff',
                  fontWeight: 600,
                  fontFamily: 'monospace'
                }}
              >
                {eraserSize}px
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Eraser Cursor Overlay */}
      {mode === 'eraser' && (
        <div
          id="eraser-cursor"
          style={{
            position: 'fixed',
            width: eraserSize,
            height: eraserSize,
            border: '1.5px solid rgba(255, 255, 255, 0.9)',
            borderRadius: '50%',
            pointerEvents: 'none',
            zIndex: 10000,
            transform: 'translate(-50%, -50%)',
            mixBlendMode: 'difference',
            background: 'rgba(255, 255, 255, 0.1)',
            boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.2)',
            left: -100,
            top: -100
          }}
        />
      )}
    </>
  )
}

export default EditorOverlays
