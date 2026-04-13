import React, { useRef, useState, useLayoutEffect, useMemo } from 'react'
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowUp,
  ArrowDown,
  CopyPlus,
  Copy,
  Trash2,
  ClipboardPaste,
  LayoutGrid,
  Layers,
  Layers2
} from 'lucide-react'
import { AlignmentDirection } from '../types'

interface SelectionMenuProps {
  selectedIds: string[]
  position: { x: number; y: number }
  alignElements: (dir: AlignmentDirection) => void
  arrangeAsGrid: () => void
  groupElements: () => void
  ungroupElements: () => void
  bringToFront: () => void
  sendToBack: () => void
  bringForward: () => void
  sendBackward: () => void
  duplicateElements: () => void
  copyElements: () => void
  pasteElements: () => void
  deleteElements: () => void
  onClose: () => void
}

const SelectionMenu: React.FC<SelectionMenuProps> = ({
  selectedIds,
  position,
  alignElements,
  arrangeAsGrid,
  groupElements,
  ungroupElements,
  bringToFront,
  sendToBack,
  bringForward,
  sendBackward,
  duplicateElements,
  copyElements,
  pasteElements,
  deleteElements,
  onClose
}) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const [adjustedPos, setAdjustedPos] = useState({ x: -1000, y: -1000 })

  useLayoutEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const screenWidth = window.innerWidth
      const screenHeight = window.innerHeight

      let newX = position.x
      let newY = position.y

      if (newX + rect.width > screenWidth) {
        newX = screenWidth - rect.width - 12
      }
      if (newY + rect.height > screenHeight) {
        newY = screenHeight - rect.height - 12
      }

      const finalX = Math.max(12, newX)
      const finalY = Math.max(12, newY)

      if (finalX !== adjustedPos.x || finalY !== adjustedPos.y) {
        setAdjustedPos({ x: finalX, y: finalY })
      }
    }
  }, [position, adjustedPos.x, adjustedPos.y])

  const menuIconStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: '#999',
    padding: '5px',
    borderRadius: '10px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
  }

  const menuButtonStyle = (disabled: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '5px 10px',
    background: 'transparent',
    border: 'none',
    color: disabled ? '#444' : '#ccc',
    fontSize: '11px',
    textAlign: 'left' as const,
    cursor: disabled ? 'default' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    borderRadius: '10px',
    fontWeight: '500',
    transition: 'background 0.2s'
  })

  // Mouse event handlers for buttons
  const onBtnEnter = (e: React.MouseEvent<HTMLButtonElement>): void => {
    if (!e.currentTarget.disabled) {
      e.currentTarget.style.background = '#333'
      e.currentTarget.style.color = '#fff'
    }
  }
  const onBtnLeave = (e: React.MouseEvent<HTMLButtonElement>): void => {
    e.currentTarget.style.background = 'transparent'
    e.currentTarget.style.color = (e.currentTarget as any).disabled ? '#444' : '#999'
  }

  const alignOptions = useMemo(
    () => [
      { id: 'left', icon: AlignLeft, dir: 'left' as const },
      { id: 'center', icon: AlignCenter, dir: 'center' as const },
      { id: 'right', icon: AlignRight, dir: 'right' as const },
      { id: 'top', icon: AlignVerticalJustifyStart, dir: 'top' as const },
      { id: 'middle', icon: AlignVerticalJustifyCenter, dir: 'middle' as const },
      { id: 'bottom', icon: AlignVerticalJustifyEnd, dir: 'bottom' as const }
    ],
    []
  )

  const orderOptions = useMemo(
    () => [
      { id: 'front', icon: ArrowUpToLine, action: bringToFront, label: 'Bring to Front' },
      { id: 'back', icon: ArrowDownToLine, action: sendToBack, label: 'Send to Back' },
      { id: 'forward', icon: ArrowUp, action: bringForward, label: 'Bring Forward' },
      { id: 'backward', icon: ArrowDown, action: sendBackward, label: 'Send Backward' }
    ],
    [bringToFront, sendToBack, bringForward, sendBackward]
  )

  const editOptions = useMemo(
    () => [
      { id: 'duplicate', icon: CopyPlus, label: 'Duplicate', action: duplicateElements },
      { id: 'copy', icon: Copy, label: 'Copy', action: copyElements },
      { id: 'delete', icon: Trash2, label: 'Delete', action: deleteElements, danger: true }
    ],
    [duplicateElements, copyElements, deleteElements]
  )

  const actionOptions = useMemo(
    () => [
      { id: 'grid', icon: LayoutGrid, label: 'Arrange as Grid', action: arrangeAsGrid },
      {
        id: 'group',
        icon: Layers,
        label: 'Group',
        action: groupElements,
        disabled: selectedIds.length < 2
      },
      { id: 'ungroup', icon: Layers2, label: 'Ungroup', action: ungroupElements }
    ],
    [arrangeAsGrid, groupElements, ungroupElements, selectedIds.length]
  )

  return (
    <div
      ref={menuRef}
      data-context-menu="true"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: adjustedPos.y,
        left: adjustedPos.x,
        background: 'var(--card-bg)',
        borderRadius: '10px',
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        zIndex: 2000,
        width: '200px',
        pointerEvents: 'auto',
        visibility: adjustedPos.x === -1000 ? 'hidden' : 'visible'
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {selectedIds.length > 0 && (
        <>
          <div style={{ color: '#666', fontSize: '10px', fontWeight: '800', paddingLeft: '4px' }}>
            ALIGN
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
            {alignOptions.map((btn) => (
              <button
                key={btn.id}
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  alignElements(btn.dir)
                  onClose()
                }}
                style={menuIconStyle}
                onMouseEnter={onBtnEnter}
                onMouseLeave={onBtnLeave}
              >
                <btn.icon size={18} />
              </button>
            ))}
          </div>

          <div style={{ height: '1px', background: '#333', margin: '0 -4px' }} />

          <div style={{ color: '#666', fontSize: '10px', fontWeight: '800', paddingLeft: '4px' }}>
            ORDER
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
            {orderOptions.map((btn) => (
              <button
                key={btn.id}
                onClick={(e) => {
                  e.stopPropagation()
                  btn.action()
                  onClose()
                }}
                style={menuIconStyle}
                onMouseEnter={onBtnEnter}
                onMouseLeave={onBtnLeave}
                title={btn.label}
              >
                <btn.icon size={18} />
              </button>
            ))}
          </div>

          <div style={{ height: '1px', background: '#333', margin: '0 -4px' }} />

          <div style={{ color: '#666', fontSize: '10px', fontWeight: '800', paddingLeft: '4px' }}>
            EDIT
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {editOptions.map((btn) => (
              <button
                key={btn.id}
                onClick={(e) => {
                  e.stopPropagation()
                  btn.action()
                  onClose()
                }}
                style={menuButtonStyle(false)}
                onMouseEnter={onBtnEnter}
                onMouseLeave={onBtnLeave}
              >
                <btn.icon size={16} />
                <span style={{ color: btn.danger ? '#ff5252' : 'inherit' }}>{btn.label}</span>
              </button>
            ))}
            <button
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                pasteElements()
                onClose()
              }}
              style={menuButtonStyle(false)}
              onMouseEnter={onBtnEnter}
              onMouseLeave={onBtnLeave}
            >
              <ClipboardPaste size={16} />
              <span>Paste</span>
            </button>
          </div>

          <div style={{ height: '1px', background: '#333', margin: '0 -4px' }} />
        </>
      )}

      <div style={{ color: '#666', fontSize: '10px', fontWeight: '800', paddingLeft: '4px' }}>
        ARRANGE
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {actionOptions.map((btn) => (
          <button
            key={btn.id}
            onClick={(e) => {
              e.stopPropagation()
              btn.action()
              onClose()
            }}
            disabled={btn.disabled}
            style={menuButtonStyle(!!btn.disabled)}
            onMouseEnter={onBtnEnter}
            onMouseLeave={onBtnLeave}
          >
            <btn.icon size={16} />
            <span>{btn.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default SelectionMenu
