import { useState, useCallback, useRef, useEffect } from 'react'
import { Viewport } from '../types'

/**
 * Manages board navigation (pan, zoom via wheel, zoom via Ctrl+drag).
 * Uses RAF-based batching to prevent excessive React re-renders during fast zoom/pan.
 */
export const useBoardNavigation = (
  containerRef: React.RefObject<HTMLDivElement | null>,
  mode: string,
  isSpaceDown: boolean,
  initialViewport?: Viewport
) => {
  const [viewport, setViewportState] = useState<Viewport>(initialViewport || { x: 0, y: 0, scale: 1 })
  const [isGrabbing, setIsGrabbing] = useState(false)
  
  const isPanning = useRef(false)
  const isZooming = useRef(false)
  const lastMousePos = useRef({ x: 0, y: 0 })
  const zoomCenter = useRef({ x: 0, y: 0 })
  const isNavigatingRef = useRef(false)

  // --- RAF-based viewport batching ---
  // The ref is ALWAYS up-to-date. React state is synced via RAF (max once per frame).
  const viewportRef = useRef(viewport)
  const rafPending = useRef(false)

  // Sync ref when state changes from external sources (e.g., initial load, resize observer)
  useEffect(() => { viewportRef.current = viewport }, [viewport])

  /** Schedules a React state sync from the ref. Multiple calls per frame are collapsed into one. */
  const flushViewport = useCallback(() => {
    if (!rafPending.current) {
      rafPending.current = true
      requestAnimationFrame(() => {
        rafPending.current = false
        setViewportState({ ...viewportRef.current })
      })
    }
  }, [])

  // --- Wheel zoom ---
  const handleWheel = useCallback(
    (e: WheelEvent): void => {
      e.preventDefault()
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top

      const current = viewportRef.current
      const worldX = (screenX - current.x) / current.scale
      const worldY = (screenY - current.y) / current.scale

      const zoomFactor = 1 - e.deltaY * 0.001
      const newScale = Math.min(Math.max(current.scale * zoomFactor, 0.05), 10)

      const newX = screenX - worldX * newScale
      const newY = screenY - worldY * newScale

      viewportRef.current = { x: newX, y: newY, scale: newScale }
      flushViewport()
    },
    [containerRef, flushViewport]
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel, containerRef])

  // --- Pointer-initiated pan / Ctrl+drag zoom ---
  const onPointerDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && e.ctrlKey && (isSpaceDown || mode === 'hand')) {
      isZooming.current = true
      isNavigatingRef.current = true
      window.dispatchEvent(new CustomEvent('cancel-element-drag'))
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
      isNavigatingRef.current = true
      window.dispatchEvent(new CustomEvent('cancel-element-drag'))
      setIsGrabbing(true)
      lastMousePos.current = { x: e.clientX, y: e.clientY }
    }
  }, [isSpaceDown, mode, containerRef])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent): void => {
      if (isZooming.current) {
        const dx = e.clientX - lastMousePos.current.x
        const dy = e.clientY - lastMousePos.current.y
        const delta = Math.abs(dx) > Math.abs(dy) ? -dx : dy
        const zoomFactor = 1 - delta * 0.01
        const current = viewportRef.current
        const newScale = Math.min(Math.max(current.scale * zoomFactor, 0.05), 10)
        const worldX = (zoomCenter.current.x - current.x) / current.scale
        const worldY = (zoomCenter.current.y - current.y) / current.scale
        viewportRef.current = {
          x: zoomCenter.current.x - worldX * newScale,
          y: zoomCenter.current.y - worldY * newScale,
          scale: newScale
        }
        flushViewport()
        lastMousePos.current = { x: e.clientX, y: e.clientY }
      } else if (isPanning.current) {
        const dx = e.clientX - lastMousePos.current.x
        const dy = e.clientY - lastMousePos.current.y
        viewportRef.current = {
          ...viewportRef.current,
          x: viewportRef.current.x + dx,
          y: viewportRef.current.y + dy
        }
        flushViewport()
        lastMousePos.current = { x: e.clientX, y: e.clientY }
      }
    }

    const onMouseUp = (): void => {
      if (isPanning.current || isZooming.current) {
        // Final synchronous flush to ensure React state exactly matches ref, ONLY if we moved
        setViewportState({ ...viewportRef.current })
      }
      isPanning.current = false
      isZooming.current = false
      if (mode !== 'hand' && !isSpaceDown) {
        isNavigatingRef.current = false
      }
      setIsGrabbing(false)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [mode, isSpaceDown, flushViewport])

  /**
   * Wrapped setViewport that also keeps the ref in sync immediately.
   * This prevents a race condition where an external setViewport call
   * could be overwritten by a pending RAF flush.
   */
  const setViewport = useCallback((v: Viewport | ((prev: Viewport) => Viewport)) => {
    if (typeof v === 'function') {
      setViewportState((prev) => {
        const next = v(prev)
        viewportRef.current = next
        return next
      })
    } else {
      viewportRef.current = v
      setViewportState(v)
    }
  }, [])

  return {
    viewport,
    setViewport,
    isGrabbing,
    onPointerDown,
    isNavigatingRef
  }
}
