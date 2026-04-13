import { useState, useCallback, useRef, useEffect } from 'react'
import { BoardElement } from '../types'

export const useBoardHistory = (elements: BoardElement[], setElements: React.Dispatch<React.SetStateAction<BoardElement[]>>) => {
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const historyPast = useRef<BoardElement[][]>([])
  const historyFuture = useRef<BoardElement[][]>([])
  const lastHistoryStateRef = useRef<BoardElement[] | null>(null)

  const pushToHistory = useCallback(() => {
    if (lastHistoryStateRef.current === elements) return

    historyPast.current.push(elements)
    lastHistoryStateRef.current = elements

    if (historyPast.current.length > 50) {
      historyPast.current.shift()
    }
    historyFuture.current = []
    setCanUndo(true)
    setCanRedo(false)
  }, [elements])

  const undo = useCallback((): void => {
    if (historyPast.current.length === 0) return
    const current = elements
    const previous = historyPast.current.pop()!
    historyFuture.current.push(current)
    lastHistoryStateRef.current = previous
    setElements(previous)
    setCanUndo(historyPast.current.length > 0)
    setCanRedo(true)
  }, [elements, setElements])

  const redo = useCallback((): void => {
    if (historyFuture.current.length === 0) return
    const current = elements
    const next = historyFuture.current.pop()!
    historyPast.current.push(current)
    lastHistoryStateRef.current = next
    setElements(next)
    setCanRedo(historyFuture.current.length > 0)
    setCanUndo(true)
  }, [elements, setElements])

  useEffect(() => {
    setCanUndo(historyPast.current.length > 0)
    setCanRedo(historyFuture.current.length > 0)
  }, [elements])

  return { undo, redo, pushToHistory, canUndo, canRedo }
}
