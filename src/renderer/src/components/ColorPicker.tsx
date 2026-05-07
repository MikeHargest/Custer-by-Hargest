import React, { useState, useEffect, useRef, useCallback } from 'react'

// ===== HSB ↔ HEX conversion =====

function hsbToRgb(h: number, s: number, b: number): [number, number, number] {
  const s1 = s / 100
  const b1 = b / 100
  const c = b1 * s1
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = b1 - c
  let r1 = 0,
    g1 = 0,
    bl = 0
  if (h < 60) {
    r1 = c
    g1 = x
  } else if (h < 120) {
    r1 = x
    g1 = c
  } else if (h < 180) {
    g1 = c
    bl = x
  } else if (h < 240) {
    g1 = x
    bl = c
  } else if (h < 300) {
    r1 = x
    bl = c
  } else {
    r1 = c
    bl = x
  }
  return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((bl + m) * 255)]
}

function rgbToHsb(r: number, g: number, b: number): [number, number, number] {
  const r1 = r / 255,
    g1 = g / 255,
    b1 = b / 255
  const max = Math.max(r1, g1, b1),
    min = Math.min(r1, g1, b1)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r1) h = ((g1 - b1) / d + 6) % 6
    else if (max === g1) h = (b1 - r1) / d + 2
    else h = (r1 - g1) / d + 4
    h *= 60
  }
  const s = max === 0 ? 0 : (d / max) * 100
  const bright = max * 100
  return [Math.round(h), Math.round(s), Math.round(bright)]
}

function hexToRgb(hex: string): [number, number, number] | null {
  if (!hex) return null
  if (hex === 'transparent') return [255, 255, 255] // Default to white for transparent base
  
  const clean = hex.replace('#', '')
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16)
    const g = parseInt(clean[1] + clean[1], 16)
    const b = parseInt(clean[2] + clean[2], 16)
    return [r, g, b]
  }
  
  const m = clean.match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return null
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0').toUpperCase()).join('')
}

// ===== Props =====
interface ColorPickerProps {
  color: string
  onChange: (color: string) => void
  onClose: () => void
  anchorRect?: DOMRect | null
  inline?: boolean
  opacity?: number
  onOpacityChange?: (opacity: number) => void
}

export default function ColorPicker({
  color,
  onChange,
  onClose,
  anchorRect,
  inline,
  opacity,
  onOpacityChange
}: ColorPickerProps): React.ReactElement {
  const rgb = hexToRgb(color) || [255, 62, 108]
  const initialHsb = rgbToHsb(...rgb)

  const [hue, setHue] = useState(initialHsb[0])
  const [sat, setSat] = useState(initialHsb[1])
  const [bright, setBright] = useState(initialHsb[2])
  const [hexInput, setHexInput] = useState(color.toUpperCase())

  const popupRef = useRef<HTMLDivElement>(null)

  // Close on outside click or far mouse movement
  useEffect(() => {
    const clickHandler = (e: MouseEvent): void => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const mouseMoveHandler = (e: MouseEvent): void => {
      if (!popupRef.current || inline) return
      const rect = popupRef.current.getBoundingClientRect()
      const threshold = 150 // Distance in pixels

      const dist = Math.sqrt(
        Math.pow(Math.max(0, rect.left - e.clientX, e.clientX - rect.right), 2) +
          Math.pow(Math.max(0, rect.top - e.clientY, e.clientY - rect.bottom), 2)
      )

      if (dist > threshold) {
        onClose()
      }
    }

    // Delay adding the listener to avoid immediate close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', clickHandler)
      document.addEventListener('mousemove', mouseMoveHandler)
    }, 50)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', clickHandler)
      document.removeEventListener('mousemove', mouseMoveHandler)
    }
  }, [onClose, inline])

  // Build the current color hex from HSB
  const currentHex = useCallback(() => {
    const [r, g, b] = hsbToRgb(hue, sat, bright)
    return rgbToHex(r, g, b)
  }, [hue, sat, bright])

  // Sync with color prop changes from outside (e.g. from Settings modal)
  useEffect(() => {
    // Only update if it's actually different from our current internal state
    const [curR, curG, curB] = hsbToRgb(hue, sat, bright)
    const currentHexStr = rgbToHex(curR, curG, curB)
    
    const targetHex = color.startsWith('#') ? color : '#' + color
    
    // Normalize both for comparison (handles #FFF vs #FFFFFF)
    const targetRgb = hexToRgb(targetHex)
    const currentRgb = [curR, curG, curB]
    
    if (targetRgb && (
        targetRgb[0] !== currentRgb[0] || 
        targetRgb[1] !== currentRgb[1] || 
        targetRgb[2] !== currentRgb[2])) {
        
      const [h, s, b] = rgbToHsb(...targetRgb)
      setHue(h)
      setSat(s)
      setBright(b)
      setHexInput(rgbToHex(...targetRgb))
    }
    // We intentionally omit hue, sat, bright from dependencies to avoid infinite loops
    // We only want to sync when the 'color' prop changes from the parent
  }, [color])

  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const handleColorUpdate = useCallback((h: number, s: number, b: number) => {
    setHue(h)
    setSat(s)
    setBright(b)
    const [r, g, bVal] = hsbToRgb(h, s, b)
    const hex = rgbToHex(r, g, bVal)
    setHexInput(hex)
    onChangeRef.current(hex)
  }, [])

  const throttleRef = useRef<NodeJS.Timeout | null>(null)

  const handleSliderMouseDown = useCallback(
    (channel: 'h' | 's' | 'b', e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      const track = e.currentTarget
      const rect = track.getBoundingClientRect()

      // Immediately jump thumb to click position, and update globally
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
      const initRatio = x / rect.width
      
      let newH = hue, newS = sat, newB = bright
      if (channel === 'h') newH = Math.round(initRatio * 360)
      else if (channel === 's') newS = Math.round(initRatio * 100)
      else newB = Math.round(initRatio * 100)
      
      handleColorUpdate(newH, newS, newB)

      const onMove = (ev: MouseEvent): void => {
        ev.preventDefault()
        const r = track.getBoundingClientRect()
        const mx = Math.max(0, Math.min(ev.clientX - r.left, r.width))
        const ratio = mx / r.width

        let mH = hue, mS = sat, mB = bright
        if (channel === 'h') mH = Math.round(ratio * 360)
        else if (channel === 's') mS = Math.round(ratio * 100)
        else mB = Math.round(ratio * 100)

        // Throttle global app update (onChange) to save CPU/prevent heavy renders
        if (!throttleRef.current) {
          throttleRef.current = setTimeout(() => {
            handleColorUpdate(mH, mS, mB)
            throttleRef.current = null
          }, 32)
        }
      }
      const onUp = (ev: MouseEvent): void => {
        // Clear any pending throttle and do one final precise update
        if (throttleRef.current) {
          clearTimeout(throttleRef.current)
          throttleRef.current = null
        }
        const r = track.getBoundingClientRect()
        const mx = Math.max(0, Math.min(ev.clientX - r.left, r.width))
        const finalRatio = mx / r.width

        let fH = hue, fS = sat, fB = bright
        if (channel === 'h') fH = Math.round(finalRatio * 360)
        else if (channel === 's') fS = Math.round(finalRatio * 100)
        else fB = Math.round(finalRatio * 100)
        
        handleColorUpdate(fH, fS, fB)

        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [hue, sat, bright, handleColorUpdate]
  )

  // Handle hex input
  const handleHexChange = (val: string): void => {
    setHexInput(val)
    const clean = val.startsWith('#') ? val : '#' + val
    const parsed = hexToRgb(clean)
    if (parsed) {
      const [h, s, b] = rgbToHsb(...parsed)
      setHue(h)
      setSat(s)
      setBright(b)
      handleColorUpdate(h, s, b)
    }
  }

  // Position
  const popupStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 99999,
    background: 'var(--card-bg)',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    width: '260px',
    userSelect: 'none'
  }

  if (inline) {
    popupStyle.position = 'relative'
    popupStyle.top = 'auto'
    popupStyle.left = 'auto'
    popupStyle.transform = 'none'
    popupStyle.boxShadow = 'none'
    popupStyle.border = 'none'
    popupStyle.padding = '0'
    popupStyle.width = '100%'
    popupStyle.zIndex = 'auto'
  } else if (anchorRect) {
    popupStyle.top = anchorRect.bottom + 6
    popupStyle.left = anchorRect.left
    // Make sure it doesn't overflow the viewport
    if (anchorRect.left + 260 > window.innerWidth) {
      popupStyle.left = window.innerWidth - 270
    }
    if (anchorRect.bottom + 240 > window.innerHeight) {
      popupStyle.top = anchorRect.top - 240
    }
  } else {
    popupStyle.top = '50%'
    popupStyle.left = '50%'
    popupStyle.transform = 'translate(-50%, -50%)'
  }

  const hex = currentHex()
  const hueColor = rgbToHex(...hsbToRgb(hue, 100, 100))

  // Track styles
  const trackStyle: React.CSSProperties = {
    position: 'relative',
    height: '14px',
    borderRadius: '7px',
    cursor: 'pointer',
    flex: 1
  }

  const thumbStyle = (pos: number): React.CSSProperties => ({
    position: 'absolute',
    top: '50%',
    left: `${pos}%`,
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: '#fff',
    border: '2px solid rgba(0,0,0,0.3)',
    transform: 'translate(-50%, -50%)',
    boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
    pointerEvents: 'none' as const
  })

  const labelStyle: React.CSSProperties = {
    width: '14px',
    fontSize: '11px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    flexShrink: 0
  }

  const valueStyle: React.CSSProperties = {
    width: '36px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '4px',
    color: 'var(--text-primary, #e0e0e0)',
    fontSize: '11px',
    textAlign: 'center',
    padding: '2px 0',
    flexShrink: 0,
    outline: 'none'
  }

  return (
    <div
      ref={popupRef}
      style={popupStyle}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Hue */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={labelStyle}>H</span>
        <div
          data-color-channel="h"
          style={{
            ...trackStyle,
            background:
              'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
          }}
          onMouseDown={(e) => handleSliderMouseDown('h', e)}
        >
          <div style={thumbStyle((hue / 360) * 100)} />
        </div>
        <input
          style={valueStyle}
          value={hue}
          onChange={(e) => {
            const v = Math.max(0, Math.min(360, parseInt(e.target.value) || 0))
            setHue(v)
            handleColorUpdate(v, sat, bright)
          }}
        />
        <span style={{ ...labelStyle, width: '8px' }}>°</span>
      </div>

      {/* Saturation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={labelStyle}>S</span>
        <div
          data-color-channel="s"
          style={{
            ...trackStyle,
            background: `linear-gradient(to right, ${rgbToHex(...hsbToRgb(hue, 0, bright))}, ${hueColor})`
          }}
          onMouseDown={(e) => handleSliderMouseDown('s', e)}
        >
          <div style={thumbStyle(sat)} />
        </div>
        <input
          style={valueStyle}
          value={sat}
          onChange={(e) => {
            const v = Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
            setSat(v)
            handleColorUpdate(hue, v, bright)
          }}
        />
        <span style={{ ...labelStyle, width: '8px' }}>%</span>
      </div>

      {/* Brightness */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={labelStyle}>B</span>
        <div
          data-color-channel="b"
          style={{
            ...trackStyle,
            background: `linear-gradient(to right, #000000, ${rgbToHex(...hsbToRgb(hue, sat, 100))})`
          }}
          onMouseDown={(e) => handleSliderMouseDown('b', e)}
        >
          <div style={thumbStyle(bright)} />
        </div>
        <input
          style={valueStyle}
          value={bright}
          onChange={(e) => {
            const v = Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
            setBright(v)
            handleColorUpdate(hue, sat, v)
          }}
        />
        <span style={{ ...labelStyle, width: '8px' }}>%</span>
      </div>

      {/* Opacity – only shown when onOpacityChange is provided */}
      {onOpacityChange !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={labelStyle}>A</span>
          <div
            style={{
              ...trackStyle,
              background: `linear-gradient(to right, transparent, ${hex})`,
              backgroundImage: `linear-gradient(to right, rgba(0,0,0,0), ${hex})`,
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)'
            }}
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              const track = e.currentTarget
              const rect = track.getBoundingClientRect()
              const getOpacity = (clientX: number): number =>
                Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
              onOpacityChange(Math.round(getOpacity(e.clientX) * 100) / 100)
              const onMove = (mv: MouseEvent): void => {
                mv.preventDefault()
                onOpacityChange(Math.round(getOpacity(mv.clientX) * 100) / 100)
              }
              const onUp = (mu: MouseEvent): void => {
                onOpacityChange(Math.round(getOpacity(mu.clientX) * 100) / 100)
                document.removeEventListener('mousemove', onMove)
                document.removeEventListener('mouseup', onUp)
              }
              document.addEventListener('mousemove', onMove)
              document.addEventListener('mouseup', onUp)
            }}
          >
            <div style={thumbStyle((opacity ?? 1) * 100)} />
          </div>
          <input
            style={valueStyle}
            value={Math.round((opacity ?? 1) * 100)}
            onChange={(e) => {
              const v = Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
              onOpacityChange(v / 100)
            }}
          />
          <span style={{ ...labelStyle, width: '8px' }}>%</span>
        </div>
      )}

      {/* Hex + Preview */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '10px',
          padding: '6px 0',
          borderTop: '1px solid rgba(255,255,255,0.06)'
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: hex,
            border: '1px solid rgba(255,255,255,0.15)',
            flexShrink: 0
          }}
        />
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>HEX</span>
        <input
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '4px',
            color: 'var(--text-primary, #e0e0e0)',
            fontSize: '12px',
            padding: '4px 8px',
            outline: 'none',
            fontFamily: 'monospace'
          }}
          value={hexInput}
          onChange={(e) => handleHexChange(e.target.value)}
        />
      </div>
    </div>
  )
}
