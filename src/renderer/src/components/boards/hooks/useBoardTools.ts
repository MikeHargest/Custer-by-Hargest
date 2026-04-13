import { useState, useCallback, useRef, useEffect } from 'react'
import { nanoid } from 'nanoid'
import { BoardElement, Viewport } from '../types'
import { simplifyPath, getCircleLineIntersection } from '../utils'

interface UseBoardToolsProps {
  mode: string
  setMode: (mode: any) => void
  viewport: Viewport
  penColor: string
  penSize: number
  eraserSize: number
  textSize: number
  setElements: React.Dispatch<React.SetStateAction<BoardElement[]>>
  setSelectedIds: (ids: string[]) => void
  setEditingTextId: (id: string | null) => void
  pushToHistory: () => void
  containerRef: React.RefObject<HTMLDivElement | null>
}

export const useBoardTools = ({
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
}: UseBoardToolsProps) => {
  const [activePath, setActivePath] = useState<{ x: number; y: number; width?: number }[] | null>(null)
  const [activeRect, setActiveRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const activePathRef = useRef(activePath)
  const activeRectRef = useRef(activeRect)
  const snappingAnchor = useRef<{ x: number; y: number } | null>(null)
  const lastPathPoint = useRef<{ x: number; y: number } | null>(null)
  const isErasing = useRef(false)

  useEffect(() => { activePathRef.current = activePath }, [activePath])
  useEffect(() => { activeRectRef.current = activeRect }, [activeRect])

  const onPointerDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    const worldX = (e.clientX - rect.left - viewport.x) / viewport.scale
    const worldY = (e.clientY - rect.top - viewport.y) / viewport.scale

    if (mode === 'pen') {
      if (e.shiftKey && lastPathPoint.current) {
        const start = lastPathPoint.current
        setActivePath([
          { x: start.x, y: start.y, width: penSize },
          { x: worldX, y: worldY, width: penSize }
        ])
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
    } else if (mode === 'text') {
      // Double click text creation is usually handled separately, 
      // but we could put single click here too if needed.
    }
  }, [mode, viewport, penSize, pushToHistory, containerRef])

  const onPointerMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const worldX = (e.clientX - rect.left - viewport.x) / viewport.scale
    const worldY = (e.clientY - rect.top - viewport.y) / viewport.scale

    if (mode === 'pen' && activePath) {
      setActivePath((prev) => {
        if (!prev) return null
        if (e.shiftKey) {
          const anchor = snappingAnchor.current || prev[prev.length - 1]
          if (!snappingAnchor.current) snappingAnchor.current = anchor
          
          const dx = Math.abs(worldX - anchor.x)
          const dy = Math.abs(worldY - anchor.y)
          const snapped = dx > dy ? { x: worldX, y: anchor.y, width: penSize } : { x: anchor.x, y: worldY, width: penSize }
          
          const isLastAnchor = prev[prev.length - 1].x === anchor.x && prev[prev.length - 1].y === anchor.y
          return isLastAnchor ? [...prev, snapped] : [...prev.slice(0, -1), snapped]
        } else {
          snappingAnchor.current = null
          const last = prev[prev.length - 1]
          if (Math.sqrt(Math.pow(worldX - last.x, 2) + Math.pow(worldY - last.y, 2)) < 3) return prev
          return [...prev, { x: worldX, y: worldY, width: penSize }]
        }
      })
    } else if (mode === 'rect' && activeRect) {
      setActiveRect(prev => prev ? { ...prev, w: worldX - prev.x, h: worldY - prev.y } : null)
    } else if (mode === 'eraser' && (e.buttons & 1)) {
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
              // Skip complex logic if eraser is far away
              const dxC = el.x - worldX, dyC = el.y - worldY
              if (Math.sqrt(dxC*dxC + dyC*dyC) > Math.max(el.width, el.height)/2 + radius + 10) {
                nextElements.push(el); return
              }

              const pts = el.points as any[]
              const worldPts = pts.map(p => ({ x: p.x + el.x, y: p.y + el.y, width: p.width || el.size || 2 }))
              const resultPaths: any[][] = []
              let currentPath: any[] = []

              for (let i = 0; i < worldPts.length; i++) {
                const p1 = worldPts[i]
                const p1Inside = Math.pow(p1.x - worldX, 2) + Math.pow(p1.y - worldY, 2) < radius * radius
                if (i === 0) { 
                  if (!p1Inside) currentPath.push(p1); else changed = true
                  continue 
                }
                const p0 = worldPts[i - 1]
                const p0Inside = Math.pow(p0.x - worldX, 2) + Math.pow(p0.y - worldY, 2) < radius * radius
                const intersections = getCircleLineIntersection(p0, p1, eraserCenter, radius)

                if (p0Inside && p1Inside) { changed = true }
                else if (!p0Inside && !p1Inside) {
                  if (intersections.length >= 2) {
                    changed = true
                    currentPath.push({ ...intersections[0], width: p1.width })
                    resultPaths.push(currentPath)
                    currentPath = [{ ...intersections[1], width: p1.width }, p1]
                  } else { currentPath.push(p1) }
                } else if (p0Inside && !p1Inside) {
                  changed = true
                  currentPath = [{ ...(intersections[0] || p1), width: p1.width }, p1]
                } else if (!p0Inside && p1Inside) {
                  changed = true
                  currentPath.push({ ...(intersections[0] || p0), width: p1.width })
                  resultPaths.push(currentPath)
                  currentPath = []
                }
              }
              if (currentPath.length > 0) resultPaths.push(currentPath)
              const filtered = resultPaths.filter(p => p.length > 0)
              if (filtered.length === 0) { changed = true }
              else if (filtered.length === 1 && filtered[0].length === worldPts.length && !changed) { nextElements.push(el) }
              else {
                changed = true
                filtered.forEach(newPts => {
                  const simplified = simplifyPath(newPts, 0.5)
                  if (simplified.length === 0) return
                  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
                  simplified.forEach(pt => {
                    minX = Math.min(minX, pt.x); minY = Math.min(minY, pt.y)
                    maxX = Math.max(maxX, pt.x); maxY = Math.max(maxY, pt.y)
                  })
                  const w = Math.max(2, maxX-minX), h = Math.max(2, maxY-minY)
                  const cx = minX + w/2, cy = minY + h/2
                  nextElements.push({
                    ...el, id: nanoid(), x: cx, y: cy, width: w, height: h,
                    // @ts-ignore
                    baseWidth: w, baseHeight: h,
                    points: simplified.map(pt => ({ x: pt.x - cx, y: pt.y - cy, width: pt.width }))
                  })
                })
              }
            })
            return changed ? nextElements : prev
        })
    }
  }, [mode, viewport, activePath, activeRect, penSize, eraserSize, containerRef, setElements])

  const onPointerUp = useCallback(() => {
    isErasing.current = false
    const currentPath = activePathRef.current
    if (currentPath && currentPath.length > 1) {
      const simplified = simplifyPath(currentPath, 1)
      if (simplified.length > 1) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        simplified.forEach(pt => {
          minX = Math.min(minX, pt.x); minY = Math.min(minY, pt.y)
          maxX = Math.max(maxX, pt.x); maxY = Math.max(maxY, pt.y)
        })
        const w = Math.max(10, maxX-minX), h = Math.max(10, maxY-minY)
        const cx = minX + w/2, cy = minY + h/2
        pushToHistory()
        setElements(prev => [...prev, {
          id: nanoid(), type: 'path', x: cx, y: cy, width: w, height: h,
          // @ts-ignore
          baseWidth: w, baseHeight: h,
          points: simplified.map(pt => ({ x: pt.x - cx, y: pt.y - cy, width: pt.width })),
          color: penColor, size: penSize, url: ''
        }])
        lastPathPoint.current = { x: currentPath[currentPath.length - 1].x, y: currentPath[currentPath.length - 1].y }
      }
    } else if (currentPath?.length === 1) {
      lastPathPoint.current = { x: currentPath[0].x, y: currentPath[0].y }
    }
    setActivePath(null)
    snappingAnchor.current = null

    const currentRect = activeRectRef.current
    if (currentRect && Math.abs(currentRect.w) > 5 && Math.abs(currentRect.h) > 5) {
      const fX = currentRect.w < 0 ? currentRect.x + currentRect.w : currentRect.x
      const fY = currentRect.h < 0 ? currentRect.y + currentRect.h : currentRect.y
      const w = Math.abs(currentRect.w), h = Math.abs(currentRect.h)
      pushToHistory()
      setElements(prev => [...prev, {
        id: nanoid(), type: 'rect', x: fX + w/2, y: fY + h/2, width: w, height: h,
        url: '', color: 'transparent', strokeColor: penColor, strokeWidth: penSize
      }])
    }
    setActiveRect(null)
  }, [pushToHistory, setElements, penColor, penSize])

  const handleTextCreation = useCallback((x: number, y: number) => {
    const newTextEl: BoardElement = {
      id: nanoid(), type: 'text', x, y,
      width: Math.max(200, textSize * 5), height: Math.max(40, textSize * 1.5),
      url: '', text: '', fontSize: textSize, fontWeight: 400, textAlign: 'left', color: penColor
    }
    pushToHistory()
    setElements(prev => [...prev.map(el => (el.type === 'text' && !el.text?.trim() ? { ...el, text: 'text' } : el)), newTextEl])
    setSelectedIds([newTextEl.id])
    setEditingTextId(newTextEl.id)
    setMode('select')
  }, [textSize, penColor, pushToHistory, setElements, setSelectedIds, setEditingTextId, setMode])

  // Global listeners for mouse move/up to support dragging off canvas
  useEffect(() => {
    const move = (e: MouseEvent) => onPointerMove(e as any)
    const up = () => onPointerUp()
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [onPointerMove, onPointerUp])

  return { activePath, activeRect, onPointerDown, handleTextCreation, lastPathPoint }
}
