import React, { useState, useCallback, useRef, useEffect, useMemo, useLayoutEffect } from 'react'
import { Application, extend, useApplication, useTick } from '@pixi/react'
import * as PIXI from 'pixi.js'
import { nanoid } from 'nanoid'
import {
  MousePointer2,
  Trash2,
  Palette,
  Save,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  LayoutGrid,
  Layers,
  Layers2,
  Copy,
  ClipboardPaste,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowUp,
  ArrowDown,
  CopyPlus,
  Image as ImageIcon,
  Video as VideoIcon,
  Link as LinkIcon,
  Undo2,
  Redo2,
  Lock,
  Pen,
  Square,
  Eraser,
  Group,
  Type,
  Check
} from 'lucide-react'
import Stats from 'stats.js'
import ColorPicker from '../ColorPicker'

import { UITheme } from '../../types'

// Register PIXI components for @pixi/react v8
// eslint-disable-next-line @typescript-eslint/no-explicit-any
extend(PIXI as any)

export interface BoardElement {
  id: string
  type: 'image' | 'video' | 'link' | 'path' | 'rect' | 'text'
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  url: string // For 'image' | 'video' | 'link'
  title?: string // For 'link'
  // For 'path'
  points?: { x: number; y: number; width?: number }[]
  size?: number
  color?: string
  // For 'rect'
  strokeColor?: string
  strokeWidth?: number
  groupId?: string
  // For 'text'
  text?: string
  fontSize?: number
  fontWeight?: number
  textAlign?: 'left' | 'center' | 'right'
}

// Utility to simplify a path using Ramer-Douglas-Peucker algorithm
// Helps remove jitter and unnecessary points while maintaining shape
const simplifyPath = (
  points: { x: number; y: number; width?: number }[],
  epsilon: number = 1
): { x: number; y: number; width?: number }[] => {
  if (points.length <= 2) return points

  const findMaxDistance = (
    pts: { x: number; y: number; width?: number }[],
    start: number,
    end: number
  ): { index: number; distance: number } => {
    let maxDist = 0
    let index = 0
    const pStart = pts[start]
    const pEnd = pts[end]

    for (let i = start + 1; i < end; i++) {
      const p = pts[i]
      // Distance from point to line segment
      const area = Math.abs(
        0.5 * (pStart.x * (pEnd.y - p.y) + pEnd.x * (p.y - pStart.y) + p.x * (pStart.y - pEnd.y))
      )
      const bottom = Math.sqrt(Math.pow(pStart.x - pEnd.x, 2) + Math.pow(pStart.y - pEnd.y, 2))
      const dist = (area / bottom) * 2

      if (dist > maxDist) {
        maxDist = dist
        index = i
      }
    }
    return { index, distance: maxDist }
  }

  const simplify = (
    pts: { x: number; y: number; width?: number }[],
    start: number,
    end: number
  ): { x: number; y: number; width?: number }[] => {
    const { index, distance } = findMaxDistance(pts, start, end)
    if (distance > epsilon) {
      const left = simplify(pts, start, index)
      const right = simplify(pts, index, end)
      return [...left.slice(0, -1), ...right]
    } else {
      return [pts[start], pts[end]]
    }
  }

  return simplify(points, 0, points.length - 1)
}

// Utility to find intersection points between a line segment (p1 to p2) and a circle
const getCircleLineIntersection = (
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  center: { x: number; y: number },
  radius: number
): { x: number; y: number }[] => {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const fx = p1.x - center.x
  const fy = p1.y - center.y

  const a = dx * dx + dy * dy
  const b = 2 * (fx * dx + fy * dy)
  const c = fx * fx + fy * fy - radius * radius

  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) return []

  const sqrtD = Math.sqrt(discriminant)
  const t1 = (-b - sqrtD) / (2 * a)
  const t2 = (-b + sqrtD) / (2 * a)

  const results: { x: number; y: number }[] = []
  if (t1 >= 0 && t1 <= 1) {
    results.push({ x: p1.x + t1 * dx, y: p1.y + t1 * dy })
  }
  if (t2 >= 0 && t2 <= 1) {
    results.push({ x: p1.x + t2 * dx, y: p1.y + t2 * dy })
  }
  return results
}

// Utility to parse hex colors for PIXI (handles #fff and #ffffff)
const parseColor = (color?: string): number => {
  if (!color) return 0xffffff
  const hex = color.replace('#', '')
  if (hex.length === 3) {
    return parseInt(
      hex
        .split('')
        .map((c) => c + c)
        .join(''),
      16
    )
  }
  return parseInt(hex, 16) || 0xffffff
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

type AlignmentDirection = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'

interface SelectionMenuProps {
  selectedIds: string[]
  position: { x: number; y: number }
  alignElements: (dir: AlignmentDirection) => void
  arrangeAsGrid: () => void
  groupElements: () => void
  ungroupElements: () => void
  bringToFront: () => void
  sendToBack: () => void
  bringForward: () => void
  sendBackward: () => void
  duplicateElements: () => void
  copyElements: () => void
  pasteElements: () => void
  deleteElements: () => void
  onClose: () => void
}

const SelectionMenu: React.FC<SelectionMenuProps> = ({
  selectedIds,
  position,
  alignElements,
  arrangeAsGrid,
  groupElements,
  ungroupElements,
  bringToFront,
  sendToBack,
  bringForward,
  sendBackward,
  duplicateElements,
  copyElements,
  pasteElements,
  deleteElements,
  onClose
}) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const [adjustedPos, setAdjustedPos] = useState({ x: -1000, y: -1000 })

  useLayoutEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const screenWidth = window.innerWidth
      const screenHeight = window.innerHeight

      let newX = position.x
      let newY = position.y

      if (newX + rect.width > screenWidth) {
        newX = screenWidth - rect.width - 12
      }
      if (newY + rect.height > screenHeight) {
        newY = screenHeight - rect.height - 12
      }

      const finalX = Math.max(12, newX)
      const finalY = Math.max(12, newY)

      if (finalX !== adjustedPos.x || finalY !== adjustedPos.y) {
        setAdjustedPos({ x: finalX, y: finalY })
      }
    }
  }, [position, adjustedPos.x, adjustedPos.y])

  const menuIconStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: '#999',
    padding: '5px',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
  }

  const menuButtonStyle = (disabled: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '5px 10px',
    background: 'transparent',
    border: 'none',
    color: disabled ? '#444' : '#ccc',
    fontSize: '11px',
    textAlign: 'left' as const,
    cursor: disabled ? 'default' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    borderRadius: '8px',
    fontWeight: '500',
    transition: 'background 0.2s'
  })

  // Mouse event handlers for buttons
  const onBtnEnter = (e: React.MouseEvent<HTMLButtonElement>): void => {
    if (!e.currentTarget.disabled) {
      e.currentTarget.style.background = '#333'
      e.currentTarget.style.color = '#fff'
    }
  }
  const onBtnLeave = (e: React.MouseEvent<HTMLButtonElement>): void => {
    e.currentTarget.style.background = 'transparent'
    e.currentTarget.style.color = e.currentTarget.disabled ? '#444' : '#999'
  }

  const alignOptions = useMemo(
    () => [
      { id: 'left', icon: AlignLeft, dir: 'left' as const },
      { id: 'center', icon: AlignCenter, dir: 'center' as const },
      { id: 'right', icon: AlignRight, dir: 'right' as const },
      { id: 'top', icon: AlignVerticalJustifyStart, dir: 'top' as const },
      { id: 'middle', icon: AlignVerticalJustifyCenter, dir: 'middle' as const },
      { id: 'bottom', icon: AlignVerticalJustifyEnd, dir: 'bottom' as const }
    ],
    []
  )

  const orderOptions = useMemo(
    () => [
      { id: 'front', icon: ArrowUpToLine, action: bringToFront, label: 'Bring to Front' },
      { id: 'back', icon: ArrowDownToLine, action: sendToBack, label: 'Send to Back' },
      { id: 'forward', icon: ArrowUp, action: bringForward, label: 'Bring Forward' },
      { id: 'backward', icon: ArrowDown, action: sendBackward, label: 'Send Backward' }
    ],
    [bringToFront, sendToBack, bringForward, sendBackward]
  )

  const editOptions = useMemo(
    () => [
      { id: 'duplicate', icon: CopyPlus, label: 'Duplicate', action: duplicateElements },
      { id: 'copy', icon: Copy, label: 'Copy', action: copyElements },
      { id: 'delete', icon: Trash2, label: 'Delete', action: deleteElements, danger: true }
    ],
    [duplicateElements, copyElements, deleteElements]
  )

  const actionOptions = useMemo(
    () => [
      { id: 'grid', icon: LayoutGrid, label: 'Arrange as Grid', action: arrangeAsGrid },
      {
        id: 'group',
        icon: Layers,
        label: 'Group',
        action: groupElements,
        disabled: selectedIds.length < 2
      },
      { id: 'ungroup', icon: Layers2, label: 'Ungroup', action: ungroupElements }
    ],
    [arrangeAsGrid, groupElements, ungroupElements, selectedIds.length]
  )

  return (
    <div
      ref={menuRef}
      data-context-menu="true"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: adjustedPos.y,
        left: adjustedPos.x,
        background: 'var(--card-bg)',
        borderRadius: '14px',
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        zIndex: 2000,
        width: '200px',
        pointerEvents: 'auto',
        visibility: adjustedPos.x === -1000 ? 'hidden' : 'visible'
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {selectedIds.length > 0 && (
        <>
          <div style={{ color: '#666', fontSize: '10px', fontWeight: '800', paddingLeft: '4px' }}>
            ALIGN
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
            {alignOptions.map((btn) => (
              <button
                key={btn.id}
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  alignElements(btn.dir)
                  onClose()
                }}
                style={menuIconStyle}
                onMouseEnter={onBtnEnter}
                onMouseLeave={onBtnLeave}
              >
                <btn.icon size={18} />
              </button>
            ))}
          </div>

          <div style={{ height: '1px', background: '#333', margin: '0 -4px' }} />

          <div style={{ color: '#666', fontSize: '10px', fontWeight: '800', paddingLeft: '4px' }}>
            ORDER
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
            {orderOptions.map((btn) => (
              <button
                key={btn.id}
                onClick={(e) => {
                  e.stopPropagation()
                  btn.action()
                  onClose()
                }}
                style={menuIconStyle}
                onMouseEnter={onBtnEnter}
                onMouseLeave={onBtnLeave}
                title={btn.label}
              >
                <btn.icon size={18} />
              </button>
            ))}
          </div>

          <div style={{ height: '1px', background: '#333', margin: '0 -4px' }} />

          <div style={{ color: '#666', fontSize: '10px', fontWeight: '800', paddingLeft: '4px' }}>
            EDIT
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {editOptions.map((btn) => (
              <button
                key={btn.id}
                onClick={(e) => {
                  e.stopPropagation()
                  btn.action()
                  onClose()
                }}
                style={menuButtonStyle(false)}
                onMouseEnter={onBtnEnter}
                onMouseLeave={onBtnLeave}
              >
                <btn.icon size={16} />
                <span style={{ color: btn.danger ? '#ff5252' : 'inherit' }}>{btn.label}</span>
              </button>
            ))}
            <button
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                pasteElements()
                onClose()
              }}
              style={menuButtonStyle(false)}
              onMouseEnter={onBtnEnter}
              onMouseLeave={onBtnLeave}
            >
              <ClipboardPaste size={16} />
              <span>Paste</span>
            </button>
          </div>

          <div style={{ height: '1px', background: '#333', margin: '0 -4px' }} />
        </>
      )}

      <div style={{ color: '#666', fontSize: '10px', fontWeight: '800', paddingLeft: '4px' }}>
        ARRANGE
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {actionOptions.map((btn) => (
          <button
            key={btn.id}
            onClick={(e) => {
              e.stopPropagation()
              btn.action()
              onClose()
            }}
            disabled={btn.disabled}
            style={menuButtonStyle(!!btn.disabled)}
            onMouseEnter={onBtnEnter}
            onMouseLeave={onBtnLeave}
          >
            <btn.icon size={16} />
            <span>{btn.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
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
  const [mode, setMode] = useState<'select' | 'hand' | 'pen' | 'rect' | 'eraser' | 'text'>('select')
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [selectionRect, setSelectionRect] = useState<{
    x: number
    y: number
    w: number
    h: number
  } | null>(null)
  const selectionStartPos = useRef<{ x: number; y: number } | null>(null)

  const [showColorPicker, setShowColorPicker] = useState(false)
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null)

  // Pen and shape tools
  const [activePath, setActivePath] = useState<{ x: number; y: number; width?: number }[] | null>(
    null
  )
  const [activeRect, setActiveRect] = useState<{
    x: number
    y: number
    w: number
    h: number
  } | null>(null)
  const activePathRef = useRef<{ x: number; y: number; width?: number }[] | null>(null)
  const activeRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null)
  const snappingAnchor = useRef<{ x: number; y: number } | null>(null)
  const lastPathPoint = useRef<{ x: number; y: number } | null>(null)
  const isErasing = useRef(false)

  useEffect(() => {
    activePathRef.current = activePath
  }, [activePath])

  useEffect(() => {
    activeRectRef.current = activeRect
  }, [activeRect])

  const [penColor, setPenColor] = useState('#ffffff')
  const [penSize, setPenSize] = useState(4)
  const [textSize, setTextSize] = useState(32)
  const [showPenSettings, setShowPenSettings] = useState(false)
  const [penSettingsAnchor, setPenSettingsAnchor] = useState<DOMRect | null>(null)

  const [eraserSize, setEraserSize] = useState(24)
  const [expandedGroups, setExpandedGroups] = useState<string[]>([])
  const [showEraserSettings, setShowEraserSettings] = useState(false)
  const [eraserSettingsAnchor, setEraserSettingsAnchor] = useState<DOMRect | null>(null)

  const [isSavedFlash, setIsSavedFlash] = useState(false)
  const isBoardActiveRef = useRef(false)
  const lastElementDoubleClickTime = useRef<number>(0)
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [showLayers, setShowLayers] = useState(false)
  const snappingGuidesRef = useRef<{ x?: number; y?: number }[]>([])
  const dragContextRef = useRef<{
    movers: { index: number; id: string; offsetX: number; offsetY: number }[]
    targets: BoardElement[]
    lastId: string | null
  } | null>(null)

  const clipboardRef = useRef<BoardElement[]>([])

  // Clear selection when switching AWAY from select tool
  useEffect(() => {
    if (mode !== 'select') {
      setSelectedIds([])
    }
  }, [mode])

  useEffect(() => {
    const handleGlobalDown = (e: MouseEvent): void => {
      const target = e.target as HTMLElement
      // If clicking inside menu, layers panel or toolbar, don't close
      const isPicker = target.closest('[data-context-menu]')
      const isToolbar = target.closest('.tool-btn')

      if (isPicker || isToolbar) return

      if (contextMenuPos) setContextMenuPos(null)
      // Layers panel now only toggles via its button
      if (showColorPicker) setShowColorPicker(false)
      if (showPenSettings) setShowPenSettings(false)
      if (showEraserSettings) setShowEraserSettings(false)
    }
    window.addEventListener('mousedown', handleGlobalDown)
    return () => window.removeEventListener('mousedown', handleGlobalDown)
  }, [contextMenuPos, showLayers, showColorPicker, showPenSettings, showEraserSettings])

  const containerRef = useRef<HTMLDivElement>(null)
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const prevDimsRef = useRef({ width: 0, height: 0 })

  // History system
  const historyPast = useRef<BoardElement[][]>([])
  const historyFuture = useRef<BoardElement[][]>([])

  const pushToHistory = useCallback(() => {
    const currentState = JSON.stringify(elements)
    // Only push if different from last entry to avoid repetitive clicks clogging history
    if (historyPast.current.length > 0) {
      const lastEntry = JSON.stringify(historyPast.current[historyPast.current.length - 1])
      if (currentState === lastEntry) return
    }

    historyPast.current.push(JSON.parse(currentState))
    if (historyPast.current.length > 50) historyPast.current.shift()
    historyFuture.current = [] // clear redo stack on new action
    setCanUndo(true)
    setCanRedo(false)
  }, [elements])

  useEffect(() => {
    setCanUndo(historyPast.current.length > 0)
    setCanRedo(historyFuture.current.length > 0)
  }, [elements])

  const lastPushedDataRef = useRef<string | null>(null)

  // Initial load or async prop sync
  useEffect(() => {
    // If the boardData coming in is exactly what we just pushed, ignore it to prevent loop
    if (boardData && boardData === lastPushedDataRef.current) return
    if (!boardData) return // Don't wipe if data is missing

    try {
      const parsed = JSON.parse(boardData)
      if (parsed && typeof parsed === 'object') {
        if (parsed.elements && Array.isArray(parsed.elements)) {
          setElements(parsed.elements)
          if (parsed.viewport) {
            const vp = parsed.viewport
            let newScale = typeof vp.scale === 'number' && !isNaN(vp.scale) ? vp.scale : 1
            if (newScale <= 0) newScale = 1
            setViewport({
              x: typeof vp.x === 'number' && !isNaN(vp.x) ? vp.x : 0,
              y: typeof vp.y === 'number' && !isNaN(vp.y) ? vp.y : 0,
              scale: newScale
            })
          }
        } else if (Array.isArray(parsed)) {
          // Legacy format (just an array of elements)
          setElements(parsed)
        }
      } else if (boardData === '[]') {
        setElements([])
      }
    } catch {
      // If it's not JSON, might be empty or corrupted, don't wipe state unless explicit
      console.error('Failed to parse board data')
    }
  }, [boardData, elements]) // Trigger whenever boardData prop changes from outside

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const elementsRef = useRef(elements)
  const viewportRef = useRef(viewport)

  useEffect(() => {
    elementsRef.current = elements
  }, [elements])

  useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const dataStr = JSON.stringify({
      elements,
      viewport
    })

    // Skip if data is same as last pushed (breaks loops and stops idle saving)
    if (dataStr === lastPushedDataRef.current) return

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const currentDataStr = JSON.stringify({
        elements: elementsRef.current,
        viewport: viewportRef.current
      })
      lastPushedDataRef.current = currentDataStr
      onChangeRef.current(currentDataStr)
    }, 1000) // 1s sync for position/zoom

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [elements, viewport])

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
            setViewport((vp) => ({
              ...vp,
              x: vp.x + dw / 2,
              y: vp.y + dh / 2
            }))
          }
        }

        prevDimsRef.current = { width: newW, height: newH }
        setDimensions({ width: newW, height: newH })
      }
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const [isSpaceDown, setIsSpaceDown] = useState(false)
  const [isAltDown, setIsAltDown] = useState(false)
  const [isGrabbing, setIsGrabbing] = useState(false)
  const isZooming = useRef(false)
  const zoomCenter = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const handleGlobalMouseDown = (e: MouseEvent): void => {
      const isClickInside = containerRef.current?.contains(e.target as Node)
      isBoardActiveRef.current = !!isClickInside
    }
    window.addEventListener('mousedown', handleGlobalMouseDown)
    return () => window.removeEventListener('mousedown', handleGlobalMouseDown)
  }, [])

  const handleUndo = useCallback((): void => {
    if (historyPast.current.length === 0) return
    const previous = historyPast.current.pop()!
    historyFuture.current.push(JSON.parse(JSON.stringify(elements)))
    setElements(previous)
    setCanUndo(historyPast.current.length > 0)
    setCanRedo(true)
  }, [elements])

  const handleRedo = useCallback((): void => {
    if (historyFuture.current.length === 0) return
    const next = historyFuture.current.pop()!
    historyPast.current.push(JSON.parse(JSON.stringify(elements)))
    setElements(next)
    setCanRedo(historyFuture.current.length > 0)
    setCanUndo(true)
  }, [elements])

  const handleManualSave = useCallback(() => {
    const dataStr = JSON.stringify({ elements, viewport })
    lastPushedDataRef.current = dataStr
    onChange(dataStr)
    setIsSavedFlash(true)
    setTimeout(() => setIsSavedFlash(false), 2000)
  }, [elements, viewport, onChange])

  const focusOnElements = useCallback(
    (targetIds?: string[]) => {
      const targetElements =
        targetIds && targetIds.length > 0
          ? elements.filter((el) => targetIds.includes(el.id))
          : elements

      if (targetElements.length === 0) return

      // Calculate bounding box
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity

      targetElements.forEach((el) => {
        const left = el.x - el.width / 2
        const top = el.y - el.height / 2
        const right = el.x + el.width / 2
        const bottom = el.y + el.height / 2

        if (left < minX) minX = left
        if (top < minY) minY = top
        if (right > maxX) maxX = right
        if (bottom > maxY) maxY = bottom
      })

      const contentWidth = maxX - minX
      const contentHeight = maxY - minY

      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      const padding = 60 // px
      const availableWidth = rect.width - padding * 2
      const availableHeight = rect.height - padding * 2

      const scaleX = availableWidth / contentWidth
      const scaleY = availableHeight / contentHeight
      const newScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.05), 5)

      const centerX = minX + contentWidth / 2
      const centerY = minY + contentHeight / 2

      const newViewportX = rect.width / 2 - centerX * newScale
      const newViewportY = rect.height / 2 - centerY * newScale

      setViewport({
        x: newViewportX,
        y: newViewportY,
        scale: newScale
      })
    },
    [elements]
  )

  const deleteSelected = useCallback((): void => {
    if (selectedIds.length > 0) {
      pushToHistory()
      setElements((prev) => prev.filter((el) => !selectedIds.includes(el.id)))
      setSelectedIds([])
    }
  }, [selectedIds, pushToHistory])

  const focusRef = useRef(focusOnElements)
  useEffect(() => {
    focusRef.current = focusOnElements
  }, [focusOnElements])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
        e.preventDefault()
        handleManualSave()
      }

      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyZ' || e.code === 'KeyY')) {
        if (isBoardActiveRef.current) {
          e.preventDefault()
          e.stopImmediatePropagation()
          if (e.code === 'KeyZ') {
            if (e.shiftKey) handleRedo()
            else handleUndo()
          } else {
            handleRedo()
          }
        }
      }

      const activeTag = document.activeElement?.tagName
      const isInput = activeTag === 'INPUT' || activeTag === 'TEXTAREA'

      if (e.code === 'Space' || e.key === ' ') {
        if (!isInput) {
          e.preventDefault()
          setIsSpaceDown(true)
        }
      }

      if (!isInput) {
        if (e.code === 'KeyF') {
          e.preventDefault()
          focusRef.current(selectedIds)
        }
        if (e.code === 'KeyV') setMode('select')
        if (e.code === 'KeyH') setMode('hand')
        if (e.code === 'KeyP') setMode('pen')
        if (e.code === 'KeyR') setMode('rect')
        if (e.code === 'KeyE') setMode('eraser')
        if (e.code === 'KeyT') setMode('text')

        if (e.code === 'Delete' || e.code === 'Backspace') {
          e.preventDefault()
          deleteSelected()
        }

        if (e.code === 'AltLeft' || e.code === 'AltRight') {
          setIsAltDown(true)
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent): void => {
      if (e.code === 'Space' || e.key === ' ') setIsSpaceDown(false)
      if (e.code === 'AltLeft' || e.code === 'AltRight') setIsAltDown(false)
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [handleManualSave, handleUndo, handleRedo, deleteSelected, selectedIds, setIsSpaceDown])

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
    (e: React.MouseEvent): void => {
      if (
        e.button === 0 &&
        e.ctrlKey &&
        (isSpaceDown || mode === 'hand')
      ) {
        isZooming.current = true
        setIsGrabbing(true)
        lastMousePos.current = { x: e.clientX, y: e.clientY }
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect) {
          zoomCenter.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
        }
      } else if (
        e.button === 1 ||
        (mode === 'hand' && !e.ctrlKey && e.button === 0) ||
        (isSpaceDown && !e.ctrlKey && e.button === 0)
      ) {
        isPanning.current = true
        setIsGrabbing(true)
        lastMousePos.current = { x: e.clientX, y: e.clientY }
      } else if (e.button === 0 && (mode === 'pen' || mode === 'rect' || mode === 'eraser')) {
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect) {
          const screenX = e.clientX - rect.left
          const screenY = e.clientY - rect.top
          const worldX = (screenX - viewport.x) / viewport.scale
          const worldY = (screenY - viewport.y) / viewport.scale

          if (mode === 'pen') {
            if (e.shiftKey && lastPathPoint.current) {
              // Photoshop style: Shift + Click connects last point to current point with a straight line
              const start = lastPathPoint.current
              setActivePath([
                { x: start.x, y: start.y, width: penSize },
                { x: worldX, y: worldY, width: penSize }
              ])
              // Set the anchor to the START point for snapping if they move the mouse
              snappingAnchor.current = start
            } else {
              setActivePath([{ x: worldX, y: worldY, width: penSize }])
              snappingAnchor.current = null
            }
          } else if (mode === 'rect') {
            setActiveRect({ x: worldX, y: worldY, w: 0, h: 0 })
          } else if (mode === 'eraser') {
            pushToHistory()
            isErasing.current = true
          }
        }
      }
    },
    [mode, isSpaceDown, viewport, penSize, pushToHistory]
  )

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent): void => {
      // Prevent creating text if an element already handled the double click
      if (Date.now() - lastElementDoubleClickTime.current < 500) return

      if (e.button === 0 && (mode === 'text' || mode === 'select')) {
        const target = e.target as HTMLElement
        // If we clicked on an existing context menu or UI elements, do not create text
        if (
          target.closest('[data-context-menu]') ||
          target.closest('.ui-layer') ||
          target.tagName.toLowerCase() === 'textarea'
        )
          return

        // If in select mode, check if we're actually clicking on an element
        // (Simplified check: if we're clicking on something with data-element-id, it's not empty board)
        if (mode === 'select' && target.closest('[data-element-id]')) return

        e.preventDefault()
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect) {
          const screenX = e.clientX - rect.left
          const screenY = e.clientY - rect.top
          const worldX = (screenX - viewport.x) / viewport.scale
          const worldY = (screenY - viewport.y) / viewport.scale

          const newTextEl: BoardElement = {
            id: nanoid(),
            type: 'text',
            x: worldX,
            y: worldY,
            width: Math.max(200, textSize * 5),
            height: Math.max(40, textSize * 1.5),
            url: '',
            text: '',
            fontSize: textSize,
            fontWeight: 400,
            textAlign: 'left',
            color: penColor
          }
          pushToHistory()
          setElements((prev) => {
            const next = prev.map((el) => {
              if (el.type === 'text' && !el.text?.trim() && el.id !== newTextEl.id) {
                return { ...el, text: 'text' }
              }
              return el
            })
            return [...next, newTextEl]
          })
          setSelectedIds([newTextEl.id])
          setEditingTextId(newTextEl.id)
          setMode('select')
        }
      }
    },
    [mode, viewport, textSize, penColor, pushToHistory]
  )

  const handleSelectionStart = useCallback(
    (e: MouseEvent): void => {
      if (mode === 'select' && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        selectionStartPos.current = { x, y }
        // Clear selection if not holding shift
        if (!e.shiftKey) {
          setSelectedIds([])
        }
      }
    },
    [mode]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent): void => {
      if (mode === 'eraser') {
        const cursor = document.getElementById('eraser-cursor')
        if (cursor) {
          cursor.style.left = `${e.clientX}px`
          cursor.style.top = `${e.clientY}px`
        }
      }

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
        const zoomSpeed = 0.01
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
      } else if (activePath && mode === 'pen') {
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect) {
          const screenX = e.clientX - rect.left
          const screenY = e.clientY - rect.top
          const worldX = (screenX - viewport.x) / viewport.scale
          const worldY = (screenY - viewport.y) / viewport.scale
          setActivePath((prev) => {
            if (!prev || prev.length === 0) return [{ x: worldX, y: worldY, width: penSize }]

            if (e.shiftKey) {
              if (!snappingAnchor.current) {
                snappingAnchor.current = prev[prev.length - 1]
              }
              const anchor = snappingAnchor.current
              const dx = Math.abs(worldX - anchor.x)
              const dy = Math.abs(worldY - anchor.y)

              const snapped =
                dx > dy
                  ? { x: worldX, y: anchor.y, width: penSize }
                  : { x: anchor.x, y: worldY, width: penSize }

              const last = prev[prev.length - 1]
              const isLastAnchor = last.x === anchor.x && last.y === anchor.y

              if (isLastAnchor) {
                return [...prev, snapped]
              } else {
                return [...prev.slice(0, -1), snapped]
              }
            } else {
              snappingAnchor.current = null
              const last = prev[prev.length - 1]
              const dx = worldX - last.x
              const dy = worldY - last.y
              const dist = Math.sqrt(dx * dx + dy * dy)

              if (dist < 3) return prev // More dense points for better eraser precision

              return [...prev, { x: worldX, y: worldY, width: penSize }]
            }
          })
        }
      } else if (activeRect && mode === 'rect') {
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect) {
          const screenX = e.clientX - rect.left
          const screenY = e.clientY - rect.top
          const worldX = (screenX - viewport.x) / viewport.scale
          const worldY = (screenY - viewport.y) / viewport.scale
          setActiveRect((prev) =>
            prev ? { ...prev, w: worldX - prev.x, h: worldY - prev.y } : null
          )
        }
      } else if (mode === 'eraser' && e.buttons & 1) {
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect) {
          const screenX = e.clientX - rect.left
          const screenY = e.clientY - rect.top
          const worldX = (screenX - viewport.x) / viewport.scale
          const worldY = (screenY - viewport.y) / viewport.scale

          const radius = eraserSize / 2 / viewport.scale
          const eraserCenter = { x: worldX, y: worldY }

          setElements((prev) => {
            let changed = false
            const nextElements: BoardElement[] = []

            prev.forEach((el) => {
              if (el.type !== 'path' || !el.points) {
                nextElements.push(el)
                return
              }

              // Bounding box check for performance
              const halfW = el.width / 2
              const halfH = el.height / 2
              const dxCenter = el.x - worldX
              const dyCenter = el.y - worldY
              const distToCenter = Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter)
              const maxDim = Math.max(halfW, halfH)

              // If the eraser is nowhere near the element's bounding box, skip complex math
              if (distToCenter > maxDim + radius + 10) {
                nextElements.push(el)
                return
              }

              const pts = el.points as { x: number; y: number; width?: number }[]
              const worldPts = pts.map((p) => ({
                x: p.x + el.x,
                y: p.y + el.y,
                width: p.width || el.size || 2
              }))

              const resultPaths: { x: number; y: number; width?: number }[][] = []
              let currentPath: { x: number; y: number; width?: number }[] = []

              for (let i = 0; i < worldPts.length; i++) {
                const p1 = worldPts[i]
                const d1sq = Math.pow(p1.x - worldX, 2) + Math.pow(p1.y - worldY, 2)
                const p1Inside = d1sq < radius * radius

                if (i === 0) {
                  if (!p1Inside) currentPath.push(p1)
                  else changed = true
                  continue
                }

                const p0 = worldPts[i - 1]
                const d0sq = Math.pow(p0.x - worldX, 2) + Math.pow(p0.y - worldY, 2)
                const p0Inside = d0sq < radius * radius

                const intersections = getCircleLineIntersection(p0, p1, eraserCenter, radius)

                if (p0Inside && p1Inside) {
                  // Entirely inside, segment is erased
                  changed = true
                } else if (!p0Inside && !p1Inside) {
                  if (intersections.length >= 2) {
                    // Segment passes through the eraser
                    changed = true
                    currentPath.push({ ...intersections[0], width: p1.width })
                    resultPaths.push(currentPath)
                    currentPath = [{ ...intersections[1], width: p1.width }, p1]
                  } else {
                    // Entirely outside, keep as is
                    currentPath.push(p1)
                  }
                } else if (p0Inside && !p1Inside) {
                  // Crossing out of the eraser circle
                  changed = true
                  // Use intersection if found, otherwise p1
                  const inter = intersections[0] || p1
                  currentPath = [{ ...inter, width: p1.width }, p1]
                } else if (!p0Inside && p1Inside) {
                  // Crossing into the eraser circle
                  changed = true
                  const inter = intersections[0] || p0
                  currentPath.push({ ...inter, width: p1.width })
                  resultPaths.push(currentPath)
                  currentPath = []
                }
              }

              if (currentPath.length > 0) resultPaths.push(currentPath)

              const filteredPaths = resultPaths.filter((p) => p.length > 0)

              if (filteredPaths.length === 0) {
                // Entire line was erased
                changed = true
              } else if (
                filteredPaths.length === 1 &&
                filteredPaths[0].length === worldPts.length &&
                !changed
              ) {
                // No changes were actually made after fine check
                nextElements.push(el)
              } else {
                // One or more resulting segments (line was split)
                changed = true
                filteredPaths.forEach((newPts) => {
                  if (newPts.length === 0) return

                  // Simplify the resulting segments to keep them clean
                  const simplified = simplifyPath(newPts, 0.5)
                  if (simplified.length === 0) return

                  let minX = simplified[0].x,
                    minY = simplified[0].y,
                    maxX = simplified[0].x,
                    maxY = simplified[0].y
                  simplified.forEach((pt) => {
                    minX = Math.min(minX, pt.x)
                    minY = Math.min(minY, pt.y)
                    maxX = Math.max(maxX, pt.x)
                    maxY = Math.max(maxY, pt.y)
                  })

                  const w = Math.max(2, maxX - minX)
                  const h = Math.max(2, maxY - minY)
                  const cx = minX + w / 2
                  const cy = minY + h / 2

                  nextElements.push({
                    ...el,
                    id: nanoid(),
                    x: cx,
                    y: cy,
                    width: w,
                    height: h,
                    // @ts-ignore - added baseWidth/baseHeight for resizing
                    baseWidth: w,
                    // @ts-ignore - added baseWidth/baseHeight for resizing
                    baseHeight: h,
                    points: simplified.map((pt) => ({
                      x: pt.x - cx,
                      y: pt.y - cy,
                      width: pt.width
                    }))
                  })
                })
              }
            })
            return changed ? nextElements : prev
          })
        }
      }
    },
    [viewport, activePath, activeRect, mode, penSize, eraserSize, pushToHistory]
  )

  // Use window-level listeners for marquee selection so PIXI canvas doesn't swallow events
  useEffect(() => {
    const onWindowMouseMove = (e: MouseEvent): void => {
      if (!selectionStartPos.current) return
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      const curX = e.clientX - rect.left
      const curY = e.clientY - rect.top
      const dx = curX - selectionStartPos.current.x
      const dy = curY - selectionStartPos.current.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist > 5) {
        const x = Math.min(selectionStartPos.current.x, curX)
        const y = Math.min(selectionStartPos.current.y, curY)
        const w = Math.abs(dx)
        const h = Math.abs(dy)

        setSelectionRect({ x, y, w, h })

        const vp = viewportRef.current
        const worldX = (x - vp.x) / vp.scale
        const worldY = (y - vp.y) / vp.scale
        const worldW = w / vp.scale
        const worldH = h / vp.scale

        const currentElements = elementsRef.current
        const intersectingIds = currentElements
          .filter((el) => {
            const elLeft = el.x - el.width / 2
            const elTop = el.y - el.height / 2
            const elRight = el.x + el.width / 2
            const elBottom = el.y + el.height / 2
            return (
              elLeft < worldX + worldW &&
              elRight > worldX &&
              elTop < worldY + worldH &&
              elBottom > worldY
            )
          })
          .map((el) => el.id)

        // Expand to include whole groups if any member is touched
        const touchedGroupIds = new Set<string>()
        currentElements.forEach((el) => {
          if (intersectingIds.includes(el.id) && el.groupId) {
            touchedGroupIds.add(el.groupId)
          }
        })

        const newSelected =
          touchedGroupIds.size > 0
            ? currentElements
              .filter(
                (el) =>
                  intersectingIds.includes(el.id) ||
                  (el.groupId && touchedGroupIds.has(el.groupId))
              )
              .map((el) => el.id)
            : intersectingIds

        if (e.shiftKey) {
          setSelectedIds((prev) => Array.from(new Set([...prev, ...newSelected])))
        } else {
          setSelectedIds(newSelected)
        }
      }
    }

    const onWindowMouseUp = (): void => {
      if (selectionStartPos.current) {
        selectionStartPos.current = null
        setSelectionRect(null)
      }
      isPanning.current = false
      isZooming.current = false
      setIsGrabbing(false)
      isErasing.current = false

      // Handle pen/rect creation on global mouse up in case they dragged off canvas
      const currentPath = activePathRef.current
      if (currentPath && currentPath.length > 1) {
        // Simplify path on finish to remove jitter and reduce points
        const simplifiedPathArr = simplifyPath(currentPath, 1)
        if (simplifiedPathArr.length <= 1) return

        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        simplifiedPathArr.forEach((pt) => {
          if (pt.x < minX) minX = pt.x
          if (pt.y < minY) minY = pt.y
          if (pt.x > maxX) maxX = pt.x
          if (pt.y > maxY) maxY = pt.y
        })

        const w = Math.max(10, maxX - minX)
        const h = Math.max(10, maxY - minY)
        const centerX = minX + w / 2
        const centerY = minY + h / 2

        // Make points relative to local center
        const localPoints = simplifiedPathArr.map((pt) => ({
          x: pt.x - centerX,
          y: pt.y - centerY,
          width: pt.width
        }))

        // @ts-ignore - baseWidth and baseHeight additions for paths
        const newElement: BoardElement & {
          type: 'path'
          points: { x: number; y: number; width?: number }[]
          size: number
          color: string
          baseWidth: number
          baseHeight: number
        } = {
          id: nanoid(),
          type: 'path',
          x: centerX,
          y: centerY,
          width: w,
          height: h,
          baseWidth: w,
          baseHeight: h,
          url: '',
          points: localPoints,
          color: penColor,
          size: penSize
        }

        pushToHistory()
        setElements((prev) => [...prev, newElement])
        // Store the last point of the finished path for future Shift + Click operations (already in world coordinates)
        const lastPt = currentPath[currentPath.length - 1]
        lastPathPoint.current = { x: lastPt.x, y: lastPt.y }
      } else if (currentPath && currentPath.length === 1) {
        // Just update the anchor for Shift+Click, but don't save a dot
        lastPathPoint.current = { x: currentPath[0].x, y: currentPath[0].y }
      }
      setActivePath(null)
      snappingAnchor.current = null

      const currentRect = activeRectRef.current
      if (currentRect && Math.abs(currentRect.w) > 5 && Math.abs(currentRect.h) > 5) {
        // Normalize rect (handle drawing backwards)
        const finalX = currentRect.w < 0 ? currentRect.x + currentRect.w : currentRect.x
        const finalY = currentRect.h < 0 ? currentRect.y + currentRect.h : currentRect.y
        const w = Math.abs(currentRect.w)
        const h = Math.abs(currentRect.h)

        // Elements position is center based
        const centerX = finalX + w / 2
        const centerY = finalY + h / 2

        const newElement: BoardElement & {
          type: 'rect'
          strokeColor: string
          strokeWidth: number
          color: string
        } = {
          id: nanoid(),
          type: 'rect',
          x: centerX,
          y: centerY,
          width: w,
          height: h,
          url: '',
          color: 'transparent',
          strokeColor: penColor,
          strokeWidth: penSize
        }
        pushToHistory()
        setElements((prev) => [...prev, newElement])
      }
      setActiveRect(null)
    }

    window.addEventListener('mousemove', onWindowMouseMove)
    window.addEventListener('mouseup', onWindowMouseUp)
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove)
      window.removeEventListener('mouseup', onWindowMouseUp)
    }
  }, [pushToHistory, penColor, penSize])

  const handleMouseUp = useCallback((): void => {
    isPanning.current = false
    isZooming.current = false
    setIsGrabbing(false)
  }, [setIsGrabbing])

  const addElementAtPos = useCallback(
    (
      type: 'image' | 'video' | 'link',
      url: string,
      screenX: number,
      screenY: number,
      initialWidth?: number,
      initialHeight?: number
    ): void => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      const worldX = (screenX - rect.left - viewport.x) / viewport.scale
      const worldY = (screenY - rect.top - viewport.y) / viewport.scale

      let finalWidth = initialWidth || (type === 'link' ? 300 : 400)
      let finalHeight = initialHeight || (type === 'link' ? 100 : 300)

      // Maintain aspect ratio and limit size for initial drop
      if (type !== 'link' && initialWidth && initialHeight) {
        const maxSize = 800
        if (finalWidth > maxSize || finalHeight > maxSize) {
          const ratio = initialWidth / initialHeight
          if (finalWidth > finalHeight) {
            finalWidth = maxSize
            finalHeight = maxSize / ratio
          } else {
            finalHeight = maxSize
            finalWidth = maxSize * ratio
          }
        }
      }

      const newElement: BoardElement = {
        id: nanoid(),
        type,
        x: worldX,
        y: worldY,
        width: finalWidth,
        height: finalHeight,
        url: url,
        title: type === 'link' ? url.split('//').pop()?.split('/')[0] || url : undefined
      }

      pushToHistory()
      setElements((prev) => [...prev, newElement])
    },
    [viewport, pushToHistory]
  )

  const getMediaDimensions = async (
    url: string,
    type: 'image' | 'video'
  ): Promise<{ width: number; height: number }> => {
    if (type === 'image') {
      return new Promise((resolve) => {
        const img = new Image()
        img.onload = (): void => resolve({ width: img.naturalWidth, height: img.naturalHeight })
        img.onerror = (): void => resolve({ width: 400, height: 300 })
        img.src = url
      })
    } else {
      return new Promise((resolve) => {
        const video = document.createElement('video')
        video.onloadedmetadata = (): void =>
          resolve({ width: video.videoWidth, height: video.videoHeight })
        video.onerror = (): void => resolve({ width: 400, height: 300 })
        video.src = url
      })
    }
  }

  const handleDrop = useCallback(
    async (e: React.DragEvent): Promise<void> => {
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
            const dims = await getMediaDimensions(url, isVideo ? 'video' : 'image')
            addElementAtPos(
              isVideo ? 'video' : 'image',
              url,
              e.clientX,
              e.clientY,
              dims.width,
              dims.height
            )
          } else {
            const reader = new FileReader()
            reader.onload = async (event) => {
              url = event.target?.result as string
              const dims = await getMediaDimensions(url, isVideo ? 'video' : 'image')
              addElementAtPos(
                isVideo ? 'video' : 'image',
                url,
                e.clientX,
                e.clientY,
                dims.width,
                dims.height
              )
            }
            reader.readAsDataURL(file)
          }
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
    const handlePaste = (e: ClipboardEvent): void => {
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
              const reader = new FileReader()
              reader.onload = (event) => {
                const url = event.target?.result as string
                const type = item.type.startsWith('video/')
                  ? ('video' as const)
                  : ('image' as const)
                getMediaDimensions(url, type).then((dims) => {
                  addElementAtPos(
                    type,
                    url,
                    rect.left + rect.width / 2,
                    rect.top + rect.height / 2,
                    dims.width,
                    dims.height
                  )
                })
              }
              reader.readAsDataURL(file)
            }
          }
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [addElementAtPos])

  const handleElementSelect = useCallback(
    (id: string | null, multi: boolean = false): void => {
      selectionStartPos.current = null

      if (!id) {
        setSelectedIds([])
        return
      }

      const target = elements.find((el) => el.id === id)
      if (!target) return

      let idsToSelect = [id]
      if (target.groupId) {
        idsToSelect = elements.filter((el) => el.groupId === target.groupId).map((el) => el.id)
      }

      if (multi) {
        setSelectedIds((prev) => {
          const alreadySelected = idsToSelect.every((sid) => prev.includes(sid))
          if (alreadySelected) {
            return prev.filter((sid) => !idsToSelect.includes(sid))
          } else {
            return Array.from(new Set([...prev, ...idsToSelect]))
          }
        })
      } else {
        setSelectedIds((prev) => {
          const alreadySelected = idsToSelect.every((sid) => prev.includes(sid))
          return alreadySelected ? prev : idsToSelect
        })
      }
    },
    [elements]
  )

  const alignElements = useCallback(
    (direction: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
      if (selectedIds.length < 2) return
      pushToHistory()
      setElements((prev) => {
        const selected = prev.filter((el) => selectedIds.includes(el.id))
        let commonVal: number

        switch (direction) {
          case 'left':
            commonVal = Math.min(...selected.map((el) => el.x - el.width / 2))
            return prev.map((el) =>
              selectedIds.includes(el.id) ? { ...el, x: commonVal + el.width / 2 } : el
            )
          case 'right':
            commonVal = Math.max(...selected.map((el) => el.x + el.width / 2))
            return prev.map((el) =>
              selectedIds.includes(el.id) ? { ...el, x: commonVal - el.width / 2 } : el
            )
          case 'center': {
            const minX = Math.min(...selected.map((el) => el.x - el.width / 2))
            const maxX = Math.max(...selected.map((el) => el.x + el.width / 2))
            commonVal = (minX + maxX) / 2
            return prev.map((el) => (selectedIds.includes(el.id) ? { ...el, x: commonVal } : el))
          }
          case 'top':
            commonVal = Math.min(...selected.map((el) => el.y - el.height / 2))
            return prev.map((el) =>
              selectedIds.includes(el.id) ? { ...el, y: commonVal + el.height / 2 } : el
            )
          case 'bottom':
            commonVal = Math.max(...selected.map((el) => el.y + el.height / 2))
            return prev.map((el) =>
              selectedIds.includes(el.id) ? { ...el, y: commonVal - el.height / 2 } : el
            )
          case 'middle': {
            const minY = Math.min(...selected.map((el) => el.y - el.height / 2))
            const maxY = Math.max(...selected.map((el) => el.y + el.height / 2))
            commonVal = (minY + maxY) / 2
            return prev.map((el) => (selectedIds.includes(el.id) ? { ...el, y: commonVal } : el))
          }
          default:
            return prev
        }
      })
    },
    [selectedIds, pushToHistory]
  )

  const arrangeAsGrid = useCallback(() => {
    if (selectedIds.length < 2) return
    pushToHistory()
    setElements((prev) => {
      const selected = prev.filter((el) => selectedIds.includes(el.id))
      selected.sort((a, b) => (a.y - b.y) * 1000 + (a.x - b.x))

      const cols = Math.ceil(Math.sqrt(selected.length))
      const spacing = 80

      const minX = Math.min(...selected.map((el) => el.x - el.width / 2))
      const minY = Math.min(...selected.map((el) => el.y - el.height / 2))

      let curX = minX
      let curY = minY
      let maxHeightInRow = 0

      const newPositions: Record<string, { x: number; y: number }> = {}

      selected.forEach((el, index) => {
        if (index > 0 && index % cols === 0) {
          curX = minX
          curY += maxHeightInRow + spacing
          maxHeightInRow = 0
        }

        newPositions[el.id] = {
          x: curX + el.width / 2,
          y: curY + el.height / 2
        }

        curX += el.width + spacing
        maxHeightInRow = Math.max(maxHeightInRow, el.height)
      })

      return prev.map((el) =>
        selectedIds.includes(el.id) ? { ...el, ...newPositions[el.id] } : el
      )
    })
  }, [selectedIds, pushToHistory])

  const groupElements = useCallback(() => {
    if (selectedIds.length < 2) return
    pushToHistory()
    const gid = nanoid()
    setElements((prev) => {
      // Find top-most index among selected
      let topIndex = -1
      for (let i = 0; i < prev.length; i++) {
        if (selectedIds.includes(prev[i].id)) topIndex = i
      }

      const selected = prev.filter((el) => selectedIds.includes(el.id))
      const unselected = prev.filter((el) => !selectedIds.includes(el.id))

      const result = [...unselected]
      // Insert at topIndex (accounting for removed selected elements)
      const adjustedIndex = unselected.findIndex((_, idx) => {
        // Find where this element was in the original array
        const originalIdx = prev.indexOf(unselected[idx])
        return originalIdx > topIndex
      })

      const insertAt = adjustedIndex === -1 ? unselected.length : adjustedIndex
      result.splice(insertAt, 0, ...selected.map((el) => ({ ...el, groupId: gid })))
      return result
    })
    setExpandedGroups((prev) => [...prev, gid])
  }, [selectedIds, pushToHistory])

  const ungroupElements = useCallback(() => {
    if (selectedIds.length === 0) return
    pushToHistory()
    const currentSelected = elements.filter((el) => selectedIds.includes(el.id))
    const gids = Array.from(new Set(currentSelected.map((el) => el.groupId).filter(Boolean)))
    setElements((prev) =>
      prev.map((el) =>
        el.groupId && gids.includes(el.groupId) ? { ...el, groupId: undefined } : el
      )
    )
  }, [selectedIds, elements, pushToHistory])

  const bringToFront = useCallback((): void => {
    if (selectedIds.length === 0) return
    pushToHistory()
    setElements((prev) => {
      const selected = prev.filter((el) => selectedIds.includes(el.id))
      const unselected = prev.filter((el) => !selectedIds.includes(el.id))
      return [...unselected, ...selected]
    })
  }, [selectedIds, pushToHistory])

  const sendToBack = useCallback((): void => {
    if (selectedIds.length === 0) return
    pushToHistory()
    setElements((prev) => {
      const selected = prev.filter((el) => selectedIds.includes(el.id))
      const unselected = prev.filter((el) => !selectedIds.includes(el.id))
      return [...selected, ...unselected]
    })
  }, [selectedIds, pushToHistory])

  const bringForward = useCallback((): void => {
    if (selectedIds.length === 0) return
    pushToHistory()
    setElements((prev) => {
      const next = [...prev]
      // Move from end to start to avoid double jumps
      for (let i = next.length - 2; i >= 0; i--) {
        if (selectedIds.includes(next[i].id) && !selectedIds.includes(next[i + 1].id)) {
          ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
        }
      }
      return next
    })
  }, [selectedIds, pushToHistory])

  const sendBackward = useCallback((): void => {
    if (selectedIds.length === 0) return
    pushToHistory()
    setElements((prev) => {
      const next = [...prev]
      for (let i = 1; i < next.length; i++) {
        if (selectedIds.includes(next[i].id) && !selectedIds.includes(next[i - 1].id)) {
          ;[next[i], next[i - 1]] = [next[i - 1], next[i]]
        }
      }
      return next
    })
  }, [selectedIds, pushToHistory])

  const duplicateElements = useCallback((): void => {
    if (selectedIds.length === 0) return
    pushToHistory()
    setElements((prev) => {
      const selected = prev.filter((el) => selectedIds.includes(el.id))
      const clones = selected.map((el) => ({
        ...el,
        id: nanoid(),
        x: el.x + 40,
        y: el.y + 40,
        groupId: undefined // Individual clones by default
      }))
      const newElements = [...prev, ...clones]
      setSelectedIds(clones.map((c) => c.id))
      return newElements
    })
  }, [selectedIds, pushToHistory])

  const copyToClipboard = useCallback((): void => {
    if (selectedIds.length === 0) return
    const selected = elements.filter((el) => selectedIds.includes(el.id))
    clipboardRef.current = JSON.parse(JSON.stringify(selected))
  }, [selectedIds, elements])

  const pasteFromClipboard = useCallback((): void => {
    if (clipboardRef.current.length === 0) return
    pushToHistory()
    const clones = clipboardRef.current.map((el) => ({
      ...el,
      id: nanoid(),
      x: el.x + 40,
      y: el.y + 40,
      groupId: undefined
    }))
    setElements((prev) => [...prev, ...clones])
    setSelectedIds(clones.map((c) => c.id))
    // Offset for next paste
    clipboardRef.current = clones.map((c) => ({ ...c }))
  }, [pushToHistory])

  const handleElementMove = useCallback(
    (id: string, x: number, y: number): void => {
      setElements((prev) => {
        // Initialize drag context if it's a new drag or id changed
        if (!dragContextRef.current || dragContextRef.current.lastId !== id) {
          const selectedSet = new Set(selectedIds)
          const isSelected = selectedSet.has(id)
          const moversIds = isSelected ? selectedSet : new Set([id])
          
          const movers: { index: number; id: string; offsetX: number; offsetY: number }[] = []
          const targets: BoardElement[] = []
          const targetEl = prev.find(el => el.id === id)
          if (!targetEl) return prev

          for (let i = 0; i < prev.length; i++) {
            const el = prev[i]
            if (moversIds.has(el.id)) {
              movers.push({ 
                index: i, 
                id: el.id, 
                offsetX: el.x - targetEl.x, 
                offsetY: el.y - targetEl.y 
              })
            } else {
              // Pre-filter targets that are reasonably close to the viewport
              // Use a slightly larger margin for safety
              targets.push(el) 
            }
          }
          dragContextRef.current = { movers, targets, lastId: id }
        }

        const { movers, targets } = dragContextRef.current
        const SNAP_THRESHOLD = 5 / viewport.scale
        
        // Calculate new bounding box for movers
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (let i = 0; i < movers.length; i++) {
          const m = movers[i]
          const el = prev[m.index]
          const curX = x + m.offsetX
          const curY = y + m.offsetY
          minX = Math.min(minX, curX - el.width / 2)
          minY = Math.min(minY, curY - el.height / 2)
          maxX = Math.max(maxX, curX + el.width / 2)
          maxY = Math.max(maxY, curY + el.height / 2)
        }

        const currentCX = minX + (maxX - minX) / 2
        const currentCY = minY + (maxY - minY) / 2
        const currentL = minX
        const currentR = maxX
        const currentT = minY
        const currentB = maxY

        let snapDX = 0
        let snapDY = 0
        let bestSnapX = Infinity
        let bestSnapY = Infinity
        const newGuides: { x?: number; y?: number }[] = []

        // Snapping logic - Optimized with for loop and spatial check
        const viewportMargin = Math.min(3000, 1500 / viewport.scale)
        for (let i = 0; i < targets.length; i++) {
          const other = targets[i]
          if (Math.abs(other.x - currentCX) > viewportMargin || Math.abs(other.y - currentCY) > viewportMargin) continue

          const otL = other.x - other.width / 2
          const otR = other.x + other.width / 2
          const otT = other.y - other.height / 2
          const otB = other.y + other.height / 2
          const otCX = other.x
          const otCY = other.y

          const targetsX = [otL, otR, otCX]
          const sourcesX = [currentL, currentR, currentCX]
          for (let s = 0; s < 3; s++) {
            for (let t = 0; t < 3; t++) {
              const diff = targetsX[t] - sourcesX[s]
              if (Math.abs(diff) < SNAP_THRESHOLD && Math.abs(diff) < Math.abs(bestSnapX)) {
                bestSnapX = diff
                newGuides.push({ x: targetsX[t] })
              }
            }
          }

          const targetsY = [otT, otB, otCY]
          const sourcesY = [currentT, currentB, currentCY]
          for (let s = 0; s < 3; s++) {
            for (let t = 0; t < 3; t++) {
              const diff = targetsY[t] - sourcesY[s]
              if (Math.abs(diff) < SNAP_THRESHOLD && Math.abs(diff) < Math.abs(bestSnapY)) {
                bestSnapY = diff
                newGuides.push({ y: targetsY[t] })
              }
            }
          }
        }

        if (bestSnapX !== Infinity) snapDX = bestSnapX
        if (bestSnapY !== Infinity) snapDY = bestSnapY
        snappingGuidesRef.current = newGuides

        const nextElements = [...prev]
        const finalSnapX = x + snapDX
        const finalSnapY = y + snapDY
        for (let i = 0; i < movers.length; i++) {
          const m = movers[i]
          const old = prev[m.index]
          nextElements[m.index] = { ...old, x: finalSnapX + m.offsetX, y: finalSnapY + m.offsetY }
        }
        return nextElements
      })
    },
    [viewport.scale, selectedIds]
  )

  const handleElementResize = useCallback(
    (id: string, width: number, height: number, x?: number, y?: number, handle?: string): void => {
      setElements((prev) => {
        const targetIdx = prev.findIndex(el => el.id === id)
        if (targetIdx === -1) return prev
        const target = prev[targetIdx]

        const SNAP_THRESHOLD = 5 / viewport.scale
        let finalW = width
        let finalH = height
        let finalX = x ?? target.x
        let finalY = y ?? target.y
        const newGuides: { x?: number; y?: number }[] = []

        if (handle) {
          const selectedSet = new Set(selectedIds)
          const viewportMargin = Math.min(2000, 1000 / viewport.scale)
          
          let bestSnapX = Infinity
          let bestSnapY = Infinity

          // Edge cases for scale handle snapping
          const curR = finalX + finalW / 2
          const curL = finalX - finalW / 2
          const curB = finalY + finalH / 2
          const curT = finalY - finalH / 2

          for (let i = 0; i < prev.length; i++) {
            const other = prev[i]
            if (other.id === id || selectedSet.has(other.id)) continue
            if (Math.abs(other.x - finalX) > viewportMargin || Math.abs(other.y - finalY) > viewportMargin) continue

            const otL = other.x - other.width / 2
            const otR = other.x + other.width / 2
            const otCX = other.x
            const otT = other.y - other.height / 2
            const otB = other.y + other.height / 2
            const otCY = other.y

            if (handle.includes('right')) {
              const targets = [otL, otR, otCX]
              for (let j = 0; j < 3; j++) {
                const diff = targets[j] - curR
                if (Math.abs(diff) < SNAP_THRESHOLD && Math.abs(diff) < Math.abs(bestSnapX)) {
                  bestSnapX = diff
                  newGuides.push({ x: targets[j] })
                }
              }
            } else if (handle.includes('left')) {
              const targets = [otL, otR, otCX]
              for (let j = 0; j < 3; j++) {
                const diff = targets[j] - curL
                if (Math.abs(diff) < SNAP_THRESHOLD && Math.abs(diff) < Math.abs(bestSnapX)) {
                  bestSnapX = diff
                  newGuides.push({ x: targets[j] })
                }
              }
            }

            if (handle.includes('bottom')) {
              const targets = [otT, otB, otCY]
              for (let j = 0; j < 3; j++) {
                const diff = targets[j] - curB
                if (Math.abs(diff) < SNAP_THRESHOLD && Math.abs(diff) < Math.abs(bestSnapY)) {
                  bestSnapY = diff
                  newGuides.push({ y: targets[j] })
                }
              }
            } else if (handle.includes('top')) {
              const targets = [otT, otB, otCY]
              for (let j = 0; j < 3; j++) {
                const diff = targets[j] - curT
                if (Math.abs(diff) < SNAP_THRESHOLD && Math.abs(diff) < Math.abs(bestSnapY)) {
                  bestSnapY = diff
                  newGuides.push({ y: targets[j] })
                }
              }
            }
          }

          if (bestSnapX !== Infinity) {
            if (handle.includes('right')) {
              finalW += bestSnapX
              finalX += bestSnapX / 2
            } else if (handle.includes('left')) {
              finalW -= bestSnapX
              finalX += bestSnapX / 2
            }
          }
          if (bestSnapY !== Infinity) {
            if (handle.includes('bottom')) {
              finalH += bestSnapY
              finalY += bestSnapY / 2
            } else if (handle.includes('top')) {
              finalH -= bestSnapY
              finalY += bestSnapY / 2
            }
          }
          snappingGuidesRef.current = newGuides
        }

        const nextElements = [...prev]
        nextElements[targetIdx] = { ...target, width: finalW, height: finalH, x: finalX, y: finalY }
        return nextElements
      })
    },
    [viewport.scale, selectedIds]
  )

  const handleElementRotate = useCallback((id: string, rotation: number): void => {
    setElements((prev) => prev.map((el) => (el.id === id ? { ...el, rotation } : el)))
  }, [])

  const handleContainerRef = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el
    setContainerEl(el)
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
        cursor: isGrabbing
          ? 'grabbing'
          : isSpaceDown
            ? 'grab'
            : mode === 'hand'
              ? 'grab'
              : mode === 'eraser'
                ? 'none'
                : 'default'
      }}
      ref={handleContainerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => { }}
      onMouseLeave={(): void => {
        handleMouseUp()
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={() => {
        handleMouseUp()
        dragContextRef.current = null
      }}
      onDrop={handleDrop}
      onDragOver={(e): void => e.preventDefault()}
      onContextMenu={(e): void => {
        e.preventDefault()
        setContextMenuPos({ x: e.clientX, y: e.clientY })
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '14px',
          transform: 'translateY(-50%)',
          zIndex: 100,
          background: 'var(--card-bg)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '13px',
          padding: '5px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      >
        <ToolButton
          active={mode === 'hand'}
          onClick={() => {
            setMode('hand')
            setShowPenSettings(false)
            setShowEraserSettings(false)
            setShowColorPicker(false)
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setMode('hand')
            setShowPenSettings(false)
            setShowEraserSettings(false)
            setShowColorPicker(false)
          }}
          icon={<Lock size={18} />}
          title="View Only (H)"
        />
        <ToolButton
          active={mode === 'select'}
          onClick={() => {
            setMode('select')
            setShowPenSettings(false)
            setShowEraserSettings(false)
            setShowColorPicker(false)
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setMode('select')
            setShowPenSettings(false)
            setShowEraserSettings(false)
            setShowColorPicker(false)
          }}
          icon={<MousePointer2 size={18} />}
          title="Select (V)"
        />
        <ToolButton
          active={mode === 'pen'}
          onClick={() => {
            setMode('pen')
            setShowPenSettings(false)
            setShowEraserSettings(false)
            setShowColorPicker(false)
          }}
          onDoubleClick={(e): void => {
            setMode('pen')
            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
            setShowPenSettings(true)
            setShowEraserSettings(false)
            setShowColorPicker(false)
            setPenSettingsAnchor(rect)
          }}
          onContextMenu={(e: React.MouseEvent<HTMLButtonElement>): void => {
            e.preventDefault()
            e.stopPropagation()
            setMode('pen')
            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
            setShowPenSettings(true)
            setShowEraserSettings(false)
            setShowColorPicker(false)
            setPenSettingsAnchor(rect)
          }}
          icon={<Pen size={18} />}
          title="Ручка (P)"
        />
        <ToolButton
          active={mode === 'eraser'}
          onClick={(): void => {
            setMode('eraser')
            setShowEraserSettings(false)
            setShowPenSettings(false)
            setShowColorPicker(false)
          }}
          onDoubleClick={(e: React.MouseEvent<HTMLButtonElement>): void => {
            setMode('eraser')
            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
            setShowEraserSettings(true)
            setShowPenSettings(false)
            setShowColorPicker(false)
            setEraserSettingsAnchor(rect)
          }}
          onContextMenu={(e: React.MouseEvent<HTMLButtonElement>): void => {
            e.preventDefault()
            e.stopPropagation()
            setMode('eraser')
            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
            setShowEraserSettings(true)
            setShowPenSettings(false)
            setShowColorPicker(false)
            setEraserSettingsAnchor(rect)
          }}
          icon={<Eraser size={18} />}
          title="Ластик (E)"
        />
        <ToolButton
          active={mode === 'rect'}
          onClick={() => {
            setMode('rect')
            setShowPenSettings(false)
            setShowEraserSettings(false)
            setShowColorPicker(false)
          }}
          onDoubleClick={(e) => {
            setMode('rect')
            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
            setShowPenSettings(true)
            setShowEraserSettings(false)
            setShowColorPicker(false)
            setPenSettingsAnchor(rect)
          }}
          onContextMenu={(e: React.MouseEvent<HTMLButtonElement>): void => {
            e.preventDefault()
            e.stopPropagation()
            setMode('rect')
            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
            setShowPenSettings(true)
            setShowEraserSettings(false)
            setShowColorPicker(false)
            setPenSettingsAnchor(rect)
          }}
          icon={<Square size={18} />}
          title="Rectangle Tool (R)"
        />
        <ToolButton
          active={mode === 'text'}
          onClick={() => {
            setMode('text')
            setShowPenSettings(false)
            setShowEraserSettings(false)
            setShowColorPicker(false)
          }}
          onDoubleClick={(e) => {
            setMode('text')
            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
            setShowPenSettings(true)
            setShowEraserSettings(false)
            setShowColorPicker(false)
            setPenSettingsAnchor(rect)
          }}
          onContextMenu={(e: React.MouseEvent<HTMLButtonElement>): void => {
            e.preventDefault()
            e.stopPropagation()
            setMode('text')
            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
            setShowPenSettings(true)
            setShowEraserSettings(false)
            setShowColorPicker(false)
            setPenSettingsAnchor(rect)
          }}
          icon={<Type size={18} />}
          title="Text Tool (T)"
        />

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.15)', margin: '0 6px' }} />

        <ToolButton
          active={false}
          onClick={handleUndo}
          disabled={!canUndo}
          icon={<Undo2 size={18} />}
          title="Undo (Ctrl+Z)"
        />
        <ToolButton
          active={false}
          onClick={handleRedo}
          disabled={!canRedo}
          icon={<Redo2 size={18} />}
          title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
        />

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.15)', margin: '0 6px' }} />

        <ToolButton
          active={false}
          onClick={handleManualSave}
          icon={
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px' }}>
              <Save 
                size={18} 
                style={{ 
                  opacity: isSavedFlash ? 0 : 1, 
                  transition: 'opacity 0.2s ease',
                  position: 'absolute'
                }} 
              />
              <div 
                style={{ 
                  opacity: isSavedFlash ? 1 : 0, 
                  transition: 'opacity 0.2s ease',
                  position: 'absolute',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#4ade80'
                }}
              >
                <Check size={18} strokeWidth={3} />
              </div>
            </div>
          }
          title="Save Board (Ctrl+S)"
          style={{ color: isSavedFlash ? '#4ade80' : undefined }}
        />

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.15)', margin: '0 6px' }} />

        <ToolButton
          active={showColorPicker}
          onClick={(e) => {
            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
            setShowColorPicker(!showColorPicker)
            setShowPenSettings(false)
            setShowEraserSettings(false)
            setPickerAnchor(rect)
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
            setShowColorPicker(true)
            setShowPenSettings(false)
            setShowEraserSettings(false)
            setPickerAnchor(rect)
          }}
          icon={<Palette size={18} />}
          title="Background Color"
        />

        <ToolButton
          active={false}
          onClick={deleteSelected}
          icon={<Trash2 size={18} />}
          title="Delete (Del)"
          danger
          disabled={selectedIds.length === 0}
        />
      </div>

      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {containerEl && dimensions.width > 0 && dimensions.height > 0 && (
          <Application
            // @ts-ignore - PIXI resizeTo prop mismatch with @pixi/react
            resizeTo={containerEl as HTMLElement}
            background={theme?.boardBg || '#1b1b1b'}
            antialias={true}
            // @ts-ignore - style prop typing mismatch with @pixi/react
            style={{ display: 'block', width: '100%', height: '100%', outline: 'none' }}
          >
            <BoardContent
              elements={elements}
              activePath={activePath}
              activeRect={activeRect}
              penColor={penColor}
              penSize={penSize}
              viewport={viewport}
              selectedIds={selectedIds}
              onSelect={handleElementSelect}
              onSelectionStart={handleSelectionStart}
              onMove={handleElementMove}
              onResize={handleElementResize}
              onRotate={handleElementRotate}
              onInteractionStart={pushToHistory}
              onDoubleClick={(id): void => {
                lastElementDoubleClickTime.current = Date.now()
                setEditingTextId(id)
                handleElementSelect(id)
              }}
              editingTextId={editingTextId}
              showFPS={showFPS}
              containerRef={containerRef}
              interactive={mode === 'select' && !isSpaceDown}
              screenWidth={dimensions.width}
              screenHeight={dimensions.height}
              theme={theme}
              isAltDown={isAltDown}
              guidesRef={snappingGuidesRef}
              lastElementDoubleClickTime={lastElementDoubleClickTime}
            />
          </Application>
        )}
      </div>

      {/* Inline Text Editor Overlay */}
      {(() => {
        if (!editingTextId) return null
        const el = elements.find((e) => e.id === editingTextId)
        if (!el || el.type !== 'text') return null

        const screenX = (el.x - el.width / 2) * viewport.scale + viewport.x
        const screenY = (el.y - el.height / 2) * viewport.scale + viewport.y
        const screenW = el.width * viewport.scale
        const screenH = el.height * viewport.scale

        return (
          <textarea
            ref={(node) => {
              if (node) {
                // Delay focus slightly to ensure the mousedown/mouseup sequence completes
                setTimeout(() => {
                  node.focus()
                  // Put cursor at the end
                  node.selectionStart = node.value.length
                  node.selectionEnd = node.value.length
                }, 10)
              }
            }}
            value={el.text || ''}
            onChange={(e) => {
              setElements((prev) =>
                prev.map((p) => (p.id === el.id ? { ...p, text: e.target.value } : p))
              )
            }}
            onBlur={() => {
              // Delay blur deletion to see if another internal click happened
              setTimeout(() => {
                setEditingTextId(null)
                if (!el.text?.trim()) {
                  setElements((prev) =>
                    prev.map((p) => (p.id === el.id ? { ...p, text: 'text' } : p))
                  )
                }
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
                // Return focus to canvas or keep selection
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
              border: '1px dashed rgba(255,255,255,0.5)',
              color: el.color || '#ffffff',
              fontSize: `${(el.fontSize || 24) * viewport.scale}px`,
              fontWeight: el.fontWeight || 400,
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              textAlign: el.textAlign || 'left',
              lineHeight: 1.4,
              resize: 'none',
              outline: 'none',
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
            background: 'rgba(0, 122, 255, 0.1)',
            border: '2px solid rgba(0, 122, 255, 0.5)',
            borderRadius: '4px',
            pointerEvents: 'none',
            zIndex: 1000
          }}
        />
      )}

      {/* Floating Info Pod */}
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
          pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.08)'
        }}
      >
        <span style={{ opacity: 0.8 }}>{elements.length} components</span>
        <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.1)' }} />
        <span style={{ opacity: 0.8 }}>{Math.round(viewport.scale * 100)}%</span>
      </div>

      {/* Top Right Controls (Layers) */}
      <div
        style={{
          position: 'absolute',
          top: '24px',
          right: '24px',
          zIndex: 1100,
          display: 'flex',
          gap: '8px'
        }}
      >
        <ToolButton
          active={showLayers}
          onClick={(): void => setShowLayers(!showLayers)}
          icon={<Layers size={18} />}
          title="Layers"
        />
      </div>

      {/* Pen Settings Menu */}
      {showPenSettings && penSettingsAnchor && (
        <div data-context-menu="true" onWheel={(e) => e.stopPropagation()}>
          <div
            style={{
              position: 'fixed',
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
            <div style={{ marginBottom: '16px' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="range"
                  min={mode === 'text' ? '8' : '1'}
                  max={mode === 'text' ? '144' : '100'}
                  value={mode === 'text' ? textSize : penSize}
                  onChange={(e): void => {
                    const val = parseInt(e.target.value)
                    if (mode === 'text') {
                      setTextSize(val)
                      if (selectedIds.length > 0) {
                        setElements((prev) =>
                          prev.map((el) => {
                            if (selectedIds.includes(el.id) && el.type === 'text') {
                              return {
                                ...el,
                                fontSize: val,
                                height: Math.max(el.height, val * 1.5)
                              }
                            }
                            return el
                          })
                        )
                      }
                    } else {
                      setPenSize(val)
                      if (selectedIds.length > 0) {
                        setElements((prev) =>
                          prev.map((el) => {
                            if (selectedIds.includes(el.id) && el.type === 'path') {
                              return { ...el, size: val }
                            } else if (selectedIds.includes(el.id) && el.type === 'rect') {
                              return { ...el, strokeWidth: val }
                            }
                            return el
                          })
                        )
                      }
                    }
                  }}
                  style={{ flex: 1, cursor: 'pointer', accentColor: 'var(--accent)' }}
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
            <div style={{ position: 'relative', width: '100%' }}>
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
        <div data-context-menu="true" onWheel={(e) => e.stopPropagation()}>
          <div
            style={{
              position: 'fixed',
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
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.05em'
              }}
            >
              ERASER SIZE
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="range"
                min="4"
                max="100"
                value={eraserSize}
                onChange={(e): void => setEraserSize(parseInt(e.target.value))}
                style={{ flex: 1, cursor: 'pointer', accentColor: 'var(--accent)' }}
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
      {showLayers && (
        <div
          data-context-menu="true"
          onWheel={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '64px',
            right: '18px',
            width: '220px',
            maxHeight: 'calc(100% - 84px)',
            background: 'var(--card-bg)',
            borderRadius: '14px',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1100,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.1em',
                color: 'rgba(255,255,255,0.4)'
              }}
            >
              LAYERS
            </span>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>
              {elements.length}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }} className="custom-scrollbar">
            {elements.length === 0 ? (
              <div
                style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: 'rgba(255, 255, 255, 0.2)',
                  fontSize: '13px'
                }}
              >
                No elements on board
              </div>
            ) : (
              (() => {
                const result: React.ReactNode[] = []
                const processedGroups = new Set<string>()
                const reversed = [...elements].reverse()

                reversed.forEach((el) => {
                  if (el.groupId) {
                    if (!processedGroups.has(el.groupId)) {
                      processedGroups.add(el.groupId)
                      const isExpanded = expandedGroups.includes(el.groupId)
                      const groupMembers = elements.filter((m) => m.groupId === el.groupId)
                      const isGroupSelected = groupMembers.every((m) => selectedIds.includes(m.id))

                      result.push(
                        <div key={el.groupId} style={{ marginBottom: '4px' }}>
                          <div
                            onClick={(e) => {
                              e.stopPropagation()
                              const ids = groupMembers.map((m) => m.id)
                              setSelectedIds(ids)
                            }}
                            style={{
                              padding: '8px 12px',
                              borderRadius: '8px',
                              background: isGroupSelected
                                ? 'rgba(255,255,255,0.08)'
                                : 'rgba(255,255,255,0.02)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              border: isGroupSelected
                                ? '1px solid rgba(255,255,255,0.1)'
                                : '1px solid transparent',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <div
                              onClick={(e) => {
                                e.stopPropagation()
                                setExpandedGroups((prev) =>
                                  isExpanded
                                    ? prev.filter((id) => id !== el.groupId)
                                    : [...prev, el.groupId!]
                                )
                              }}
                              style={{
                                width: '20px',
                                height: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'rgba(255,255,255,0.3)',
                                transition: 'transform 0.2s ease',
                                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                              }}
                            >
                              <div
                                style={{
                                  borderLeft: '4px solid currentColor',
                                  borderTop: '3px solid transparent',
                                  borderBottom: '3px solid transparent'
                                }}
                              />
                            </div>
                            <div
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '6px',
                                background: 'rgba(0,0,0,0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: isGroupSelected ? 'var(--accent)' : 'rgba(255,255,255,0.4)'
                              }}
                            >
                              <Group size={12} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: '12px',
                                  fontWeight: isGroupSelected ? '600' : '400',
                                  color: isGroupSelected ? '#fff' : 'rgba(255,255,255,0.6)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                Group {el.groupId!.slice(0, 4)}
                              </div>
                            </div>
                          </div>

                          {isExpanded && (
                            <div style={{ marginLeft: '24px', marginTop: '4px' }}>
                              {groupMembers
                                .slice()
                                .reverse()
                                .map((member) => {
                                  const isMemberSelected = selectedIds.includes(member.id)
                                  return (
                                    <div
                                      key={member.id}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleElementSelect(member.id)
                                      }}
                                      style={{
                                        padding: '6px 10px',
                                        borderRadius: '6px',
                                        background: isMemberSelected
                                          ? 'rgba(255,255,255,0.08)'
                                          : 'transparent',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        marginBottom: '2px',
                                        border: isMemberSelected
                                          ? '1px solid rgba(255,255,255,0.05)'
                                          : '1px solid transparent'
                                      }}
                                    >
                                      <div
                                        style={{
                                          width: '18px',
                                          height: '18px',
                                          color: isMemberSelected
                                            ? 'var(--accent)'
                                            : 'rgba(255,255,255,0.3)'
                                        }}
                                      >
                                        {member.type === 'path' && <Pen size={12} />}
                                        {member.type === 'rect' && <Square size={12} />}
                                        {member.type === 'image' && <ImageIcon size={12} />}
                                        {member.type === 'video' && <VideoIcon size={12} />}
                                        {member.type === 'link' && <LinkIcon size={12} />}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: '11px',
                                          color: isMemberSelected
                                            ? '#fff'
                                            : 'rgba(255,255,255,0.4)',
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis'
                                        }}
                                      >
                                        {member.title ||
                                          member.type.charAt(0).toUpperCase() +
                                          member.type.slice(1)}
                                      </div>
                                    </div>
                                  )
                                })}
                            </div>
                          )}
                        </div>
                      )
                    }
                  } else {
                    const isSelected = selectedIds.includes(el.id)
                    result.push(
                      <div
                        key={el.id}
                        onClick={() => handleElementSelect(el.id)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: isSelected ? 'rgba(255,255,255,0.08)' : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          marginBottom: '4px',
                          border: isSelected
                            ? '1px solid rgba(255,255,255,0.1)'
                            : '1px solid transparent'
                        }}
                      >
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '10px',
                            background: 'rgba(0,0,0,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.4)'
                          }}
                        >
                          {el.type === 'image' && <ImageIcon size={14} />}
                          {el.type === 'video' && <VideoIcon size={14} />}
                          {el.type === 'link' && <LinkIcon size={14} />}
                          {el.type === 'path' && <Pen size={14} />}
                          {el.type === 'rect' && <Square size={14} />}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '13px',
                              fontWeight: isSelected ? '600' : '400',
                              color: isSelected ? '#fff' : 'rgba(255,255,255,0.6)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {el.title || `${el.type.charAt(0).toUpperCase() + el.type.slice(1)}`}
                          </div>
                          <div
                            style={{
                              fontSize: '10px',
                              color: 'rgba(255,255,255,0.2)',
                              marginTop: '2px'
                            }}
                          >
                            ID: {el.id.slice(0, 8)}
                          </div>
                        </div>
                      </div>
                    )
                  }
                })
                return result
              })()
            )}
          </div>
        </div>
      )}

      {contextMenuPos && (
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
          copyElements={copyToClipboard}
          pasteElements={pasteFromClipboard}
          deleteElements={deleteSelected}
          onClose={() => setContextMenuPos(null)}
        />
      )}

      {showColorPicker && (
        <div data-context-menu="true" onWheel={(e) => e.stopPropagation()}>
          <ColorPicker
            color={theme?.boardBg || '#1b1b1b'}
            onChange={(color) => {
              if (setTheme && theme) setTheme({ ...theme, boardBg: color })
            }}
            onClose={() => setShowColorPicker(false)}
            anchorRect={pickerAnchor}
          />
        </div>
      )}
    </div>
  )
}

interface ToolButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  active?: boolean
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  onContextMenu?: (e: React.MouseEvent<HTMLButtonElement>) => void
  icon: React.ReactNode
  title?: string
  danger?: boolean
  disabled?: boolean
}

const ToolButton = React.forwardRef<HTMLButtonElement, ToolButtonProps>(
  (
    { active, onClick, onDoubleClick, onContextMenu, icon, title, danger, disabled, style },
    ref
  ) => (
    <button
      ref={ref}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      disabled={disabled}
      style={{
        background: active ? 'var(--accent, #525252)' : 'transparent',
        border: 'none',
        color: disabled ? '#333' : danger ? '#ff6b6b' : '#fff',
        padding: '7px',
        borderRadius: '9px',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: disabled ? 0.3 : 1,
        transform: active ? 'scale(1.05)' : 'scale(1)',
        ...style
      }}
      className="tool-btn"
      title={title}
    >
      {icon}
    </button>
  )
)
ToolButton.displayName = 'ToolButton'

interface BoardContentProps {
  elements: BoardElement[]
  activePath: { x: number; y: number }[] | null
  activeRect: { x: number; y: number; w: number; h: number } | null
  penColor: string
  penSize: number
  viewport: Viewport
  selectedIds: string[]
  onSelect: (id: string | null, multi?: boolean) => void
  onSelectionStart: (e: MouseEvent) => void
  onMove: (id: string, x: number, y: number) => void
  onResize: (id: string, width: number, height: number, x?: number, y?: number, handle?: string) => void
  onRotate: (id: string, rotation: number) => void
  onInteractionStart: () => void
  onDoubleClick?: (id: string) => void
  editingTextId?: string | null
  showFPS: boolean
  containerRef: React.RefObject<HTMLDivElement | null>
  interactive?: boolean
  screenWidth: number
  screenHeight: number
  theme?: UITheme
  isAltDown?: boolean
  lastElementDoubleClickTime?: React.MutableRefObject<number>
  guidesRef: React.RefObject<{ x?: number; y?: number }[]>
}

const StatsMonitor = React.memo<{
  showFPS: boolean
  containerRef: React.RefObject<HTMLDivElement | null>
}>(({ showFPS, containerRef }) => {
  const { app: pixiApp } = useApplication()
  const statsRef = useRef<{ statsInstances: Stats[]; wrapper: HTMLDivElement } | null>(null)

  useLayoutEffect(() => {
    if (showFPS && pixiApp && containerRef.current) {
      const container = containerRef.current
      const wrapper = document.createElement('div')
      wrapper.style.position = 'absolute'
      wrapper.style.top = '10px'
      wrapper.style.left = '10px'
      wrapper.style.zIndex = '1000'
      wrapper.style.pointerEvents = 'none'
      wrapper.style.opacity = '0.8'

      const statsInstances: Stats[] = []
      // Multiple panels: FPS, MS, MB
      for (let i = 0; i < 3; i++) {
        try {
          const stats = new Stats()
          stats.showPanel(i)
          const dom = stats.dom
          dom.style.position = 'relative'
          dom.style.display = 'inline-block'
          dom.style.marginRight = '5px'
          
          // Make it transparent
          const children = dom.children
          for (let j = 0; j < children.length; j++) {
            ;(children[j] as HTMLElement).style.background = 'transparent'
            ;(children[j] as HTMLElement).style.backgroundColor = 'transparent'
          }

          wrapper.appendChild(dom)
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
})

const SnappingGuidesRenderer = React.memo(
  ({
    guidesRef,
    scale,
    theme
  }: {
    guidesRef: React.RefObject<{ x?: number; y?: number }[]>
    scale: number
    theme: UITheme | undefined
  }) => {
    const [graphics, setGraphics] = useState<PIXI.Graphics | null>(null)

    useTick(() => {
      if (!graphics) return
      graphics.clear()
      const guides = guidesRef.current
      if (!guides || guides.length === 0) return

      const accentColor = theme?.boardAccent
        ? parseInt(theme.boardAccent.replace('#', ''), 16)
        : 0xff4f4f

      for (let i = 0; i < guides.length; i++) {
        const guide = guides[i]
        // @ts-ignore - PIXI v8 stroke API
        graphics.stroke({ width: 1.5 / scale, color: accentColor, alpha: 0.8 })
        if (guide.x !== undefined) {
          graphics.moveTo(guide.x, -1000000)
          graphics.lineTo(guide.x, 1000000)
        } else if (guide.y !== undefined) {
          graphics.moveTo(-1000000, guide.y)
          graphics.lineTo(1000000, guide.y)
        }
      }
    })

    return <pixiGraphics ref={setGraphics} draw={() => {}} />
  }
)

const BoardContent = React.memo(
  ({
    elements,
    activePath,
    activeRect,
    penColor,
    penSize,
    viewport,
    selectedIds,
    onSelect,
    onSelectionStart,
    onMove,
    onResize,
    onRotate,
    onInteractionStart,
    onDoubleClick,
    editingTextId,
    showFPS,
    containerRef,
    interactive = true,
    screenWidth,
    screenHeight,
    theme,
    isAltDown,
    lastElementDoubleClickTime,
    guidesRef
  }: BoardContentProps) => {
  const pixiElementsRef = useRef<Map<string, PIXI.Container>>(new Map())
  const onRegisterPixiCallback = useCallback((id: string, container: PIXI.Container | null) => {
    if (container) pixiElementsRef.current.set(id, container)
    else pixiElementsRef.current.delete(id)
  }, [])

  const [isDraggingSelection, setIsDraggingSelection] = useState(false)
  const dragStartData = useRef<{ id: string; x: number; y: number; mx: number; my: number } | null>(
    null
  )
  const lastMultiClickTime = useRef<number>(0)

  useEffect(() => {
    if (!isDraggingSelection) return
    const movers: { container: PIXI.Container; initialX: number; initialY: number }[] = []
    if (selectedIds.length > 0) {
      for (const id of selectedIds) {
        const container = pixiElementsRef.current.get(id)
        if (container) {
          movers.push({ container, initialX: container.x, initialY: container.y })
        }
      }
    }

    const onPointerMove = (e: PointerEvent): void => {
      if (!dragStartData.current) return
      const dx = (e.clientX - dragStartData.current.mx) / viewport.scale
      const dy = (e.clientY - dragStartData.current.my) / viewport.scale
      
      for (let i = 0; i < movers.length; i++) {
        const m = movers[i]
        m.container.x = m.initialX + dx
        m.container.y = m.initialY + dy
      }
    }

    const onPointerUp = (e: PointerEvent): void => {
      if (!dragStartData.current) return
      const dx = (e.clientX - dragStartData.current.mx) / viewport.scale
      const dy = (e.clientY - dragStartData.current.my) / viewport.scale
      onMove(dragStartData.current.id, dragStartData.current.x + dx, dragStartData.current.y + dy)

      setIsDraggingSelection(false)
      dragStartData.current = null
      if (guidesRef.current) guidesRef.current = []
      document.body.style.cursor = 'auto'
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      document.body.style.cursor = 'auto'
    }
  }, [isDraggingSelection, viewport.scale, selectedIds, onMove, guidesRef, elements])

  const CULL_MARGIN = 64
  const screenW = (screenWidth + CULL_MARGIN * 2) / viewport.scale
  const screenH = (screenHeight + CULL_MARGIN * 2) / viewport.scale
  const screenX = (-viewport.x - CULL_MARGIN) / viewport.scale
  const screenY = (-viewport.y - CULL_MARGIN) / viewport.scale

  return (
    // @ts-ignore - pixiContainer is an intrinsic PIXI element
    <pixiContainer x={viewport.x} y={viewport.y} scale={viewport.scale}>
      {/* @ts-ignore - pixiGraphics is an intrinsic PIXI element */}
      <pixiGraphics
        draw={(g: PIXI.Graphics): void => {
          g.clear()
          g.beginFill(0x000000, 0)
          g.drawRect(-100000, -100000, 200000, 200000)
          g.endFill()
        }}
        eventMode={interactive ? 'static' : 'none'}
        hitArea={new PIXI.Rectangle(-100000, -100000, 200000, 200000)}
        onPointerDown={(e: PIXI.FederatedPointerEvent): void => {
          if (e.button === 0) {
            onSelectionStart(e.nativeEvent as MouseEvent)
          }
        }}
      />

      {activePath && activePath.length > 0 && (
        <pixiGraphics
          draw={(g: PIXI.Graphics): void => {
            g.clear()
            const pts = activePath as { x: number; y: number; width?: number }[]
            if (pts.length === 0) return

            const colorHex = parseColor(penColor)
            const strokeWidth = penSize

            if (pts.length === 1) {
              g.beginFill(colorHex)
              g.drawCircle(pts[0].x, pts[0].y, strokeWidth / 2)
              g.endFill()
            } else {
              g.moveTo(pts[0].x, pts[0].y)
              if (pts.length > 2) {
                let i
                for (i = 1; i < pts.length - 2; i++) {
                  const xc = (pts[i].x + pts[i + 1].x) / 2
                  const yc = (pts[i].y + pts[i + 1].y) / 2
                  g.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc)
                }
                g.quadraticCurveTo(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y)
              } else {
                g.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
              }

              // Use stroke for PIXI v8 compatibility and smoothness
              // @ts-ignore - PIXI v8 stroke API
              g.stroke({
                width: strokeWidth,
                color: colorHex,
                alpha: 1,
                join: 'round',
                cap: 'round'
              })
            }
          }}
        />
      )}

      {activeRect && (
        <pixiGraphics
          draw={(g: PIXI.Graphics): void => {
            g.clear()
            // Normalize rect dimensions to handle drawing backwards
            let x = activeRect.x
            let y = activeRect.y
            let w = activeRect.w
            let h = activeRect.h

            if (w < 0) {
              x += w
              w = Math.abs(w)
            }
            if (h < 0) {
              y += h
              h = Math.abs(h)
            }

            g.beginFill(0, 0)
            g.drawRect(x, y, w, h)
            g.endFill()
            // @ts-ignore - PIXI v8 stroke API
            g.stroke({
              width: penSize,
              color: parseColor(penColor),
              alpha: 1,
              join: 'round',
              cap: 'round'
            })
          }}
        />
      )}

      {(() => {
        const selectedIdsSet = new Set(selectedIds)
        const items: any[] = []
        for (let i = 0; i < elements.length; i++) {
          const el = elements[i]
          const isSelected = selectedIdsSet.has(el.id)
          const isEditing = el.id === editingTextId
          
          const halfW = el.width / 2
          const halfH = el.height / 2
          const isVisible =
            el.x + halfW > screenX &&
            el.x - halfW < screenX + screenW &&
            el.y + halfH > screenY &&
            el.y - halfH < screenY + screenH

          if (!isVisible) continue

          items.push(
            <ElementItem
              key={el.id}
              element={el}
              isSelected={isSelected}
              zoomScale={viewport.scale}
              onSelect={onSelect}
              onMove={onMove}
              onResize={onResize}
              onRotate={onRotate}
              onInteractionStart={onInteractionStart}
              onDoubleClick={onDoubleClick}
              isEditing={isEditing}
              renderable={true}
              interactive={interactive}
              theme={theme}
              isMultiSelection={selectedIds.length > 1}
              isAltDown={isAltDown}
              guidesRef={guidesRef}
              onRegisterPixi={onRegisterPixiCallback}
            />
          )
        }
        return items
      })()}

      {selectedIds.length > 1 && (
        <pixiContainer>
          {(() => {
            const selectedIdsSet = new Set(selectedIds)
            const selectedElements = elements.filter((el) => selectedIdsSet.has(el.id))
            if (selectedElements.length === 0) return null

            let minX = Infinity,
              minY = Infinity,
              maxX = -Infinity,
              maxY = -Infinity
            selectedElements.forEach((el) => {
              minX = Math.min(minX, el.x - el.width / 2)
              minY = Math.min(minY, el.y - el.height / 2)
              maxX = Math.max(maxX, el.x + el.width / 2)
              maxY = Math.max(maxY, el.y + el.height / 2)
            })

            const w = maxX - minX
            const h = maxY - minY
            const cx = minX + w / 2
            const cy = minY + h / 2
            const accentColor = theme?.boardAccent
              ? parseInt(theme.boardAccent.replace('#', ''), 16)
              : 0x007aff

            const baseHandleSize = 8
            const handleSize = baseHandleSize / viewport.scale
            const lineWidth = 2 / viewport.scale

            const handles = [
              { id: 'top-left', x: minX, y: minY, cursor: 'nwse-resize' },
              { id: 'top', x: cx, y: minY, cursor: 'ns-resize' },
              { id: 'top-right', x: maxX, y: minY, cursor: 'nesw-resize' },
              { id: 'right', x: maxX, y: cy, cursor: 'ew-resize' },
              { id: 'bottom-right', x: maxX, y: maxY, cursor: 'nwse-resize' },
              { id: 'bottom', x: cx, y: maxY, cursor: 'ns-resize' },
              { id: 'bottom-left', x: minX, y: maxY, cursor: 'nesw-resize' },
              { id: 'left', x: minX, y: cy, cursor: 'ew-resize' }
            ]

            return (
              <pixiContainer>
                <pixiGraphics
                  eventMode="static"
                  cursor="move"
                  onPointerDown={(e: PIXI.FederatedPointerEvent): void => {
                    const now = Date.now()
                    if (now - lastMultiClickTime.current < 500) {
                      if (lastElementDoubleClickTime) {
                        lastElementDoubleClickTime.current = now
                      }
                      lastMultiClickTime.current = 0
                      return
                    }
                    lastMultiClickTime.current = now

                    e.stopPropagation()
                    onInteractionStart()
                    setIsDraggingSelection(true)
                    const mainTarget = selectedElements[0]
                    if (mainTarget) {
                      dragStartData.current = {
                        id: mainTarget.id,
                        x: mainTarget.x,
                        y: mainTarget.y,
                        mx: e.nativeEvent.clientX,
                        my: e.nativeEvent.clientY
                      }
                      document.body.style.cursor = 'move'
                    }
                  }}
                  draw={(g: PIXI.Graphics): void => {
                    g.clear()
                    g.beginFill(0xffffff, 0.001) // Nearly invisible hit area
                    g.drawRect(minX, minY, w, h)
                    g.endFill()

                    // @ts-ignore - PIXI v8 stroke API
                    g.stroke({ width: lineWidth, color: accentColor, alpha: 1 })
                  }}
                />
                {handles.map((hd) => (
                  <pixiGraphics
                    key={hd.id}
                    x={hd.x}
                    y={hd.y}
                    eventMode="static"
                    cursor={hd.cursor}
                    draw={(g: PIXI.Graphics): void => {
                      g.clear()
                      g.lineStyle(0)
                      g.beginFill(accentColor)
                      let hw = handleSize
                      let hh = handleSize
                      if (hd.id === 'top' || hd.id === 'bottom') {
                        hw = handleSize * 2.5
                        hh = handleSize * 0.6
                      } else if (hd.id === 'left' || hd.id === 'right') {
                        hh = handleSize * 2.5
                        hw = handleSize * 0.6
                      }
                      g.drawRoundedRect(-hw / 2, -hh / 2, hw, hh, 2 / viewport.scale)
                      g.endFill()
                    }}
                  />
                ))}
              </pixiContainer>
            )
          })()}
        </pixiContainer>
      )}

      {/* Snapping Guides Rendering */}
      <SnappingGuidesRenderer guidesRef={guidesRef} scale={viewport.scale} theme={theme} />

      <StatsMonitor showFPS={showFPS} containerRef={containerRef} />
    </pixiContainer>
  )
})

interface ElementItemProps {
  element: BoardElement
  isSelected: boolean
  zoomScale: number
  onSelect: (id: string | null, multi?: boolean) => void
  onMove: (id: string, x: number, y: number) => void
  onResize: (id: string, w: number, h: number, x?: number, y?: number, handle?: string) => void
  onRotate: (id: string, rotation: number) => void
  onInteractionStart: () => void
  onDoubleClick?: (id: string) => void
  isEditing?: boolean
  renderable?: boolean
  interactive?: boolean
  theme?: UITheme
  isMultiSelection?: boolean
  isAltDown?: boolean
  guidesRef: React.RefObject<{ x?: number; y?: number }[]>
  onRegisterPixi?: (id: string, container: PIXI.Container | null) => void
}

const ROT_CURSORS = (() => {
  const getUrl = (rot: number): string => {
    const svg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g transform="translate(12 12) scale(0.90) translate(-12 -12)"><g transform="rotate(${rot + 180} 12 12)"><path d="M19 10C19 14.9706 14.9706 19 10 19" stroke="white" stroke-width="5.5" stroke-linecap="round"/><path d="M19 10L23 10L19 5L15 10Z" fill="white" stroke="white" stroke-width="3" stroke-linejoin="round"/><path d="M10 19L10 23L5 19L10 15Z" fill="white" stroke="white" stroke-width="3" stroke-linejoin="round"/><path d="M19 10C19 14.9706 14.9706 19 10 19" stroke="black" stroke-width="2.5" stroke-linecap="round"/><path d="M19 10L23 10L19 5L15 10Z" fill="black"/><path d="M10 19L10 23L5 19L10 15Z" fill="black"/></g></g></svg>`
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, auto`
  }
  return { 0: getUrl(0), 90: getUrl(90), 180: getUrl(180), 270: getUrl(270) }
})()

const ElementItem: React.FC<ElementItemProps> = React.memo(
  ({
    element,
    isSelected,
    zoomScale,
    onSelect,
    onMove,
    onResize,
    onRotate,
    onInteractionStart,
    onDoubleClick,
    isEditing = false,
    renderable = true,
    interactive = true,
    theme,
    isMultiSelection = false,
    isAltDown = false,
    guidesRef,
    onRegisterPixi
  }) => {
    const containerRef = useRef<PIXI.Container | null>(null)
    useEffect(() => {
      if (onRegisterPixi) onRegisterPixi(element.id, containerRef.current)
      return () => {
        if (onRegisterPixi) onRegisterPixi(element.id, null)
      }
    }, [element.id, onRegisterPixi])

    const [lodTextures, setLodTextures] = useState<{
      high: PIXI.Texture
      mid?: PIXI.Texture
      low?: PIXI.Texture
    } | null>(null)
    const activeLevel = useMemo(() => {
      if (zoomScale > 0.6) return 'high'
      if (zoomScale > 0.25) return 'mid'
      return 'low'
    }, [zoomScale])

    const activeTexture = useMemo(() => {
      if (!lodTextures) return null
      // @ts-ignore - indexing textures
      return lodTextures[activeLevel] || lodTextures.high
    }, [lodTextures, activeLevel])

    const [isDragging, setIsDragging] = useState(false)
    const [activeHandle, setActiveHandle] = useState<string | null>(null)

    const [loadError, setLoadError] = useState(false)

    const resizeStartData = useRef<{
      w: number
      h: number
      x: number
      y: number
      mx: number
      my: number
      startRotation: number
      startAngle: number
      elementScreenCenterX: number
      elementScreenCenterY: number
    } | null>(null)

    const lastClickTime = useRef<number>(0)
    const texturesRef = useRef<PIXI.Texture[]>([])

    // Helper to generate downscaled textures for LOD
    const generateLOD = useCallback(
      (source: HTMLImageElement | HTMLVideoElement): { mid: PIXI.Texture; low: PIXI.Texture } => {
        const createLevel = (scale: number): PIXI.Texture => {
          const canvas = document.createElement('canvas')
          const w = (source instanceof HTMLVideoElement ? source.videoWidth : source.width) * scale
          const h =
            (source instanceof HTMLVideoElement ? source.videoHeight : source.height) * scale
          canvas.width = Math.max(1, w)
          canvas.height = Math.max(1, h)
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
          }
          return PIXI.Texture.from(canvas)
        }

        return {
          mid: createLevel(0.5),
          low: createLevel(0.25)
        }
      },
      []
    )

    useEffect(() => {
      let active = true
      const cleanupTextures = (): void => {
        for (const t of texturesRef.current) {
          if (t && !t.destroyed) {
            t.destroy(true)
            // PIXI v8 Cache management
            try { PIXI.Cache.remove(t.label || (t as any).uid) } catch (e) {}
          }
        }
        texturesRef.current = []
      }

      const loadMedia = async (): Promise<void> => {
        if (!element.url) return
        try {
          if (element.type === 'image') {
            const img = new Image()
            if (element.url.startsWith('http')) {
              img.crossOrigin = 'anonymous'
            }
            img.src = element.url
            await new Promise((resolve, reject) => {
              img.onload = resolve
              img.onerror = () => {
                setLoadError(true)
                reject(new Error('Failed to load: ' + element.url))
              }
            })
            if (active) {
              cleanupTextures()
              const high = PIXI.Texture.from(img)
              const lods = generateLOD(img)
              texturesRef.current = [high, lods.mid, lods.low]
              setLodTextures({ high, ...lods })
              if (!element.width || !element.height) {
                onResize(element.id, img.width, img.height)
              }
            }
          } else if (element.type === 'video') {
            const video = document.createElement('video')
            video.src = element.url
            video.muted = true
            video.loop = true
            video.autoplay = true
            video.crossOrigin = 'anonymous'
            await video.play().catch((err) => {
              console.error('Video play error:', err)
              setLoadError(true)
            })

            if (active) {
              cleanupTextures()
              const high = PIXI.Texture.from(video)
              texturesRef.current = [high]
              setLodTextures({ high })
              if (video.videoWidth > 0 && video.videoHeight > 0) {
                onResize(element.id, video.videoWidth, video.videoHeight)
              } else {
                const onMeta = (): void => {
                  if (active) onResize(element.id, video.videoWidth, video.videoHeight)
                }
                video.addEventListener('loadedmetadata', onMeta)
              }
            }
          }
        } catch (err) {
          console.error('LOD Load error', err)
          setLoadError(true)
        }
      }

      loadMedia()
      return () => {
        active = false
        cleanupTextures()
      }
    }, [element.url, element.type, element.id]) // Strict dependencies to prevent leak



    useEffect(() => {
      if (!isDragging && !activeHandle) return

      const onPointerMove = (e: PointerEvent): void => {
        if (!resizeStartData.current) return

        const dx = (e.clientX - resizeStartData.current.mx) / zoomScale
        const dy = (e.clientY - resizeStartData.current.my) / zoomScale

        if (isDragging && !activeHandle) {
          if (containerRef.current) {
            containerRef.current.x = resizeStartData.current.x + dx
            containerRef.current.y = resizeStartData.current.y + dy
          }
        } else if (activeHandle && !activeHandle.startsWith('rotate-')) {
          let newW = resizeStartData.current.w
          let newH = resizeStartData.current.h
          let newX = resizeStartData.current.x
          let newY = resizeStartData.current.y
          const h = activeHandle

          if (h.includes('right')) {
            newW = Math.max(20, resizeStartData.current.w + dx)
            newX = resizeStartData.current.x + (newW - resizeStartData.current.w) / 2
          } else if (h.includes('left')) {
            newW = Math.max(20, resizeStartData.current.w - dx)
            newX = resizeStartData.current.x - (newW - resizeStartData.current.w) / 2
          }

          if (h.includes('bottom')) {
            newH = Math.max(20, resizeStartData.current.h + dy)
            newY = resizeStartData.current.y + (newH - resizeStartData.current.h) / 2
          } else if (h.includes('top')) {
            newH = Math.max(20, resizeStartData.current.h - dy)
            newY = resizeStartData.current.y - (newH - resizeStartData.current.h) / 2
          }

          onResize(element.id, newW, newH, newX, newY, h)
        } else if (activeHandle && activeHandle.startsWith('rotate-')) {
          const newAngle = Math.atan2(
            e.clientY - resizeStartData.current.elementScreenCenterY,
            e.clientX - resizeStartData.current.elementScreenCenterX
          )
          const rotationDelta = newAngle - resizeStartData.current.startAngle
          let finalRotation = resizeStartData.current.startRotation + rotationDelta

          if (e.shiftKey) {
            const step = (15 * Math.PI) / 180
            finalRotation = Math.round(finalRotation / step) * step
          }

          onRotate(element.id, finalRotation)
        }
      }

      const onPointerUp = (e: PointerEvent): void => {
        if (!resizeStartData.current) return
        const dx = (e.clientX - resizeStartData.current.mx) / zoomScale
        const dy = (e.clientY - resizeStartData.current.my) / zoomScale
        
        if (activeHandle && !activeHandle.startsWith('rotate-')) {
          let newW = resizeStartData.current.w
          let newH = resizeStartData.current.h
          let newX = resizeStartData.current.x
          let newY = resizeStartData.current.y
          const h = activeHandle

          if (h.includes('right')) {
            newW = Math.max(20, resizeStartData.current.w + dx)
            newX = resizeStartData.current.x + (newW - resizeStartData.current.w) / 2
          } else if (h.includes('left')) {
            newW = Math.max(20, resizeStartData.current.w - dx)
            newX = resizeStartData.current.x - (newW - resizeStartData.current.w) / 2
          }

          if (h.includes('bottom')) {
            newH = Math.max(20, resizeStartData.current.h + dy)
            newY = resizeStartData.current.y + (newH - resizeStartData.current.h) / 2
          } else if (h.includes('top')) {
            newH = Math.max(20, resizeStartData.current.h - dy)
            newY = resizeStartData.current.y - (newH - resizeStartData.current.h) / 2
          }
          onResize(element.id, newW, newH, newX, newY, activeHandle)
        } else if (activeHandle && activeHandle.startsWith('rotate-')) {
          // Final rotation handled by onPointerMove and simplified here if needed
        } else {
          onMove(element.id, resizeStartData.current.x + dx, resizeStartData.current.y + dy)
        }

        setIsDragging(false)
        setActiveHandle(null)
        if (guidesRef.current) guidesRef.current = []
        document.body.style.cursor = 'auto'
      }

      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
      return () => {
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        document.body.style.cursor = 'auto'
      }
    }, [isDragging, activeHandle, zoomScale, element.id, onMove, onResize, onInteractionStart, guidesRef])

    const handlePointerDown = (e: PIXI.FederatedPointerEvent): void => {
      onInteractionStart()
      if (e.button === 0) {
        if (onDoubleClick) {
          const now = Date.now()
          if (now - lastClickTime.current < 500) {
            onDoubleClick(element.id)
            lastClickTime.current = 0
            return // Prevent dragging logic from starting on double-click
          }
          lastClickTime.current = now
        }

        onSelect(element.id, e.shiftKey)
        const center = e.currentTarget.toGlobal(new PIXI.Point(0, 0))
        const mouseEvent = e.nativeEvent as MouseEvent
        if (mouseEvent.altKey) {
          setActiveHandle('rotate-body')
          setIsDragging(false)

          resizeStartData.current = {
            w: element.width,
            h: element.height,
            x: element.x,
            y: element.y,
            mx: mouseEvent.clientX,
            my: mouseEvent.clientY,
            startRotation: element.rotation || 0,
            startAngle: Math.atan2(mouseEvent.clientY - center.y, mouseEvent.clientX - center.x),
            elementScreenCenterX: center.x,
            elementScreenCenterY: center.y
          }

          document.body.style.cursor = `url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cGF0aCBkPSJNMTYgMTAuOEMxNy4xIDExLjUgMTcuOCAxMi42IDE3LjggMTQgMTcuOCAxNy4yIDE1LjIgMTkuOCAxMiAxOS44IDguOCAxOS44IDYuMiAxNy4yIDYuMiAxNCA2LjIgMTIuNiA2LjkgMTEuNSA4IDEwLjgiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPHBhdGggZD0iTTE2IDEwLjhDMTcuMSAxMS41IDE3LjggMTIuNiAxNy44IDE0IDE3LjggMTcuMiAxNS4yIDE5LjggMTIgMTkuOCA4LjggMTkuOCA2LjIgMTcuMiA2LjIgMTQgNi4yIDEyLjYgNi45IDExLjUgOCAxMC44IiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjEiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogIDxwYXRoIGQ9Ik0xOC40IDZWMTBIMTQuNCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KICA8cGF0aCBkPSJNMTguNCA2VjEwSDE0LjQiIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iMSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CiAgPHBhdGggZD0iTTUuNiA2VjEwSDkuNiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KICA8cGF0aCBkPSJNNS42IDZWMTBIOS42IiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjEiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+") 12 12, auto`
        } else {
          setIsDragging(true)
          resizeStartData.current = {
            w: element.width,
            h: element.height,
            x: element.x,
            y: element.y,
            mx: mouseEvent.clientX,
            my: mouseEvent.clientY,
            startRotation: element.rotation || 0,
            startAngle: 0,
            elementScreenCenterX: 0,
            elementScreenCenterY: 0
          }
        }
        e.stopPropagation()
      }
    }

    const handleResizeStart = (e: PIXI.FederatedPointerEvent, handle: string): void => {
      e.stopPropagation()
      onInteractionStart()
      setActiveHandle(handle)
      setIsDragging(false)

      let cursor = 'auto'
      if (handle.startsWith('rotate-')) {
        const idMap = {
          'rotate-top-left': 0,
          'rotate-top-right': 90,
          'rotate-bottom-right': 180,
          'rotate-bottom-left': 270
        }
        const rot = idMap[handle as keyof typeof idMap]
        cursor = ROT_CURSORS[rot as keyof typeof ROT_CURSORS]
      } else {
        const idMap = {
          'top-left': 'nwse-resize',
          top: 'ns-resize',
          'top-right': 'nesw-resize',
          right: 'ew-resize',
          'bottom-right': 'nwse-resize',
          bottom: 'ns-resize',
          'bottom-left': 'nesw-resize',
          left: 'ew-resize'
        }
        cursor = idMap[handle as keyof typeof idMap] || 'auto'
      }
      document.body.style.cursor = cursor

      resizeStartData.current = {
        w: element.width,
        h: element.height,
        x: element.x,
        y: element.y,
        mx: e.nativeEvent.clientX,
        my: e.nativeEvent.clientY,
        startRotation: element.rotation || 0,
        startAngle: 0,
        elementScreenCenterX: 0,
        elementScreenCenterY: 0
      }

      // Calculate center in screen coords.
      const halfW = element.width / 2
      const halfH = element.height / 2
      const cos = Math.cos(element.rotation || 0)
      const sin = Math.sin(element.rotation || 0)

      // Need to find handle position in element space for rotation handles
      let hx = 0,
        hy = 0
      if (handle.includes('top-left')) {
        hx = -halfW
        hy = -halfH
      } else if (handle.includes('top-right')) {
        hx = halfW
        hy = -halfH
      } else if (handle.includes('bottom-left')) {
        hx = -halfW
        hy = halfH
      } else if (handle.includes('bottom-right')) {
        hx = halfW
        hy = halfH
      } else if (handle === 'top') {
        hy = -halfH
      } else if (handle === 'bottom') {
        hy = halfH
      } else if (handle === 'left') {
        hx = -halfW
      } else if (handle === 'right') {
        hx = halfW
      }

      const rotatedX = (hx * cos - hy * sin) * zoomScale
      const rotatedY = (hx * sin + hy * cos) * zoomScale

      // If it's a rotation handle, it's 1.08x further out
      const factor = handle.startsWith('rotate-') ? 1.08 : 1
      const screenCenterX = e.nativeEvent.clientX - rotatedX * factor
      const screenCenterY = e.nativeEvent.clientY - rotatedY * factor

      resizeStartData.current.elementScreenCenterX = screenCenterX
      resizeStartData.current.elementScreenCenterY = screenCenterY

      if (handle.startsWith('rotate-')) {
        resizeStartData.current.startAngle = Math.atan2(
          e.nativeEvent.clientY - screenCenterY,
          e.nativeEvent.clientX - screenCenterX
        )
      }
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
        rotation={element.rotation || 0}
        visible={renderable}
        ref={containerRef}
      >
        <pixiContainer
          eventMode={interactive ? 'static' : 'none'}
          cursor={
            isAltDown
              ? `url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cGF0aCBkPSJNMTYgMTAuOEMxNy4xIDExLjUgMTcuOCAxMi42IDE3LjggMTQgMTcuOCAxNy4yIDE1LjIgMTkuOCAxMiAxOS44IDguOCAxOS44IDYuMiAxNy4yIDYuMiAxNCA2LjIgMTIuNiA2LjkgMTEuNSA4IDEwLjgiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPHBhdGggZD0iTTE2IDEwLjhDMTcuMSAxMS41IDE3LjggMTIuNiAxNy44IDE0IDE3LjggMTcuMiAxNS4yIDE5LjggMTIgMTkuOCA4LjggMTkuOCA2LjIgMTcuMiA2LjIgMTQgNi4yIDEyLjYgNi45IDExLjUgOCAxMC44IiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjEiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogIDxwYXRoIGQ9Ik0xOC40IDZWMTBIMTQuNCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KICA8cGF0aCBkPSJNMTguNCA2VjEwSDE0LjQiIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iMSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CiAgPHBhdGggZD0iTTUuNiA2VjEwSDkuNiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KICA8cGF0aCBkPSJNNS42IDZWMTBIOS42IiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjEiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+") 12 12, auto`
              : interactive
                ? 'pointer'
                : 'auto'
          }
          onPointerDown={handlePointerDown}
        >
          {element.type === 'link' ? (
            <pixiContainer onClick={handleLinkClick}>
              <pixiGraphics
                draw={(g: PIXI.Graphics): void => {
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
          ) : element.type === 'path' ? (
            <pixiContainer>
              <pixiGraphics
                draw={(g: PIXI.Graphics): void => {
                  g.clear()
                  if (!element.points || element.points.length === 0) return
                  const pts = element.points as { x: number; y: number; width?: number }[]
                  const colorHex = parseColor(element.color)
                  const strokeWidth = element.size || 2

                  // @ts-ignore - baseWidth/baseHeight for paths
                  const sx = element.width / (element.baseWidth || element.width || 1)
                  // @ts-ignore - baseWidth/baseHeight for paths
                  const sy = element.height / (element.baseHeight || element.height || 1)

                  const renderPath = (): void => {
                    if (pts.length > 1) {
                      g.moveTo(pts[0].x * sx, pts[0].y * sy)
                      if (pts.length > 2) {
                        let i
                        for (i = 1; i < pts.length - 2; i++) {
                          const pNext = pts[i + 1]
                          const xc = (pts[i].x * sx + pNext.x * sx) / 2
                          const yc = (pts[i].y * sy + pNext.y * sy) / 2
                          g.quadraticCurveTo(pts[i].x * sx, pts[i].y * sy, xc, yc)
                        }
                        g.quadraticCurveTo(
                          pts[i].x * sx,
                          pts[i].y * sy,
                          pts[i + 1].x * sx,
                          pts[i + 1].y * sy
                        )
                      } else {
                        g.lineTo(pts[1].x * sx, pts[1].y * sy)
                      }
                    } else if (pts.length === 1) {
                      g.beginFill(colorHex)
                      g.drawCircle(pts[0].x * sx, pts[0].y * sy, strokeWidth / 2)
                      g.endFill()
                    }
                  }

                  // 1. Ghost stroke for wider hit area (invisible)
                  renderPath()
                  // @ts-ignore - PIXI v8 stroke API
                  g.stroke({
                    width: Math.max(24, strokeWidth + 10),
                    color: colorHex,
                    alpha: 0,
                    join: 'round',
                    cap: 'round'
                  })

                  // 2. Actual visual stroke
                  renderPath()
                  // @ts-ignore - PIXI v8 stroke API
                  g.stroke({
                    width: strokeWidth,
                    color: colorHex,
                    alpha: 1,
                    join: 'round',
                    cap: 'round'
                  })
                }}
              />
            </pixiContainer>
          ) : element.type === 'rect' ? (
            <pixiGraphics
              draw={(g: PIXI.Graphics): void => {
                g.clear()
                const fillColor =
                  element.color && element.color !== 'transparent' ? parseColor(element.color) : 0
                const fillAlpha = element.color === 'transparent' ? 0 : 1
                const strokeColor = parseColor(element.strokeColor)
                const strokeWidth = element.strokeWidth || 2

                g.beginFill(fillColor, fillAlpha)
                g.drawRect(-element.width / 2, -element.height / 2, element.width, element.height)
                g.endFill()

                if (strokeWidth > 0) {
                  // @ts-ignore - PIXI v8 stroke API
                  g.stroke({
                    width: strokeWidth,
                    color: strokeColor,
                    alpha: 1,
                    join: 'round',
                    cap: 'round'
                  })
                }

                g.hitArea = new PIXI.Rectangle(
                  -element.width / 2,
                  -element.height / 2,
                  element.width,
                  element.height
                )
              }}
            />
          ) : element.type === 'text' ? (
            <pixiContainer>
              <pixiGraphics
                draw={(g: PIXI.Graphics): void => {
                  g.clear()
                  g.beginFill(0, 0)
                  g.drawRect(-element.width / 2, -element.height / 2, element.width, element.height)
                  g.endFill()
                  g.hitArea = new PIXI.Rectangle(
                    -element.width / 2,
                    -element.height / 2,
                    element.width,
                    element.height
                  )
                }}
              />
              {!isEditing && (
                <pixiText
                  text={element.text || ''}
                  x={
                    element.textAlign === 'center'
                      ? 0
                      : element.textAlign === 'right'
                        ? element.width / 2
                        : -element.width / 2
                  }
                  y={-element.height / 2}
                  // @ts-ignore - resolution is supported in PIXI but missing from @pixi/react types
                  resolution={Math.min(10, Math.max(2, window.devicePixelRatio * zoomScale))}
                  anchor={{
                    x: element.textAlign === 'center' ? 0.5 : element.textAlign === 'right' ? 1 : 0,
                    y: 0
                  }}
                  style={
                    new PIXI.TextStyle({
                      fill: element.color || '#ffffff',
                      fontSize: element.fontSize || 24,
                      fontWeight: String(element.fontWeight || 400) as PIXI.TextStyleFontWeight,
                      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                      wordWrap: true,
                      wordWrapWidth: element.width,
                      lineHeight: (element.fontSize || 24) * 1.4
                    })
                  }
                />
              )}
            </pixiContainer>
          ) : activeTexture ? (
            <pixiSprite
              key={`${element.id}-${activeLevel}`}
              texture={activeTexture}
              width={element.width}
              height={element.height}
              anchor={0.5}
            />
          ) : (
            <pixiContainer>
              <pixiGraphics
                draw={(g: PIXI.Graphics): void => {
                  g.clear()
                  g.beginFill(loadError ? 0x222222 : 0x333333)
                  g.drawRoundedRect(
                    -element.width / 2,
                    -element.height / 2,
                    element.width,
                    element.height,
                    12
                  )
                  g.endFill()

                  if (loadError) {
                    g.beginFill(0, 0)
                    g.drawRoundedRect(
                      -element.width / 2 + 4,
                      -element.height / 2 + 4,
                      element.width - 8,
                      element.height - 8,
                      8
                    )
                    g.endFill()
                    // @ts-ignore - PIXI v8 stroke API
                    g.stroke({ width: 1, color: 0xff5252, alpha: 0.5 })
                  }
                }}
              />
              {loadError && (
                <pixiText
                  text="⚠️ Resource Expired or Missing"
                  anchor={0.5}
                  style={
                    new PIXI.TextStyle({
                      fill: '#ff5252',
                      fontSize: 12,
                      fontWeight: '700',
                      wordWrap: true,
                      wordWrapWidth: element.width - 20
                    })
                  }
                />
              )}
            </pixiContainer>
          )}
        </pixiContainer>

        {isSelected && (
          <pixiContainer>
            {(() => {
              const accentColor = theme?.boardAccent
                ? parseInt(theme.boardAccent.replace('#', ''), 16)
                : 0x007aff
              const baseHandleSize = 8
              const handleSize = baseHandleSize / zoomScale
              const hitAreaSize = handleSize * 3
              const lineWidth = 1 / zoomScale // Thin outline for all selected
              const selectionLineWidth = 2 / zoomScale // Thick outline for single selection
              const halfW = element.width / 2
              const halfH = element.height / 2

              const handles = [
                { id: 'top-left', x: -halfW, y: -halfH, cursor: 'nwse-resize' },
                { id: 'top', x: 0, y: -halfH, cursor: 'ns-resize' },
                { id: 'top-right', x: halfW, y: -halfH, cursor: 'nesw-resize' },
                { id: 'right', x: halfW, y: 0, cursor: 'ew-resize' },
                { id: 'bottom-right', x: halfW, y: halfH, cursor: 'nwse-resize' },
                { id: 'bottom', x: 0, y: halfH, cursor: 'ns-resize' },
                { id: 'bottom-left', x: -halfW, y: halfH, cursor: 'nesw-resize' },
                { id: 'left', x: -halfW, y: 0, cursor: 'ew-resize' }
              ]

              return (
                <pixiContainer>
                  {/* Thin outline always present if selected */}
                  <pixiGraphics
                    draw={(g: PIXI.Graphics): void => {
                      g.clear()
                      g.beginFill(0, 0)
                      g.lineStyle(lineWidth, accentColor, 0.8)
                      g.drawRect(-halfW, -halfH, element.width, element.height)
                      g.endFill()
                    }}
                  />

                  {/* Heavy frame and handles only if single selection */}
                  {!isMultiSelection && (
                    <pixiContainer>
                      <pixiGraphics
                        draw={(g: PIXI.Graphics): void => {
                          g.clear()
                          g.beginFill(0, 0)
                          g.drawRect(-halfW, -halfH, element.width, element.height)
                          g.endFill()
                          // @ts-ignore - PIXI v8 stroke API
                          g.stroke({ width: selectionLineWidth, color: accentColor, alpha: 1 })
                        }}
                      />
                      {handles.map((h) => (
                        <pixiGraphics
                          key={h.id}
                          eventMode="static"
                          cursor={h.cursor}
                          onPointerDown={(ev: PIXI.FederatedPointerEvent): void =>
                            handleResizeStart(ev, h.id)
                          }
                          draw={(g: PIXI.Graphics): void => {
                            g.clear()
                            g.beginFill(0, 0)
                            g.drawRect(-hitAreaSize / 2, -hitAreaSize / 2, hitAreaSize, hitAreaSize)
                            g.endFill()

                            g.lineStyle(0)
                            g.beginFill(accentColor)
                            let hw = handleSize
                            let hh = handleSize
                            if (h.id === 'top' || h.id === 'bottom') {
                              hw = handleSize * 2.5
                              hh = handleSize * 0.6
                            } else if (h.id === 'left' || h.id === 'right') {
                              hh = handleSize * 2.5
                              hw = handleSize * 0.6
                            }
                            g.drawRoundedRect(-hw / 2, -hh / 2, hw, hh, 2 / zoomScale)
                            g.endFill()
                          }}
                          x={h.x}
                          y={h.y}
                        />
                      ))}
                      {/* Rotation handles at corners (invisible zones) */}
                      {[
                        { id: 'rotate-top-left', hx: -halfW, hy: -halfH, rot: 0 },
                        { id: 'rotate-top-right', hx: halfW, hy: -halfH, rot: 90 },
                        { id: 'rotate-bottom-right', hx: halfW, hy: halfH, rot: 180 },
                        { id: 'rotate-bottom-left', hx: -halfW, hy: halfH, rot: 270 }
                      ].map((rh) => {
                        const scrOffset = 16 / zoomScale
                        return (
                          <pixiGraphics
                            key={rh.id}
                            eventMode="static"
                            cursor={ROT_CURSORS[rh.rot as keyof typeof ROT_CURSORS]}
                            onPointerDown={(ev: PIXI.FederatedPointerEvent): void =>
                              handleResizeStart(ev, rh.id)
                            }
                            draw={(g: PIXI.Graphics): void => {
                              g.clear()
                              const size = 14 / zoomScale
                              g.lineStyle(0)
                              g.beginFill(0xffffff, 0.001)
                              g.drawCircle(0, 0, size)
                              g.endFill()
                            }}
                            x={rh.hx + (rh.hx > 0 ? scrOffset : -scrOffset)}
                            y={rh.hy + (rh.hy > 0 ? scrOffset : -scrOffset)}
                          />
                        )
                      })}
                    </pixiContainer>
                  )}
                </pixiContainer>
              )
            })()}
          </pixiContainer>
        )}

        {element.type === 'video' && (
          <pixiContainer y={element.height / 2 - 25}>
            <pixiGraphics
              draw={(g: PIXI.Graphics): void => {
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
ElementItem.displayName = 'ElementItem'

export default BoardsView
