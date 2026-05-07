import React, { useRef, useEffect } from 'react'
import {
  MousePointer2,
  Trash2,
  Palette,
  Save,
  Undo2,
  Redo2,
  Lock,
  Pen,
  Square,
  Eraser,
  Type,
  Check,
  Maximize
} from 'lucide-react'

export interface ToolButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  active?: boolean
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  onContextMenu?: (e: React.MouseEvent<HTMLButtonElement>) => void
  icon: React.ReactNode
  title?: string
  danger?: boolean
  disabled?: boolean
}

export const ToolButton = React.forwardRef<HTMLButtonElement, ToolButtonProps>(
  (
    { active, onClick, onDoubleClick, onContextMenu, icon, title, danger, disabled, style },
    ref
  ) => (
    <button
      ref={ref}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      disabled={disabled}
      style={{
        background: active ? 'var(--accent, #525252)' : 'transparent',
        border: 'none',
        color: disabled ? '#333' : danger ? '#ff6b6b' : '#fff',
        padding: '7px',
        borderRadius: '9px',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: disabled ? 0.3 : 1,
        transform: active ? 'scale(1.05)' : 'scale(1)',
        ...style
      }}
      className="tool-btn"
      title={title}
    >
      {icon}
    </button>
  )
)
ToolButton.displayName = 'ToolButton'

interface ToolbarProps {
  mode: string
  setMode: (mode: any) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onSave: () => void
  isSavedFlash: boolean
  showColorPicker: boolean
  setShowColorPicker: (show: boolean) => void
  setPickerAnchor: (rect: DOMRect | null) => void
  setShowPenSettings: (show: boolean) => void
  setShowEraserSettings: (show: boolean) => void
  setPenSettingsAnchor: (rect: DOMRect | null) => void
  setEraserSettingsAnchor: (rect: DOMRect | null) => void
  deleteSelected: () => void
  selectedIdsCount: number
  onFitToContent?: () => void
  hasElements?: boolean
  isSettingsPinned?: boolean
  penSize?: number
  setPenSize?: (s: number) => void
  rectStrokeWidth?: number
  setRectStrokeWidth?: (s: number) => void
  eraserSize?: number
  setEraserSize?: (s: number) => void
  textSize?: number
  setTextSize?: (s: number) => void
  selectionSize?: number
  setSelectionSize?: (s: number) => void
  isSizeDisabled?: boolean
  isStrokeDisabled?: boolean
  isFillDisabled?: boolean
  strokeColor?: string
  fillColor?: string
  onStrokeColorClick?: (rect: DOMRect) => void
  onFillColorClick?: (rect: DOMRect) => void
  onBgColorClick?: (rect: DOMRect) => void
  activePicker?: 'stroke' | 'fill' | 'bg' | null
}

const Toolbar: React.FC<ToolbarProps> = ({
  mode,
  setMode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  isSavedFlash,
  showColorPicker,
  setShowColorPicker,
  setPickerAnchor,
  setShowPenSettings,
  setShowEraserSettings,
  setPenSettingsAnchor,
  setEraserSettingsAnchor,
  deleteSelected,
  selectedIdsCount,
  onFitToContent,
  hasElements,
  isSettingsPinned,
  penSize,
  setPenSize,
  rectStrokeWidth,
  setRectStrokeWidth,
  eraserSize,
  setEraserSize,
  textSize,
  setTextSize,
  selectionSize,
  setSelectionSize,
  isSizeDisabled,
  isStrokeDisabled,
  isFillDisabled,
  strokeColor,
  fillColor,
  onStrokeColorClick,
  onFillColorClick,
  onBgColorClick,
  activePicker
}) => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handleWheel = (e: WheelEvent) => e.stopPropagation()
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])
  
  let currentSize = selectionSize ?? 0
  let min = 0
  let max = 300
  let setSizeFn = setSelectionSize
  let sizeDisabled = isSizeDisabled

  if (mode === 'pen') {
    currentSize = penSize ?? 4
    setSizeFn = setPenSize
    sizeDisabled = false
  } else if (mode === 'rect') {
    currentSize = rectStrokeWidth ?? 2
    setSizeFn = setRectStrokeWidth
    sizeDisabled = false
  } else if (mode === 'eraser') {
    currentSize = eraserSize || 24
    min = 4
    setSizeFn = setEraserSize
    sizeDisabled = false
  } else if (mode === 'text') {
    currentSize = textSize || 32
    min = 8
    setSizeFn = setTextSize
    sizeDisabled = false
  }

  if (sizeDisabled) {
    currentSize = 0
  }

  return (
    <div
      ref={containerRef}
      data-context-menu="true"
      style={{
        position: 'absolute',
        top: '50%',
        left: '14px',
        transform: 'translateY(-50%)',
        zIndex: 100,
        background: 'var(--card-bg)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '13px',
        padding: '5px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <div 
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          marginBottom: '4px', 
          padding: '4px 0',
        }}
      >
        {/* Size Slider Block */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          opacity: sizeDisabled ? 0.3 : 1,
          pointerEvents: sizeDisabled ? 'none' : 'auto',
          transition: 'opacity 0.2s ease'
        }}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px', fontWeight: 'bold' }}>
             {Math.round(currentSize)}
          </div>
          <input 
            type="range"
            min={min}
            max={max}
            value={sizeDisabled ? 0 : currentSize}
            disabled={sizeDisabled}
            onChange={(e) => setSizeFn && setSizeFn(Number(e.target.value))}
            style={{
              appearance: 'auto',
              // @ts-ignore
              WebkitAppearance: 'slider-vertical',
              height: '80px',
              width: '8px',
              cursor: sizeDisabled ? 'default' : 'ns-resize',
              margin: '0',
              accentColor: sizeDisabled ? 'transparent' : '#d1d1d1'
            }}
          />
        </div>

        <div style={{ height: '1px', width: '20px', background: 'rgba(255,255,255,0.15)', marginTop: '12px', marginBottom: '12px' }} />
        
        {/* Color Indicators */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={(e) => onStrokeColorClick?.(e.currentTarget.getBoundingClientRect())}
            title="Stroke Color"
            disabled={isStrokeDisabled}
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '4px',
              background: 'transparent',
              border: `3px solid ${strokeColor || '#ffffff'}`,
              cursor: isStrokeDisabled ? 'default' : 'pointer',
              padding: 0,
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              transition: 'all 0.1s',
              boxSizing: 'border-box',
              opacity: isStrokeDisabled ? 0.3 : 1,
              pointerEvents: isStrokeDisabled ? 'none' : 'auto'
            }}
            onMouseDown={(e) => !isStrokeDisabled && (e.currentTarget.style.transform = 'scale(0.9)')}
            onMouseUp={(e) => !isStrokeDisabled && (e.currentTarget.style.transform = 'scale(1)')}
          />
          <button
            onClick={(e) => onFillColorClick?.(e.currentTarget.getBoundingClientRect())}
            title="Fill Color"
            disabled={isFillDisabled}
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '4px',
              background: fillColor === 'transparent' ? 'none' : fillColor,
              border: '2px solid rgba(255,255,255,0.2)',
              cursor: isFillDisabled ? 'default' : 'pointer',
              padding: 0,
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              transition: 'all 0.1s',
              position: 'relative',
              overflow: 'hidden',
              opacity: isFillDisabled ? 0.3 : 1,
              pointerEvents: isFillDisabled ? 'none' : 'auto'
            }}
            onMouseDown={(e) => !isFillDisabled && (e.currentTarget.style.transform = 'scale(0.9)')}
            onMouseUp={(e) => !isFillDisabled && (e.currentTarget.style.transform = 'scale(1)')}
          >
            {fillColor === 'transparent' && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(45deg, transparent 45%, #ff4d4f 45%, #ff4d4f 55%, transparent 55%)'
              }} />
            )}
          </button>
        </div>

        <div style={{ height: '1px', width: '20px', background: 'rgba(255,255,255,0.15)', marginTop: '12px' }} />
      </div>

      <ToolButton
        active={mode === 'hand'}
        onClick={() => {
          setMode('hand')
          if (!isSettingsPinned) {
            setShowPenSettings(false)
            setShowEraserSettings(false)
            setShowColorPicker(false)
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setMode('hand')
          setShowPenSettings(false)
          setShowEraserSettings(false)
          setShowColorPicker(false)
        }}
        icon={<Lock size={18} />}
        title="View Only (H)"
      />
      <ToolButton
        active={mode === 'select'}
        onClick={() => {
          setMode('select')
          if (!isSettingsPinned) {
            setShowPenSettings(false)
            setShowEraserSettings(false)
            setShowColorPicker(false)
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setMode('select')
          setShowPenSettings(false)
          setShowEraserSettings(false)
          setShowColorPicker(false)
        }}
        icon={<MousePointer2 size={18} />}
        title="Select (V)"
      />
      <ToolButton
        active={mode === 'pen'}
        onClick={() => {
          setMode('pen')
          if (!isSettingsPinned) {
            setShowPenSettings(false)
            setShowEraserSettings(false)
            setShowColorPicker(false)
          }
        }}
        onDoubleClick={(e): void => {
          setMode('pen')
          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
          setShowPenSettings(true)
          setShowEraserSettings(false)
          setShowColorPicker(false)
          setPenSettingsAnchor(rect)
        }}
        onContextMenu={(e: React.MouseEvent<HTMLButtonElement>): void => {
          e.preventDefault()
          e.stopPropagation()
          setMode('pen')
          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
          setShowPenSettings(true)
          setShowEraserSettings(false)
          setShowColorPicker(false)
          setPenSettingsAnchor(rect)
        }}
        icon={<Pen size={18} />}
        title="Ручка (P)"
      />
      <ToolButton
        active={mode === 'eraser'}
        onClick={(): void => {
          setMode('eraser')
          if (!isSettingsPinned) {
            setShowEraserSettings(false)
            setShowPenSettings(false)
            setShowColorPicker(false)
          }
        }}
        onDoubleClick={(e: React.MouseEvent<HTMLButtonElement>): void => {
          setMode('eraser')
          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
          setShowEraserSettings(true)
          setShowPenSettings(false)
          setShowColorPicker(false)
          setEraserSettingsAnchor(rect)
        }}
        onContextMenu={(e: React.MouseEvent<HTMLButtonElement>): void => {
          e.preventDefault()
          e.stopPropagation()
          setMode('eraser')
          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
          setShowEraserSettings(true)
          setShowPenSettings(false)
          setShowColorPicker(false)
          setEraserSettingsAnchor(rect)
        }}
        icon={<Eraser size={18} />}
        title="Ластик (E)"
      />
      <ToolButton
        active={mode === 'rect'}
        onClick={() => {
          setMode('rect')
          if (!isSettingsPinned) {
            setShowPenSettings(false)
            setShowEraserSettings(false)
            setShowColorPicker(false)
          }
        }}
        onDoubleClick={(e) => {
          setMode('rect')
          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
          setShowPenSettings(true)
          setShowEraserSettings(false)
          setShowColorPicker(false)
          setPenSettingsAnchor(rect)
        }}
        onContextMenu={(e: React.MouseEvent<HTMLButtonElement>): void => {
          e.preventDefault()
          e.stopPropagation()
          setMode('rect')
          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
          setShowPenSettings(true)
          setShowEraserSettings(false)
          setShowColorPicker(false)
          setPenSettingsAnchor(rect)
        }}
        icon={<Square size={18} />}
        title="Rectangle Tool (R)"
      />
      <ToolButton
        active={mode === 'text'}
        onClick={() => {
          setMode('text')
          if (!isSettingsPinned) {
            setShowPenSettings(false)
            setShowEraserSettings(false)
            setShowColorPicker(false)
          }
        }}
        onDoubleClick={(e) => {
          setMode('text')
          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
          setShowPenSettings(true)
          setShowEraserSettings(false)
          setShowColorPicker(false)
          setPenSettingsAnchor(rect)
        }}
        onContextMenu={(e: React.MouseEvent<HTMLButtonElement>): void => {
          e.preventDefault()
          e.stopPropagation()
          setMode('text')
          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
          setShowPenSettings(true)
          setShowEraserSettings(false)
          setShowColorPicker(false)
          setPenSettingsAnchor(rect)
        }}
        icon={<Type size={18} />}
        title="Text Tool (T)"
      />

      <div style={{ height: '1px', background: 'rgba(255,255,255,0.15)', margin: '0 6px' }} />

      <ToolButton
        active={false}
        onClick={onUndo}
        disabled={!canUndo}
        icon={<Undo2 size={18} />}
        title="Undo (Ctrl+Z)"
      />
      <ToolButton
        active={false}
        onClick={onRedo}
        disabled={!canRedo}
        icon={<Redo2 size={18} />}
        title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
      />

      <div style={{ height: '1px', background: 'rgba(255,255,255,0.15)', margin: '0 6px' }} />

      <ToolButton
        active={false}
        onClick={(e) => {
          // Blur any active element to ensure final data is captured
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
          }
          // Small delay to let blur/state settle
          setTimeout(() => onSave(), 10)
        }}
        icon={
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '18px',
              height: '18px'
            }}
          >
            <Save
              size={18}
              style={{
                opacity: isSavedFlash ? 0 : 1,
                transition: 'opacity 0.2s ease',
                position: 'absolute'
              }}
            />
            <div
              style={{
                opacity: isSavedFlash ? 1 : 0,
                transition: 'opacity 0.2s ease',
                position: 'absolute',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4ade80'
              }}
            >
              <Check size={18} strokeWidth={3} />
            </div>
          </div>
        }
        title="Save Board (Ctrl+S)"
        style={{ color: isSavedFlash ? '#4ade80' : undefined }}
      />

      <div style={{ height: '1px', background: 'rgba(255,255,255,0.15)', margin: '0 6px' }} />

      <ToolButton
        active={activePicker === 'bg'}
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
          onBgColorClick?.(rect)
        }}
        icon={<Palette size={18} />}
        title="Background Color"
      />

      <ToolButton
        active={false}
        onClick={deleteSelected}
        icon={<Trash2 size={18} />}
        title="Delete (Del)"
        danger
        disabled={selectedIdsCount === 0}
      />

      <div style={{ height: '1px', background: 'rgba(255,255,255,0.15)', margin: '0 6px' }} />

      <ToolButton
        active={false}
        onClick={() => onFitToContent?.()}
        icon={<Maximize size={18} />}
        title="Fit to Content (F)"
        disabled={!hasElements}
      />
    </div>
  )
}

export default Toolbar
