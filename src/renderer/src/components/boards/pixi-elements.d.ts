import * as PIXI from 'pixi.js'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      container: any
      graphics: any
      sprite: any
      text: any
    }
  }
}
