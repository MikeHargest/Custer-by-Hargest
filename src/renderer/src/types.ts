export interface TaskItem {
  id: string
  text: string
  completed: boolean
  isExpanded?: boolean
  subtasks: TaskItem[]
}

export interface PipelineItem {
  id: string
  text: string
  completed: boolean
}

export interface PipelineStage {
  id: string
  name: string
  items: PipelineItem[]
  color?: string
  colorOpacity?: number
  description?: string
  startDate?: string
  endDate?: string
}

export interface PipelineData {
  id: string
  name: string
  stages: PipelineStage[]
}

export interface ProjectAttachment {
  id: string
  name: string
  path: string
  type: 'file' | 'link' | 'folder'
}

export interface Project {
  id: string
  name: string
  isExpanded: boolean
  tasks: TaskItem[]
  archivedTasks?: TaskItem[]
  color?: string
  subprojects?: Project[]
  banner?: string
  description?: string
  attachments?: ProjectAttachment[]
  icon?: string
  status?: string
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent'
  startDate?: string
  endDate?: string
  progressMode?: 'tasks' | 'manual' | 'pipeline'
  manualProgress?: number
  depth?: number
  bannerCollapsed?: boolean
  events?: AppEvent[]
  path?: string
  notesPath?: string
  boardsPath?: string
  boardData?: string
  pipeline?: PipelineStage[] // Legacy field
  pipelines?: PipelineData[] // New field
  activePipelineId?: string
  activePipelineStageId?: string
  bannerPosition?: number
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
  isPinned?: boolean
  isHeaderPinned?: boolean
}

export interface AlarmData {
  id: string
  title: string
  taskName: string | null
  date: string // YYYY-MM-DD
  time: string // HH:MM
  isEnabled: boolean
  isNotified: boolean
}

export interface AppNote {
  id: string
  title: string
  content: string
  type?: 'markdown' | 'board'
  projectId?: string
  parentId?: string
  lastModified: number
  createdAt?: number
  path?: string // Absolute path to the .md file
  fileName?: string
  isTrash?: boolean
  order?: number
}

export interface UITheme {
  bgColor: string
  cardBg: string
  accent: string
  textPrimary: string
  boardAccent: string
  boardBg: string
  calendarTaskBg?: string
  calendarEventBg?: string
  timerBg?: string
}

export interface AppEvent {
  id: string
  title: string
  date?: string // YYYY-MM-DD
  time?: string // HH:MM
  location?: string
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
    interval: number
    daysOfWeek?: number[] // 0-6 for Sunday-Saturday
    endType: 'never' | 'until' | 'count'
    endDate?: string
    count?: number
  }
  exceptions?: {
    [dateStr: string]: {
      deleted?: boolean
      editedEventId?: string // Link to an exceptions AppEvent
    }
  } // date string to exception rules
  originalEventId?: string // If this is an exception event
  originalDate?: string // What date this exception event was originally for
  reminder?: {
    minutesBefore: number // 0, 5, 15, 30, 60, etc.
    isNotified?: boolean
  }
  // Sync Fields
  externalId?: string // Link to external calendar event ID (e.g., Google Calendar)
  etag?: string // Server revision tracking
  syncStatus?: string // 'synced' | 'pending_push' | 'pending_delete' | 'conflict'
  updatedAt?: number // Timestamp of last local change
}

export interface AppNotification {
  id: string
  type: 'reminder' | 'timer' | 'system'
  title: string
  message: string
  timestamp: number
  isRead: boolean
  relatedId?: string // eventId, timerId, etc.
}

export const DEFAULT_THEME: UITheme = {
  bgColor: '#333333',
  cardBg: '#121212',
  accent: '#525252',
  textPrimary: '#EAEAEA',
  boardAccent: '#71717a',
  boardBg: '#1b1b1b',
  calendarTaskBg: '#2a2a2a',
  calendarEventBg: 'rgba(255,255,255,0.03)',
  timerBg: '#171717'
}
