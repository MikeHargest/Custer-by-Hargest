import { useCallback, useEffect } from 'react'
import { nanoid } from 'nanoid'
import { BoardElement, Viewport } from '../types'

interface UseBoardAssetsProps {
  boardDir: string
  boardFileName: string
  viewport: Viewport
  containerRef: React.RefObject<HTMLDivElement | null>
  setElements: React.Dispatch<React.SetStateAction<BoardElement[]>>
  pushToHistory: () => void
}

export const useBoardAssets = ({
  boardDir,
  boardFileName,
  viewport,
  containerRef,
  setElements,
  pushToHistory
}: UseBoardAssetsProps) => {

  const addElementAtPos = useCallback(
    (
      type: 'image' | 'video' | 'link',
      url: string,
      screenX: number,
      screenY: number,
      initialWidth?: number,
      initialHeight?: number
    ): string | null => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return null

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

      const needsSaving =
        (type === 'image' || type === 'video') &&
        (url.startsWith('data:') || (url.startsWith('file:///') && !url.includes('ibo_temp')))

      const finalId = nanoid()
      const newElement: BoardElement = {
        id: finalId,
        type,
        x: worldX,
        y: worldY,
        width: finalWidth,
        height: finalHeight,
        url: url,
        isProcessing: needsSaving,
        title: type === 'link' ? url.split('//').pop()?.split('/')[0] || url : undefined
      }

      pushToHistory()
      setElements((prev) => [...prev, newElement])

      if (needsSaving) {
        // Setup a local safety timeout for this specific element
        const safetyTimer = setTimeout(() => {
          setElements((prev) =>
            prev.map((el) => (el.id === finalId && el.isProcessing ? { ...el, isProcessing: false } : el))
          )
        }, 4000)

        // @ts-ignore - api defined in preload
        window.api
          .saveBoardAsset(boardDir, boardFileName, finalId, url)
          .then((result: { url: string; fullPath: string } | null) => {
            clearTimeout(safetyTimer)
            if (result) {
              setElements((prev) =>
                prev.map((el) =>
                  el.id === finalId ? { ...el, url: result.fullPath, isProcessing: false } : el
                )
              )
            } else {
              setElements((prev) =>
                prev.map((el) => (el.id === finalId ? { ...el, isProcessing: false } : el))
              )
            }
          })
          .catch((err: any) => {
            clearTimeout(safetyTimer)
            console.error('Failed to save asset:', err)
            setElements((prev) =>
              prev.map((el) => (el.id === finalId ? { ...el, isProcessing: false } : el))
            )
          })
      }
      return finalId
    },
    [viewport, pushToHistory, boardDir, boardFileName, containerRef, setElements]
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
  }, [addElementAtPos, containerRef])

  return { handleDrop, addElementAtPos }
}
