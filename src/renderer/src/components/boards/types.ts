export type ElementType =
  | 'image'
  | 'video'
  | 'path'
  | 'rect'
  | 'circle'
  | 'text'
  | 'youtube'
  | 'vimeo'
  | 'vk'
  | 'rutube'
  | 'kinescope'

export interface BaseElement {
  id: string
  type: ElementType
  x: number
  y: number
  width: number
  height: number
  rotation: number
  groupId?: string
}

export interface ImageElement extends BaseElement {
  type: 'image'
  url: string
  lowResUrl?: string
}

export interface VideoElement extends BaseElement {
  type: 'video'
  url: string
}

export interface PathElement extends BaseElement {
  type: 'path'
  points: { x: number; y: number }[]
  color: string
  size: number
}

export interface RectElement extends BaseElement {
  type: 'rect'
  color: string
  strokeColor: string
  strokeWidth: number
}

export interface CircleElement extends BaseElement {
  type: 'circle'
  color: string
  strokeColor: string
  strokeWidth: number
}

export interface TextElement extends BaseElement {
  type: 'text'
  text: string
  fontSize: number
  fontFamily: string
  color: string
}

export interface YoutubeElement extends BaseElement {
  type: 'youtube'
  videoId: string
}

export interface VimeoElement extends BaseElement {
  type: 'vimeo'
  videoId: string
}

export interface VkElement extends BaseElement {
  type: 'vk'
  videoId: string // expecting format "oid_vid", e.g. "-12345_67890"
}

export interface RutubeElement extends BaseElement {
  type: 'rutube'
  videoId: string
}

export interface KinescopeElement extends BaseElement {
  type: 'kinescope'
  videoId: string
}

export type CanvasElement =
  | ImageElement
  | VideoElement
  | PathElement
  | RectElement
  | CircleElement
  | TextElement
  | YoutubeElement
  | VimeoElement
  | VkElement
  | RutubeElement
  | KinescopeElement
