import { useState, useEffect, useRef, useCallback } from 'react'

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
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
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
}

export default function ColorPicker({
  color,
  onChange,
  onClose,
  anchorRect
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
      if (!popupRef.current) return
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
  }, [onClose])

  // Build the current color hex from HSB
  const currentHex = useCallback(() => {
    const [r, g, b] = hsbToRgb(hue, sat, bright)
    return rgbToHex(r, g, b)
  }, [hue, sat, bright])

  // Sync hex display and emit onChange whenever HSB changes
  useEffect(() => {
    const [r, g, b] = hsbToRgb(hue, sat, bright)
    const hex = rgbToHex(r, g, b)
    setHexInput(hex)
    onChange(hex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hue, sat, bright])

  // ===== Slider drag logic =====
  const applyRatio = useCallback((channel: 'h' | 's' | 'b', ratio: number) => {
    const clamped = Math.max(0, Math.min(1, ratio))
    if (channel === 'h') setHue(Math.round(clamped * 360))
    else if (channel === 's') setSat(Math.round(clamped * 100))
    else setBright(Math.round(clamped * 100))
  }, [])

  const handleSliderMouseDown = useCallback(
    (channel: 'h' | 's' | 'b', e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      const track = e.currentTarget
      const rect = track.getBoundingClientRect()

      // Immediately jump thumb to click position
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
      applyRatio(channel, x / rect.width)

      const onMove = (ev: MouseEvent): void => {
        ev.preventDefault()
        const r = track.getBoundingClientRect()
        const mx = Math.max(0, Math.min(ev.clientX - r.left, r.width))
        applyRatio(channel, mx / r.width)
      }
      const onUp = (): void => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [applyRatio]
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
    }
  }

  // Position
  const popupStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 99999,
    background: 'var(--card-bg)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    width: '260px',
    userSelect: 'none'
  }

  if (anchorRect) {
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
    <div ref={popupRef} style={popupStyle} onMouseDown={(e) => e.stopPropagation()}>
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
          }}
        />
        <span style={{ ...labelStyle, width: '8px' }}>%</span>
      </div>

      {/* Brightness */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
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
          }}
        />
        <span style={{ ...labelStyle, width: '8px' }}>%</span>
      </div>

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
