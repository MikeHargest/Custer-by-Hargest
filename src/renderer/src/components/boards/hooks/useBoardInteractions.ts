import { useCallback } from 'react'
import { nanoid } from 'nanoid'
import { BoardElement } from '../types'

interface UseBoardInteractionsProps {
  elements: BoardElement[]
  setElements: React.Dispatch<React.SetStateAction<BoardElement[]>>
  selectedIds: string[]
  setSelectedIds: (ids: string[]) => void
  pushToHistory: () => void
}

export const useBoardInteractions = ({
  elements,
  setElements,
  selectedIds,
  setSelectedIds,
  pushToHistory
}: UseBoardInteractionsProps) => {

  const handleElementMove = useCallback((id: string, x: number, y: number) => {
    setElements((prev) => {
      const target = prev.find((el) => el.id === id)
      if (!target) return prev
      const dx = x - target.x, dy = y - target.y
      return prev.map((el) => selectedIds.includes(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el)
    })
  }, [selectedIds, setElements])

  const handleElementResize = useCallback((id: string, width: number, height: number, x?: number, y?: number, handle?: string) => {
    setElements((prev) => {
      const target = prev.find((el) => el.id === id)
      if (!target) return prev

      if (selectedIds.length <= 1) {
        return prev.map((el) => {
          if (el.id !== id) return el
          const nextEl = { ...el, width, height, x: x ?? el.x, y: y ?? el.y }
          if (el.type === 'text' && handle) {
            if (handle.includes('top') || handle.includes('bottom')) {
              const scaleW = width / (target.width || 1)
              const scaleH = height / (target.height || 1)
              const scale = Math.abs(scaleW - 1) > Math.abs(scaleH - 1) ? scaleW : scaleH
              nextEl.fontSize = Math.max(8, Math.round((el.fontSize || 24) * scale))
              nextEl.width = (target.width || 0) * scale
              nextEl.height = (target.height || 0) * scale
            }
          }
          return nextEl
        })
      }

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      prev.filter(el => selectedIds.includes(el.id)).forEach(el => {
        const ew = el.width || 0, eh = el.height || 0
        minX = Math.min(minX, el.x - ew / 2); minY = Math.min(minY, el.y - eh / 2)
        maxX = Math.max(maxX, el.x + ew / 2); maxY = Math.max(maxY, el.y + eh / 2)
      })
      
      const groupW = maxX - minX
      const groupH = maxY - minY
      const ratioW = groupW > 0 ? width / groupW : 1
      const ratioH = groupH > 0 ? height / groupH : 1
      
      const newGroupCx = x !== undefined ? x : (minX + maxX) / 2
      const newGroupCy = y !== undefined ? y : (minY + maxY) / 2
      const oldGroupCx = (minX + maxX) / 2
      const oldGroupCy = (minY + maxY) / 2

      return prev.map((el) => {
        if (!selectedIds.includes(el.id)) return el
        const ew = el.width || 0, eh = el.height || 0
        
        const relX = el.x - oldGroupCx
        const relY = el.y - oldGroupCy
        
        const newRelX = relX * ratioW
        const newRelY = relY * ratioH
        
        const nextEl = { 
          ...el, 
          x: newGroupCx + newRelX, 
          y: newGroupCy + newRelY, 
          width: ew * ratioW, 
          height: eh * ratioH 
        }
        if (el.type === 'text') {
           const textScaleX = nextEl.width / (ew || 1)
           nextEl.fontSize = Math.max(8, Math.round((el.fontSize || 24) * textScaleX))
        }
        return nextEl
      })
    })
  }, [selectedIds, setElements])

  const handleElementRotate = useCallback((id: string, rotation: number, cxOverride?: number, cyOverride?: number) => {
    setElements((prev) => {
      const target = prev.find((el) => el.id === id)
      if (!target) return prev
      const delta = rotation - (target.rotation || 0)
      if (selectedIds.length <= 1) return prev.map((el) => el.id === id ? { ...el, rotation } : el)
      
      let cx = cxOverride, cy = cyOverride
      if (cx === undefined || cy === undefined) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        prev.filter(el => selectedIds.includes(el.id)).forEach(el => {
          const ew = el.width || 0, eh = el.height || 0
          minX = Math.min(minX, el.x - ew / 2); minY = Math.min(minY, el.y - eh / 2)
          maxX = Math.max(maxX, el.x + ew / 2); maxY = Math.max(maxY, el.y + eh / 2)
        })
        cx = (minX + maxX) / 2
        cy = (minY + maxY) / 2
      }

      return prev.map((el) => {
        if (!selectedIds.includes(el.id)) return el
        const dx = el.x - cx!, dy = el.y - cy!, cos = Math.cos(delta), sin = Math.sin(delta)
        return { ...el, x: cx! + (dx * cos - dy * sin), y: cy! + (dx * sin + dy * cos), rotation: (el.rotation || 0) + delta }
      })
    })
  }, [selectedIds, setElements])

  const groupElements = useCallback(() => {
    if (selectedIds.length < 2) return
    pushToHistory()
    const gid = nanoid()
    setElements(prev => prev.map(el => selectedIds.includes(el.id) ? { ...el, groupId: gid } : el))
  }, [selectedIds, pushToHistory, setElements])

  const ungroupElements = useCallback(() => {
    if (selectedIds.length === 0) return
    pushToHistory()
    const groupIds = new Set(elements.filter(el => selectedIds.includes(el.id)).map(el => el.groupId).filter(Boolean))
    setElements(prev => prev.map(el => (el.groupId && groupIds.has(el.groupId)) ? { ...el, groupId: undefined } : el))
  }, [selectedIds, pushToHistory, elements, setElements])

  const bringToFront = useCallback(() => {
    if (selectedIds.length === 0) return
    pushToHistory()
    setElements(prev => {
      const selected = prev.filter(el => selectedIds.includes(el.id))
      const others = prev.filter(el => !selectedIds.includes(el.id))
      return [...others, ...selected]
    })
  }, [selectedIds, pushToHistory, setElements])

  const sendToBack = useCallback(() => {
    if (selectedIds.length === 0) return
    pushToHistory()
    setElements(prev => {
      const selected = prev.filter(el => selectedIds.includes(el.id))
      const others = prev.filter(el => !selectedIds.includes(el.id))
      return [...selected, ...others]
    })
  }, [selectedIds, pushToHistory, setElements])

  const duplicateElements = useCallback(() => {
    if (selectedIds.length === 0) return
    pushToHistory()
    const newElements: BoardElement[] = []
    const idMap = new Map<string, string>()
    const selected = elements.filter(el => selectedIds.includes(el.id))
    selected.forEach(el => idMap.set(el.id, nanoid()))
    selected.forEach(el => {
      newElements.push({ ...el, id: idMap.get(el.id)!, x: el.x + 20, y: el.y + 20, groupId: el.groupId ? (idMap.get(el.groupId) || nanoid()) : undefined })
    })
    setElements(prev => [...prev, ...newElements])
    setSelectedIds(newElements.map(el => el.id))
  }, [selectedIds, elements, pushToHistory, setElements, setSelectedIds])

  const copyElements = useCallback(() => {
    if (selectedIds.length === 0) return
    const selected = elements.filter(el => selectedIds.includes(el.id))
    localStorage.setItem('whiteboard_clipboard', JSON.stringify(selected))
  }, [selectedIds, elements])

  const pasteElements = useCallback(() => {
    const raw = localStorage.getItem('whiteboard_clipboard')
    if (!raw) return
    try {
      const items = JSON.parse(raw) as BoardElement[]
      if (!Array.isArray(items)) return
      pushToHistory()
      const newElements: BoardElement[] = []
      const idMap = new Map<string, string>()
      items.forEach(el => idMap.set(el.id, nanoid()))
      items.forEach(el => {
        newElements.push({ ...el, id: idMap.get(el.id)!, x: el.x + 40, y: el.y + 40, groupId: el.groupId ? (idMap.get(el.groupId) || nanoid()) : undefined })
      })
      setElements(prev => [...prev, ...newElements])
      setSelectedIds(newElements.map(el => el.id))
    } catch { console.error('Failed to paste') }
  }, [pushToHistory, setElements, setSelectedIds])

  const arrangeAsGrid = useCallback(() => {
    if (selectedIds.length < 2) return
    pushToHistory()
    setElements(prev => {
      const selected = prev.filter((el) => selectedIds.includes(el.id))
      selected.sort((a, b) => (a.y - b.y) * 1000 + (a.x - b.x))
      const cols = Math.ceil(Math.sqrt(selected.length)), spacing = 80
      const minX = Math.min(...selected.map(el => el.x - el.width/2)), minY = Math.min(...selected.map(el => el.y - el.height/2))
      let curX = minX, curY = minY, maxHeight = 0, nextElements = [...prev]
      selected.forEach((el, i) => {
        if (i > 0 && i % cols === 0) { curX = minX; curY += maxHeight + spacing; maxHeight = 0 }
        const idx = nextElements.findIndex(e => e.id === el.id)
        nextElements[idx] = { ...el, x: curX + el.width/2, y: curY + el.height/2 }
        curX += el.width + spacing; maxHeight = Math.max(maxHeight, el.height)
      })
      return nextElements
    })
  }, [selectedIds, pushToHistory, setElements])

  const bringForward = useCallback(() => {
    if (selectedIds.length === 0) return
    pushToHistory()
    setElements(prev => {
      const next = [...prev]
      for (let i = next.length - 2; i >= 0; i--) {
        if (selectedIds.includes(next[i].id) && !selectedIds.includes(next[i+1].id)) {
          [next[i], next[i+1]] = [next[i+1], next[i]]
        }
      }
      return next
    })
  }, [selectedIds, pushToHistory, setElements])

  const sendBackward = useCallback(() => {
    if (selectedIds.length === 0) return
    pushToHistory()
    setElements(prev => {
      const next = [...prev]
      for (let i = 1; i < next.length; i++) {
        if (selectedIds.includes(next[i].id) && !selectedIds.includes(next[i-1].id)) {
          [next[i], next[i-1]] = [next[i-1], next[i]]
        }
      }
      return next
    })
  }, [selectedIds, pushToHistory, setElements])

  return { 
    handleElementMove, handleElementResize, handleElementRotate, 
    groupElements, ungroupElements, bringToFront, sendToBack, bringForward, sendBackward,
    duplicateElements, copyElements, pasteElements, arrangeAsGrid 
  }
}
