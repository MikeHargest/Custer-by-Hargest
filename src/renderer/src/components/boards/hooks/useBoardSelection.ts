import { useState, useCallback, useRef, useEffect } from 'react'
import { BoardElement, Viewport } from '../types'

interface UseBoardSelectionProps {
  elements: BoardElement[]
  viewport: Viewport
  setSelectedIds: (ids: string[] | ((prev: string[]) => string[])) => void
  containerRef: React.RefObject<HTMLDivElement | null>
  pushToHistory: () => void
  setElements: React.Dispatch<React.SetStateAction<BoardElement[]>>
  selectedIds: string[]
}

export const useBoardSelection = ({
  elements,
  viewport,
  setSelectedIds,
  containerRef,
  pushToHistory,
  setElements,
  selectedIds
}: UseBoardSelectionProps) => {
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const selectionStartPos = useRef<{ x: number; y: number } | null>(null)
  
  const elementsRef = useRef(elements)
  useEffect(() => { elementsRef.current = elements }, [elements])
  const viewportRef = useRef(viewport)
  useEffect(() => { viewportRef.current = viewport }, [viewport])

  const handleElementSelect = useCallback(
    (id: string | null, isShift: boolean = false): void => {
      selectionStartPos.current = null
      if (!id) {
        setSelectedIds([])
        return
      }
      const target = elementsRef.current.find((el) => el.id === id)
      if (!target) return

      let idsToSelect = [id]
      if (target.groupId) {
        idsToSelect = elementsRef.current.filter((el) => el.groupId === target.groupId).map((el) => el.id)
      }

      if (isShift) {
        setSelectedIds((prev) => {
          const alreadySelected = idsToSelect.every((sid) => prev.includes(sid))
          return alreadySelected ? prev.filter((sid) => !idsToSelect.includes(sid)) : Array.from(new Set([...prev, ...idsToSelect]))
        })
      } else {
        setSelectedIds((prev) => {
          const alreadySelected = prev.length === idsToSelect.length && idsToSelect.every((sid) => prev.includes(sid))
          return alreadySelected ? prev : idsToSelect
        })
      }
    },
    [setSelectedIds]
  )

  useEffect(() => {
    const onMouseMove = (e: MouseEvent): void => {
      if (!selectionStartPos.current) return
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      const curX = e.clientX - rect.left, curY = e.clientY - rect.top
      const dx = curX - selectionStartPos.current.x, dy = curY - selectionStartPos.current.y
      if (Math.sqrt(dx * dx + dy * dy) > 5) {
        const x = Math.min(selectionStartPos.current.x, curX), y = Math.min(selectionStartPos.current.y, curY)
        const w = Math.abs(dx), h = Math.abs(dy)
        setSelectionRect({ x, y, w, h })

        const vp = viewportRef.current
        const worldX = (x - vp.x) / vp.scale, worldY = (y - vp.y) / vp.scale
        const worldW = w / vp.scale, worldH = h / vp.scale

        const intersectingIds = elementsRef.current.filter((el) => {
          const w = el.width || 0, h = el.height || 0
          const elLeft = el.x - w / 2, elTop = el.y - h / 2
          const elRight = el.x + w / 2, elBottom = el.y + h / 2
          return elLeft < worldX + worldW && elRight > worldX && elTop < worldY + worldH && elBottom > worldY
        }).map((el) => el.id)

        const touchedGroupIds = new Set<string>()
        elementsRef.current.forEach((el) => {
          if (intersectingIds.includes(el.id) && el.groupId) touchedGroupIds.add(el.groupId)
        })

        const newSelected = touchedGroupIds.size > 0
          ? elementsRef.current.filter(el => intersectingIds.includes(el.id) || (el.groupId && touchedGroupIds.has(el.groupId))).map(el => el.id)
          : intersectingIds

        if (e.shiftKey) setSelectedIds((prev) => Array.from(new Set([...prev, ...newSelected])))
        else setSelectedIds(newSelected)
      }
    }

    const onMouseUp = (): void => {
      selectionStartPos.current = null
      setSelectionRect(null)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [containerRef, setSelectedIds])

  const alignElements = useCallback((direction: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (selectedIds.length < 2) return
    pushToHistory()
    setElements((prev) => {
      const selected = prev.filter((el) => selectedIds.includes(el.id))
      let commonVal: number
      switch (direction) {
        case 'left':
          commonVal = Math.min(...selected.map((el) => el.x - el.width / 2))
          return prev.map((el) => selectedIds.includes(el.id) ? { ...el, x: commonVal + el.width / 2 } : el)
        case 'right':
          commonVal = Math.max(...selected.map((el) => el.x + el.width / 2))
          return prev.map((el) => selectedIds.includes(el.id) ? { ...el, x: commonVal - el.width / 2 } : el)
        case 'center': {
          const minX = Math.min(...selected.map((el) => el.x - el.width / 2))
          const maxX = Math.max(...selected.map((el) => el.x + el.width / 2))
          commonVal = (minX + maxX) / 2
          return prev.map((el) => selectedIds.includes(el.id) ? { ...el, x: commonVal } : el)
        }
        case 'top':
          commonVal = Math.min(...selected.map((el) => el.y - el.height / 2))
          return prev.map((el) => selectedIds.includes(el.id) ? { ...el, y: commonVal + el.height / 2 } : el)
        case 'bottom':
          commonVal = Math.max(...selected.map((el) => el.y + el.height / 2))
          return prev.map((el) => selectedIds.includes(el.id) ? { ...el, y: commonVal - el.height / 2 } : el)
        case 'middle': {
          const minY = Math.min(...selected.map((el) => el.y - el.height / 2))
          const maxY = Math.max(...selected.map((el) => el.y + el.height / 2))
          commonVal = (minY + maxY) / 2
          return prev.map((el) => selectedIds.includes(el.id) ? { ...el, y: commonVal } : el)
        }
        default: return prev
      }
    })
  }, [selectedIds, pushToHistory, setElements])

  return { selectionRect, selectionStartPos, handleElementSelect, alignElements }
}
