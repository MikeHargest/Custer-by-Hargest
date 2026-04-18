import * as PIXI from 'pixi.js'
import { TextureCacheEntry } from './types'

/**
 * Global cache for textures and LOD levels.
 */
export const sharedTextureCache = new Map<string, TextureCacheEntry>()

const loadingPromises = new Map<
  string,
  Promise<{ high: PIXI.Texture; mid: PIXI.Texture; low: PIXI.Texture; source: any }>
>()

const releaseTimers = new Map<string, ReturnType<typeof setTimeout>>()

export const getSharedTexture = (
  url: string,
  type: 'image' | 'video'
): Promise<{ high: PIXI.Texture; mid: PIXI.Texture; low: PIXI.Texture; source: any }> => {
  const cached = sharedTextureCache.get(url)
  if (cached) {
    // Check if textures were destroyed by PixiJS context loss or unmount
    if (cached.high.destroyed || (cached.high as any).source?.destroyed) {
      sharedTextureCache.delete(url)
      // Fall through to reload
    } else {
      cached.refCount++
      cached.lastUsed = Date.now()
      
      // If it was scheduled for destruction, cancel it
      const timer = releaseTimers.get(url)
      if (timer) {
        clearTimeout(timer)
        releaseTimers.delete(url)
      }

      return Promise.resolve({ high: cached.high, mid: cached.mid, low: cached.low, source: cached.source })
    }
  }

  const existingPromise = loadingPromises.get(url)
  if (existingPromise) {
    return existingPromise.then((res) => {
      const c = sharedTextureCache.get(url)
      if (c) c.refCount++
      return res
    })
  }

  const promise = new Promise<{
    high: PIXI.Texture
    mid: PIXI.Texture
    low: PIXI.Texture
    source: any
  }>((resolve, reject) => {
    if (type === 'image') {
      const img = new Image()
      if (url.startsWith('http')) img.crossOrigin = 'anonymous'
      img.src = url
      img.onload = (): void => {
        const high = PIXI.Texture.from(img)
        // Generate LOD
        const createLevel = (scale: number): PIXI.Texture => {
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, img.width * scale)
          canvas.height = Math.max(1, img.height * scale)
          const ctx = canvas.getContext('2d')
          if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          return PIXI.Texture.from(canvas)
        }
        const mid = createLevel(0.5)
        const low = createLevel(0.25)

        sharedTextureCache.set(url, {
          high,
          mid,
          low,
          source: img,
          refCount: 1,
          lastUsed: Date.now()
        })
        loadingPromises.delete(url)
        resolve({ high, mid, low, source: img })
      }
      img.onerror = (e): void => {
        loadingPromises.delete(url)
        reject(e)
      }
    } else {
      const video = document.createElement('video')
      video.src = url
      video.muted = true
      video.loop = true
      video.autoplay = true
      video.crossOrigin = 'anonymous'
      video
        .play()
        .then(() => {
          const high = PIXI.Texture.from(video)
          sharedTextureCache.set(url, {
            high,
            mid: high,
            low: high,
            source: video,
            refCount: 1,
            lastUsed: Date.now()
          })
          loadingPromises.delete(url)
          resolve({ high, mid: high, low: high, source: video })
        })
        .catch((e) => {
          loadingPromises.delete(url)
          reject(e)
        })
    }
  })

  loadingPromises.set(url, promise)
  return promise
}

export const releaseSharedTexture = (url: string): void => {
  const cached = sharedTextureCache.get(url)
  if (cached) {
    cached.refCount--
    if (cached.refCount <= 0) {
      // Don't destroy immediately. Give it a 15-second grace period.
      // This prevents massive FPS drops when panning back and forth across the whiteboard margins.
      const timer = setTimeout(() => {
        const c = sharedTextureCache.get(url)
        if (c && c.refCount <= 0) {
          try {
            if (!c.high.destroyed) c.high.destroy(true)
            if (c.mid !== c.high && !c.mid.destroyed) c.mid.destroy(true)
            if (c.low !== c.high && !c.low.destroyed) c.low.destroy(true)
          } catch (e) {
            console.error('Failed to destroy textures:', e)
          }
          if (c.source instanceof HTMLVideoElement) {
            c.source.pause()
            c.source.src = ''
            c.source.load()
          }
          sharedTextureCache.delete(url)
        }
        releaseTimers.delete(url)
      }, 15000) // 15 seconds grace period
      
      releaseTimers.set(url, timer)
    }
  }
}

// Utility to simplify a path using Ramer-Douglas-Peucker algorithm
export const simplifyPath = (
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
export const getCircleLineIntersection = (
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
export const parseColor = (color?: string): number => {
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
