import React, { memo } from 'react'
import * as LucideIcons from 'lucide-react'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, MoreVertical } from 'lucide-react'
import { Project, TaskItem } from '../../../types'

interface ProjectItemProps {
  project: Project
  level: number
  selectedProjectId: string | null
  setSelectedProjectId: (id: string | null) => void
  editingId: string | null
  editingValue: string
  setEditingValue: (val: string) => void
  saveProjectName: (id: string, newValue?: string) => void
  saveTaskName: (projectId: string, taskId: string) => void
  cancelEditing: () => void
  activeDropdown: string | null
  setActiveDropdown: (id: string | null) => void
  updateProjectColor: (id: string, color: string) => void
  startEditing: (id: string, val: string) => void
  deleteProject: (id: string) => void
  toggleProjectExpansion: (id: string, e: React.MouseEvent) => void
  addSubProject: (id: string, e?: React.MouseEvent) => Promise<void>
  quickAddTask: (id: string) => void
  onDragStart: (
    e: React.MouseEvent,
    idOrData: string | { type: 'task' | 'project'; projectId: string; taskId: string }
  ) => void
  dropIndicator: {
    id: string
    position: 'before' | 'inside' | 'after'
    type: 'project' | 'task'
  } | null
  isDragging: string | null
  parentColor?: string
  openColorPickerFor: (projectId: string, rect: DOMRect) => void
  showTaskCounts: boolean
}

const ProjectItem: React.FC<ProjectItemProps> = memo(function ProjectItem({
  project,
  level,
  selectedProjectId,
  setSelectedProjectId,
  editingId,
  editingValue,
  setEditingValue,
  saveProjectName,
  saveTaskName,
  cancelEditing,
  activeDropdown,
  setActiveDropdown,
  updateProjectColor,
  startEditing,
  deleteProject,
  toggleProjectExpansion,
  addSubProject,
  quickAddTask,
  onDragStart,
  dropIndicator,
  isDragging,
  parentColor,
  openColorPickerFor,
  showTaskCounts
}) {
  const isSelected = selectedProjectId === project.id
  const displayColor = project.color || parentColor || 'var(--accent)'

  return (
    <div key={project.id}>
      <div
        className={`premium-project-item ${isSelected ? 'selected' : ''} ${activeDropdown === project.id ? 'has-dropdown' : ''
          } ${editingId === project.id ? 'is-editing' : ''} ${dropIndicator?.id === project.id && dropIndicator.position === 'inside'
            ? 'drag-over-nest'
            : ''
          }`}
        data-project-id={project.id}
        data-level={level}
        style={{
          zIndex:
            activeDropdown === project.id || editingId === project.id || isDragging === project.id
              ? 9990
              : undefined,
          opacity: isDragging === project.id ? 0.4 : 1,
          borderTop:
            dropIndicator?.id === project.id &&
              dropIndicator.position === 'before' &&
              dropIndicator.type === 'project'
              ? '2px solid var(--accent)'
              : undefined,
          borderBottom:
            dropIndicator?.id === project.id &&
              dropIndicator.position === 'after' &&
              dropIndicator.type === 'project'
              ? '2px solid var(--accent)'
              : undefined,
          marginRight: '8px',
          marginLeft: level === 0 ? '0px' : '4px', // The rest is inherited from parent's div
          position: 'relative'
        }}
        onClick={() => {
          if (editingId === project.id) return
          setSelectedProjectId(project.id)
        }}
        onMouseDown={(e) => {
          if (editingId === project.id) return
          const target = e.target as HTMLElement
          if (
            target.closest('button') ||
            target.closest('input') ||
            target.closest('textarea') ||
            target.closest('a')
          )
            return
          onDragStart(e, { type: 'project', projectId: project.id, taskId: '' })
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 0 4px 8px'
          }}
        >
          {(() => {
            if (project.icon?.startsWith('file')) {
              return (
                <img
                  src={project.icon}
                  alt=""
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: 'var(--radius-sm)',
                    objectFit: 'cover',
                    flexShrink: 0
                  }}
                />
              )
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const IconComponent = (LucideIcons as any)[project.icon || 'FolderOpen']
            if (IconComponent) {
              return <IconComponent size={16} style={{ color: displayColor, flexShrink: 0 }} />
            }
            return (
              <span
                style={{
                  fontSize: '14px',
                  width: '16px',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '2px'
                }}
              >
                {project.icon}
              </span>
            )
          })()}

          {editingId === project.id ? (
            <input
              className="inline-edit-input"
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onBlur={(e) => {
                const currentValue = e.target.value
                setEditingValue(currentValue)
                setTimeout(() => saveProjectName(project.id, currentValue), 0)
              }}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') {
                  const currentValue = e.currentTarget.value
                  setEditingValue(currentValue)
                  setTimeout(() => saveProjectName(project.id, currentValue), 0)
                }
                if (e.key === 'Escape') cancelEditing()
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                minWidth: 0,
                overflow: 'hidden'
              }}
            >
              <span
                className="task-text"
                style={{
                  fontSize: '13px',
                  fontWeight: isSelected ? 600 : 500,
                  color: 'var(--text-primary)',
                  opacity: isSelected ? 1 : 0.95,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {project.name}
              </span>
              {showTaskCounts &&
                ((): React.ReactNode => {
                  let count = 0
                  const traverse = (tasks: TaskItem[]): void => {
                    count += tasks.length
                    tasks.forEach((t) => {
                      if (t.subtasks) traverse(t.subtasks)
                    })
                  }
                  if (project.tasks) traverse(project.tasks)
                  if (count === 0) return null
                  return (
                    <span
                      style={{
                        marginLeft: '8px',
                        fontSize: '11px',
                        color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                        opacity: 0.6,
                        fontWeight: 500,
                        flexShrink: 0
                      }}
                    >
                      {count}
                    </span>
                  )
                })()}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: '4px',
              marginLeft: '8px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={`task-edit-btn ${project.subprojects && project.subprojects.length > 0 ? 'visible-hint' : ''
                }`}
              onClick={(e) => toggleProjectExpansion(project.id, e)}
              style={{
                padding: '2px',
                color: 'var(--text-secondary)',
                visibility:
                  project.subprojects && project.subprojects.length > 0 ? 'visible' : 'hidden'
              }}
            >
              {project.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            <div style={{ position: 'relative' }}>
              <button
                className={`task-edit-btn ${activeDropdown === project.id ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveDropdown(activeDropdown === project.id ? null : project.id)
                }}
                title="Project Settings"
                style={{ padding: '2px', marginRight: '6px' }}
              >
                <MoreVertical size={12} />
              </button>
              {activeDropdown === project.id && (
                <div
                  className="project-dropdown"
                  style={{ right: 0, left: 'auto' }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {level === 0 && (
                    <button
                      className="project-dropdown-item"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        setActiveDropdown(null)
                        openColorPickerFor(project.id, rect)
                      }}
                    >
                      <div
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          background: project.color || 'var(--accent)',
                          border: '1px solid rgba(255,255,255,0.2)'
                        }}
                      />
                      <span>Project Color</span>
                    </button>
                  )}
                  <button
                    className="project-dropdown-item"
                    onClick={() => {
                      setActiveDropdown(null)
                      setTimeout(() => startEditing(project.id, project.name), 0)
                    }}
                  >
                    <Pencil size={14} />
                    <span>Rename Project</span>
                  </button>
                  <button
                    className="project-dropdown-item"
                    onClick={() => {
                      setActiveDropdown(null)
                      addSubProject(project.id)
                    }}
                  >
                    <Plus size={14} />
                    <span>Add Subproject</span>
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
                      setActiveDropdown(null)
                      deleteProject(project.id)
                      if (selectedProjectId === project.id) setSelectedProjectId(null)
                    }}
                  >
                    <Trash2 size={14} />
                    <span>Delete Project</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {project.isExpanded && project.subprojects && project.subprojects.length > 0 && (
        <div style={{ marginLeft: '16px', borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: '4px' }}>
          {project.subprojects.map((sub) => (
            <ProjectItem
              key={sub.id}
              project={sub}
              level={level + 1}
              selectedProjectId={selectedProjectId}
              setSelectedProjectId={setSelectedProjectId}
              editingId={editingId}
              editingValue={editingValue}
              setEditingValue={setEditingValue}
              saveProjectName={saveProjectName}
              saveTaskName={saveTaskName}
              cancelEditing={cancelEditing}
              activeDropdown={activeDropdown}
              setActiveDropdown={setActiveDropdown}
              updateProjectColor={updateProjectColor}
              startEditing={startEditing}
              deleteProject={deleteProject}
              toggleProjectExpansion={toggleProjectExpansion}
              addSubProject={addSubProject}
              quickAddTask={quickAddTask}
              onDragStart={onDragStart}
              dropIndicator={dropIndicator}
              isDragging={isDragging}
              parentColor={displayColor}
              openColorPickerFor={openColorPickerFor}
              showTaskCounts={showTaskCounts}
            />
          ))}
        </div>
      )}
    </div>
  )
})

export default ProjectItem
