import React from 'react'
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
  Check
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
  selectedIdsCount
}) => {
  return (
    <div
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
      <ToolButton
        active={mode === 'hand'}
        onClick={() => {
          setMode('hand')
          setShowPenSettings(false)
          setShowEraserSettings(false)
          setShowColorPicker(false)
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
          setShowPenSettings(false)
          setShowEraserSettings(false)
          setShowColorPicker(false)
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
          setShowPenSettings(false)
          setShowEraserSettings(false)
          setShowColorPicker(false)
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
          setShowEraserSettings(false)
          setShowPenSettings(false)
          setShowColorPicker(false)
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
          setShowPenSettings(false)
          setShowEraserSettings(false)
          setShowColorPicker(false)
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
          setShowPenSettings(false)
          setShowEraserSettings(false)
          setShowColorPicker(false)
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
        onClick={onSave}
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
        active={showColorPicker}
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
          setShowColorPicker(!showColorPicker)
          setShowPenSettings(false)
          setShowEraserSettings(false)
          setPickerAnchor(rect)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
          setShowColorPicker(true)
          setShowPenSettings(false)
          setShowEraserSettings(false)
          setPickerAnchor(rect)
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
    </div>
  )
}

export default Toolbar
