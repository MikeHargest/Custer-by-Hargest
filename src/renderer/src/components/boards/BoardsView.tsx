import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Application, extend, useApplication } from '@pixi/react'
import * as PIXI from 'pixi.js'
import { nanoid } from 'nanoid'
import { MousePointer2, Hand, Trash2, Palette } from 'lucide-react'
import Stats from 'stats.js'
import ColorPicker from '../ColorPicker'

import { UITheme } from '../../types'

// Register PIXI components for @pixi/react v8
// eslint-disable-next-line @typescript-eslint/no-explicit-any
extend(PIXI as any)

interface BoardElement {
  id: string
  type: 'image' | 'video' | 'link'
  x: number
  y: number
  width: number
  height: number
  url: string
  title?: string
}

interface Viewport {
  x: number
  y: number
  scale: number
}

interface BoardsViewProps {
  boardData: string
  onChange: (data: string) => void
  showFPS?: boolean
  theme?: UITheme
  setTheme?: (theme: UITheme) => void
  isSidebarOpen?: boolean
}

const BoardsView: React.FC<BoardsViewProps> = ({
  boardData,
  onChange,
  showFPS = false,
  theme,
  setTheme
}) => {
  const [elements, setElements] = useState<BoardElement[]>([])
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 })
  const [mode, setMode] = useState<'select' | 'hand'>('select')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [showColorPicker, setShowColorPicker] = useState(false)
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  // Tracks previous container size synchronously (ref, not state) so ResizeObserver
  // delta calculations are correct even during rapid CSS transitions (batching-safe)
  const prevDimsRef = useRef({ width: 0, height: 0 })

  // Removed problematic useApplication() call from here as it must be used inside <Application> context

  // Stats initialization is now handled by the StatsMonitor component inside <Application>

  // Load initial data
  // Load initial data
  const [prevBoardData, setPrevBoardData] = useState(boardData)

  if (boardData !== prevBoardData) {
    setPrevBoardData(boardData)
    try {
      if (boardData) {
        const parsed = JSON.parse(boardData)
        if (Array.isArray(parsed)) {
          setElements(parsed)
        }
      }
    } catch (e) {
      console.error('Failed to parse board data', e)
    }
  }

  // Save data on changes — use ref + idle callback to avoid blocking renders
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const elementsRef = useRef(elements)

  useEffect(() => {
    elementsRef.current = elements
  }, [elements])

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      if ('requestIdleCallback' in window) {
        ; (window as Window).requestIdleCallback(() => {
          onChange(JSON.stringify(elementsRef.current))
        })
      } else {
        onChange(JSON.stringify(elementsRef.current))
      }
    }, 2000)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [elements, onChange])

  // Handle resize with ResizeObserver — keep camera centered on resize
  // prevDimsRef is updated synchronously so delta is always correct,
  // even when ResizeObserver fires many times during a CSS sidebar transition.
  useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newW = entry.contentRect.width
        const newH = entry.contentRect.height

        const prev = prevDimsRef.current
        if (prev.width > 0 && prev.height > 0) {
          const dw = newW - prev.width
          const dh = newH - prev.height
          if (dw !== 0 || dh !== 0) {
            // Shift viewport so the visible center stays fixed
            setViewport((vp) => ({
              ...vp,
              x: vp.x + dw / 2,
              y: vp.y + dh / 2
            }))
          }
        }

        // Update ref synchronously BEFORE any React re-render
        prevDimsRef.current = { width: newW, height: newH }
        setDimensions({ width: newW, height: newH })
      }
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Interaction: Pan & Zoom
  const [isSpaceDown, setIsSpaceDown] = useState(false)
  const isZooming = useRef(false)
  const zoomCenter = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const activeTag = document.activeElement?.tagName
        if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
          e.preventDefault()
          setIsSpaceDown(true)
        }
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpaceDown(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const handleWheel = useCallback(
    (e: React.WheelEvent): void => {
      e.preventDefault()
      const { deltaY, clientX, clientY } = e

      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      const screenX = clientX - rect.left
      const screenY = clientY - rect.top

      const currentViewport = viewport
      const worldX = (screenX - currentViewport.x) / currentViewport.scale
      const worldY = (screenY - currentViewport.y) / currentViewport.scale

      const zoomSpeed = 0.001
      const zoomFactor = 1 - deltaY * zoomSpeed
      const newScale = Math.min(Math.max(currentViewport.scale * zoomFactor, 0.05), 10)

      const newX = screenX - worldX * newScale
      const newY = screenY - worldY * newScale

      setViewport({ x: newX, y: newY, scale: newScale })
    },
    [viewport]
  )

  const isPanning = useRef(false)
  const lastMousePos = useRef({ x: 0, y: 0 })

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (
        e.button === 1 ||
        (mode === 'hand' && e.button === 0) ||
        (isSpaceDown && !e.ctrlKey && e.button === 0)
      ) {
        isPanning.current = true
        lastMousePos.current = { x: e.clientX, y: e.clientY }
      } else if (isSpaceDown && e.ctrlKey && e.button === 0) {
        isZooming.current = true
        lastMousePos.current = { x: e.clientX, y: e.clientY }
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect) {
          zoomCenter.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
        }
      }
    },
    [mode, isSpaceDown]
  )

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - lastMousePos.current.x
      const dy = e.clientY - lastMousePos.current.y

      setViewport((prev) => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy
      }))

      lastMousePos.current = { x: e.clientX, y: e.clientY }
    } else if (isZooming.current) {
      const dx = e.clientX - lastMousePos.current.x
      const zoomSpeed = 0.01 // Sensitivity for zoom dragging
      const zoomFactor = 1 + dx * zoomSpeed

      setViewport((prev) => {
        const currentViewport = prev
        const screenX = zoomCenter.current.x
        const screenY = zoomCenter.current.y
        const worldX = (screenX - currentViewport.x) / currentViewport.scale
        const worldY = (screenY - currentViewport.y) / currentViewport.scale

        const newScale = Math.min(Math.max(currentViewport.scale * zoomFactor, 0.05), 10)
        const newX = screenX - worldX * newScale
        const newY = screenY - worldY * newScale

        return { x: newX, y: newY, scale: newScale }
      })
      lastMousePos.current = { x: e.clientX, y: e.clientY }
    }
  }, [])

  const handleMouseUp = useCallback(() => {
    isPanning.current = false
    isZooming.current = false
  }, [])

  const addElementAtPos = useCallback(
    (type: 'image' | 'video' | 'link', url: string, screenX: number, screenY: number) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      const worldX = (screenX - rect.left - viewport.x) / viewport.scale
      const worldY = (screenY - rect.top - viewport.y) / viewport.scale

      const newElement: BoardElement = {
        id: nanoid(),
        type,
        x: worldX,
        y: worldY,
        width: type === 'link' ? 300 : 400,
        height: type === 'link' ? 100 : 300,
        url: url,
        title: type === 'link' ? url.split('//').pop()?.split('/')[0] || url : undefined
      }

      setElements((prev) => [...prev, newElement])
    },
    [viewport]
  )

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      const files = Array.from(e.dataTransfer.files)

      if (files.length > 0) {
        for (const file of files) {
          const isVideo = file.type.startsWith('video/')
          const isImage = file.type.startsWith('image/')
          if (!isVideo && !isImage) continue

          let url = (file as File & { path?: string }).path
          if (url) {
            url = 'file:///' + url.replace(/\\/g, '/')
          } else {
            url = URL.createObjectURL(file)
          }
          addElementAtPos(isVideo ? 'video' : 'image', url, e.clientX, e.clientY)
        }
      } else {
        const text = e.dataTransfer.getData('text')
        if (text && (text.startsWith('http') || text.startsWith('www'))) {
          addElementAtPos('link', text, e.clientX, e.clientY)
        }
      }
    },
    [addElementAtPos]
  )

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return

      const text = e.clipboardData?.getData('text')
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      if (text && (text.startsWith('http') || text.startsWith('www'))) {
        addElementAtPos('link', text, rect.left + rect.width / 2, rect.top + rect.height / 2)
      }

      const items = e.clipboardData?.items
      if (items) {
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/') || item.type.startsWith('video/')) {
            const file = item.getAsFile()
            if (file) {
              const url = URL.createObjectURL(file)
              addElementAtPos(
                item.type.startsWith('video/') ? 'video' : 'image',
                url,
                rect.left + rect.width / 2,
                rect.top + rect.height / 2
              )
            }
          }
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [addElementAtPos])

  const deleteSelected = useCallback(() => {
    if (selectedId) {
      setElements((prev) => prev.filter((el) => el.id !== selectedId))
      setSelectedId(null)
    }
  }, [selectedId])

  const handleElementMove = useCallback((id: string, x: number, y: number) => {
    setElements((prev) => prev.map((el) => (el.id === id ? { ...el, x, y } : el)))
  }, [])

  const handleElementResize = useCallback((id: string, width: number, height: number) => {
    setElements((prev) =>
      prev.map((el) =>
        el.id === id && (el.width !== width || el.height !== height) ? { ...el, width, height } : el
      )
    )
  }, [])

  return (
    <div
      className="boards-view"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: theme?.boardBg || '#1b1b1b',
        overflow: 'hidden',
        cursor: isSpaceDown ? 'grab' : mode === 'hand' ? 'grab' : 'default'
      }}
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* Toolbar */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '20px',
          transform: 'translateY(-50%)',
          zIndex: 100,
          background: 'rgba(20, 20, 20, 0.7)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '20px',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <ToolButton
          active={mode === 'select'}
          onClick={() => setMode('select')}
          icon={<MousePointer2 size={20} />}
          title="Select (V)"
        />
        <ToolButton
          active={mode === 'hand'}
          onClick={() => setMode('hand')}
          icon={<Hand size={20} />}
          title="Pan (H)"
        />
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.15)', margin: '0 6px' }} />

        <div style={{ position: 'relative' }}>
          <ToolButton
            active={showColorPicker}
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
              setShowColorPicker(!showColorPicker)
              setPickerAnchor(rect)
            }}
            icon={<Palette size={20} />}
            title="Background Color"
          />
          {showColorPicker && (
            <ColorPicker
              color={theme?.boardBg || '#1b1b1b'}
              onChange={(color) => {
                if (setTheme && theme) setTheme({ ...theme, boardBg: color })
              }}
              onClose={() => setShowColorPicker(false)}
              anchorRect={pickerAnchor}
            />
          )}
        </div>

        <ToolButton
          active={false}
          onClick={deleteSelected}
          icon={<Trash2 size={20} />}
          title="Delete (Del)"
          danger
          disabled={!selectedId}
        />
      </div>

      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {dimensions.width > 0 && dimensions.height > 0 && (
          <Application
            width={dimensions.width}
            height={dimensions.height}
            background={theme?.boardBg || '#1b1b1b'}
            antialias={true}
            // @ts-ignore - style prop works on the underlying canvas
            style={{ display: 'block', width: '100%', height: '100%', outline: 'none' }}
          >
            <BoardContent
              elements={elements}
              viewport={viewport}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMove={handleElementMove}
              onResize={handleElementResize}
              showFPS={showFPS}
              containerRef={containerRef}
              interactive={!isSpaceDown}
              screenWidth={dimensions.width}
              screenHeight={dimensions.height}
            />
          </Application>
        )}
      </div>

      {/* Floating Info Pod */}
      <div
        style={{
          position: 'absolute',
          bottom: '24px',
          left: '24px',
          background: 'rgba(30, 30, 30, 0.8)',
          backdropFilter: 'blur(10px)',
          padding: '8px 16px',
          borderRadius: '24px',
          color: '#efefef',
          fontSize: '13px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          pointerEvents: 'none',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.05)'
        }}
      >
        <span style={{ opacity: 0.8 }}>{Math.round(viewport.scale * 100)}%</span>
        <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.1)' }} />
        <span style={{ opacity: 0.8 }}>{elements.length} components</span>
      </div>
    </div>
  )
}

interface ToolButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  active?: boolean
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  icon: React.ReactNode
  title?: string
  danger?: boolean
  disabled?: boolean
}

const ToolButton = React.forwardRef<HTMLButtonElement, ToolButtonProps>(
  ({ active, onClick, icon, title, danger, disabled }, ref) => (
    <button
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: active ? 'var(--accent, #525252)' : 'transparent',
        border: 'none',
        color: disabled ? '#333' : danger ? '#ff6b6b' : '#fff',
        padding: '12px',
        borderRadius: '16px',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: disabled ? 0.3 : 1,
        transform: active ? 'scale(1.1)' : 'scale(1)'
      }}
      className="tool-btn"
      title={title}
    >
      {icon}
    </button>
  )
)

interface BoardContentProps {
  elements: BoardElement[]
  viewport: Viewport
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMove: (id: string, x: number, y: number) => void
  onResize: (id: string, width: number, height: number) => void
  showFPS: boolean
  containerRef: React.RefObject<HTMLDivElement | null>
  interactive?: boolean
  screenWidth: number
  screenHeight: number
}

const StatsMonitor: React.FC<{
  showFPS: boolean
  containerRef: React.RefObject<HTMLDivElement | null>
}> = ({ showFPS, containerRef }) => {
  const { app: pixiApp } = useApplication()
  const statsRef = useRef<any>(null)

  useEffect(() => {
    const container = containerRef.current
    if (showFPS && container && pixiApp) {
      const statsInstances: any[] = []
      const wrapper = document.createElement('div')
      wrapper.id = 'stats-monitor-wrapper'

      Object.assign(wrapper.style, {
        position: 'absolute',
        left: '24px',
        top: '24px',
        zIndex: '1000',
        display: 'flex',
        gap: '4px',
        pointerEvents: 'none',
        background: 'rgba(0,0,0,0.2)',
        padding: '6px',
        borderRadius: '8px',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.05)'
      })

      // 1. Standard Panels (FPS, MS, MEM)
      for (let i = 0; i < 3; i++) {
        try {
          const stats = new (Stats as any)()
          stats.showPanel(i)
          stats.dom.style.position = 'relative'
          stats.dom.style.top = 'auto'
          stats.dom.style.left = 'auto'
          wrapper.appendChild(stats.dom)
          statsInstances.push(stats)
        } catch (e) {
          console.error('Failed to init stats.js panel', i, e)
        }
      }

      container.appendChild(wrapper)
      statsRef.current = { statsInstances, wrapper }

      const updateStats = (): void => {
        for (const s of statsInstances) {
          s.begin()
          s.end()
        }
      }

      pixiApp.ticker.add(updateStats)

      return () => {
        pixiApp.ticker.remove(updateStats)
        if (container?.contains(wrapper)) {
          container.removeChild(wrapper)
        }
      }
    }
    return undefined
  }, [showFPS, pixiApp, containerRef])

  return null
}

const BoardContent: React.FC<BoardContentProps> = ({
  elements,
  viewport,
  selectedId,
  onSelect,
  onMove,
  onResize,
  showFPS,
  containerRef,
  interactive = true,
  screenWidth,
  screenHeight
}) => {
  // Find viewport boundaries in world space to cull non-visible rects
  // Use React-state dimensions (not app.screen which lags on resize)
  const CULL_MARGIN = 64 // extra px margin to avoid edge-case clipping
  const screenW = (screenWidth + CULL_MARGIN * 2) / viewport.scale
  const screenH = (screenHeight + CULL_MARGIN * 2) / viewport.scale
  const screenX = (-viewport.x - CULL_MARGIN) / viewport.scale
  const screenY = (-viewport.y - CULL_MARGIN) / viewport.scale

  return (
    <pixiContainer x={viewport.x} y={viewport.y} scale={viewport.scale}>
      {elements.map((el: BoardElement) => {
        // Culling Check
        const elLeft = el.x - el.width / 2
        const elRight = el.x + el.width / 2
        const elTop = el.y - el.height / 2
        const elBottom = el.y + el.height / 2

        const isVisible = !(
          elRight < screenX ||
          elLeft > screenX + screenW ||
          elBottom < screenY ||
          elTop > screenY + screenH
        )

        return (
          <ElementItem
            key={el.id}
            element={el}
            isSelected={selectedId === el.id}
            onSelect={onSelect}
            onMove={onMove}
            onResize={onResize}
            renderable={isVisible}
            interactive={interactive}
          />
        )
      })}

      <StatsMonitor showFPS={showFPS} containerRef={containerRef} />
    </pixiContainer>
  )
}

interface ElementItemProps {
  element: BoardElement
  isSelected: boolean
  onSelect: (id: string | null) => void
  onMove: (id: string, x: number, y: number) => void
  onResize: (id: string, w: number, h: number) => void
  renderable?: boolean
  interactive?: boolean
}

const ElementItem = React.memo<ElementItemProps>(
  ({ element, isSelected, onSelect, onMove, onResize, renderable = true, interactive = true }) => {
    const [texture, setTexture] = useState<PIXI.Texture | null>(null)
    const isDragging = useRef(false)
    const dragOffset = useRef({ x: 0, y: 0 })

    useEffect(() => {
      let active = true
      const loadTexture = async (): Promise<void> => {
        try {
          if (element.type === 'image') {
            const img = new Image()
            if (element.url.startsWith('http')) {
              img.crossOrigin = 'anonymous'
            }
            img.src = element.url
            await new Promise((resolve, reject) => {
              img.onload = resolve
              img.onerror = () => reject(new Error('Failed to load image: ' + element.url))
            })
            if (active) {
              const tex = PIXI.Texture.from(img)
              setTexture(tex)
              onResize(element.id, img.width, img.height)
            }
          } else if (element.type === 'video') {
            const videoElement = document.createElement('video')
            videoElement.src = element.url
            videoElement.muted = true
            videoElement.loop = true
            videoElement.autoplay = true
            videoElement.crossOrigin = 'anonymous'

            try {
              await videoElement.play()
            } catch {
              // Playback might be blocked initially
            }

            if (active) {
              const t = PIXI.Texture.from(videoElement)
              setTexture(t)
              if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                onResize(element.id, videoElement.videoWidth, videoElement.videoHeight)
              } else {
                // Wait for metadata if not immediately available
                videoElement.addEventListener('loadedmetadata', () => {
                  if (active) {
                    onResize(element.id, videoElement.videoWidth, videoElement.videoHeight)
                  }
                })
              }
            }
          }
        } catch (err) {
          console.error('Failed to load media texture', err)
        }
      }

      loadTexture()
      return () => {
        active = false
      }
    }, [element.url, element.type])

    const handlePointerDown = (e: PIXI.FederatedPointerEvent): void => {
      if (e.button === 0) {
        onSelect(element.id)
        isDragging.current = true
        const parent = (e.currentTarget as any).parent
        const localPos = e.getLocalPosition(parent)
        dragOffset.current = {
          x: localPos.x - element.x,
          y: localPos.y - element.y
        }
        e.stopPropagation()
      }
    }

    const handlePointerMove = (e: PIXI.FederatedPointerEvent): void => {
      if (isDragging.current) {
        const parent = (e.currentTarget as any).parent
        const localPos = e.getLocalPosition(parent)
        onMove(element.id, localPos.x - dragOffset.current.x, localPos.y - dragOffset.current.y)
      }
    }

    const handlePointerUp = (): void => {
      isDragging.current = false
    }

    const handleLinkClick = (): void => {
      if (element.type === 'link') {
        window.open(element.url, '_blank')
      }
    }

    return (
      <pixiContainer
        x={element.x}
        y={element.y}
        eventMode={interactive ? 'static' : 'none'}
        cursor={interactive ? 'pointer' : 'auto'}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerUpOutside={handlePointerUp}
        visible={renderable}
      >
        {element.type === 'link' ? (
          <pixiContainer onClick={handleLinkClick}>
            <pixiGraphics
              draw={(g: PIXI.Graphics) => {
                g.clear()
                g.beginFill(0x2d2d2d, 0.9)
                g.lineStyle(2, 0x444444)
                g.drawRoundedRect(
                  -element.width / 2,
                  -element.height / 2,
                  element.width,
                  element.height,
                  16
                )
                g.endFill()

                // Draw iconic link symbol
                g.lineStyle(0)
                g.beginFill(0x007aff, 0.2)
                g.drawCircle(-element.width / 2 + 30, 0, 15)
                g.endFill()
              }}
            />
            <pixiText
              text={element.title || 'Link'}
              x={10}
              anchor={0.5}
              style={
                new PIXI.TextStyle({
                  fill: '#007aff',
                  fontSize: 16,
                  fontWeight: '700',
                  wordWrap: true,
                  wordWrapWidth: element.width - 60
                })
              }
            />
          </pixiContainer>
        ) : texture ? (
          <pixiSprite
            texture={texture}
            width={element.width}
            height={element.height}
            anchor={0.5}
          />
        ) : (
          <pixiGraphics
            draw={(g: PIXI.Graphics) => {
              g.clear()
              g.beginFill(0x333333)
              g.drawRoundedRect(
                -element.width / 2,
                -element.height / 2,
                element.width,
                element.height,
                12
              )
              g.endFill()
            }}
          />
        )}

        {/* Modern Glowy Selection Highlight */}
        {isSelected && (
          <pixiGraphics
            draw={(g: PIXI.Graphics) => {
              g.clear()
              g.lineStyle(6, 0x007aff, 0.4) // Outer glow
              g.drawRoundedRect(
                -element.width / 2 - 10,
                -element.height / 2 - 10,
                element.width + 20,
                element.height + 20,
                18
              )
              g.lineStyle(3, 0x007aff, 1) // Inner border
              g.drawRoundedRect(
                -element.width / 2 - 6,
                -element.height / 2 - 6,
                element.width + 12,
                element.height + 12,
                16
              )
            }}
          />
        )}

        {element.type === 'video' && (
          <pixiContainer y={element.height / 2 - 25}>
            <pixiGraphics
              draw={(g: PIXI.Graphics) => {
                g.beginFill(0xed6a5e, 0.9)
                g.drawRoundedRect(-35, -12, 70, 24, 12)
                g.endFill()
              }}
            />
            <pixiText
              text="VIDEO"
              anchor={0.5}
              style={
                new PIXI.TextStyle({
                  fill: '#ffffff',
                  fontSize: 11,
                  fontWeight: '900',
                  letterSpacing: 1
                })
              }
            />
          </pixiContainer>
        )}
      </pixiContainer>
    )
  }
)

export default BoardsView
