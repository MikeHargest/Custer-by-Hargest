import React, { useState, useRef, useEffect, useMemo } from 'react'
import * as PIXI from 'pixi.js'
import { BoardElement, CachedSnapTarget, Viewport } from '../types'
import { getSharedTexture, releaseSharedTexture, parseColor } from '../utils'
import { UITheme } from '../../../types'

export interface ElementItemProps {
  element: BoardElement
  isSelected: boolean
  viewport: Viewport
  activeLevel?: 'high' | 'mid' | 'low'
  onSelect: (id: string, multi: boolean) => void
  onMove: (id: string, x: number, y: number) => void
  onResize: (
    id: string,
    width: number,
    height: number,
    x?: number,
    y?: number,
    handle?: string,
    fontSize?: number
  ) => void
  onRotate: (id: string, rotation: number) => void
  onInteractionStart: () => void
  onDragStart?: (id: string, e?: PIXI.FederatedPointerEvent) => void
  onDoubleClick?: (id: string) => void
  isEditing?: boolean
  renderable?: boolean
  interactive?: boolean
  theme?: UITheme
  isMultiSelection?: boolean

  guidesRef: React.RefObject<{ x?: number; y?: number }[]>
  onRegisterPixi: (id: string, container: PIXI.Container | null) => void
  isNavigatingRef?: React.RefObject<boolean>
  dragContextRef: React.RefObject<{
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
  } | null>
}

const Graphics = (props: any) => {
  const { draw, ...other } = props
  return (
    <pixiGraphics
      ref={(g: PIXI.Graphics | null) => {
        if (g && draw) draw(g)
      }}
      {...other}
    />
  )
}
const Container = 'pixiContainer' as any
const Sprite = 'pixiSprite' as any
const Text = 'pixiText' as any

const ROT_CURSORS = (() => {
  const getUrl = (rot: number): string => {
    const svg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g transform="translate(12 12) scale(0.90) translate(-12 -12)"><g transform="rotate(${rot + 180} 12 12)"><path d="M19 10C19 14.9706 14.9706 19 10 19" stroke="white" stroke-width="5.5" stroke-linecap="round"/><path d="M19 10L23 10L19 5L15 10Z" fill="white" stroke="white" stroke-width="3" stroke-linejoin="round"/><path d="M10 19L10 23L5 19L10 15Z" fill="white" stroke="white" stroke-width="3" stroke-linejoin="round"/><path d="M19 10C19 14.9706 14.9706 19 10 19" stroke="black" stroke-width="2.5" stroke-linecap="round"/><path d="M19 10L23 10L19 5L15 10Z" fill="black"/><path d="M10 19L10 23L5 19L10 15Z" fill="black"/></g></g></svg>`
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, auto`
  }
  return { 0: getUrl(0), 90: getUrl(90), 180: getUrl(180), 270: getUrl(270) }
})()

/**
 * Sub-component for rendering the selection frame and handles.
 * Separated to avoid re-drawing the main element content during zoom/pan.
 */
const SelectionUI = React.memo(({
  element, isSelected, isMultiSelection, viewport, accentColor, handleResizeStart
}: {
  element: BoardElement
  isSelected: boolean
  isMultiSelection: boolean
  viewport: Viewport
  accentColor: number
  handleResizeStart: (e: PIXI.FederatedPointerEvent, handle: string) => void
}) => {
  if (!isSelected || isMultiSelection) return null

  const baseHandleSize = 8
  const handleSize = baseHandleSize / viewport.scale
  const hitAreaSize = handleSize * 3
  // Keep selection stroke visually consistent with multi-selection group frame.
  const lineWidth = 2 / viewport.scale
  const halfW = (element.width || 0) / 2
  const halfH = (element.height || 0) / 2

  const sizeLabelStyle = new PIXI.TextStyle({
    fill: accentColor,
    fontSize: 12 / viewport.scale,
    fontWeight: '600',
    fontFamily: 'Inter, sans-serif'
  })

  const widthText = Math.round(element.width || 0)
  const heightText = Math.round(element.height || 0)
  const sizeText = `${widthText} × ${heightText}`

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
    <Container>
      <Graphics
        draw={(g: PIXI.Graphics): void => {
          g.clear()
          g.rect(-halfW, -halfH, element.width || 0, element.height || 0)
          g.fill({ color: 0, alpha: 0 })
          // @ts-ignore - PIXI v8 stroke API
          g.stroke({ width: lineWidth, color: accentColor, alpha: 1 })
        }}
      />

      <Container>
        {handles.map((h) => (
          <Graphics
            key={h.id}
            // @ts-ignore
            eventMode="static"
            cursor={h.cursor}
            onPointerDown={(ev: PIXI.FederatedPointerEvent): void => handleResizeStart(ev, h.id)}
            draw={(g: PIXI.Graphics): void => {
              g.clear()
              g.rect(-hitAreaSize / 2, -hitAreaSize / 2, hitAreaSize, hitAreaSize)
              g.fill({ color: 0, alpha: 0 })

              let hw = handleSize
              let hh = handleSize
              if (h.id === 'top' || h.id === 'bottom') {
                hw = handleSize * 2.5
                hh = handleSize * 0.6
              } else if (h.id === 'left' || h.id === 'right') {
                hh = handleSize * 2.5
                hw = handleSize * 0.6
              }
              g.roundRect(-hw / 2, -hh / 2, hw, hh, 2 / viewport.scale)
              g.fill({ color: accentColor })
            }}
            x={h.x}
            y={h.y}
          />
        ))}
        {[
          { id: 'rotate-top-left', hx: -halfW, hy: -halfH, rot: 0 },
          { id: 'rotate-top-right', hx: halfW, hy: -halfH, rot: 90 },
          { id: 'rotate-bottom-right', hx: halfW, hy: halfH, rot: 180 },
          { id: 'rotate-bottom-left', hx: -halfW, hy: halfH, rot: 270 }
        ].map((rh) => {
          const scrOffset = 16 / viewport.scale
          return (
            <Graphics
              key={rh.id}
              // @ts-ignore
              eventMode="static"
              cursor={ROT_CURSORS[rh.rot as keyof typeof ROT_CURSORS]}
              onPointerDown={(ev: PIXI.FederatedPointerEvent): void => handleResizeStart(ev, rh.id)}
              draw={(g: PIXI.Graphics): void => {
                g.clear()
                const size = 14 / viewport.scale
                g.circle(0, 0, size)
                g.fill({ color: 0xffffff, alpha: 0.001 })
              }}
              x={rh.hx + (rh.hx > 0 ? scrOffset : -scrOffset)}
              y={rh.hy + (rh.hy > 0 ? scrOffset : -scrOffset)}
            />
          )
        })}
      </Container>

      {/* Size Label */}
      <Text
        text={sizeText}
        style={sizeLabelStyle}
        anchor={{ x: 0.5, y: 0 }}
        y={halfH + 12 / viewport.scale}
      />
    </Container>
  )
})

const ElementItem: React.FC<ElementItemProps> = React.memo(
  ({
    element,
    isSelected,
    viewport,
    activeLevel: activeLevelProp,
    onSelect,
    onMove,
    onResize,
    onRotate,
    onInteractionStart,
    onDragStart,
    onDoubleClick,
    isEditing = false,
    renderable = true,
    interactive = true,
    theme,
    isMultiSelection = false,
    guidesRef,
    onRegisterPixi,
    isNavigatingRef,
    dragContextRef
  }) => {
    const [isDragging, setIsDragging] = useState(false)
    const [activeHandle, setActiveHandle] = useState<string | null>(null)
    const resizeStartData = useRef<any>(null)
    const lastClickTime = useRef(0)
    const containerRef = useRef<PIXI.Container | null>(null)
    const currentSnapDX = useRef(0)
    const currentSnapDY = useRef(0)
    const textRef = useRef<any>(null)
    const borderRef = useRef<PIXI.Graphics | null>(null)
    const accentColor = useMemo(() => theme?.boardAccent ? parseInt(theme.boardAccent.replace('#', ''), 16) : 0x007aff, [theme])

    useEffect(() => {
      if (onRegisterPixi) onRegisterPixi(element.id, containerRef.current)
      return () => { if (onRegisterPixi) onRegisterPixi(element.id, null) }
    }, [element.id, onRegisterPixi])

    // Stable ref for onResize so it doesn't trigger texture reload effect
    const onResizeRef = useRef(onResize)
    useEffect(() => { onResizeRef.current = onResize }, [onResize])

    // Imperatively redraw the border whenever size or scale changes
    useEffect(() => {
      const g = borderRef.current
      if (!g || g.destroyed || element.groupId) {
        if (g && !g.destroyed) g.clear()
        return
      }
      g.clear()
      // For single selection, SelectionUI already draws the frame.
      // Avoid stacking two borders (which makes single-select look thicker than multi-select).
      if (isSelected && !isMultiSelection) return
      if (!isSelected) return
      const ew = element.width || 0
      const eh = element.height || 0
      g.rect(-ew / 2, -eh / 2, ew, eh)
      g.fill({ color: 0, alpha: 0 })
      // @ts-ignore
      g.stroke({ width: 2 / viewport.scale, color: accentColor, alpha: 0.55 })
    }, [element.width, element.height, viewport.scale, element.groupId, isSelected, isMultiSelection, accentColor])

    const [lodTextures, setLodTextures] = useState<any>(null)
    const [renderedLevel, setRenderedLevel] = useState<'high' | 'mid' | 'low'>(activeLevelProp || 'low')

    // Determine the target level based on zoom
    const targetLevel = useMemo(() => {
      if (activeLevelProp) return activeLevelProp
      if (viewport.scale > 0.6) return 'high'
      if (viewport.scale > 0.25) return 'mid'
      return 'low'
    }, [viewport.scale, activeLevelProp])

    // Staggered LOD switching to prevent GPU stall
    useEffect(() => {
      if (targetLevel !== renderedLevel) {
        // Downgrading is fast (textures already in VRAM), do it immediately for snappy zoom
        if (
          (renderedLevel === 'high' && targetLevel !== 'high') ||
          (renderedLevel === 'mid' && targetLevel === 'low')
        ) {
          setRenderedLevel(targetLevel)
          return undefined
        }

        // Upgrading requires massive GPU uploads for uninitialized textures.
        // Spread it over multiple frames to avoid complete UI freeze
        const delay = Math.random() * 400 + 100
        const timer = setTimeout(() => {
          setRenderedLevel(targetLevel)
        }, delay)
        return () => clearTimeout(timer)
      }
      return undefined
    }, [targetLevel, renderedLevel])

    // Auto-resize text elements downwards
    useEffect(() => {
      if (element.type === 'text' && textRef.current && !isDragging && !activeHandle) {
        const tf = requestAnimationFrame(() => {
          if (!textRef.current || textRef.current.destroyed) return
          const P = (element.fontSize || 24) * 0.25 // Text padding proportionally scales
          const actualHeight = textRef.current.height
          const targetElementHeight = actualHeight + P * 2
          if (Math.abs((element.height || 0) - targetElementHeight) > 2) {
            const dy = (targetElementHeight - (element.height || 0)) / 2
            onResizeRef.current(element.id, element.width || 0, targetElementHeight, element.x, element.y + dy, 'text-auto-resize')
          }
        })
        return () => cancelAnimationFrame(tf)
      }
      return undefined
    }, [element.text, element.fontSize, element.fontWeight, element.width, element.type, element.id, element.height, element.x, element.y, isDragging, activeHandle])

    // Cap text resolution at 4x to save memory and performance, but assure it redraws sharply based on zoom.
    const textResolution = useMemo(() => {
      const target = (window.devicePixelRatio || 1) * viewport.scale
      return target > 4 ? 4 : target > 2 ? 2 : target > 1 ? 1.5 : target > 0.5 ? 1 : 0.5
    }, [viewport.scale])

    const activeTexture = useMemo(() => {
      if (!lodTextures) return null
      const tex = lodTextures[renderedLevel] || lodTextures.high
      // Validate texture is not destroyed and has a valid source for PIXI GL rendering
      if (!tex || tex.destroyed) return null
      try { if (!tex.source || tex.source.destroyed) return null } catch { return null }
      return tex
    }, [lodTextures, renderedLevel])

    const [loadError, setLoadError] = useState(false)

    useEffect(() => {
      let active = true
      const loadMedia = async (): Promise<void> => {
        if (!element.url || (element.type !== 'image' && element.type !== 'video')) return
        try {
          const textures = await getSharedTexture(element.url, element.type)
          if (active) {
            setLodTextures(textures)
            if (element.type === 'image' && (!element.width || !element.height)) {
              const img = textures.source as HTMLImageElement
              onResizeRef.current(element.id, img.width, img.height)
            } else if (element.type === 'video' && (!element.width || !element.height)) {
              const v = textures.source as HTMLVideoElement
              if (v.videoWidth > 0 && v.videoHeight > 0) onResizeRef.current(element.id, v.videoWidth, v.videoHeight)
            }
          }
        } catch (_e) { if (active) setLoadError(true) }
      }
      loadMedia()
      return () => {
        active = false
        setLodTextures(null) // Clear reference BEFORE destroying to prevent PIXI rendering a destroyed texture
        if (element.url) releaseSharedTexture(element.url)
      }
    }, [element.url, element.type, element.id])

    // Drag / Resize / Rotate Event Listeners
    useEffect(() => {
      if (!isDragging && !activeHandle) return
      const onPointerMove = (e: PointerEvent): void => {
        if (!resizeStartData.current) return

        let dx = 0, dy = 0
        if (resizeStartData.current.startWorldX !== undefined) {
          const currentWorldX = (e.clientX - viewport.x) / viewport.scale
          const currentWorldY = (e.clientY - viewport.y) / viewport.scale
          dx = currentWorldX - resizeStartData.current.startWorldX
          dy = currentWorldY - resizeStartData.current.startWorldY
        } else {
          // Fallback for resizing which doesn't use startWorldX
          dx = (e.clientX - resizeStartData.current.mx) / viewport.scale
          dy = (e.clientY - resizeStartData.current.my) / viewport.scale
        }

        if (e.shiftKey) {
          if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0;
        }
        if (isDragging) {
          if (!resizeStartData.current.dragStarted) {
            const screenDx = e.clientX - resizeStartData.current.mx
            const screenDy = e.clientY - resizeStartData.current.my
            if (screenDx * screenDx + screenDy * screenDy < 25) return
            resizeStartData.current.dragStarted = true
          }
          const moveX = resizeStartData.current.x + dx, moveY = resizeStartData.current.y + dy
          const distSqr = dx * viewport.scale * dx * viewport.scale + dy * viewport.scale * dy * viewport.scale
          if (distSqr < 30) {
            if (guidesRef.current?.length) (guidesRef as any).current = []
            if (containerRef.current) { containerRef.current.x = moveX; containerRef.current.y = moveY }
            currentSnapDX.current = 0; currentSnapDY.current = 0
            return
          }
          let snapDX = 0, snapDY = 0
          const SNAP_THRESHOLD = 5 / viewport.scale
          const ctx = dragContextRef.current
          if (ctx && ctx.targets.length > 0) {
            const w = element.width || 0
            const h = element.height || 0
            const cL = moveX - w / 2, cR = moveX + w / 2, cT = moveY - h / 2, cB = moveY + h / 2
            let bX = Infinity, bY = Infinity, newGuides: any[] = []
            ctx.targets.forEach(other => {
              const tx = [other.l, other.r, other.cx], sx = [cL, cR, moveX]
              sx.forEach(s => tx.forEach(t => { if (Math.abs(t - s) < SNAP_THRESHOLD && Math.abs(t - s) < Math.abs(bX)) { bX = t - s; newGuides.push({ x: t }) } }))
              const ty = [other.t, other.b, other.cy], sy = [cT, cB, moveY]
              sy.forEach(s => ty.forEach(t => { if (Math.abs(t - s) < SNAP_THRESHOLD && Math.abs(t - s) < Math.abs(bY)) { bY = t - s; newGuides.push({ y: t }) } }))
            })
            if (bX !== Infinity) snapDX = bX; if (bY !== Infinity) snapDY = bY
            if (guidesRef.current) (guidesRef as any).current = newGuides
          }
          currentSnapDX.current = snapDX; currentSnapDY.current = snapDY
          if (containerRef.current) { containerRef.current.x = moveX + snapDX; containerRef.current.y = moveY + snapDY }
        } else if (activeHandle && !activeHandle.startsWith('rotate-')) {
          let nW = resizeStartData.current.w, nH = resizeStartData.current.h, nX = resizeStartData.current.x, nY = resizeStartData.current.y
          const h = activeHandle
          if (h.includes('right')) { nW = Math.max(20, resizeStartData.current.w + dx); nX = resizeStartData.current.x + (nW - resizeStartData.current.w) / 2 }
          else if (h.includes('left')) { nW = Math.max(20, resizeStartData.current.w - dx); nX = resizeStartData.current.x - (nW - resizeStartData.current.w) / 2 }
          if (h.includes('bottom')) { nH = Math.max(20, resizeStartData.current.h + dy); nY = resizeStartData.current.y + (nH - resizeStartData.current.h) / 2 }
          else if (h.includes('top')) { nH = Math.max(20, resizeStartData.current.h - dy); nY = resizeStartData.current.y - (nH - resizeStartData.current.h) / 2 }

          if (element.type === 'image' || element.type === 'video' || (element.type === 'text' && h.includes('-'))) {
            const scaleX = nW / resizeStartData.current.w
            const scaleY = nH / resizeStartData.current.h
            let targetScale = 1
            if (h.includes('right') || h.includes('left')) {
              targetScale = (h.includes('bottom') || h.includes('top')) ? (Math.abs(scaleX - 1) > Math.abs(scaleY - 1) ? scaleX : scaleY) : scaleX
            } else {
              targetScale = scaleY
            }

            if (element.type === 'text' && resizeStartData.current.fontSize) {
              const minTextScale = 8 / resizeStartData.current.fontSize
              targetScale = Math.max(targetScale, minTextScale)
            }

            nW = Math.max(20, resizeStartData.current.w * targetScale)
            nH = Math.max(20, resizeStartData.current.h * targetScale)

            nX = resizeStartData.current.x
            nY = resizeStartData.current.y
            if (h.includes('right')) nX += (nW - resizeStartData.current.w) / 2
            else if (h.includes('left')) nX -= (nW - resizeStartData.current.w) / 2
            if (h.includes('bottom')) nY += (nH - resizeStartData.current.h) / 2
            else if (h.includes('top')) nY -= (nH - resizeStartData.current.h) / 2

            if (element.type === 'text') {
              onResize(element.id, nW, nH, nX, nY, h, resizeStartData.current.fontSize ? resizeStartData.current.fontSize * targetScale : undefined)
              return
            }
          }

          onResize(element.id, nW, nH, nX, nY, h)
        } else if (activeHandle?.startsWith('rotate-')) {
          const nAngle = Math.atan2(e.clientY - resizeStartData.current.elementScreenCenterY, e.clientX - resizeStartData.current.elementScreenCenterX)
          let fRot = resizeStartData.current.startRotation + (nAngle - resizeStartData.current.startAngle)
          if (e.shiftKey) { const step = (15 * Math.PI) / 180; fRot = Math.round(fRot / step) * step }
          onRotate(element.id, fRot)
        }
      }
      const onPointerUp = (e: PointerEvent): void => {
        if (!resizeStartData.current) return
        if (!activeHandle?.startsWith('rotate-') && !activeHandle) {
          if (resizeStartData.current.dragStarted) {
            const finalWorldX = (e.clientX - viewport.x) / viewport.scale
            const finalWorldY = (e.clientY - viewport.y) / viewport.scale
            const fdx = finalWorldX - resizeStartData.current.startWorldX
            const fdy = finalWorldY - resizeStartData.current.startWorldY
            onMove(element.id, resizeStartData.current.x + fdx + currentSnapDX.current, resizeStartData.current.y + fdy + currentSnapDY.current)
          }
        }
        setIsDragging(false); setActiveHandle(null); resizeStartData.current = null
        if (guidesRef.current) (guidesRef as any).current = []
        document.body.style.cursor = 'auto'
      }
      window.addEventListener('pointermove', onPointerMove); window.addEventListener('pointerup', onPointerUp)
      const onCancel = (): void => {
        if (!resizeStartData.current) return
        onMove(element.id, resizeStartData.current.x + currentSnapDX.current, resizeStartData.current.y + currentSnapDY.current)
        setIsDragging(false); setActiveHandle(null); resizeStartData.current = null
        if (guidesRef.current) (guidesRef as any).current = []
        document.body.style.cursor = 'auto'
      }
      window.addEventListener('cancel-element-drag', onCancel)
      return () => { window.removeEventListener('pointermove', onPointerMove); window.removeEventListener('pointerup', onPointerUp); window.removeEventListener('cancel-element-drag', onCancel) }
    }, [isDragging, activeHandle, viewport, element.id, onMove, onResize, onRotate, guidesRef, (element.width || 0), (element.height || 0), dragContextRef])

    const handlePointerDown = (e: PIXI.FederatedPointerEvent): void => {
      if (e.button === 1 || isNavigatingRef?.current) return

      if (e.ctrlKey && !isSelected) {
        e.stopPropagation()
        return
      }

      onInteractionStart()
      if (e.button === 0) {
        const now = Date.now()
        if (onDoubleClick && now - lastClickTime.current < 500) { onDoubleClick(element.id); lastClickTime.current = 0; return }
        lastClickTime.current = now;

        if (e.ctrlKey && isSelected) {
          onSelect(element.id, true)
          e.stopPropagation()
          return
        }

        onSelect(element.id, e.shiftKey || e.metaKey)
        const mouseEvent = e.nativeEvent as MouseEvent
        const center = e.currentTarget.toGlobal(new PIXI.Point(0, 0))
        if (mouseEvent.altKey) {
          setActiveHandle('rotate-body'); setIsDragging(false)
          resizeStartData.current = { w: element.width || 0, h: element.height || 0, x: element.x, y: element.y, mx: mouseEvent.clientX, my: mouseEvent.clientY, startRotation: element.rotation || 0, startAngle: Math.atan2(mouseEvent.clientY - center.y, mouseEvent.clientX - center.x), elementScreenCenterX: center.x, elementScreenCenterY: center.y }
          document.body.style.cursor = 'crosshair'
        } else {
          if (element.groupId || isMultiSelection) {
            if (onDragStart) onDragStart(element.id, e)
            e.stopPropagation()
            return
          }
          setIsDragging(true); resizeStartData.current = { w: element.width || 0, h: element.height || 0, x: element.x, y: element.y, mx: mouseEvent.clientX, my: mouseEvent.clientY, startWorldX: (mouseEvent.clientX - viewport.x) / viewport.scale, startWorldY: (mouseEvent.clientY - viewport.y) / viewport.scale, startRotation: element.rotation || 0, startAngle: 0, elementScreenCenterX: 0, elementScreenCenterY: 0, dragStarted: false, fontSize: element.fontSize }
          if (onDragStart) onDragStart(element.id)
        }
        e.stopPropagation()
      }
    }

    const handleResizeStart = (e: PIXI.FederatedPointerEvent, handle: string): void => {
      if (e.ctrlKey || e.button === 1 || isNavigatingRef?.current) return
      e.stopPropagation(); onInteractionStart(); setActiveHandle(handle); setIsDragging(false)
      const mouseEvent = e.nativeEvent as MouseEvent
      const halfW = (element.width || 0) / 2, halfH = (element.height || 0) / 2, cos = Math.cos(element.rotation || 0), sin = Math.sin(element.rotation || 0)
      let hx = 0, hy = 0
      if (handle.includes('left')) hx = -halfW; else if (handle.includes('right')) hx = halfW
      if (handle.includes('top')) hy = -halfH; else if (handle.includes('bottom')) hy = halfH
      const rX = (hx * cos - hy * sin) * viewport.scale, rY = (hx * sin + hy * cos) * viewport.scale
      const factor = handle.startsWith('rotate-') ? 1.08 : 1
      const cx = mouseEvent.clientX - rX * factor, cy = mouseEvent.clientY - rY * factor
      resizeStartData.current = { w: element.width || 0, h: element.height || 0, x: element.x, y: element.y, mx: mouseEvent.clientX, my: mouseEvent.clientY, startRotation: element.rotation || 0, startAngle: Math.atan2(mouseEvent.clientY - cy, mouseEvent.clientX - cx), elementScreenCenterX: cx, elementScreenCenterY: cy, fontSize: element.fontSize }
    }

    return (
      <Container x={element.x} y={element.y} rotation={element.rotation || 0} visible={renderable} ref={containerRef as any}>
        <Container eventMode={interactive ? 'static' : 'none'} onPointerDown={handlePointerDown}>
          {element.type === 'link' ? (
            <Container onClick={() => window.open(element.url, '_blank')}>
              <Graphics
                draw={(g: PIXI.Graphics) => {
                  g.clear()
                  g.roundRect(-(element.width || 0) / 2, -(element.height || 0) / 2, (element.width || 0), (element.height || 0), 16)
                  g.fill({ color: 0x2d2d2d, alpha: 0.9 })
                  // @ts-ignore - stroke API
                  g.stroke({ width: 2, color: 0x444444 })
                  g.circle(-(element.width || 0) / 2 + 30, 0, 15)
                  g.fill({ color: 0x007aff, alpha: 0.2 })
                }}
              />
              <Text text={element.title || 'Link'} x={10} anchor={0.5} style={new PIXI.TextStyle({ fill: '#007aff', fontSize: 16, fontWeight: '700', wordWrap: true, wordWrapWidth: (element.width || 0) - 60 })} />
            </Container>
          ) : element.type === 'path' ? (
            <Graphics draw={(g: PIXI.Graphics) => {
              g.clear(); if (!element.points?.length) return
              const pts = element.points as any[], color = parseColor(element.color), size = element.size || 0
              const alpha = element.opacity ?? 1
              const fillColor = element.fillColor && element.fillColor !== 'transparent' ? parseColor(element.fillColor) : null
              const fillAlpha = element.fillOpacity ?? 1

              const sx = (element.width || 0) / (element.baseWidth || element.width || 1), sy = (element.height || 0) / (element.baseHeight || element.height || 1)
              const render = () => { if (pts.length > 1) { g.moveTo(pts[0].x * sx, pts[0].y * sy); for (let i = 1; i < pts.length - 1; i++) { const xc = (pts[i].x * sx + pts[i + 1].x * sx) / 2, yc = (pts[i].y * sy + pts[i + 1].y * sy) / 2; g.quadraticCurveTo(pts[i].x * sx, pts[i].y * sy, xc, yc) } g.lineTo(pts[pts.length - 1].x * sx, pts[pts.length - 1].y * sy) } }
              
              if (fillColor !== null) {
                render()
                g.fill({ color: fillColor, alpha: fillAlpha })
              }

              if (size > 0) {
                const scaledSize = Math.max(size * viewport.scale, 1.5) / viewport.scale;
                render(); g.stroke({ width: Math.max(24 / viewport.scale, scaledSize + 10 / viewport.scale), color, alpha: 0 }); render(); g.stroke({ width: scaledSize, color, alpha })
              }
            }} />
          ) : element.type === 'rect' ? (
            <Graphics
              draw={(g: PIXI.Graphics) => {
                g.clear()
                g.rect(-(element.width || 0) / 2, -(element.height || 0) / 2, (element.width || 0), (element.height || 0))
                g.fill({
                  color: element.color === 'transparent' ? 0 : parseColor(element.color),
                  alpha: element.color === 'transparent' ? 0 : (element.opacity ?? 1)
                })
                if ((element.strokeWidth || 0) > 0) {
                  const scaledStroke = Math.max((element.strokeWidth || 1) * viewport.scale, 1.5) / viewport.scale
                  // @ts-ignore - stroke API
                  g.stroke({ width: scaledStroke, color: parseColor(element.strokeColor), alpha: element.strokeOpacity ?? 1 })
                }
                g.hitArea = new PIXI.Rectangle(
                  -(element.width || 0) / 2,
                  -(element.height || 0) / 2,
                  (element.width || 0),
                  (element.height || 0)
                )
              }}
            />
          ) : element.type === 'text' ? (
            <Container alpha={isEditing ? 0 : (element.opacity ?? 1)}>
              <Text
                ref={textRef}
                text={(element.text || '') + '\u200B'}
                x={element.textAlign === 'center' ? 0 : element.textAlign === 'right' ? ((element.width || 0) / 2 - ((element.fontSize || 24) * 0.25)) : (-(element.width || 0) / 2 + ((element.fontSize || 24) * 0.25))}
                y={-(element.height || 0) / 2 + ((element.fontSize || 24) * 0.25)}
                resolution={textResolution}
                anchor={{ x: element.textAlign === 'center' ? 0.5 : element.textAlign === 'right' ? 1 : 0, y: 0 }}
                // Add +5 pixels to wordWrapWidth to absorb tiny float-point font hinting differentials, preventing jumps.
                style={new PIXI.TextStyle({ fill: element.color || '#ffffff', fontSize: element.fontSize || 24, fontWeight: String(element.fontWeight || 400) as any, fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", wordWrap: true, wordWrapWidth: Math.max(0, (element.width || 0) - ((element.fontSize || 24) * 0.25) * 2 + 5), lineHeight: (element.fontSize || 24) * 1.4 })}
              />
            </Container>
          ) : activeTexture ? (
            <Sprite texture={activeTexture} width={(element.width || 0)} height={(element.height || 0)} anchor={0.5} roundPixels={true} />
          ) : (
            <Graphics
              draw={(g: PIXI.Graphics) => {
                g.clear()
                const ew = element.width || 0
                const eh = element.height || 0
                g.rect(-ew / 2, -eh / 2, ew, eh)
                g.fill({
                  color: element.isProcessing ? 0x1a1a1a : loadError ? 0x222222 : 0x333333
                })
              }}
            />
          )}
        </Container>

        {/* Thin border overlay for non-grouped elements - rendered on top of content */}
        {!element.groupId && (
          <pixiGraphics ref={borderRef as any} draw={() => {}} />
        )}
        <SelectionUI
          element={element}
          isSelected={isSelected}
          isMultiSelection={isMultiSelection}
          viewport={viewport}
          accentColor={accentColor}
          handleResizeStart={handleResizeStart}
        />
      </Container>
    )
  }
)
SelectionUI.displayName = 'SelectionUI'
ElementItem.displayName = 'ElementItem'
export default ElementItem
