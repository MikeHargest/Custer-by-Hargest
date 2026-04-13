import React from 'react'
import { BoardElement } from '../types'

interface LayersPanelProps {
  elements: BoardElement[]
  selectedIds: string[]
  setSelectedIds: (ids: string[]) => void
  expandedGroups: string[]
  setExpandedGroups: React.Dispatch<React.SetStateAction<string[]>>
  showLayers: boolean
}

const LayersPanel: React.FC<LayersPanelProps> = ({
  elements,
  selectedIds,
  setSelectedIds,
  expandedGroups,
  setExpandedGroups,
  showLayers
}) => {
  if (!showLayers) return null

  return (
    <div
      data-context-menu="true"
      onWheel={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: '64px',
        right: '18px',
        width: '220px',
        maxHeight: 'calc(100% - 84px)',
        background: 'var(--card-bg)',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1100,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.1em',
            color: 'rgba(255,255,255,0.4)'
          }}
        >
          LAYERS
        </span>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>
          {elements.length}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }} className="custom-scrollbar">
        {elements.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: 'rgba(255, 255, 255, 0.2)',
              fontSize: '13px'
            }}
          >
            No elements on board
          </div>
        ) : (
          (() => {
            const result: React.ReactNode[] = []
            const processedGroups = new Set<string>()
            const reversed = [...elements].reverse()

            reversed.forEach((el) => {
              if (el.groupId) {
                if (!processedGroups.has(el.groupId)) {
                  processedGroups.add(el.groupId)
                  const isExpanded = expandedGroups.includes(el.groupId)
                  const groupMembers = elements.filter((m) => m.groupId === el.groupId)
                  const isGroupSelected = groupMembers.every((m) => selectedIds.includes(m.id))

                  result.push(
                    <div key={el.groupId} style={{ marginBottom: '4px' }}>
                      <div
                        onClick={(e) => {
                          e.stopPropagation()
                          const ids = groupMembers.map((m) => m.id)
                          setSelectedIds(ids)
                        }}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '10px',
                          background: isGroupSelected
                            ? 'rgba(255,255,255,0.08)'
                            : 'rgba(255,255,255,0.02)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          border: isGroupSelected
                            ? '1px solid rgba(255,255,255,0.1)'
                            : '1px solid transparent',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedGroups((prev) =>
                              isExpanded
                                ? prev.filter((id) => id !== el.groupId)
                                : [...prev, el.groupId!]
                            )
                          }}
                          style={{
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'rgba(255,255,255,0.3)',
                            transition: 'transform 0.2s ease',
                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                          }}
                        >
                          <div
                            style={{
                              borderLeft: '4px solid currentColor',
                              borderTop: '3px solid transparent',
                              borderBottom: '3px solid transparent'
                            }}
                          />
                        </div>
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '6px',
                            background: 'rgba(0,0,0,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px',
                            color: 'rgba(255,255,255,0.4)',
                            fontWeight: 'bold'
                          }}
                        >
                          G
                        </div>
                        <span
                          style={{
                            fontSize: '13px',
                            color: isGroupSelected ? '#fff' : 'rgba(255,255,255,0.6)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            flex: 1
                          }}
                        >
                          Group ({groupMembers.length})
                        </span>
                      </div>
                      {isExpanded && (
                        <div style={{ paddingLeft: '20px', marginTop: '4px' }}>
                          {groupMembers.reverse().map((m) => (
                            <div
                              key={m.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedIds([m.id])
                              }}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                marginBottom: '2px',
                                background: selectedIds.includes(m.id)
                                  ? 'rgba(255,255,255,0.06)'
                                  : 'transparent',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                              <div
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '4px',
                                  background: 'rgba(0,0,0,0.2)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '9px',
                                  color: 'rgba(255,255,255,0.3)'
                                }}
                              >
                                {m.type[0].toUpperCase()}
                              </div>
                              <span
                                style={{
                                  fontSize: '12px',
                                  color: selectedIds.includes(m.id)
                                    ? '#fff'
                                    : 'rgba(255,255,255,0.4)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {m.type}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                }
              } else {
                const isSelected = selectedIds.includes(el.id)
                result.push(
                  <div
                    key={el.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedIds([el.id])
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '10px',
                      background: isSelected ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                      marginBottom: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      border: isSelected
                        ? '1px solid rgba(255,255,255,0.1)'
                        : '1px solid transparent',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        background: 'rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        color: 'rgba(255,255,255,0.4)',
                        fontWeight: 'bold'
                      }}
                    >
                      {el.type[0].toUpperCase()}
                    </div>
                    <span
                      style={{
                        fontSize: '13px',
                        color: isSelected ? '#fff' : 'rgba(255,255,255,0.6)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1
                      }}
                    >
                      {el.title || el.type}
                    </span>
                  </div>
                )
              }
            })
            return result
          })()
        )}
      </div>
    </div>
  )
}

export default LayersPanel
