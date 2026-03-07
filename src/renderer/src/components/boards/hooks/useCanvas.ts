import { useState, useCallback, useRef, useEffect } from 'react'
import Konva from 'konva'

interface Transform {
  x: number
  y: number
  scale: number
}

/**
 * Lightweight canvas hook.
 * Pan & zoom are handled natively by Konva Stage (draggable + onWheel).
 * This hook only manages:
 *  - keyboard state (Space / Ctrl)
 *  - a transformRef that mirrors the Stage position/scale (for DOM overlay sync)
 *  - screenToWorld helper that reads directly from the Stage ref
 *  - zoomToRect for animated focus
 */
export const useCanvas = (isHandMode: boolean = false) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage | null>(null)
  // DOM overlay container that follows the canvas transform
  const overlayRef = useRef<HTMLDivElement>(null)
  // Current path SVG overlay (legacy, will be removed once path draws on Konva)
  const currentPathOverlayRef = useRef<HTMLDivElement>(null)

  const [isSpaceDown, setIsSpaceDown] = useState(false)
  const [isCtrlDown, setIsCtrlDown] = useState(false)

  // Ref-based transform for non-React reads (no re-renders)
  const transformRef = useRef<Transform>({ x: 0, y: 0, scale: 1 })
  const containerRectRef = useRef<DOMRect | null>(null)

  const updateRect = useCallback(() => {
    if (containerRef.current) {
      containerRectRef.current = containerRef.current.getBoundingClientRect()
    }
  }, [])

  /** Sync DOM overlay transforms from the Konva Stage — called on every stage move/zoom */
  const syncOverlays = useCallback(() => {
    const t = transformRef.current
    const css = `translate(${t.x}px, ${t.y}px) scale(${t.scale})`
    if (overlayRef.current) {
      overlayRef.current.style.transform = css
    }
    if (currentPathOverlayRef.current) {
      currentPathOverlayRef.current.style.transform = css
    }
  }, [])

  /** Read current transform from the Konva Stage and update the ref */
  const readStageTransform = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    transformRef.current = {
      x: stage.x(),
      y: stage.y(),
      scale: stage.scaleX()
    }
  }, [])

  /** Convert screen coords to world coords using the Stage ref directly */
  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    let rect = containerRectRef.current
    if (!rect) {
      rect = containerRef.current?.getBoundingClientRect() || null
      containerRectRef.current = rect
    }
    if (!rect) return { x: 0, y: 0 }
    const t = transformRef.current
    return {
      x: (clientX - rect.left - t.x) / t.scale,
      y: (clientY - rect.top - t.y) / t.scale
    }
  }, [])

  /** Konva Stage onDragMove handler — syncs overlays without React state */
  const handleStageDragMove = useCallback(() => {
    readStageTransform()
    syncOverlays()
  }, [readStageTransform, syncOverlays])

  /** Konva Stage onWheel handler — zoom to cursor, bypass React */
  const handleStageWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault()
      const stage = stageRef.current
      if (!stage) return

      const we = e.evt
      const isTrackpad = we.deltaMode === 0
      const isPinch = we.ctrlKey

      if (isTrackpad && !isPinch) {
        // Trackpad pan
        stage.x(stage.x() - we.deltaX)
        stage.y(stage.y() - we.deltaY)
      } else {
        // Zoom to pointer
        const zoomSpeed = isPinch ? 0.015 : 0.001
        const zoomFactor = Math.exp(-we.deltaY * zoomSpeed)
        const oldScale = stage.scaleX()
        const newScale = Math.min(Math.max(oldScale * zoomFactor, 0.1), 10)

        const pointer = stage.getPointerPosition()
        if (!pointer) return

        const mousePointTo = {
          x: (pointer.x - stage.x()) / oldScale,
          y: (pointer.y - stage.y()) / oldScale
        }

        stage.scaleX(newScale)
        stage.scaleY(newScale)
        stage.x(pointer.x - mousePointTo.x * newScale)
        stage.y(pointer.y - mousePointTo.y * newScale)
      }

      stage.batchDraw()
      readStageTransform()
      syncOverlays()
    },
    [readStageTransform, syncOverlays]
  )

  /** Programmatic zoom-to-rect (e.g. focus on selected elements) */
  const zoomToRect = useCallback(
    (rect: { x: number; y: number; width: number; height: number }, padding = 100) => {
      const container = containerRef.current
      const stage = stageRef.current
      if (!container || !stage) return

      updateRect()
      const cRect = containerRectRef.current
      if (!cRect) return
      const availableW = cRect.width - padding * 2
      const availableH = cRect.height - padding * 2

      const scaleX = availableW / rect.width
      const scaleY = availableH / rect.height
      const newScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.1), 5)

      const centerX = rect.x + rect.width / 2
      const centerY = rect.y + rect.height / 2

      stage.scaleX(newScale)
      stage.scaleY(newScale)
      stage.x(cRect.width / 2 - centerX * newScale)
      stage.y(cRect.height / 2 - centerY * newScale)
      stage.batchDraw()

      readStageTransform()
      syncOverlays()
    },
    [readStageTransform, syncOverlays]
  )

  // Keyboard listeners (Space for pan, Ctrl for scrubby zoom)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpaceDown(true)
      if (e.code === 'ControlLeft' || e.code === 'ControlRight') setIsCtrlDown(true)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpaceDown(false)
      if (e.code === 'ControlLeft' || e.code === 'ControlRight') setIsCtrlDown(false)
    }
    const handleBlur = () => {
      setIsSpaceDown(false)
      setIsCtrlDown(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  return {
    containerRef,
    stageRef,
    overlayRef,
    currentPathOverlayRef,
    transformRef,
    isSpaceDown,
    isCtrlDown,
    screenToWorld,
    zoomToRect,
    handleStageDragMove,
    handleStageWheel,
    syncOverlays,
    updateRect,
    isHandMode
  }
}
