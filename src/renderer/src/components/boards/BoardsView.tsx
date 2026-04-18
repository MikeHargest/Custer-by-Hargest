import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Application, extend } from '@pixi/react'
import * as PIXI from 'pixi.js'
import Stats from 'stats.js'

console.log('[BoardsView] PIXI Version:', PIXI.VERSION)
console.log('[BoardsView] Graphics check:', !!PIXI.Graphics)

// Register PIXI components for @pixi/react v8
extend({
  container: PIXI.Container,
  graphics: PIXI.Graphics,
  sprite: PIXI.Sprite,
  text: PIXI.Text,
  // Also register capitalized names (common in PIXI world)
  Container: PIXI.Container,
  Graphics: PIXI.Graphics,
  Sprite: PIXI.Sprite,
  Text: PIXI.Text,
  // Support legacy names used in some components
  pixiContainer: PIXI.Container,
  pixiGraphics: PIXI.Graphics,
  pixiSprite: PIXI.Sprite,
  pixiText: PIXI.Text
})

const StatsMonitor: React.FC<{
  showFPS?: boolean
  containerRef: React.RefObject<HTMLDivElement | null>
}> = ({ showFPS, containerRef }) => {
  useEffect(() => {
    if (!showFPS || !containerRef.current) return

    // Cleanup existing wrappers to prevent duplication
    const existingWrappers = containerRef.current.querySelectorAll('#stats-monitor-wrapper')
    existingWrappers.forEach((el) => el.remove())

    const stats = new Stats()
    stats.showPanel(0) // 0: fps

    const wrapper = document.createElement('div')
    wrapper.id = 'stats-monitor-wrapper'
    wrapper.style.position = 'absolute'
    wrapper.style.top = '14px'
    wrapper.style.right = '320px' // Offset from sidebar
    wrapper.style.zIndex = '1000'
    wrapper.style.pointerEvents = 'none'
    wrapper.appendChild(stats.dom)

    // Customize appearance
    stats.dom.style.position = 'relative'
    stats.dom.style.left = '0'
    stats.dom.style.top = '0'
    stats.dom.style.background = 'transparent'
    stats.dom.style.backgroundColor = 'transparent'

    const updateStyles = (): void => {
      if (stats.dom) {
        Array.from(stats.dom.children).forEach((child: unknown) => {
          const el = child as HTMLElement
          el.style.background = 'transparent'
          el.style.backgroundColor = 'transparent'
        })
      }
    }
    updateStyles()

    containerRef.current.appendChild(wrapper)

    let rafId: number
    const animate = (): void => {
      stats.update()
      rafId = requestAnimationFrame(animate)
    }
    rafId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(rafId)
      wrapper.remove()
    }
  }, [showFPS, containerRef])

  return null
}
import { Layers } from 'lucide-react'

// Types & Utils
import { BoardElement, BoardsViewProps, CachedSnapTarget } from './types'

// Hooks
import { useBoardHistory } from './hooks/useBoardHistory'
import { useBoardNavigation } from './hooks/useBoardNavigation'
import { useBoardAssets } from './hooks/useBoardAssets'
import { useBoardTools } from './hooks/useBoardTools'
import { useBoardSelection } from './hooks/useBoardSelection'
import { useBoardInteractions } from './hooks/useBoardInteractions'

// Subcomponents
import BoardContent from './subcomponents/BoardContent'
import SelectionMenu from './subcomponents/SelectionMenu'
import BoardBottomBar from './subcomponents/BoardBottomBar'
import Toolbar from './subcomponents/Toolbar'
import LayersPanel from './subcomponents/LayersPanel'
import EditorOverlays from './subcomponents/EditorOverlays'
import ColorPicker from '../ColorPicker'

const BoardsView: React.FC<BoardsViewProps> = ({
  boardData,
  onChange,
  showFPS = false,
  theme,
  setTheme,
  boardId,
  boardDir,
  boardFileName
}) => {
  // --- Core State ---
  const [elements, setElements] = useState<BoardElement[]>([])
  const [mode, setMode] = useState<'select' | 'hand' | 'pen' | 'rect' | 'eraser' | 'text'>('select')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [isSpaceDown, setIsSpaceDown] = useState(false)

  const [showLayers, setShowLayers] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<string[]>([])

  const containerRef = useRef<HTMLDivElement>(null)
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null)
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  })
  const prevDimsRef = useRef({ width: 0, height: 0 })

  // Floating UI States
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null)
  const [showPenSettings, setShowPenSettings] = useState(false)
  const [penSettingsAnchor, setPenSettingsAnchor] = useState<DOMRect | null>(null)
  const [showEraserSettings, setShowEraserSettings] = useState(false)
  const [eraserSettingsAnchor, setEraserSettingsAnchor] = useState<DOMRect | null>(null)
  const [isSettingsPinned, setIsSettingsPinned] = useState(false)
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [isSavedFlash, setIsSavedFlash] = useState(false)

  const adjustAnchor = useCallback((rect: DOMRect | null) => {
    if (!rect || !containerRef.current) return null
    const board = containerRef.current.getBoundingClientRect()
    return {
      top: rect.top - board.top,
      bottom: rect.bottom - board.top,
      left: rect.left - board.left,
      right: rect.right - board.left,
      width: rect.width,
      height: rect.height,
      x: rect.x - board.left,
      y: rect.y - board.top,
      toJSON: () => {}
    } as DOMRect
  }, [])

  const handleSetPickerAnchor = useCallback((r: DOMRect | null) => setPickerAnchor(adjustAnchor(r)), [adjustAnchor])
  const handleSetPenSettingsAnchor = useCallback((r: DOMRect | null) => setPenSettingsAnchor(adjustAnchor(r)), [adjustAnchor])
  const handleSetEraserSettingsAnchor = useCallback((r: DOMRect | null) => setEraserSettingsAnchor(adjustAnchor(r)), [adjustAnchor])

  // Refs for logic
  const isBoardActiveRef = useRef(false)
  const lastElementDoubleClickTime = useRef<number>(0)
  const snappingGuidesRef = useRef<{ x?: number; y?: number }[]>([])
  const dragContextRef = useRef<{
    movers: {
      index: number
      id: string
      offsetX: number
      offsetY: number
      width: number
      height: number
    }[]
    targets: CachedSnapTarget[]
    lastId: string | null
  } | null>(null)
  const lastPushedDataRef = useRef<string | null>(null)
  const isDirtyRef = useRef(false)

  // Settings
  const [penColor, setPenColor] = useState('#ffffff')
  const [penSize, setPenSizeState] = useState(4)
  const [textSize, setTextSizeState] = useState(32)
  const [eraserSize, setEraserSizeState] = useState(24)

  const setPenSize = useCallback(
    (val: number) => {
      setPenSizeState(val)
      if (selectedIds.length > 0) {
        setElements((prev) =>
          prev.map((el) => {
            if (selectedIds.includes(el.id)) {
              if (el.type === 'path') return { ...el, size: val }
              if (el.type === 'rect') return { ...el, strokeWidth: val }
            }
            return el
          })
        )
      }
    },
    [selectedIds, setElements]
  )

  const setTextSize = useCallback(
    (val: number) => {
      setTextSizeState(val)
      if (selectedIds.length > 0) {
        setElements((prev) =>
          prev.map((el) => {
            if (selectedIds.includes(el.id) && el.type === 'text') {
              return { ...el, fontSize: val, height: Math.max((el.height || 0), val * 1.5) }
            }
            return el
          })
        )
      }
    },
    [selectedIds, setElements]
  )

  const setEraserSize = useCallback(
    (val: number) => {
      setEraserSizeState(val)
      if (selectedIds.length > 0) {
        setElements((prev) =>
          prev.map((el) => {
            return el
          })
        )
      }
    },
    [selectedIds, setElements]
  )

  const processingCount = useMemo(() => elements.filter((el) => el.isProcessing).length, [elements])
  const isSyncing = processingCount > 0

  // --- Refs to avoid dependency churn on callbacks ---
  // These stabilize handleManualSave and the autosave effect
  // so they don't re-create on every viewport/elements change.
  const elementsRef = useRef(elements)
  useEffect(() => {
    elementsRef.current = elements
  }, [elements])
  const selectedIdsRef = useRef(selectedIds)
  useEffect(() => {
    selectedIdsRef.current = selectedIds
  }, [selectedIds])
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // --- Hooks ---
  const { undo, redo, pushToHistory, canUndo, canRedo } = useBoardHistory(elements, setElements)

  const {
    viewport,
    setViewport,
    isGrabbing,
    onPointerDown: onNavPointerDown,
    isNavigatingRef
  } = useBoardNavigation(containerRef, mode, isSpaceDown)

  // Keep a viewport ref for stable callbacks
  const viewportRef = useRef(viewport)
  useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

  const { handleDrop } = useBoardAssets({
    boardId,
    boardDir,
    boardFileName,
    viewport,
    containerRef,
    setElements,
    pushToHistory
  })

  const {
    activePath,
    activeRect,
    onPointerDown: onToolPointerDown,
    handleTextCreation
  } = useBoardTools({
    mode,
    setMode,
    viewport,
    penColor,
    penSize,
    eraserSize,
    textSize,
    setElements,
    setSelectedIds,
    setEditingTextId,
    pushToHistory,
    containerRef
  })
  const { selectionRect, selectionStartPos, handleElementSelect, alignElements } =
    useBoardSelection({
      elements,
      viewport,
      setSelectedIds,
      containerRef,
      pushToHistory,
      setElements,
      selectedIds
    })

  const {
    handleElementMove,
    handleElementResize,
    handleElementRotate,
    groupElements,
    ungroupElements,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    duplicateElements,
    copyElements,
    pasteElements,
    arrangeAsGrid
  } = useBoardInteractions({
    elements,
    setElements,
    selectedIds,
    setSelectedIds,
    pushToHistory
  })

  // --- Stable callbacks (use refs to avoid dependency on viewport/elements) ---

  /** Save: reads from refs, so it never changes identity. */
  const handleManualSave = useCallback((): void => {
    const dataStr = JSON.stringify({
      elements: elementsRef.current,
      viewport: viewportRef.current
    })
    lastPushedDataRef.current = dataStr
    onChangeRef.current(dataStr)
    setIsSavedFlash(true)
    setTimeout(() => setIsSavedFlash(false), 2000)
  }, []) // ← stable! No viewport/elements dependency.

  const deleteSelected = useCallback((): void => {
    if (selectedIds.length > 0) {
      pushToHistory()
      setElements((prev) => prev.filter((el) => !selectedIds.includes(el.id)))
      setSelectedIds([])
    }
  }, [selectedIds, pushToHistory, setElements])

  /** Fit viewport to show all elements or just selected ones */
  const fitToContent = useCallback((): void => {
    const els = elementsRef.current
    if (els.length === 0) return

    const selectedIds = selectedIdsRef.current
    const targetEls = selectedIds.length > 0 
      ? els.filter((el) => selectedIds.includes(el.id))
      : els
      
    if (targetEls.length === 0) return

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    targetEls.forEach((el) => {
      const w = el.width || 0
      const h = el.height || 0
      minX = Math.min(minX, el.x - w / 2)
      minY = Math.min(minY, el.y - h / 2)
      maxX = Math.max(maxX, el.x + w / 2)
      maxY = Math.max(maxY, el.y + h / 2)
    })

    const contentW = maxX - minX
    const contentH = maxY - minY
    if (contentW <= 0 || contentH <= 0) return

    const centerX = minX + contentW / 2
    const centerY = minY + contentH / 2

    const dims = prevDimsRef.current
    const screenW = dims.width > 0 ? dims.width : window.innerWidth
    const screenH = dims.height > 0 ? dims.height : window.innerHeight

    const padding = 80
    const scaleX = (screenW - padding * 2) / contentW
    const scaleY = (screenH - padding * 2) / contentH
    const newScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.05), 2)

    const newX = screenW / 2 - centerX * newScale
    const newY = screenH / 2 - centerY * newScale

    setViewport({ x: newX, y: newY, scale: newScale })
  }, [setViewport])

  // --- Effects ---

  // Initial Data Load
  useEffect(() => {
    if (boardData && boardData === lastPushedDataRef.current) return
    if (!boardData) return
    try {
      const parsed = JSON.parse(boardData)
      if (parsed && typeof parsed === 'object') {
        const rawEls = Array.isArray(parsed.elements)
          ? parsed.elements
          : Array.isArray(parsed)
            ? parsed
            : []
        const cleanElements = rawEls.map((el: BoardElement) => ({ ...el, isProcessing: false }))

        // Set elements and viewport synchronously
        setElements((prev) => {
          if (prev.length === 0 && cleanElements.length === 0) return prev
          return cleanElements
        })

        if (parsed.viewport) {
          setViewport(parsed.viewport)

          // Auto-fit: detect if saved viewport doesn't show ANY elements
          if (cleanElements.length > 0) {
            const vp = parsed.viewport
            const invScale = 1 / Math.max(0.0001, vp.scale)
            const sw = (window.innerWidth || 1920) * invScale
            const sh = (window.innerHeight || 1080) * invScale
            const wx = -vp.x * invScale
            const wy = -vp.y * invScale
            const margin = 1000

            const anyVisible = cleanElements.some((el: BoardElement) => {
              const hw = (el.width || 0) / 2
              const hh = (el.height || 0) / 2
              return (
                el.x + hw >= wx - margin &&
                el.x - hw <= wx + sw + margin &&
                el.y + hh >= wy - margin &&
                el.y - hh <= wy + sh + margin
              )
            })

            if (!anyVisible) {
              console.warn('[BoardsView] No elements visible at saved viewport — auto-fitting to content.')
              // Schedule fit after state settles
              requestAnimationFrame(() => {
                elementsRef.current = cleanElements
                fitToContent()
              })
            }
          }
        } else if (cleanElements.length > 0) {
          // No viewport saved — fit to content
          requestAnimationFrame(() => {
            elementsRef.current = cleanElements
            fitToContent()
          })
        }
      }
    } catch {
      console.error('Failed to parse board data')
    }
  }, [boardData, setViewport, fitToContent])

  // Mark dirty on any change
  useEffect(() => {
    isDirtyRef.current = true
  }, [elements.length, viewport])

  // Autosave (uses refs → stable, never re-creates the interval)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isDirtyRef.current) return
      const els = elementsRef.current.map(({ isProcessing: _ip, ...rest }) => rest)
      const dataStr = JSON.stringify({ elements: els, viewport: viewportRef.current })
      if (dataStr !== lastPushedDataRef.current) {
        lastPushedDataRef.current = dataStr
        onChangeRef.current(dataStr)
        isDirtyRef.current = false
      }
    }, 10000)
    return () => {
      clearInterval(interval)
      // CRITICAL: Save viewport + elements on unmount (note switch, etc)
      const els = elementsRef.current.map(({ isProcessing: _ip, ...rest }) => rest)
      const dataStr = JSON.stringify({ elements: els, viewport: viewportRef.current })
      if (dataStr !== lastPushedDataRef.current) {
        lastPushedDataRef.current = dataStr
        onChangeRef.current(dataStr)
      }
    }
  }, [])

  // Resize Observer
  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Round to ignore sub-pixel jitter
        const newW = Math.round(entry.contentRect.width)
        const newH = Math.round(entry.contentRect.height)
        const prev = prevDimsRef.current

        if (prev.width > 0 && prev.height > 0) {
          const dw = newW - prev.width
          const dh = newH - prev.height
          // Only update if difference is at least 1 pixel
          if (Math.abs(dw) >= 1 || Math.abs(dh) >= 1) {
            setViewport((vp) => ({ ...vp, x: vp.x + dw / 2, y: vp.y + dh / 2 }))
            prevDimsRef.current = { width: newW, height: newH }
            setDimensions({ width: newW, height: newH })
          }
        } else {
          // First time initialization
          prevDimsRef.current = { width: newW, height: newH }
          setDimensions({ width: newW, height: newH })
        }
      }
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [setViewport, containerEl])

  // Global Keys (now stable because handleManualSave is stable)
  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
        e.preventDefault()
        handleManualSave()
      }
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyZ' || e.code === 'KeyY')) {
        if (isBoardActiveRef.current) {
          e.preventDefault()
          e.stopImmediatePropagation()
          if (e.code === 'KeyZ') {
            if (e.shiftKey) redo()
            else undo()
          } else {
            redo()
          }
        }
      }
      const isInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')
      if (e.code === 'Space' || e.key === ' ') {
        if (!isInput) {
          e.preventDefault()
          setIsSpaceDown(true)
          if (isNavigatingRef.current !== undefined) isNavigatingRef.current = true
          window.dispatchEvent(new CustomEvent('cancel-element-drag'))
        }
      }
      if (!isInput) {
        if (e.code === 'KeyV') setMode('select')
        if (e.code === 'KeyH') setMode('hand')
        if (e.code === 'KeyP') setMode('pen')
        if (e.code === 'KeyR') setMode('rect')
        if (e.code === 'KeyE') setMode('eraser')
        if (e.code === 'KeyT') setMode('text')
        if (e.code === 'KeyF') fitToContent()
        if (e.code === 'Delete' || e.code === 'Backspace') {
          e.preventDefault()
          deleteSelected()
        }

        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') {
          e.preventDefault()
          copyElements()
        }
        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV' && mode === 'select') {
          e.preventDefault()
          pasteElements()
        }
        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyD') {
          e.preventDefault()
          duplicateElements()
        }
        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyG') {
          e.preventDefault()
          if (e.shiftKey) ungroupElements()
          else groupElements()
        }
      }
    }
    const up = (e: KeyboardEvent): void => {
      if (e.code === 'Space' || e.key === ' ') {
        setIsSpaceDown(false)
        if (mode !== 'hand' && isNavigatingRef.current !== undefined) {
          isNavigatingRef.current = false
        }
      }
    }
    window.addEventListener('keydown', down, { capture: true })
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down, { capture: true })
      window.removeEventListener('keyup', up)
    }
  }, [
    undo,
    redo,
    deleteSelected,
    mode,
    handleManualSave,
    isNavigatingRef,
    copyElements,
    pasteElements,
    duplicateElements,
    groupElements,
    ungroupElements,
    fitToContent
  ])

  // --- Event Handlers ---
  const handleMouseDown = useCallback((e: React.MouseEvent): void => {
    isBoardActiveRef.current = true
    setContextMenuPos(null)
    
    // Auto-hide settings if not pinned
    if (!isSettingsPinned) {
      setShowPenSettings(false)
      setShowEraserSettings(false)
      setShowColorPicker(false)
    }

    onNavPointerDown(e)
    if (isNavigatingRef.current === false) onToolPointerDown(e)
  }, [onNavPointerDown, onToolPointerDown, isNavigatingRef, isSettingsPinned])

  const handleDoubleClick = useCallback((e: React.MouseEvent): void => {
    if (Date.now() - lastElementDoubleClickTime.current < 500) return
    if (e.button === 0 && mode === 'text') {
      const target = e.target as HTMLElement
      if (target.closest('[data-context-menu]') || target.closest('.ui-layer') || target.tagName === 'TEXTAREA') return
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        const vp = viewportRef.current
        const x = (e.clientX - rect.left - vp.x) / vp.scale
        const y = (e.clientY - rect.top - vp.y) / vp.scale
        handleTextCreation(x, y)
      }
    }
  }, [mode, handleTextCreation])

  // Stable callback for onDoubleClick on element
  const handleElementDoubleClick = useCallback((id: string): void => {
    lastElementDoubleClickTime.current = Date.now()
    pushToHistory()
    setEditingTextId(id)
  }, [pushToHistory])

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
        cursor: isGrabbing
          ? 'grabbing'
          : (isSpaceDown || mode === 'hand')
            ? 'grab'
            : mode === 'eraser'
              ? 'none'
              : 'default'
      }}
      ref={(el) => {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el
        setContainerEl(el)
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onMouseLeave={() => {
        if (isNavigatingRef.current !== undefined) isNavigatingRef.current = false
      }}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onContextMenu={(e) => {
        e.preventDefault()
        if (!containerRef.current) return
        const board = containerRef.current.getBoundingClientRect()
        setContextMenuPos({ x: e.clientX - board.left, y: e.clientY - board.top })
      }}
    >
      <Toolbar
        mode={mode}
        setMode={setMode}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onSave={handleManualSave}
        isSavedFlash={isSavedFlash}
        showColorPicker={showColorPicker}
        setShowColorPicker={setShowColorPicker}
        setPickerAnchor={handleSetPickerAnchor}
        setShowPenSettings={setShowPenSettings}
        setShowEraserSettings={setShowEraserSettings}
        setPenSettingsAnchor={handleSetPenSettingsAnchor}
        setEraserSettingsAnchor={handleSetEraserSettingsAnchor}
        deleteSelected={deleteSelected}
        selectedIdsCount={selectedIds.length}
        onFitToContent={fitToContent}
        hasElements={elements.length > 0}
        isSettingsPinned={isSettingsPinned}
        penSize={penSize}
        setPenSize={setPenSize}
        eraserSize={eraserSize}
        setEraserSize={setEraserSize}
        textSize={textSize}
        setTextSize={setTextSize}
      />

      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {containerEl && dimensions.width > 0 && dimensions.height > 0 && (
          <Application
            // @ts-ignore - resizeTo prop for @pixi/react
            resizeTo={containerEl}
            background={theme?.boardBg || '#1b1b1b'}
            antialias={false}
            resolution={window.devicePixelRatio || 1}
            autoDensity={true}
            powerPreference="high-performance"
            // @ts-ignore - explicitly start the ticker to ensure initial elements render
            onMount={(app) => {
              if (app && app.ticker) {
                app.ticker.start()
              }
            }}
          >
            <BoardContent
              containerRef={containerRef}
              elements={elements}
              activePath={activePath}
              activeRect={activeRect}
              penColor={penColor}
              penSize={penSize}
              viewport={viewport}
              selectedIds={selectedIds}
              onSelect={setSelectedIds}
              onElementSelect={handleElementSelect}
              selectionStartPos={selectionStartPos}
              onMove={handleElementMove}
              onResize={handleElementResize}
              onRotate={handleElementRotate}
              onInteractionStart={() => {
                pushToHistory()
                setContextMenuPos(null)
              }}
              onDoubleClick={handleElementDoubleClick}
              editingTextId={editingTextId}
              mode={mode}
              screenWidth={dimensions.width}
              screenHeight={dimensions.height}
              theme={theme}

              isSpaceDown={isSpaceDown}
              lastElementDoubleClickTime={lastElementDoubleClickTime}
              guidesRef={snappingGuidesRef}
              dragContextRef={dragContextRef}
              isNavigatingRef={isNavigatingRef}
            />
          </Application>
        )}
        <StatsMonitor showFPS={showFPS} containerRef={containerRef} />
      </div>

      <EditorOverlays
        editingTextId={editingTextId}
        elements={elements}
        viewport={viewport}
        setElements={setElements}
        setEditingTextId={setEditingTextId}
        selectionRect={selectionRect}
        showPenSettings={showPenSettings}
        penSettingsAnchor={penSettingsAnchor}
        mode={mode}
        textSize={textSize}
        setTextSize={setTextSize}
        penSize={penSize}
        setPenSize={setPenSize}
        penColor={penColor}
        setPenColor={setPenColor}
        selectedIds={selectedIds}
        showEraserSettings={showEraserSettings}
        eraserSettingsAnchor={eraserSettingsAnchor}
        eraserSize={eraserSize}
        setEraserSize={setEraserSize}
        pushToHistory={pushToHistory}
        isSettingsPinned={isSettingsPinned}
        setIsSettingsPinned={setIsSettingsPinned}
      />

      <BoardBottomBar 
        elementsCount={elements.length} 
        scale={viewport.scale} 
        isSyncing={isSyncing} 
        processingCount={processingCount} 
      />

      <div style={{ position: 'absolute', top: '24px', right: '24px', zIndex: 1100, display: 'flex', gap: '8px' }}>
        <button
          onClick={() => setShowLayers(!showLayers)}
          style={{
            background: showLayers ? 'var(--accent)' : 'var(--card-bg)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            padding: '8px',
            color: '#fff',
            cursor: 'pointer'
          }}
        >
          <Layers size={18} />
        </button>
      </div>

      <LayersPanel
        elements={elements}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        expandedGroups={expandedGroups}
        setExpandedGroups={setExpandedGroups}
        showLayers={showLayers}
      />

      {contextMenuPos && selectedIds.length > 0 && (
        <SelectionMenu
          selectedIds={selectedIds}
          position={contextMenuPos}
          alignElements={alignElements}
          arrangeAsGrid={arrangeAsGrid}
          groupElements={groupElements}
          ungroupElements={ungroupElements}
          bringToFront={bringToFront}
          sendToBack={sendToBack}
          bringForward={bringForward}
          sendBackward={sendBackward}
          duplicateElements={duplicateElements}
          copyElements={copyElements}
          pasteElements={pasteElements}
          deleteElements={deleteSelected}
          onClose={() => setContextMenuPos(null)}
        />
      )}

      {showColorPicker && pickerAnchor && (
        <div
          style={{
            position: 'absolute',
            zIndex: 10000,
            top: pickerAnchor.bottom + 10,
            left: pickerAnchor.left,
            background: 'var(--card-bg)',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            width: '260px',
            userSelect: 'none'
          }}
        >
          <ColorPicker
            color={theme?.boardBg || '#1b1b1b'}
            onChange={(c) => setTheme && setTheme({ ...theme!, boardBg: c })}
            onClose={() => setShowColorPicker(false)}
            inline={true}
          />
        </div>
      )}
    </div>
  )
}

export default BoardsView
