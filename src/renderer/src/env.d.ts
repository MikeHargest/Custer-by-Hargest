/// <reference types="vite/client" />

declare global {
  namespace JSX {
    interface IntrinsicElements {
      container: any
      graphics: any
      sprite: any
      text: any
      pixiContainer: any
      pixiGraphics: any
      pixiSprite: any
      pixiText: any
    }
  }
}
