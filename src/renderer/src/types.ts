export interface TaskItem {
  id: string
  text: string
  completed: boolean
  isExpanded?: boolean
  subtasks: TaskItem[]
}

export interface Project {
  id: string
  name: string
  isExpanded: boolean
  tasks: TaskItem[]
  color?: string
  subprojects?: Project[]
  banner?: string
  description?: string
  icon?: string
  status?: string
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent'
  startDate?: string
  endDate?: string
  progressMode?: 'tasks' | 'manual'
  manualProgress?: number
  depth?: number
  bannerCollapsed?: boolean
  events?: AppEvent[]
  path?: string
  notesPath?: string
  boardsPath?: string
  boardData?: string
}

export interface TimelineTask {
  id: string
  projectId: string
  taskName: string
  date: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD for multi-day tasks
  taskId?: string // Link to the sidebar task ID
}

export interface TimerData {
  id: string
  title: string
  taskName: string | null
  hours: number
  minutes: number
  seconds: number
  soundPath: string | null
  soundName: string | null
  isRunning?: boolean
  isStopwatch?: boolean
}

export interface AppNote {
  id: string
  title: string
  content: string
  type?: 'markdown' | 'tldraw'
  projectId?: string
  lastModified: number
  path?: string // Absolute path to the .md file
  isTrash?: boolean
}

export interface UITheme {
  bgColor: string
  cardBg: string
  accent: string
  textPrimary: string
  boardAccent: string
  boardBg: string
  timelineTaskBg?: string
  timerBg?: string
}

export interface AppEvent {
  id: string
  title: string
  date?: string // YYYY-MM-DD
  time?: string // HH:MM
  location?: string
}
