import { UITheme } from '../../types'
import * as PIXI from 'pixi.js'

export interface BoardElement {
  id: string
  type: 'image' | 'video' | 'link' | 'path' | 'rect' | 'text'
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  url: string // For 'image' | 'video' | 'link'
  title?: string // For 'link'
  // For 'path'
  points?: { x: number; y: number; width?: number }[]
  size?: number
  color?: string
  // For 'rect'
  strokeColor?: string
  strokeWidth?: number
  groupId?: string
  baseWidth?: number
  baseHeight?: number
  // For 'text'
  text?: string
  fontSize?: number
  fontWeight?: number
  textAlign?: 'left' | 'center' | 'right'
  // Transient state
  isProcessing?: boolean
}

export interface CachedSnapTarget {
  l: number
  r: number
  t: number
  b: number
  cx: number
  cy: number
}

export interface Viewport {
  x: number
  y: number
  scale: number
}

export interface BoardsViewProps {
  boardData: string
  onChange: (data: string) => void
  showFPS?: boolean
  theme?: UITheme
  setTheme?: (theme: UITheme) => void
  isSidebarOpen?: boolean
  boardId: string
  boardDir: string
  boardFileName: string
}

export type AlignmentDirection = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'

export interface TextureCacheEntry {
  high: PIXI.Texture
  mid: PIXI.Texture
  low: PIXI.Texture
  source: HTMLImageElement | HTMLVideoElement
  refCount: number
  lastUsed: number
}
