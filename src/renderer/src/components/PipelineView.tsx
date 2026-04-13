import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  Plus,
  Trash2,
  PlusCircle,
  GripVertical,
  MoreVertical,
  RefreshCw,
  Square,
  Check
} from 'lucide-react'
import { Project, PipelineStage, PipelineItem, PipelineData } from '../types'
import ColorPicker from './ColorPicker'

// --- Shared style helpers ---
const editBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  borderRadius: '6px',
  padding: '6px 12px',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '12px',
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
}

const TinyButton = ({
  onClick,
  children,
  style,
  title,
  disabled
}: {
  onClick?: (e: React.MouseEvent) => void
  children: React.ReactNode
  style?: React.CSSProperties
  title?: string
  disabled?: boolean
}): React.ReactElement => {
  const [isHovered, setIsHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: isHovered ? 'rgba(255,255,255,0.06)' : 'transparent',
        border: 'none',
        padding: '4px',
        borderRadius: '4px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: isHovered ? 'var(--text-primary)' : 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: disabled ? 0.3 : 1,
        ...style
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
    </button>
  )
}

// --- Main PipelineView ---
interface PipelineViewProps {
  project: Project
  onUpdate: (id: string, updates: Partial<Project>) => void
}

export default function PipelineView({ project, onUpdate }: PipelineViewProps): React.ReactElement {
  // --- Migration and Initialization ---
  useEffect(() => {
    if (project.pipeline && (!project.pipelines || project.pipelines.length === 0)) {
      const defaultPipeline: PipelineData = {
        id: 'default',
        name: 'Default Pipeline',
        stages: project.pipeline
      }
      onUpdate(project.id, {
        pipelines: [defaultPipeline],
        activePipelineId: 'default',
        pipeline: undefined
      })
    } else if (project.pipelines && project.pipelines.length > 0 && !project.activePipelineId) {
      onUpdate(project.id, { activePipelineId: project.pipelines[0].id })
    }
  }, [project.id, project.pipeline, project.pipelines, project.activePipelineId, onUpdate])

  const pipelines = useMemo(() => project.pipelines || [], [project.pipelines])
  const activePipelineId = project.activePipelineId || (pipelines.length > 0 ? pipelines[0].id : '')
  const activePipeline = useMemo(
    () => pipelines.find((p) => p.id === activePipelineId) || pipelines[0],
    [pipelines, activePipelineId]
  )

  const [editingPipelineId, setEditingPipelineId] = useState<string | null>(null)
  const [pipelineNameValue, setPipelineNameValue] = useState('')
  const [activeStageDropdown, setActiveStageDropdown] = useState<string | null>(null)
  const [hoveredPipelineId, setHoveredPipelineId] = useState<string | null>(null)
  const [stageColorPickerAnchor, setStageColorPickerAnchor] = useState<{
    stageId: string
    rect: DOMRect
  } | null>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      const target = e.target as HTMLElement
      if (!target.closest('.project-dropdown') && !target.closest('.task-edit-btn')) {
        setActiveStageDropdown(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // --- DRAG AND DROP STATE ---
  const [draggingItem, setDraggingItem] = useState<{ itemId: string; stageId: string } | null>(null)
  const [dropIndicator, setDropIndicator] = useState<{
    id: string
    position: 'before' | 'after' | 'inside'
    stageId: string
  } | null>(null)
  const dragDataRef = useRef<{ itemId: string; stageId: string } | null>(null)
  const dropTargetRef = useRef<{
    action: 'before' | 'after' | 'inside'
    stageId: string
    itemId?: string
  } | null>(null)

  const [, setDraggingStageId] = useState<string | null>(null)
  const [stageDropIndicator, setStageDropIndicator] = useState<{
    id: string
    position: 'before' | 'after'
  } | null>(null)
  const stageDragDataRef = useRef<{ stageId: string } | null>(null)
  const stageDropTargetRef = useRef<{
    stageId: string
    position: 'before' | 'after'
  } | null>(null)

  // --- PIPELINE CRUD ---
  const handleAddPipeline = (): void => {
    const newPipeline: PipelineData = {
      id: Math.random().toString(36).substr(2, 9),
      name: `Page ${pipelines.length + 1}`,
      stages: []
    }
    onUpdate(project.id, {
      pipelines: [...pipelines, newPipeline],
      activePipelineId: newPipeline.id
    })
  }

  const handleDeletePipeline = (e: React.MouseEvent, id: string): void => {
    e.stopPropagation()
    const newPipelines = pipelines.filter((p) => p.id !== id)
    const newActiveId =
      id === activePipelineId
        ? newPipelines.length > 0
          ? newPipelines[0].id
          : ''
        : activePipelineId
    onUpdate(project.id, { pipelines: newPipelines, activePipelineId: newActiveId })
  }

  const startEditingPipeline = (e: React.MouseEvent, p: PipelineData): void => {
    e.stopPropagation()
    setEditingPipelineId(p.id)
    setPipelineNameValue(p.name)
  }

  const savePipelineName = (): void => {
    if (!editingPipelineId) return
    const newPipelines = pipelines.map((p) =>
      p.id === editingPipelineId ? { ...p, name: pipelineNameValue || 'Untitled' } : p
    )
    onUpdate(project.id, { pipelines: newPipelines })
    setEditingPipelineId(null)
  }

  // --- STAGE CRUD ---
  const handleAddStage = (): void => {
    if (!activePipeline) return
    const newStage: PipelineStage = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'New Stage',
      items: []
    }
    const newPipelines = pipelines.map((p) =>
      p.id === activePipelineId ? { ...p, stages: [...p.stages, newStage] } : p
    )
    onUpdate(project.id, { pipelines: newPipelines })
  }

  const handleUpdateStage = (stageId: string, name: string): void => {
    if (!activePipeline) return
    const newPipelines = pipelines.map((p) =>
      p.id === activePipelineId
        ? { ...p, stages: p.stages.map((s) => (s.id === stageId ? { ...s, name } : s)) }
        : p
    )
    onUpdate(project.id, { pipelines: newPipelines })
  }

  const handleDeleteStage = (stageId: string): void => {
    if (!activePipeline) return
    const newPipelines = pipelines.map((p) =>
      p.id === activePipelineId ? { ...p, stages: p.stages.filter((s) => s.id !== stageId) } : p
    )
    onUpdate(project.id, { pipelines: newPipelines })
  }

  // --- ITEM CRUD ---
  const handleAddItem = (stageId: string): void => {
    if (!activePipeline) return
    const newItem: PipelineItem = {
      id: Math.random().toString(36).substr(2, 9),
      text: 'New Item',
      completed: false
    }
    const newPipelines = pipelines.map((p) =>
      p.id === activePipelineId
        ? {
            ...p,
            stages: p.stages.map((s) =>
              s.id === stageId ? { ...s, items: [...s.items, newItem] } : s
            )
          }
        : p
    )
    onUpdate(project.id, { pipelines: newPipelines })
  }

  const handleUpdateItem = (
    stageId: string,
    itemId: string,
    updates: Partial<PipelineItem>
  ): void => {
    if (!activePipeline) return
    const newPipelines = pipelines.map((p) =>
      p.id === activePipelineId
        ? {
            ...p,
            stages: p.stages.map((s) =>
              s.id === stageId
                ? { ...s, items: s.items.map((i) => (i.id === itemId ? { ...i, ...updates } : i)) }
                : s
            )
          }
        : p
    )
    onUpdate(project.id, { pipelines: newPipelines })
  }

  const handleDeleteItem = (stageId: string, itemId: string): void => {
    if (!activePipeline) return
    const newPipelines = pipelines.map((p) =>
      p.id === activePipelineId
        ? {
            ...p,
            stages: p.stages.map((s) =>
              s.id === stageId ? { ...s, items: s.items.filter((i) => i.id !== itemId) } : s
            )
          }
        : p
    )
    onUpdate(project.id, { pipelines: newPipelines })
  }

  // --- DRAG AND DROP ---
  const performItemDrop = useCallback(
    (
      sourceItemId: string,
      sourceStageId: string,
      targetStageId: string,
      action: string,
      targetItemId?: string
    ) => {
      if (!activePipeline) return

      let itemToMove: PipelineItem | null = null
      const updatedStages = activePipeline.stages.map((s) => {
        if (s.id === sourceStageId) {
          const itemIdx = s.items.findIndex((i) => i.id === sourceItemId)
          if (itemIdx !== -1) {
            itemToMove = s.items[itemIdx]
            return { ...s, items: s.items.filter((i) => i.id !== sourceItemId) }
          }
        }
        return s
      })

      if (!itemToMove) return

      const finalStages = updatedStages.map((s) => {
        if (s.id === targetStageId) {
          const newItems = [...s.items]
          if (action === 'inside' || !targetItemId) {
            newItems.push(itemToMove!)
          } else {
            const targetIdx = newItems.findIndex((i) => i.id === targetItemId)
            if (targetIdx !== -1) {
              const insertIdx = action === 'before' ? targetIdx : targetIdx + 1
              newItems.splice(insertIdx, 0, itemToMove!)
            } else {
              newItems.push(itemToMove!)
            }
          }
          return { ...s, items: newItems }
        }
        return s
      })

      const newPipelines = pipelines.map((p) =>
        p.id === activePipelineId ? { ...p, stages: finalStages } : p
      )
      onUpdate(project.id, { pipelines: newPipelines })
    },
    [activePipeline, activePipelineId, pipelines, onUpdate, project.id]
  )

  const performStageDrop = useCallback(
    (sourceId: string, targetId: string, position: 'before' | 'after') => {
      if (!activePipeline) return

      const newStages = [...activePipeline.stages]
      const sourceIdx = newStages.findIndex((s) => s.id === sourceId)
      if (sourceIdx === -1) return
      const [movedStage] = newStages.splice(sourceIdx, 1)

      const targetIdx = newStages.findIndex((s) => s.id === targetId)
      if (targetIdx !== -1) {
        const insertIdx = position === 'before' ? targetIdx : targetIdx + 1
        newStages.splice(insertIdx, 0, movedStage)
      } else {
        newStages.push(movedStage)
      }

      const newPipelines = pipelines.map((p) =>
        p.id === activePipelineId ? { ...p, stages: newStages } : p
      )
      onUpdate(project.id, { pipelines: newPipelines })
    },
    [activePipeline, activePipelineId, pipelines, onUpdate, project.id]
  )

  const startDraggingStage = (e: React.MouseEvent, stageId: string): void => {
    if (e.button !== 0) return

    const target = e.target as HTMLElement
    const interactiveTags = ['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT']
    if (interactiveTags.includes(target.tagName) || target.closest('button')) return

    e.preventDefault()
    e.stopPropagation()

    stageDragDataRef.current = { stageId }
    setDraggingStageId(stageId)

    const handleMouseMove = (ev: MouseEvent): void => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY)
      if (!el) {
        setStageDropIndicator(null)
        stageDropTargetRef.current = null
        return
      }

      const stageContainer = el.closest('[data-pipeline-stage-id]') as HTMLElement | null
      if (stageContainer) {
        const targetId = stageContainer.dataset.pipelineStageId || ''
        if (targetId === stageId) {
          setStageDropIndicator(null)
          stageDropTargetRef.current = null
          return
        }

        const rect = stageContainer.getBoundingClientRect()
        const ratio = (ev.clientX - rect.left) / rect.width
        const pos = ratio < 0.5 ? 'before' : 'after'

        stageDropTargetRef.current = { stageId: targetId, position: pos }
        setStageDropIndicator({ id: targetId, position: pos })
        return
      }

      setStageDropIndicator(null)
      stageDropTargetRef.current = null
    }

    const handleMouseUp = (): void => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(document.body.style as any).cursor = ''
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(document.body.style as any).userSelect = ''

      const source = stageDragDataRef.current
      const target = stageDropTargetRef.current

      if (source && target) {
        performStageDrop(source.stageId, target.stageId, target.position)
      }

      setDraggingStageId(null)
      setStageDropIndicator(null)
      stageDragDataRef.current = null
      stageDropTargetRef.current = null
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    /* eslint-disable @typescript-eslint/no-explicit-any */
    ;(document.body.style as any).cursor = 'grabbing'
    ;(document.body.style as any).userSelect = 'none'
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }

  const startDraggingItem = (e: React.MouseEvent, itemId: string, stageId: string): void => {
    if (e.button !== 0) return

    const target = e.target as HTMLElement
    if (!target.closest('.drag-handle')) return

    e.preventDefault()
    e.stopPropagation()

    const dragData = { itemId, stageId }
    dragDataRef.current = dragData
    setDraggingItem(dragData)

    const handleMouseMove = (ev: MouseEvent): void => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY)
      if (!el) {
        dropTargetRef.current = null
        setDropIndicator(null)
        return
      }

      const itemCard = el.closest('[data-pipeline-item-id]') as HTMLElement | null
      if (itemCard) {
        const targetItemId = itemCard.dataset.pipelineItemId || ''
        const targetStageId = itemCard.dataset.stageId || ''

        if (targetItemId === dragData.itemId) {
          dropTargetRef.current = null
          setDropIndicator(null)
          return
        }

        const rect = itemCard.getBoundingClientRect()
        const ratio = (ev.clientY - rect.top) / rect.height
        const pos = ratio < 0.5 ? 'before' : 'after'

        dropTargetRef.current = { action: pos, stageId: targetStageId, itemId: targetItemId }
        setDropIndicator({ id: targetItemId, position: pos, stageId: targetStageId })
        return
      }

      const stageContainer = el.closest('[data-pipeline-stage-id]') as HTMLElement | null
      if (stageContainer) {
        const targetStageId = stageContainer.dataset.pipelineStageId || ''
        dropTargetRef.current = { action: 'inside', stageId: targetStageId }
        setDropIndicator(null)
        return
      }

      dropTargetRef.current = null
      setDropIndicator(null)
    }

    const handleMouseUp = (): void => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(document.body.style as any).cursor = ''
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(document.body.style as any).userSelect = ''

      const source = dragDataRef.current
      const target = dropTargetRef.current

      if (source && target) {
        performItemDrop(source.itemId, source.stageId, target.stageId, target.action, target.itemId)
      }

      setDraggingItem(null)
      setDropIndicator(null)
      dragDataRef.current = null
      dropTargetRef.current = null
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    /* eslint-disable @typescript-eslint/no-explicit-any */
    ;(document.body.style as any).cursor = 'grabbing'
    ;(document.body.style as any).userSelect = 'none'
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }

  return (
    <div
      style={{
        flex: 1,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        boxSizing: 'border-box'
      }}
    >
      {/* Card container matching other views */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--card-bg)',
          borderRadius: 0,
          minHeight: 0
        }}
      >
        {/* Header bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            padding: '0 16px',
            height: '45px',
            boxSizing: 'border-box',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            flexShrink: 0
          }}
        >
          {/* Pipeline tabs */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              overflowX: 'auto',
              scrollbarWidth: 'none'
            }}
          >
            {pipelines.map((p) => (
              <div
                key={p.id}
                onClick={() => onUpdate(project.id, { activePipelineId: p.id })}
                onMouseEnter={() => setHoveredPipelineId(p.id)}
                onMouseLeave={() => setHoveredPipelineId(null)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: p.id === activePipelineId ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: 'none',
                  color:
                    p.id === activePipelineId ? 'var(--text-primary)' : 'var(--text-secondary)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                {editingPipelineId === p.id ? (
                  <input
                    autoFocus
                    value={pipelineNameValue}
                    onChange={(e) => setPipelineNameValue(e.target.value)}
                    onBlur={savePipelineName}
                    onKeyDown={(e) => e.key === 'Enter' && savePipelineName()}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'inherit',
                      fontSize: 'inherit',
                      fontWeight: 'inherit',
                      padding: 0,
                      width: '100px',
                      outline: 'none'
                    }}
                  />
                ) : (
                  <>
                    <span onDoubleClick={(e) => startEditingPipeline(e, p)}>{p.name}</span>
                    <div
                      style={{
                        display: 'flex',
                        gap: '4px',
                        opacity: (p.id === activePipelineId && hoveredPipelineId === p.id) ? 1 : 0,
                        pointerEvents: (p.id === activePipelineId && hoveredPipelineId === p.id) ? 'auto' : 'none',
                        transition: 'opacity 0.2s'
                      }}
                    >
                      <button
                        onClick={(e) => handleDeletePipeline(e, p.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-secondary)'
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = 'var(--danger)')
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = 'var(--text-secondary)')
                        }
                        title="Delete"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            <button
              onClick={handleAddPipeline}
              style={{ ...editBtnStyle, padding: '4px 6px' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                e.currentTarget.style.color = 'var(--text-primary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--text-secondary)'
              }}
              title="Add Page"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Add stage button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              onClick={handleAddStage}
              disabled={!activePipeline}
              style={{
                ...editBtnStyle,
                padding: '4px 10px',
                opacity: !activePipeline ? 0.3 : 1,
                pointerEvents: !activePipeline ? 'none' : 'auto'
              }}
              onMouseEnter={(e) => {
                if (!activePipeline) return
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                e.currentTarget.style.color = 'var(--text-primary)'
              }}
              onMouseLeave={(e) => {
                if (!activePipeline) return
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--text-secondary)'
              }}
            >
              <PlusCircle size={14} style={{ marginRight: '4px' }} /> Add Stage
            </button>
          </div>
        </div>

        {/* Stages area */}
        <div
          className="pipeline-stages custom-scrollbar"
          style={{
            display: 'flex',
            gap: '16px',
            overflowX: 'auto',
            overflowY: 'auto',
            flex: 1,
            padding: '24px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.1) transparent',
            position: 'relative',
            alignItems: 'flex-start'
          }}
        >
          {!activePipeline || activePipeline.stages.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px',
                color: 'rgba(255, 255, 255, 0.25)'
              }}
            >
              <p style={{ margin: 0, fontSize: '13px' }}>
                {!activePipeline
                  ? 'Create a pipeline to get started.'
                  : 'No stages in this pipeline. Click "Add Stage" above.'}
              </p>
            </div>
          ) : (
            activePipeline.stages.map((stage) => (
              <React.Fragment key={stage.id}>
                <div
                  data-pipeline-stage-id={stage.id}
                  style={{
                    minWidth: '300px',
                    width: '300px',
                    background: stage.color
                      ? `${stage.color}${Math.round((stage.colorOpacity ?? 0.1) * 255)
                          .toString(16)
                          .padStart(2, '0')}`
                      : 'rgba(255,255,255,0.03)',
                    borderRadius: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    border: `1px solid ${
                      stage.color
                        ? `${stage.color}${Math.round((stage.colorOpacity ?? 0.1) * 2 * 255)
                            .toString(16)
                            .padStart(2, '0')}`
                        : 'rgba(255,255,255,0.05)'
                    }`,
                    transition: 'opacity 0.2s',
                    position: 'relative',
                    height: 'fit-content',
                    maxHeight: 'none'
                  }}
                >
                  {/* Stage drop indicators */}
                  {stageDropIndicator?.id === stage.id &&
                    stageDropIndicator?.position === 'before' && (
                      <div
                        style={{
                          position: 'absolute',
                          left: '-9px',
                          top: '0',
                          bottom: '0',
                          width: '3px',
                          background: 'rgba(255, 255, 255, 0.4)',
                          borderRadius: '1.5px',
                          zIndex: 10,
                          pointerEvents: 'none'
                        }}
                      />
                    )}
                  {stageDropIndicator?.id === stage.id &&
                    stageDropIndicator?.position === 'after' && (
                      <div
                        style={{
                          position: 'absolute',
                          right: '-9px',
                          top: '0',
                          bottom: '0',
                          width: '3px',
                          background: 'rgba(255, 255, 255, 0.4)',
                          borderRadius: '1.5px',
                          zIndex: 10,
                          pointerEvents: 'none'
                        }}
                      />
                    )}

                  {/* Stage header */}
                  <div
                    data-stage-header-id={stage.id}
                    onMouseDown={(e) => startDraggingStage(e, stage.id)}
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      cursor: 'grab'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                      <input
                        value={stage.name}
                        onChange={(e) => handleUpdateStage(stage.id, e.target.value)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-primary)',
                          fontWeight: 600,
                          fontSize: '13px',
                          width: '100%',
                          outline: 'none'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '4px', position: 'relative' }}>
                      <button
                        className={`task-edit-btn ${activeStageDropdown === stage.id ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveStageDropdown(
                            activeStageDropdown === stage.id ? null : stage.id
                          )
                        }}
                        style={{ padding: '2px', color: 'var(--text-secondary)', opacity: 1 }}
                      >
                        <MoreVertical size={14} />
                      </button>
                      {activeStageDropdown === stage.id && (
                        <div
                          className="project-dropdown"
                          style={{ right: 0, left: 'auto', zIndex: 9999 }}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <button
                            className="project-dropdown-item"
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect()
                              setActiveStageDropdown(null)
                              setStageColorPickerAnchor({ stageId: stage.id, rect })
                            }}
                          >
                            <div
                              style={{
                                width: '14px',
                                height: '14px',
                                borderRadius: '50%',
                                background: stage.color || 'var(--accent)',
                                border: '1px solid rgba(255,255,255,0.2)'
                              }}
                            />
                            <span>Choose Color</span>
                          </button>
                          <button
                            className="project-dropdown-item"
                            onClick={() => {
                              setActiveStageDropdown(null)
                              const newStages = activePipeline.stages.map((s) =>
                                s.id === stage.id
                                  ? { ...s, color: undefined, colorOpacity: undefined }
                                  : s
                              )
                              const newPipelines = pipelines.map((p) =>
                                p.id === activePipelineId ? { ...p, stages: newStages } : p
                              )
                              onUpdate(project.id, { pipelines: newPipelines })
                            }}
                          >
                            <RefreshCw size={14} />
                            <span>Reset Color</span>
                          </button>
                          <div
                            style={{
                              height: '1px',
                              background: 'rgba(255,255,255,0.1)',
                              margin: '2px 0'
                            }}
                          />
                          <button
                            className="project-dropdown-item danger"
                            onClick={() => {
                              setActiveStageDropdown(null)
                              handleDeleteStage(stage.id)
                            }}
                          >
                            <Trash2 size={14} />
                            <span>Delete Stage</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Items list */}
                  <div
                    style={{
                      flex: 1,
                      padding: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      position: 'relative',
                      background:
                        dropIndicator?.stageId === stage.id &&
                        dropIndicator?.position === 'inside'
                          ? 'rgba(255,255,255,0.02)'
                          : 'transparent'
                    }}
                  >
                    {stage.items.map((item, idx) => (
                      <React.Fragment key={item.id}>
                        {idx > 0 && (
                          <div
                            style={{
                              height: '1px',
                              background: 'rgba(255,255,255,0.05)',
                              margin: '2px 10px'
                            }}
                          />
                        )}
                        {dropIndicator?.id === item.id &&
                          dropIndicator?.position === 'before' && (
                            <div
                              style={{
                                height: '2px',
                                background: 'rgba(255, 255, 255, 0.4)',
                                borderRadius: '1px',
                                margin: '2px 0'
                              }}
                            />
                          )}
                        <div
                          data-pipeline-item-id={item.id}
                          data-stage-id={stage.id}
                          onMouseDown={(e) => startDraggingItem(e, item.id, stage.id)}
                          style={{
                            background: 'transparent',
                            padding: '10px',
                            borderRadius: '10px',
                            border: 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            transition: 'all 0.2s',
                            opacity: draggingItem?.itemId === item.id ? 0.4 : 1
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                          >
                            <GripVertical
                              className="drag-handle"
                              size={14}
                              style={{ opacity: 0.3, cursor: 'grab', flexShrink: 0 }}
                            />
                            <button
                              onClick={() =>
                                handleUpdateItem(stage.id, item.id, {
                                  completed: !item.completed
                                })
                              }
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                flexShrink: 0,
                                color: '#ffffff'
                              }}
                            >
                              {item.completed ? (
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Square size={16} fill={project.color || '#ffffff'} stroke={project.color || '#ffffff'} />
                                  <Check size={12} color="#000000" style={{ position: 'absolute' }} strokeWidth={3} />
                                </div>
                              ) : (
                                <Square size={16} style={{ opacity: 0.3 }} color={project.color || '#ffffff'} strokeWidth={1} />
                              )}
                            </button>
                            <input
                              value={item.text}
                              onChange={(e) =>
                                handleUpdateItem(stage.id, item.id, { text: e.target.value })
                              }
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: item.completed
                                  ? 'var(--text-secondary)'
                                  : 'var(--text-primary)',
                                textDecoration: item.completed ? 'line-through' : 'none',
                                fontSize: '12px',
                                width: '100%',
                                outline: 'none'
                              }}
                            />
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'flex-end',
                              gap: '4px',
                              opacity: 0.6
                            }}
                          >
                            <TinyButton onClick={() => handleDeleteItem(stage.id, item.id)}>
                              <Trash2 size={12} color="var(--danger)" />
                            </TinyButton>
                          </div>
                        </div>
                        {dropIndicator?.id === item.id &&
                          dropIndicator?.position === 'after' && (
                            <div
                              style={{
                                height: '2px',
                                background: 'rgba(255, 255, 255, 0.4)',
                                borderRadius: '1px',
                                margin: '2px 0'
                              }}
                            />
                          )}
                      </React.Fragment>
                    ))}
                    <button
                      onClick={() => handleAddItem(stage.id)}
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px dashed rgba(255,255,255,0.1)',
                        borderRadius: '10px',
                        padding: '8px',
                        color: 'var(--text-secondary)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      <Plus size={10} /> Add Item
                    </button>
                  </div>
                </div>
              </React.Fragment>
            ))
          )}

          {/* Color picker portal */}
          {stageColorPickerAnchor && activePipeline && (
            <ColorPicker
              color={
                activePipeline.stages.find((s) => s.id === stageColorPickerAnchor.stageId)
                  ?.color || '#FF3E6C'
              }
              anchorRect={stageColorPickerAnchor.rect}
              opacity={
                activePipeline.stages.find((s) => s.id === stageColorPickerAnchor.stageId)
                  ?.colorOpacity ?? 0.1
              }
              onOpacityChange={(opacity) => {
                const newStages = activePipeline.stages.map((s) =>
                  s.id === stageColorPickerAnchor.stageId ? { ...s, colorOpacity: opacity } : s
                )
                const newPipelines = pipelines.map((p) =>
                  p.id === activePipelineId ? { ...p, stages: newStages } : p
                )
                onUpdate(project.id, { pipelines: newPipelines })
              }}
              onChange={(color) => {
                const newStages = activePipeline.stages.map((s) =>
                  s.id === stageColorPickerAnchor.stageId ? { ...s, color } : s
                )
                const newPipelines = pipelines.map((p) =>
                  p.id === activePipelineId ? { ...p, stages: newStages } : p
                )
                onUpdate(project.id, { pipelines: newPipelines })
              }}
              onClose={() => setStageColorPickerAnchor(null)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
