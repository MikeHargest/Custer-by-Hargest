import React, { useState, useRef, useEffect, useCallback } from 'react'
import * as PIXI from 'pixi.js'
import ElementItem from './ElementItem'
import { BoardElement, Viewport, CachedSnapTarget } from '../types'
import { parseColor } from '../utils'
import { UITheme } from '../../../types'

interface BoardContentProps {
  elements: BoardElement[]
  activePath: { x: number; y: number; width?: number }[] | null
  activeRect: { x: number; y: number; w: number; h: number } | null
  penColor: string
  penSize: number
  viewport: Viewport
  selectedIds: string[]
  onSelect: (ids: string[]) => void
  onElementSelect: (id: string, multi: boolean) => void
  selectionStartPos: React.MutableRefObject<{ x: number; y: number } | null>
  onMove: (id: string, x: number, y: number) => void
  onResize: (
    id: string,
    width: number,
    height: number,
    x?: number,
    y?: number,
    handle?: string
  ) => void
  onRotate: (id: string, rotation: number) => void
  onInteractionStart: () => void
  onDoubleClick: (id: string) => void
  editingTextId: string | null
  containerRef: React.RefObject<HTMLDivElement | null>
  interactive?: boolean
  screenWidth: number
  screenHeight: number
  theme?: UITheme

  isSpaceDown: boolean
  lastElementDoubleClickTime: React.MutableRefObject<number>
  guidesRef: React.MutableRefObject<{ x?: number; y?: number }[]>
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
  mode: string
  isNavigatingRef: React.RefObject<boolean>
}

// These should be moved to subcomponents/helpers.tsx if they are used elsewhere
const SnappingGuidesRenderer: React.FC<{
  guidesRef: React.RefObject<{ x?: number; y?: number }[]>
  scale: number
  theme?: UITheme
}> = ({ guidesRef, scale, theme }) => {
  // Use a fast tick-based or animation-frame based check instead of React state for smooth rendering
  // But for legacy compatibility, we keep this if needed. Let's optimize it.

  return (
    <Graphics
      draw={(g: PIXI.Graphics): void => {
        g.clear()
        if (!guidesRef.current || guidesRef.current.length === 0) return
        const accentColor = theme?.boardAccent
          ? parseInt(theme.boardAccent.replace('#', ''), 16)
          : 0x007aff

        guidesRef.current.forEach((guide) => {
          if (guide.x !== undefined) {
            g.moveTo(guide.x, -100000)
            g.lineTo(guide.x, 200000)
          }
          if (guide.y !== undefined) {
            g.moveTo(-100000, guide.y)
            g.lineTo(200000, guide.y)
          }
        })

        // @ts-ignore - PIXI v8 stroke API
        g.stroke({ width: 1 / scale, color: accentColor, alpha: 0.5 })
      }}
    />
  )
}

/** Legacy Graphics support for PIXI v8 with @pixi/react */
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
    onElementSelect,
    selectionStartPos,
    onMove,
    onResize,
    onRotate,
    onInteractionStart,
    onDoubleClick,
    editingTextId,
    containerRef,
    interactive = true,
    screenWidth,
    screenHeight,
    theme,

    isSpaceDown,
    lastElementDoubleClickTime,
    guidesRef,
    dragContextRef,
    mode,
    isNavigatingRef
  }: BoardContentProps) => {
    const pixiElementsRef = useRef<Map<string, PIXI.Container>>(new Map())
    const onRegisterPixiCallback = useCallback((id: string, container: PIXI.Container | null) => {
      if (container) pixiElementsRef.current.set(id, container)
      else pixiElementsRef.current.delete(id)
    }, [])

    const [isDraggingSelection, setIsDraggingSelection] = useState(false)
    const dragStartData = useRef<{
      id: string
      x: number
      y: number
      mx: number
      my: number
    } | null>(null)
    const lastMultiClickTime = useRef<number>(0)
    // Ref to the bounding box PIXI container so we can move it during drag
    const selectionBBoxRef = useRef<PIXI.Container | null>(null)

    useEffect(() => {
      if (!isDraggingSelection) return
      const movers: {
        container: PIXI.Container
        initialX: number
        initialY: number
        width: number
        height: number
      }[] = []
      if (selectedIds.length > 0) {
        for (const id of selectedIds) {
          const container = pixiElementsRef.current.get(id)
          if (container) {
            const el = elements.find((e) => e.id === id)
            if (el) {
              movers.push({
                container,
                initialX: container.x,
                initialY: container.y,
                width: el.width || 0,
                height: el.height || 0
              })
            }
          }
        }
      }

      let currentSnapDX = 0
      let currentSnapDY = 0

      const onPointerMove = (e: PointerEvent): void => {
        if (!dragStartData.current) return
        const dx = (e.clientX - dragStartData.current.mx) / viewport.scale
        const dy = (e.clientY - dragStartData.current.my) / viewport.scale

        const SNAP_THRESHOLD = 5 / viewport.scale
        const distSqr =
          dx * viewport.scale * dx * viewport.scale + dy * viewport.scale * dy * viewport.scale
        if (distSqr < 30) {
          // Less than ~5.4 pixels of movement
          const mRef = guidesRef as React.MutableRefObject<unknown[]>
          if (mRef.current && mRef.current.length > 0) mRef.current = []

          // Move container visually without snapping
          for (let i = 0; i < movers.length; i++) {
            const m = movers[i]
            m.container.x = m.initialX + dx
            m.container.y = m.initialY + dy
          }

          if (selectionBBoxRef.current) {
            selectionBBoxRef.current.x = dx
            selectionBBoxRef.current.y = dy
          }

          currentSnapDX = 0
          currentSnapDY = 0
          return
        }

        let snapDX = 0
        let snapDY = 0

        const ctx = dragContextRef.current
        if (ctx && ctx.targets.length > 0) {
          let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity
          for (let i = 0; i < movers.length; i++) {
            const m = movers[i]
            const curX = m.initialX + dx
            const curY = m.initialY + dy
            minX = Math.min(minX, curX - m.width / 2)
            minY = Math.min(minY, curY - m.height / 2)
            maxX = Math.max(maxX, curX + m.width / 2)
            maxY = Math.max(maxY, curY + m.height / 2)
          }

          const currentCX = minX + (maxX - minX) / 2
          const currentCY = minY + (maxY - minY) / 2
          const currentL = minX
          const currentR = maxX
          const currentT = minY
          const currentB = maxY

          let bestSnapX = Infinity
          let bestSnapY = Infinity
          const newGuides: { x?: number; y?: number }[] = []
          const viewportMargin = 1500 / viewport.scale

          for (let i = 0; i < ctx.targets.length; i++) {
            const other = ctx.targets[i]
            if (
              Math.abs(other.cx - currentCX) > viewportMargin ||
              Math.abs(other.cy - currentCY) > viewportMargin
            )
              continue

            const targetsX = [other.l, other.r, other.cx]
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

            const targetsY = [other.t, other.b, other.cy]
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
          const mRef = guidesRef as React.MutableRefObject<unknown[]>
          if (mRef.current) mRef.current = newGuides
        }

        currentSnapDX = snapDX
        currentSnapDY = snapDY

        for (let i = 0; i < movers.length; i++) {
          const m = movers[i]
          m.container.x = m.initialX + dx + snapDX
          m.container.y = m.initialY + dy + snapDY
        }
        // Move the bounding box container in sync with the elements
        if (selectionBBoxRef.current) {
          selectionBBoxRef.current.x = dx + snapDX
          selectionBBoxRef.current.y = dy + snapDY
        }
      }

      const onPointerUp = (e: PointerEvent): void => {
        if (!dragStartData.current) return
        const dx = (e.clientX - dragStartData.current.mx) / viewport.scale
        const dy = (e.clientY - dragStartData.current.my) / viewport.scale

        // Call onMove with snapped position to commit to state
        onMove(
          dragStartData.current.id,
          dragStartData.current.x + dx + currentSnapDX,
          dragStartData.current.y + dy + currentSnapDY
        )

        // Reset bbox position — React state will re-render with correct coords
        if (selectionBBoxRef.current) {
          selectionBBoxRef.current.x = 0
          selectionBBoxRef.current.y = 0
        }
        setIsDraggingSelection(false)
        dragStartData.current = null
        if (guidesRef.current) (guidesRef as any).current = []
        document.body.style.cursor = 'auto'
      }

      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)

      // Cancel multi-selection drag immediately when navigation starts (Space, pan/zoom)
      const onCancelDrag = (): void => {
        if (!dragStartData.current) return
        // Commit positions of all movers as final
        /*
        for (let i = 0; i < movers.length; i++) {
          const m = movers[i]
          const el = elements.find((el, idx) => selectedIds.includes(el.id)) // Simplified, might need matching logic
          if (!el) continue
          // Note: This logic for committing all selected elements during navigation cancel might be simplified
        }
        */

        setIsDraggingSelection(false)
        dragStartData.current = null
        if (guidesRef.current) (guidesRef as any).current = []
        document.body.style.cursor = 'auto'
      }

      window.addEventListener('cancel-element-drag', onCancelDrag)
      return () => {
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        window.removeEventListener('cancel-element-drag', onCancelDrag)
        document.body.style.cursor = 'auto'
      }
    }, [
      isDraggingSelection,
      viewport.scale,
      selectedIds,
      onMove,
      guidesRef,
      elements,
      dragContextRef
    ])

    const CULL_MARGIN = 1000
    const invScale = 1 / Math.max(0.0001, viewport.scale)
    const effectiveWidth = screenWidth || 1920
    const effectiveHeight = screenHeight || 1080
    const screenW = effectiveWidth * invScale
    const screenH = effectiveHeight * invScale
    const worldX = -viewport.x * invScale
    const worldY = -viewport.y * invScale


    return (
      <Container x={viewport.x} y={viewport.y} scale={viewport.scale}>
        {/* @ts-ignore - graphics is an intrinsic PIXI element */}
        {/* @ts-ignore - PIXI v8 graphics draw/eventMode props are handled by PIXI */}
        <Graphics
          draw={(g: PIXI.Graphics): void => {
            g.clear()
            g.rect(-100000, -100000, 200000, 200000)
            g.fill({ color: 0x000000, alpha: 0 })
          }}
          eventMode={interactive ? 'static' : 'none'}
          hitArea={new PIXI.Rectangle(-100000, -100000, 200000, 200000)}
          onPointerDown={(e: PIXI.FederatedPointerEvent): void => {
            if (e.ctrlKey || e.button === 1 || isSpaceDown) return

            if (e.button === 0 && mode === 'select') {
              onSelect([]) // Deselect all
              const rect = containerRef.current?.getBoundingClientRect()
              if (rect) {
                selectionStartPos.current = {
                  x: e.nativeEvent.clientX - rect.left,
                  y: e.nativeEvent.clientY - rect.top
                }
              }
            }
          }}
        />

        {activePath && activePath.length > 0 && (
          <Graphics
            draw={(g: PIXI.Graphics): void => {
              g.clear()
              const pts = activePath as { x: number; y: number; width?: number }[]
              if (pts.length === 0) return

              const colorHex = parseColor(penColor)
              const strokeWidth = penSize

              if (pts.length === 1) {
                g.circle(pts[0].x, pts[0].y, strokeWidth / 2)
                g.fill({ color: colorHex })
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
          <Graphics
            draw={(g: PIXI.Graphics): void => {
              g.clear()
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

              g.rect(x, y, w, h)
              g.fill({ color: 0, alpha: 0 })
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
          const items: React.ReactElement[] = []
          const activeLevel = viewport.scale > 0.6 ? 'high' : viewport.scale > 0.25 ? 'mid' : 'low'

          console.log('[BoardContent] Rendering elements:', elements.length)

          for (let i = 0; i < elements.length; i++) {
            const el = elements[i]
            const isSelected = selectedIdsSet.has(el.id)
            const isEditing = el.id === editingTextId

            const isVisible =
              el.x + (el.width || 0) / 2 >= worldX - CULL_MARGIN &&
              el.x - (el.width || 0) / 2 <= worldX + screenW + CULL_MARGIN &&
              el.y + (el.height || 0) / 2 >= worldY - CULL_MARGIN &&
              el.y - (el.height || 0) / 2 <= worldY + screenH + CULL_MARGIN

            if (!isVisible && !isSelected) continue

            items.push(
              <ElementItem
                key={el.id}
                element={el}
                isSelected={isSelected}
                zoomScale={isSelected ? viewport.scale : 1}
                activeLevel={activeLevel}
                onSelect={onElementSelect}
                onMove={onMove}
                onResize={onResize}
                onRotate={onRotate}
                onInteractionStart={onInteractionStart}
                onDoubleClick={onDoubleClick}
                isEditing={isEditing}
                renderable={true}
                interactive={interactive && mode === 'select'}
                theme={theme}
                isMultiSelection={selectedIds.length > 1}
                guidesRef={guidesRef}
                onRegisterPixi={onRegisterPixiCallback}
                dragContextRef={dragContextRef}
                isNavigatingRef={isNavigatingRef}
              />
            )
          }
          return items
        })()}

        {selectedIds.length > 1 && (
          <Container ref={selectionBBoxRef}>
            {(() => {
              const selectedIdsSet = new Set(selectedIds)
              const selectedElements = elements.filter((el) => selectedIdsSet.has(el.id))
              if (selectedElements.length === 0) return null

              let minX = Infinity,
                minY = Infinity,
                maxX = -Infinity,
                maxY = -Infinity
              selectedElements.forEach((el) => {
                const w = el.width || 0
                const h = el.height || 0
                minX = Math.min(minX, el.x - w / 2)
                minY = Math.min(minY, el.y - h / 2)
                maxX = Math.max(maxX, el.x + w / 2)
                maxY = Math.max(maxY, el.y + h / 2)
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
                <Container>
                  <Graphics
                    // @ts-ignore - PIXI v8 eventMode
                    eventMode="static"
                    cursor="move"
                    onPointerDown={(e: PIXI.FederatedPointerEvent): void => {
                      if (e.ctrlKey || e.button === 1 || isNavigatingRef?.current) return

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
                      g.rect(minX, minY, w, h)
                      g.fill({ color: 0xffffff, alpha: 0.001 })

                      // @ts-ignore - PIXI v8 stroke API
                      g.stroke({ width: lineWidth, color: accentColor, alpha: 1 })
                    }}
                  />
                  {handles.map((hd) => (
                    <Graphics
                      key={hd.id}
                      x={hd.x}
                      y={hd.y}
                      // @ts-ignore - PIXI v8 stroke API
                      eventMode="static"
                      cursor={hd.cursor}
                      draw={(g: PIXI.Graphics): void => {
                        g.clear()
                        let hw = handleSize
                        let hh = handleSize
                        if (hd.id === 'top' || hd.id === 'bottom') {
                          hw = handleSize * 2.5
                          hh = handleSize * 0.6
                        } else if (hd.id === 'left' || hd.id === 'right') {
                          hh = handleSize * 2.5
                          hw = handleSize * 0.6
                        }
                        g.roundRect(-hw / 2, -hh / 2, hw, hh, 2 / viewport.scale)
                        g.fill({ color: accentColor })
                      }}
                    />
                  ))}
                </Container>
              )
            })()}
          </Container>
        )}
        <SnappingGuidesRenderer guidesRef={guidesRef} scale={viewport.scale} theme={theme} />
      </Container>
    )
  }
)

BoardContent.displayName = 'BoardContent'

export default BoardContent
