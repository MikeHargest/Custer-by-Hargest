import React, { memo } from 'react'
import { Project } from '../../../types'
import TaskItem from './TaskItem'
import SidebarDropZone from './SidebarDropZone'

interface TaskTreeProps {
  project: Project
  isRoot: boolean
  isArchiveView: boolean
  toggleTask: (projectId: string, taskId: string) => void
  toggleTaskExpansion: (projectId: string, taskId: string) => void
  editingId: string | null
  editingValue: string
  setEditingValue: (val: string) => void
  saveTaskName: (projectId: string, taskId: string) => void
  cancelEditing: () => void
  startEditing: (id: string, value: string) => void
  deleteTask: (projectId: string, taskId: string) => void
  getTaskTimelineDate: (projectId: string, taskId: string) => string | null
  onTaskAdded: (projectId: string, name: string, parentId?: string, explicitId?: string) => void
  isDragging: string | null
  dropIndicator: any
  startMouseDrag: (e: React.MouseEvent, info: any) => void
  showTaskCounts: boolean
}

const TaskTree: React.FC<TaskTreeProps> = memo(function TaskTree({
  project,
  isRoot,
  isArchiveView,
  toggleTask,
  toggleTaskExpansion,
  editingId,
  editingValue,
  setEditingValue,
  saveTaskName,
  cancelEditing,
  startEditing,
  deleteTask,
  getTaskTimelineDate,
  onTaskAdded,
  isDragging,
  dropIndicator,
  startMouseDrag,
  showTaskCounts
}) {
  const projectTasks = isArchiveView ? (project.archivedTasks || []) : (project.tasks || [])
  return (
    <div key={project.id}>
      {!isRoot && projectTasks.length > 0 && (
        <div
          style={{
            fontSize: '11px',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
            marginTop: '16px',
            marginBottom: '8px',
            paddingLeft: '4px',
            opacity: 0.8,
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            paddingBottom: '4px'
          }}
        >
          {project.name}
        </div>
      )}
      {projectTasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          project={project}
          depth={0}
          toggleTask={toggleTask}
          toggleTaskExpansion={toggleTaskExpansion}
          editingId={editingId}
          editingValue={editingValue}
          setEditingValue={setEditingValue}
          saveTaskName={saveTaskName}
          cancelEditing={cancelEditing}
          startEditing={startEditing}
          deleteTask={deleteTask}
          getTaskTimelineDate={getTaskTimelineDate}
          onTaskAdded={onTaskAdded}
          isDragging={isDragging}
          dropIndicator={dropIndicator}
          startMouseDrag={startMouseDrag}
          showTaskCounts={showTaskCounts}
          isArchiveView={isArchiveView}
        />
      ))}
      {project.subprojects?.map((sub) => (
        <TaskTree
          key={sub.id}
          project={sub}
          isRoot={false}
          isArchiveView={isArchiveView}
          toggleTask={toggleTask}
          toggleTaskExpansion={toggleTaskExpansion}
          editingId={editingId}
          editingValue={editingValue}
          setEditingValue={setEditingValue}
          saveTaskName={saveTaskName}
          cancelEditing={cancelEditing}
          startEditing={startEditing}
          deleteTask={deleteTask}
          getTaskTimelineDate={getTaskTimelineDate}
          onTaskAdded={onTaskAdded}
          isDragging={isDragging}
          dropIndicator={dropIndicator}
          startMouseDrag={startMouseDrag}
          showTaskCounts={showTaskCounts}
        />
      ))}
      {projectTasks.length > 0 && <SidebarDropZone dzAction="project" dzProject={project.id} />}
    </div>
  )
})

export default TaskTree
