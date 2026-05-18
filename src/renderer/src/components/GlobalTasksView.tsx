import React from 'react'
import { Project, TaskItem } from '../types'
import TaskTree from './sidebar/subcomponents/TaskTree'
import { CheckSquare, Folder } from 'lucide-react'

interface GlobalTasksViewProps {
  projects: Project[]
  onUpdateTask: (projectId: string, taskId: string, updates: Partial<TaskItem>) => void
  onTaskAdded: (projectId: string, name: string, parentId?: string) => void
  onTaskDeleted: (projectId: string, taskId: string) => void
  showTaskCounts: boolean
  hideEmptyProjects?: boolean
}

const GlobalTasksView: React.FC<GlobalTasksViewProps> = ({
  projects,
  onUpdateTask,
  onTaskAdded,
  onTaskDeleted,
  showTaskCounts,
  hideEmptyProjects
}) => {
  const filteredProjects = projects.filter(p => {
    if (!hideEmptyProjects) return true
    return (p.tasks && p.tasks.length > 0) || (p.subprojects && p.subprojects.length > 0)
  })

  return (
    <div className="global-tasks-view" style={{ 
      flex: 1, 
      height: '100%', 
      overflowY: 'auto', 
      padding: '24px'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
          gap: '24px' 
        }}>
          {filteredProjects.map(project => (
            <div 
              key={project.id} 
              style={{ 
                background: 'var(--card-bg)', 
                borderRadius: '12px', 
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Folder size={18} style={{ color: project.color || 'var(--accent)' }} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{project.name}</h3>
              </div>
              
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <TaskTree 
                  project={project}
                  isRoot={true}
                  isArchiveView={false}
                  toggleTask={(pid, tid) => {
                    const findTask = (list: TaskItem[]): TaskItem | undefined => {
                      for (const t of list) {
                        if (t.id === tid) return t
                        if (t.subtasks) {
                          const found = findTask(t.subtasks)
                          if (found) return found
                        }
                      }
                      return undefined
                    }
                    const task = findTask(project.tasks || [])
                    if (task) onUpdateTask(pid, tid, { completed: !task.completed })
                  }}
                  toggleTaskExpansion={(pid, tid) => {
                    const findTask = (list: TaskItem[]): TaskItem | undefined => {
                      for (const t of list) {
                        if (t.id === tid) return t
                        if (t.subtasks) {
                          const found = findTask(t.subtasks)
                          if (found) return found
                        }
                      }
                      return undefined
                    }
                    const task = findTask(project.tasks || [])
                    if (task) onUpdateTask(pid, tid, { isExpanded: !task.isExpanded })
                  }}
                  editingId={null}
                  editingValue=""
                  setEditingValue={() => {}}
                  saveTaskName={() => {}}
                  cancelEditing={() => {}}
                  startEditing={() => {}}
                  deleteTask={onTaskDeleted}
                  getTaskTimelineDate={() => null}
                  onTaskAdded={onTaskAdded}
                  isDragging={null}
                  dropIndicator={null}
                  startMouseDrag={() => {}}
                  showTaskCounts={showTaskCounts}
                />
              </div>
            </div>
          ))}
          {projects.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px', opacity: 0.5 }}>
              <p>No projects found. Create a project to start adding tasks.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default GlobalTasksView
