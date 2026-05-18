import React, { useState, useEffect, useRef, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import {
  Plus,
  Trash2,
  FileText,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Palette,
  Eraser,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListTodo,
  Minus,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  Presentation,
  Pencil,
  FolderOpen,
  Folder,
  Link2,
  Unlink,
  Image as ImageIcon,
  ExternalLink
} from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import UnderlineExt from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import { Markdown } from 'tiptap-markdown'
import Link from '@tiptap/extension-link'
import ImageExt from '@tiptap/extension-image'
import { Virtuoso } from 'react-virtuoso'
import { motion, AnimatePresence } from 'framer-motion'

import { AppNote, Project } from '../types'
import ColorPicker from './ColorPicker'
import BoardsView from './boards/BoardsView'
import { shouldCreateBackup } from '../utils/backupManager'

export interface NotesViewHandle {
  manualSave: () => void
  toggleSidebar: () => void
  openHistory: (rect: DOMRect) => void
  openBoardHistory: (rect: DOMRect) => void
  openBoardVersions: (rect: DOMRect) => void
  getSaveStatus: () => 'saved' | 'saving' | 'unsaved'
  getSidebarOpen: () => boolean
  getActiveNoteType: () => 'markdown' | 'board' | null
}

interface NotesViewProps {
  notes: AppNote[]
  setNotes: React.Dispatch<React.SetStateAction<AppNote[]>>
  projects: Project[]
  workspacePath: string
  selectedProjectId: string | null
  activeNoteId: string | null
  setActiveNoteId: (id: string | null) => void
  theme: any // UITheme
  setTheme: (theme: any) => void
  showFPS?: boolean
  setCurrentView: (view: any) => void
  backupIntervalMinutes?: number
  boardAutosaveIntervalMinutes?: number
  boardBackupIntervalMinutes?: number
  disableBoardBackups?: boolean
  onSaveStatusChange?: (status: 'saved' | 'saving' | 'unsaved') => void
  onSidebarChange?: (open: boolean) => void
  onActiveNoteTypeChange?: (type: 'markdown' | 'board' | null) => void
  notesToolbarActionsRef?: React.MutableRefObject<NotesViewHandle | null>
}

const findProjectRecursive = (projs: Project[], id: string | null): Project | undefined => {
  if (!id) return undefined
  for (const p of projs) {
    if (p.id === id) return p
    if (p.subprojects) {
      const found = findProjectRecursive(p.subprojects, id)
      if (found) return found
    }
  }
  return undefined
}

const sanitizeFileName = (name: string): string => {
  return (
    name
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100) || 'Untitled'
  )
}

const getFileName = (title: string, id: string, ext: string): string => {
  const sanitized = sanitizeFileName(title)
  const shortId = id.slice(0, 8)
  return `${sanitized}_${shortId}.${ext}`
}

export default function NotesView({
  notes,
  setNotes,
  projects,
  workspacePath,
  selectedProjectId,
  activeNoteId,
  setActiveNoteId,
  theme,
  setTheme,
  showFPS,
  setCurrentView,
  backupIntervalMinutes = 10,
  boardAutosaveIntervalMinutes = 5,
  boardBackupIntervalMinutes = 10,
  disableBoardBackups = false,
  onSaveStatusChange,
  onSidebarChange,
  onActiveNoteTypeChange,
  notesToolbarActionsRef
}: NotesViewProps): React.ReactElement {
  const floatingBtnStyle = (active = false): React.CSSProperties => ({
    width: '28px',
    height: '28px',
    borderRadius: '7px',
    border: active ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
    background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.18s ease'
  })

  const NonInclusiveLink = Link.extend({
    inclusive: false
  })

  const activeProjectId = selectedProjectId || 'default'
  const [showTrash, setShowTrash] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const [textColorPickerRect, setTextColorPickerRect] = useState<DOMRect | null>(null)
  const saveTimers = useRef<{ [id: string]: ReturnType<typeof setTimeout> }>({})
  const [localTitle, setLocalTitle] = useState('')
  const lastActiveIdRef = useRef<string | null>(activeNoteId)
  const activeNoteIdRef = useRef<string | null>(activeNoteId)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const titleEffectRef = useRef<string>(localTitle)
  const [collapsedNotes, setCollapsedNotes] = useState<Set<string>>(new Set())
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null)
  const [dragTargetId, setDragTargetId] = useState<string | null>(null)

  // Link dialog state
  const [linkDialog, setLinkDialog] = useState<{ open: boolean; initialUrl: string } | null>(null)
  const [linkDialogUrl, setLinkDialogUrl] = useState('')
  const notesRef = useRef(notes)
  // Board cache: stores loaded board content per board id
  const [boardContent, setBoardContent] = useState<Record<string, string>>({})
  const boardContentRef = useRef<Record<string, string>>({})

  const [sidebarContextMenu, setSidebarContextMenu] = useState<{
    x: number
    y: number
    note: AppNote
  } | null>(null)

  // Save State
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')

  // Backup / History States
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [previewContent, setPreviewContent] = useState<string | null>(null)
  const [historyList, setHistoryList] = useState<any[]>([])
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false)
  const [boardHistoryMenuPos, setBoardHistoryMenuPos] = useState<{ top: number; left: number } | null>(null)

  // Board Versions State
  const [boardVersions, setBoardVersions] = useState<any[]>([])
  const [showBoardVersionsDropdown, setShowBoardVersionsDropdown] = useState(false)
  const [boardVersionsMenuPos, setBoardVersionsMenuPos] = useState<{ top: number; left: number } | null>(null)

  // Selection Bubble Menu Delay
  const [showBubbleMenu, setShowBubbleMenu] = useState(false)
  const bubbleMenuTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isMouseDownRef = useRef(false)
  const [_showFullBubbleMenu, setShowFullBubbleMenu] = useState(false)

  const lastBackedUpContentRef = useRef<Record<string, string>>({})
  const lastBoardBackupAtRef = useRef<Record<string, number>>({})
  const lastBoardBackupHashRef = useRef<Record<string, string>>({})
  // Tracks boards that have changes not yet flushed to source (.board) file
  const boardIsDirtyRef = useRef<Record<string, boolean>>({})

  // Custom Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  })

  const handleConfirm = useCallback(() => {
    if (confirmDialog.isOpen) {
      confirmDialog.onConfirm()
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
    }
  }, [confirmDialog])

  const handleCancel = useCallback(() => {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
  }, [])

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!confirmDialog.isOpen) return

      if (e.key === 'Enter') {
        e.preventDefault()
        handleConfirm()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleCancel()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [confirmDialog.isOpen, handleConfirm, handleCancel])

  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  useEffect(() => {
    boardContentRef.current = boardContent
  }, [boardContent])

  useEffect(() => {
    titleEffectRef.current = localTitle
  }, [localTitle])

  useEffect(() => {
    activeNoteIdRef.current = activeNoteId
  }, [activeNoteId])

  const getNoteTargetDir = useCallback(
    (nProjId: string | undefined, nIsTrash: boolean | undefined): string => {
      const isTrash = nIsTrash || nProjId === 'trash'
      const pId = nProjId === 'trash' ? 'default' : nProjId || 'default'

      let targetDir = workspacePath + '/notes'
      if (pId !== 'default') {
        const project = findProjectRecursive(projects, pId)
        if (project) {
          if (project.notesPath) {
            targetDir = project.notesPath
          } else if (project.path) {
            targetDir = `${project.path}/notes`
          }
        }
      }

      if (isTrash) {
        targetDir = `${targetDir}/trash`
      }
      return targetDir
    },
    [projects, workspacePath]
  )

  const getBoardTargetDir = useCallback(
    (nProjId: string | undefined, nIsTrash: boolean | undefined): string => {
      const isTrash = nIsTrash || nProjId === 'trash'
      const pId = nProjId === 'trash' ? 'default' : nProjId || 'default'

      let targetDir = workspacePath + '/boards'
      if (pId !== 'default') {
        const project = findProjectRecursive(projects, pId)
        if (project) {
          // @ts-ignore
          if (project.boardsPath) {
            // @ts-ignore
            targetDir = project.boardsPath
          } else if (project.path) {
            targetDir = `${project.path}/boards`
          }
        }
      }

      if (isTrash) {
        targetDir = `${targetDir}/trash`
      }
      return targetDir
    },
    [projects, workspacePath]
  )

  const handleManualSave = useCallback(async () => {
    if (!activeNoteId) return
    const currentNote = notesRef.current.find((n) => n.id === activeNoteId)
    if (!currentNote) return

    if (saveTimers.current[activeNoteId]) {
      clearTimeout(saveTimers.current[activeNoteId])
      delete saveTimers.current[activeNoteId]
    }

    setSaveStatus('saving')

    const type = currentNote.type || 'markdown'
    const isBoard = type === 'board'
    let targetDir = isBoard
      ? getBoardTargetDir(currentNote.projectId, currentNote.isTrash)
      : getNoteTargetDir(currentNote.projectId, currentNote.isTrash)

    if (!targetDir) {
      setSaveStatus('saved')
      return
    }

    const ext = isBoard ? 'board' : 'md'
    const fileName = currentNote.fileName || getFileName(currentNote.title, activeNoteId, ext)

    if (isBoard) {
      // Write cache then pack
      let boardPayload = boardContentRef.current[activeNoteId] || currentNote.content || '{}'
      try {
        const parsedContent = JSON.parse(boardPayload)
        boardPayload = JSON.stringify({
          ...parsedContent,
          id: currentNote.id,
          title: currentNote.title,
          projectId: currentNote.projectId,
          type: 'board'
        })
      } catch (e) { }

      // @ts-ignore
      const ok = await window.api.writeBoardJson(activeNoteId, boardPayload)
      // @ts-ignore
      if (ok) {
        // @ts-ignore
        await window.api.packBoard(activeNoteId, targetDir, fileName)
        // Source file is now up to date — clear dirty flag
        boardIsDirtyRef.current[activeNoteId] = false
      }
    } else {
      // @ts-ignore
      await window.api.saveNote(targetDir, fileName, currentNote)
    }

    setSaveStatus('saved')
  }, [activeNoteId, getBoardTargetDir, getNoteTargetDir])
  // FLUSH ON CLOSE: Synchronously save all pending changes when the app quits or window is closed
  useEffect(() => {
    const handleBeforeUnload = () => {
      const pendingIds = Object.keys(saveTimers.current)
      for (const id of pendingIds) {
        clearTimeout(saveTimers.current[id])
        const currentNoteVersion = notesRef.current.find((n) => n.id === id)
        if (!currentNoteVersion) continue

        const type = currentNoteVersion.type || 'markdown'
        const isBoard = type === 'board'
        let targetDir = isBoard
          ? getBoardTargetDir(currentNoteVersion.projectId, currentNoteVersion.isTrash)
          : getNoteTargetDir(currentNoteVersion.projectId, currentNoteVersion.isTrash)

        const ext = isBoard ? 'board' : 'md'
        const fileName = currentNoteVersion.fileName || getFileName(currentNoteVersion.title, id, ext)

        if (isBoard) {
          // @ts-ignore
          window.api.writeBoardJson(id, boardContentRef.current[id] || currentNoteVersion.content || '{}').then(ok => {
            // @ts-ignore
            if (ok) window.api.packBoard(id, targetDir, fileName)
          })
        } else {
          ; (window as any).api.saveNote(targetDir, fileName, currentNoteVersion)
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [workspacePath, projects])

  const buildBoardPayload = useCallback((note: AppNote): string => {
    let boardPayload = boardContentRef.current[note.id] || note.content || '{}'
    try {
      const parsedContent = JSON.parse(boardPayload)
      boardPayload = JSON.stringify({
        ...parsedContent,
        id: note.id,
        title: note.title,
        projectId: note.projectId,
        type: 'board'
      })
    } catch (e) { }
    return boardPayload
  }, [])

  const flushBoardToDisk = useCallback(async (note: AppNote): Promise<boolean> => {
    const targetDir = getBoardTargetDir(note.projectId, note.isTrash)
    const fileName = note.fileName || getFileName(note.title, note.id, 'board')

    if (saveTimers.current[note.id]) {
      clearTimeout(saveTimers.current[note.id])
      delete saveTimers.current[note.id]
    }

    const boardPayload = buildBoardPayload(note)
    // @ts-ignore
    const ok = await window.api.writeBoardJson(note.id, boardPayload)
    if (!ok) return false
    // @ts-ignore
    await window.api.packBoard(note.id, targetDir, fileName)
    return true
  }, [buildBoardPayload, getBoardTargetDir])

  // BACKUP SYSTEM
  const createBackupSnapshot = useCallback(async (
    noteToBackup: AppNote,
    reason: 'interval' | 'switch' | 'manual' | 'restore-preflight' = 'interval'
  ) => {
    const isBoard = noteToBackup.type === 'board'

    // Check if we should create a backup using central logic
    const lastHash = isBoard
      ? lastBoardBackupHashRef.current[noteToBackup.id] || ''
      : lastBackedUpContentRef.current[noteToBackup.id] || ''

    const currentHash = isBoard
      ? buildBoardPayload(noteToBackup)
      : noteToBackup.content || ''

    const lastBackupAt = isBoard
      ? lastBoardBackupAtRef.current[noteToBackup.id] || 0
      : 0 // Notes don't use cooldown currently, but we could add it

    const config = {
      backupIntervalMinutes,
      boardBackupIntervalMinutes,
      disableBoardBackups
    }

    if (!shouldCreateBackup(noteToBackup, reason, config, lastBackupAt, lastHash, currentHash)) {
      // Even if skipping backup, we might need to flush board to disk on switch
      if (isBoard && reason === 'switch') {
        await flushBoardToDisk(noteToBackup)
      }
      return
    }

    // Prepare target directory
    let targetDir: string
    if (isBoard) {
      targetDir = getBoardTargetDir(noteToBackup.projectId, noteToBackup.isTrash)
    } else {
      targetDir = getNoteTargetDir(noteToBackup.projectId, noteToBackup.isTrash)
    }

    // Always flush latest board state on switch/restore/manual to avoid data loss.
    if (isBoard && reason !== 'interval') {
      await flushBoardToDisk(noteToBackup)
    }

    const ext = isBoard ? 'board' : 'md'
    const fileName = noteToBackup.fileName || getFileName(noteToBackup.title, noteToBackup.id, ext)
    const backupPayload = isBoard
      ? {
          ...noteToBackup,
          __boardBackupIntervalMinutes: boardBackupIntervalMinutes,
          __backupReason: reason
        }
      : noteToBackup

    // @ts-ignore
    const success = await window.api.createNoteBackup(targetDir, backupPayload, fileName)

    if (success) {
      if (isBoard) {
        lastBoardBackupAtRef.current[noteToBackup.id] = Date.now()
        lastBoardBackupHashRef.current[noteToBackup.id] = currentHash
      } else {
        lastBackedUpContentRef.current[noteToBackup.id] = currentHash
      }
    }
  }, [
    backupIntervalMinutes,
    boardBackupIntervalMinutes,
    disableBoardBackups,
    buildBoardPayload,
    flushBoardToDisk,
    getBoardTargetDir,
    getNoteTargetDir
  ])

  // ── Timer 1: Notes backup (markdown notes only, not boards) ──────────────────
  useEffect(() => {
    const ms = Math.max(1, backupIntervalMinutes) * 60 * 1000
    const interval = setInterval(() => {
      const activeId = activeNoteIdRef.current
      if (!activeId || isPreviewMode) return
      const currentNote = notesRef.current.find(n => n.id === activeId)
      if (currentNote && currentNote.type !== 'board') {
        createBackupSnapshot(currentNote, 'interval')
      }
    }, ms)
    return () => clearInterval(interval)
  }, [backupIntervalMinutes, createBackupSnapshot, isPreviewMode])

  // ── Timer 2: Board autosave — flushes temp → source file ─────────────────────
  // Runs every boardAutosaveIntervalMinutes for the active board.
  // Only saves if board has unsaved changes and is not empty.
  useEffect(() => {
    const ms = Math.max(1, boardAutosaveIntervalMinutes) * 60 * 1000
    const interval = setInterval(async () => {
      const activeId = activeNoteIdRef.current
      if (!activeId) return
      if (!boardIsDirtyRef.current[activeId]) return
      const currentNote = notesRef.current.find(n => n.id === activeId)
      if (!currentNote || currentNote.type !== 'board') return

      // Skip empty boards
      const cachedContent = boardContentRef.current[activeId]
      if (!cachedContent) return
      try {
        const parsed = JSON.parse(cachedContent)
        if (!Array.isArray(parsed.elements) || parsed.elements.length === 0) return
      } catch { return }

      const targetDir = getBoardTargetDir(currentNote.projectId, currentNote.isTrash)
      const fileName = currentNote.fileName || getFileName(currentNote.title, activeId, 'board')
      const boardPayload = buildBoardPayload(currentNote)

      // @ts-ignore
      const ok = await window.api.writeBoardJson(activeId, boardPayload)
      if (ok) {
        // @ts-ignore
        await window.api.packBoard(activeId, targetDir, fileName)
        boardIsDirtyRef.current[activeId] = false
        console.log('[board-autosave] Source file updated for board:', activeId)
      }
    }, ms)
    return () => clearInterval(interval)
  }, [boardAutosaveIntervalMinutes, buildBoardPayload, getBoardTargetDir])

  // ── Timer 3: Board backup — creates timestamped copy from temp file ───────────
  // Runs every boardBackupIntervalMinutes for the active board.
  // Reads from cache (temp file), never from source file.
  useEffect(() => {
    if (disableBoardBackups) return
    const ms = Math.max(1, boardBackupIntervalMinutes) * 60 * 1000
    const interval = setInterval(async () => {
      const activeId = activeNoteIdRef.current
      if (!activeId || isPreviewMode) return
      const currentNote = notesRef.current.find(n => n.id === activeId)
      if (!currentNote || currentNote.type !== 'board') return

      // Skip empty boards (check handled in IPC handler too, but guard here as well)
      const cachedContent = boardContentRef.current[activeId]
      if (!cachedContent) return
      try {
        const parsed = JSON.parse(cachedContent)
        if (!Array.isArray(parsed.elements) || parsed.elements.length === 0) return
      } catch { return }

      const targetDir = getBoardTargetDir(currentNote.projectId, currentNote.isTrash)
      const fileName = currentNote.fileName || getFileName(currentNote.title, activeId, 'board')

      // @ts-ignore
      await window.api.backupBoard(activeId, targetDir, fileName)
    }, ms)
    return () => clearInterval(interval)
  }, [boardBackupIntervalMinutes, disableBoardBackups, getBoardTargetDir, isPreviewMode])

  // Save final snapshot on Note Switch
  useEffect(() => {
    const previousId = lastActiveIdRef.current
    if (previousId && previousId !== activeNoteId) {
      const previousNote = notesRef.current.find(n => n.id === previousId)
      if (previousNote) {
        createBackupSnapshot(previousNote, 'switch')
      }
    }
    lastActiveIdRef.current = activeNoteId
    // Reset preview mode on switch
    setIsPreviewMode(false)
    setPreviewContent(null)
    setSaveStatus('saved') // Reset save state on note switch
    setShowHistoryDropdown(false)
    setBoardHistoryMenuPos(null)
    setShowBoardVersionsDropdown(false)
    setBoardVersionsMenuPos(null)
  }, [activeNoteId, createBackupSnapshot])

  useEffect(() => {
    if (!showHistoryDropdown && !showBoardVersionsDropdown) return
    const onDocPointerDown = (e: MouseEvent): void => {
      const target = e.target as HTMLElement
      if (
        target.closest('[data-history-menu-root="true"]') ||
        target.closest('[data-history-menu-button="true"]') ||
        target.closest('[data-versions-menu-root="true"]') ||
        target.closest('[data-versions-menu-button="true"]')
      )
        return
      setShowHistoryDropdown(false)
      setBoardHistoryMenuPos(null)
      setShowBoardVersionsDropdown(false)
      setBoardVersionsMenuPos(null)
    }
    document.addEventListener('mousedown', onDocPointerDown)
    return () => document.removeEventListener('mousedown', onDocPointerDown)
  }, [showHistoryDropdown, showBoardVersionsDropdown])

  const handleLoadBoardVersions = async () => {
    if (!activeNoteId) return
    const currentNote = notesRef.current.find((n) => n.id === activeNoteId)
    if (!currentNote || currentNote.type !== 'board') return

    const targetDir = getBoardTargetDir(currentNote.projectId, currentNote.isTrash)
    const fileName = currentNote.fileName || getFileName(currentNote.title, currentNote.id, 'board')

    // @ts-ignore
    const versions = await window.api.listBoardVersions(targetDir, fileName)
    setBoardVersions(versions)
    setShowBoardVersionsDropdown((prev) => !prev)
  }

  const handleAddBoardSave = async () => {
    if (!activeNoteId) return
    const currentNote = notesRef.current.find((n) => n.id === activeNoteId)
    if (!currentNote || currentNote.type !== 'board') return

    // Save current to main file first
    await handleManualSave()

    const targetDir = getBoardTargetDir(currentNote.projectId, currentNote.isTrash)
    const fileName = currentNote.fileName || getFileName(currentNote.title, currentNote.id, 'board')

    // @ts-ignore
    const success = await window.api.createBoardVersion(targetDir, fileName)
    if (success) {
      // @ts-ignore
      window.api.showNotification('Version Created', `New version of "${currentNote.title}" saved.`)
      // Refresh list
      // @ts-ignore
      const versions = await window.api.listBoardVersions(targetDir, fileName)
      setBoardVersions(versions)
    }
  }

  const handleRestoreBoardVersion = async (versionPath: string) => {
    if (!activeNoteId) return
    const currentNote = notesRef.current.find((n) => n.id === activeNoteId)
    if (!currentNote || currentNote.type !== 'board') return

    const targetDir = getBoardTargetDir(currentNote.projectId, currentNote.isTrash)
    const fileName = currentNote.fileName || getFileName(currentNote.title, currentNote.id, 'board')

    // @ts-ignore
    const success = await window.api.restoreBoardVersion(targetDir, fileName, versionPath)
    if (success) {
      // @ts-ignore
      window.api.showNotification('Version Restored', `Board "${currentNote.title}" has been restored.`)
      // Reload board content
      // @ts-ignore
      const newContent = await window.api.openBoard(targetDir, fileName, currentNote.id)
      setBoardContent((prev) => ({ ...prev, [currentNote.id]: newContent }))
      setShowBoardVersionsDropdown(false)
      setBoardVersionsMenuPos(null)
    }
  }

  const handleDeleteBoardVersion = async (versionPath: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Version',
      message: 'Are you sure you want to delete this version?',
      onConfirm: async () => {
        // @ts-ignore
        const success = await window.api.deleteBoardVersion(versionPath)
        if (success) {
          const activeId = activeNoteIdRef.current
          if (!activeId) return
          const currentNote = notesRef.current.find((n) => n.id === activeId)
          if (!currentNote) return
          const targetDir = getBoardTargetDir(currentNote.projectId, currentNote.isTrash)
          const fileName = currentNote.fileName || getFileName(currentNote.title, currentNote.id, 'board')
          // @ts-ignore
          const versions = await window.api.listBoardVersions(targetDir, fileName)
          setBoardVersions(versions)
        }
      }
    })
  }

  // Ctrl+S listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        // Force blur current element to ensure state is flushed
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur()
        }
        // Increase delay to 150ms to ensure all sub-components (like text editor)
        // and debounced syncs in BoardsView have finished their work.
        setTimeout(() => handleManualSave(), 150)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleManualSave])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement

      // Проверка для меню бекапов/версий
      const isMenuButton = target.closest('[data-history-menu-button="true"]') ||
                         target.closest('[data-versions-menu-button="true"]') ||
                         target.closest('[data-history-menu-button="true"]')

      const isMenuRoot = target.closest('[data-history-menu-root="true"]') ||
                       target.closest('[data-versions-menu-root="true"]')

      if (!isMenuButton && !isMenuRoot) {
        setShowHistoryDropdown(false)
        setShowBoardVersionsDropdown(false)
        setBoardHistoryMenuPos(null)
        setBoardVersionsMenuPos(null)
      }
    }

    if (showHistoryDropdown || showBoardVersionsDropdown) {
      window.addEventListener('mousedown', handleClickOutside)
    }
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [showHistoryDropdown, showBoardVersionsDropdown])

  const handleLoadHistory = async () => {
    if (!activeNoteId) return
    const currentNote = notesRef.current.find(n => n.id === activeNoteId)
    if (!currentNote) return
    const isBoard = currentNote.type === 'board'
    const targetDir = isBoard
      ? getBoardTargetDir(currentNote.projectId, currentNote.isTrash)
      : getNoteTargetDir(currentNote.projectId, currentNote.isTrash)
    const fileName = currentNote.fileName || getFileName(currentNote.title, currentNote.id, isBoard ? 'board' : 'md')

    // @ts-ignore
    const backups = await window.api.listNoteBackups(targetDir, fileName)
    setHistoryList(backups)
    setShowHistoryDropdown((prev) => !prev)
  }

  const handlePreviewHistory = async (backupItem: any) => {
    const currentNote = notesRef.current.find(n => n.id === activeNoteIdRef.current)
    if (!currentNote) return
    const isBoard = currentNote.type === 'board'
    if (isBoard) {
      if (saveTimers.current[currentNote.id]) {
        clearTimeout(saveTimers.current[currentNote.id])
        delete saveTimers.current[currentNote.id]
      }
      const targetDir = getBoardTargetDir(currentNote.projectId, currentNote.isTrash)
      const fileName = currentNote.fileName || getFileName(currentNote.title, currentNote.id, 'board')
      await createBackupSnapshot(currentNote, 'restore-preflight')
      // @ts-ignore
      const restored = await window.api.restoreNoteBackup(targetDir, fileName, backupItem.path)
      if (!restored?.success) {
        console.error('Board backup restore failed:', restored?.error)
        // @ts-ignore
        window.api.showNotification('Restore Failed', restored?.error || 'Unable to restore board backup.')
        return
      }
      // @ts-ignore
      const loaded = await window.api.openBoard(targetDir, fileName, currentNote.id)
      if (loaded) {
        setBoardContent(prev => ({ ...prev, [currentNote.id]: loaded }))
        setNotes(prev => prev.map(n => n.id === currentNote.id ? { ...n, content: loaded, lastModified: Date.now() } : n))
      } else {
        // @ts-ignore
        window.api.showNotification('Restore Failed', 'Board backup was restored on disk but could not be opened.')
      }
      setShowHistoryDropdown(false)
      setBoardHistoryMenuPos(null)
      setSaveStatus('saved')
      return
    }

    // @ts-ignore
    const text = await window.api.readNoteBackup(backupItem.path)
    if (text !== null) {
      setPreviewContent(text)
      setIsPreviewMode(true)
      setShowHistoryDropdown(false)
      editor?.commands.setContent(text)
    }
  }

  const handleCancelPreview = () => {
    const currentNote = notesRef.current.find(n => n.id === activeNoteId)
    if (!currentNote) return
    setIsPreviewMode(false)
    setPreviewContent(null)
    editor?.commands.setContent(currentNote.content || '')
  }

  const handleRestorePreview = async () => {
    const currentNote = notesRef.current.find(n => n.id === activeNoteId)
    if (!currentNote || !previewContent) return

    // Force backup of current state
    await createBackupSnapshot(currentNote)

    const newContent = previewContent
    setIsPreviewMode(false)
    setPreviewContent(null)

    handleUpdateNoteRef.current(currentNote.id, { content: newContent })
  }

  const handleDeleteBackup = async (backupItem: any) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Backup',
      message: 'Are you sure you want to permanently delete this backup?',
      onConfirm: async () => {
        // @ts-ignore
        const ok = await window.api.deleteNoteBackup(backupItem.path)
        if (ok) {
          setHistoryList((prev) => prev.filter((h) => h.path !== backupItem.path))
        }
      }
    })
  }

  const handleUpdateNote = useCallback(
    (id: string, updates: Partial<AppNote>): void => {
      // Apply updates to React state immediately to ensure "total saving" and avoid data loss on switch
      setNotes((prev) =>
        prev.map((n) => {
          if (n.id === id) {
            return { ...n, ...updates, lastModified: Date.now() }
          }
          return n
        })
      )

      // Save content logic (Renaming is now handled separately by handleTitleBlur)
      if (updates.content !== undefined) {
        setSaveStatus('unsaved')

        // Board content is managed exclusively by handleBoardChange.
        // The autosave timer (boardAutosaveIntervalMinutes) handles source file writes.
        const currentNote = notesRef.current.find(n => n.id === id)
        if (currentNote?.type === 'board') return

        if (saveTimers.current[id]) clearTimeout(saveTimers.current[id])
        saveTimers.current[id] = setTimeout(
          async (): Promise<void> => {
            setSaveStatus('saving')
            // Read from ref to always get the LATEST notes state, not a stale closure
            const currentNoteVersion = notesRef.current.find((n) => n.id === id)
            if (!currentNoteVersion) {
              setSaveStatus('saved')
              return
            }

            const targetDir = getNoteTargetDir(currentNoteVersion.projectId, currentNoteVersion.isTrash)
            if (!targetDir) return

            const fileName = currentNoteVersion.fileName || getFileName(currentNoteVersion.title, id, 'md')
            // @ts-ignore
            window.api.saveNote(targetDir, fileName, currentNoteVersion)
            setSaveStatus('saved')
            delete saveTimers.current[id]
          },
          1000
        )
      }
    },
    [workspacePath, projects, setNotes, getNoteTargetDir]
  )


  const activeNote = notes.find((n) => n.id === activeNoteId)
  const activeNoteProjectColor = React.useMemo(() => {
    if (!activeNote) return 'var(--accent, #9ba8f0)'
    const projectId = activeNote.projectId || 'default'
    if (projectId === 'default' || projectId === 'trash') return 'var(--accent, #9ba8f0)'
    const project = findProjectRecursive(projects, projectId)
    return project?.color || 'var(--accent, #9ba8f0)'
  }, [activeNote, projects])
  const handleUpdateNoteRef = useRef(handleUpdateNote)

  useEffect(() => {
    handleUpdateNoteRef.current = handleUpdateNote
  }, [handleUpdateNote])

  // Stable ref for openLink so editorProps.handleClick never has a stale closure
  const openLinkRef = useRef((href: string) => {
    if (!href) return
    const trimmed = href.trim()
    if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) {
      ; (window as any).api.openExternal(trimmed)
    } else {
      let pathToOpen = trimmed
      if (pathToOpen.startsWith('file:///')) {
        pathToOpen = decodeURI(pathToOpen.replace('file:///', ''))
      } else if (pathToOpen.startsWith('local-file:///')) {
        pathToOpen = decodeURI(pathToOpen.replace('local-file:///', ''))
      } else if (pathToOpen.startsWith('file://')) {
        pathToOpen = decodeURI(pathToOpen.replace('file://', ''))
      }
      // On Windows, markdown might have saved it as /C:/..., strip the leading slash
      if (/^\/[a-zA-Z]:[\\/]/.test(pathToOpen)) {
        pathToOpen = pathToOpen.substring(1)
      }
      ; (window as any).api.openPath(decodeURIComponent(pathToOpen))
    }
  })

  // Tiptap editor instance
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] }
      }),
      UnderlineExt,
      TextStyle,
      Color,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Start typing your notes here...' }),
      Highlight.configure({ multicolor: true }),
      Markdown.configure({
        html: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      NonInclusiveLink.configure({
        openOnClick: false, // We handle clicks manually
        autolink: true,
        linkOnPaste: true,
        protocols: ['http', 'https', 'ftp', 'mailto', 'file', 'local-file'], // <-- ДОБАВЛЕНО local-file
        HTMLAttributes: {
          class: 'tiptap-link',
          rel: 'noopener noreferrer',
          target: '_blank'
        }
      }),
      ImageExt.configure({
        HTMLAttributes: {
          class: 'tiptap-image'
        }
      })
    ],
    content: activeNote?.content || '',
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection
      if (from === to) {
        setShowBubbleMenu(false)
        setShowFullBubbleMenu(false)
        return
      }

      if (!isMouseDownRef.current) {
        setShowBubbleMenu(true)
      }
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor'
      },
      handleClick: (_view, _pos, event) => {
        const target = event.target as Node
        const el = target.nodeType === 3 ? target.parentElement : (target as HTMLElement)
        const linkEl = el?.closest('a')
        if (linkEl && (event.ctrlKey || event.metaKey)) {
          const href = linkEl.getAttribute('href')
          if (href) {
            event.preventDefault()
            openLinkRef.current(href)
            return true
          }
        }
        return false
      }
    }
  })

  // Патч markdown-it validateLink напрямую через storage редактора.
  // markdownItSetup в tiptap-markdown НЕ поддерживается — опция молча игнорируется.
  // Единственный надёжный способ — патчить md после инициализации через storage.
  useEffect(() => {
    if (!editor) return
    // tiptap-markdown хранит markdown-it instance в editor.storage.markdown.parser.md
    const md = (editor.storage as any)?.markdown?.parser?.md
    if (!md) return
    const originalValidate = md.validateLink?.bind(md)
    md.validateLink = (url: string) => {
      // Разрешаем file:// и local-file:// (Electron с webSecurity:false их поддерживает)
      if (url.startsWith('file://') || url.startsWith('local-file://')) return true
      return originalValidate ? originalValidate(url) : true
    }

    const handleMouseDown = () => {
      isMouseDownRef.current = true
      if (bubbleMenuTimerRef.current) clearTimeout(bubbleMenuTimerRef.current)
      setShowBubbleMenu(false)
      setShowFullBubbleMenu(false)
    }
    const handleMouseUp = () => {
      isMouseDownRef.current = false
      if (bubbleMenuTimerRef.current) clearTimeout(bubbleMenuTimerRef.current)

      // Use a small delay to ensure the editor state is fully updated with the final selection
      bubbleMenuTimerRef.current = setTimeout(() => {
        if (editor) {
          const { from, to } = editor.state.selection
          if (from !== to) {
            setShowBubbleMenu(true)
          }
        }
      }, 50)
    }

    editor.view.dom.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      editor.view.dom.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [editor])

  // Saved selection ref — we capture {from,to} before the dialog steals focus
  const savedSelectionRef = useRef<{ from: number; to: number } | null>(null)

  // Open the link dialog, saving the current editor selection first
  const handleOpenLinkDialog = useCallback(() => {
    if (!editor) return
    // Capture selection before the dialog input steals focus
    const { from, to } = editor.state.selection
    savedSelectionRef.current = { from, to }
    const existingHref = editor.getAttributes('link').href || ''
    setLinkDialogUrl(existingHref)
    setLinkDialog({ open: true, initialUrl: existingHref })
  }, [editor])

  // Apply or remove link — restores selection first so setLink has something to wrap
  const handleApplyLink = useCallback((url: string) => {
    if (!editor) return
    setLinkDialog(null)

    const sel = savedSelectionRef.current
    savedSelectionRef.current = null

    const chain = editor.chain().focus()

    // Restore the selection the user had when they opened the dialog
    if (sel && sel.from !== sel.to) {
      chain.setTextSelection({ from: sel.from, to: sel.to })
    }

    let finalUrl = url.trim()
    if (!finalUrl) {
      chain.extendMarkRange('link').unsetLink().run()
      return
    }

    // Convert local Windows paths like C:\ to file:/// URL so markdown-it preserves them correctly
    if (/^[a-zA-Z]:[\\/]/.test(finalUrl)) {
      const normalized = finalUrl.replace(/\\/g, '/')
      // encodeURI кодирует пробелы/кириллицу, но НЕ кодирует ':' и '/'
      finalUrl = `file:///${encodeURI(normalized)}`
    } else if (/^\/[a-zA-Z]:[\/]/.test(finalUrl)) {
      // Already /C:/... format — convert to file:///C:/...
      finalUrl = `file://${encodeURI(finalUrl)}`
    }

    chain.extendMarkRange('link').setLink({ href: finalUrl }).run()
  }, [editor])

  // Browse for a local file to attach as link
  const handleBrowseFile = useCallback(async () => {
    const filePath: string | null = await (window as any).api.selectFile()
    if (filePath) {
      setLinkDialogUrl(filePath)
    }
  }, [])

  // Browse for a local folder to attach as link
  const handleBrowseFolder = useCallback(async () => {
    const folderPath: string | null = await (window as any).api.selectFolder()
    if (folderPath) {
      setLinkDialogUrl(folderPath)
    }
  }, [])

  // Insert image callback
  const handleInsertImage = useCallback(async () => {
    if (!editor) return
    const filePath: string | null = await (window as any).api.selectFile()
    if (filePath) {
      // Нормализуем обратные слеши Windows → прямые
      const normalizedPath = filePath.replace(/\\/g, '/')
      // Используем encodeURI (не encodeURIComponent!) — он кодирует пробелы и кириллицу,
      // но НЕ кодирует ':' и '/', поэтому 'C:/...' остаётся валидным, а не 'C%3A/...'
      const finalUrl = `file:///${encodeURI(normalizedPath)}`

      editor.chain().focus().setImage({ src: finalUrl }).run()
    }
  }, [editor])

  // Remove link directly
  const handleUnlink = useCallback(() => {
    if (!editor) return
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
  }, [editor])

  // Use a stable update listener that always uses the current activeNoteId from Ref
  useEffect(() => {
    if (!editor) return

    const onUpdate = ({ editor: e }: { editor: any }) => {
      const currentId = activeNoteIdRef.current
      if (currentId) {
        // Debouncing logic is handled inside handleUpdateNoteRef
        const markdownString = (e.storage as any).markdown.getMarkdown()
        handleUpdateNoteRef.current(currentId, { content: markdownString })
      }
    }

    editor.on('update', onUpdate)
    return () => {
      editor.off('update', onUpdate)
    }
  }, [editor])

  // Ctrl+K shortcut to open link dialog from anywhere in the note editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        // Only trigger if editor is focused
        if (editor && editor.isFocused) {
          e.preventDefault()
          const existingHref = editor.getAttributes('link').href || ''
          setLinkDialogUrl(existingHref)
          setLinkDialog({ open: true, initialUrl: existingHref })
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editor])

  // Track Ctrl key state to show clickable link cursor
  useEffect(() => {
    const container = document.querySelector('.notes-view-container')
    if (!container) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        container.classList.add('ctrl-held')
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        container.classList.remove('ctrl-held')
      }
    }
    const onBlur = () => container.classList.remove('ctrl-held')
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      container.classList.remove('ctrl-held')
    }
  }, [])

  // Lock/unlock editor when entering/exiting history preview mode
  useEffect(() => {
    if (editor) editor.setEditable(!isPreviewMode)
  }, [isPreviewMode, editor])

  // Migrate legacy local-file:// and bare /C:/... paths to canonical file:/// format.
  // Called once on content load to fix old notes without re-saving automatically.
  const migrateLocalFilePaths = useCallback((markdown: string): string => {
    // 1. local-file:///E:/... → file:///E:/...
    let result = markdown.replace(/local-file:\/\/\//g, 'file:///')
    // 2. Исправляем C%3A → C: (артефакт от encodeURIComponent, который не должен был кодировать ':')
    result = result.replace(/file:\/\/\/([A-Za-z])%3A\//g, 'file:///$1:/')
    // 3. Bare Windows paths saved as /C:/... inside markdown links/images → file:///C:/...
    //    Matches: ](/C:/...) or ](/C:\...) or ](\/C:\/...)
    result = result.replace(/(\])\(\/(([a-zA-Z]):[\\/][^)]*)\)/g, (_match, bracket, rest) => {
      const normalized = rest.replace(/\\/g, '/')
      return `${bracket}(file:///${normalized})`
    })
    // 4. Recover escaped markdown links/images like \[text\](...) and !\[\](...)
    result = result.replace(/!\\\[([^\]]*)\\\]\(([^)]+)\)/g, '![$1]($2)')
    result = result.replace(/\\\[([^\]]*)\\\]\(([^)]+)\)/g, '[$1]($2)')
    return result
  }, [])

  // Sync editor content when active note changes or content loads from disk
  useEffect(() => {
    if (editor && activeNote && activeNote.type !== 'board') {
      const rawContent = activeNote.content || ''

      // Try to parse as JSON first (modern format fallback for older notes)
      try {
        const json = JSON.parse(rawContent)
        // If it's a valid Tiptap JSON, set it
        if (json && typeof json === 'object') {
          // Compare with current state is hard for JSON, but emitUpdate: false prevents loops
          editor.commands.setContent(json, { emitUpdate: false })
          return
        }
      } catch (e) {
        // Assume markdown
      }

      // Migrate legacy local-file:// and /C:/... paths on load (backward compat)
      const noteContent = migrateLocalFilePaths(rawContent)

      // Check purely text content change (for markdown)
      const currentMarkdown = (editor.storage as any).markdown.getMarkdown()
      if (currentMarkdown !== noteContent) {
        editor.commands.setContent(noteContent, { emitUpdate: false })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, activeNoteId, activeNote?.content])

  const applyFormatting = (type: string, value?: string): void => {
    if (!editor) return
    const chain = editor.chain().focus()

    switch (type) {
      case 'bold':
        chain.toggleBold().run()
        break
      case 'italic':
        chain.toggleItalic().run()
        break
      case 'underline':
        chain.toggleUnderline().run()
        break
      case 'strikethrough':
        chain.toggleStrike().run()
        break
      case 'color':
        if (value) chain.setColor(value).run()
        break
      case 'clear':
        chain.unsetAllMarks().run()
        break
      case 'h1':
        chain.toggleHeading({ level: 1 }).run()
        break
      case 'h2':
        chain.toggleHeading({ level: 2 }).run()
        break
      case 'h3':
        chain.toggleHeading({ level: 3 }).run()
        break
      case 'list':
        chain.toggleBulletList().run()
        break
      case 'task':
        chain.toggleTaskList().run()
        break
      case 'separator':
        chain.setHorizontalRule().run()
        break
      default:
        return
    }
  }

  const getAllDescendantIds = (projectId: string, projs: Project[]): string[] => {
    const ids: string[] = [projectId]
    const currentProject = findProjectRecursive(projs, projectId)
    if (currentProject?.subprojects) {
      currentProject.subprojects.forEach((sub) => {
        ids.push(...getAllDescendantIds(sub.id, [sub]))
      })
    }
    return ids
  }

  const projectScopeIds =
    activeProjectId === 'default' ? ['default'] : getAllDescendantIds(activeProjectId, projects)

  const filteredNotes = React.useMemo(() => notes.filter((n) => {
    const isTrash = n.isTrash || n.projectId === 'trash'
    const pId = n.projectId === 'trash' ? 'default' : n.projectId || 'default'

    if (showTrash) {
      return isTrash && projectScopeIds.includes(pId)
    } else {
      return !isTrash && projectScopeIds.includes(pId)
    }
  }), [notes, showTrash, projectScopeIds])



  // Flush pending saves when switching notes
  // IMPORTANT: This effect MUST be declared BEFORE the title-sync effect so it reads
  // titleEffectRef.current (the OLD note's pending title) before the sync effect overwrites it.
  useEffect(() => {
    const flushSave = async (id: string, pendingTitle?: string): Promise<void> => {
      const notesCopy = [...notes]
      const noteToSave = notesCopy.find((n) => n.id === id)
      if (!noteToSave) return

      const isBoard = noteToSave.type === 'board'
      const targetDir = isBoard
        ? getBoardTargetDir(noteToSave.projectId, noteToSave.isTrash)
        : getNoteTargetDir(noteToSave.projectId, noteToSave.isTrash)

      if (targetDir) {
        const ext = isBoard ? 'board' : 'md'
        const currentTitle = pendingTitle || noteToSave.title
        const newFileName = getFileName(currentTitle, id, ext)
        const oldFileName = noteToSave.fileName || getFileName(noteToSave.title, id, ext)

        // Handle rename if title was changed before flush
        if (oldFileName !== newFileName) {
          // @ts-ignore
          await window.api.renameNote(targetDir, oldFileName, newFileName)
        }

        const finalNote = { ...noteToSave, title: currentTitle, fileName: newFileName }

        if (isBoard) {
          let boardPayload = boardContentRef.current[id] || noteToSave.content || '{}'
          try {
            const parsed = JSON.parse(boardPayload)
            boardPayload = JSON.stringify({
              ...parsed,
              id: id,
              title: currentTitle,
              projectId: noteToSave.projectId,
              type: 'board'
            })
          } catch (e) { }

          // @ts-ignore
          const ok = await window.api.writeBoardJson(id, boardPayload)
          // @ts-ignore
          if (ok) await window.api.packBoard(id, targetDir, newFileName)
        } else {
          // @ts-ignore
          await window.api.saveNote(targetDir, newFileName, finalNote)
        }

        // Update the notes list in App.tsx so the change persists in the sidebar/state
        setNotes(prev => prev.map(n => n.id === id ? finalNote : n))
      }
    }

    if (lastActiveIdRef.current && lastActiveIdRef.current !== activeNoteId) {
      const prevId = lastActiveIdRef.current
      // titleEffectRef.current still holds the OLD note's pending title at this point
      // because this effect fires before the title-sync effect below
      flushSave(prevId, titleEffectRef.current)

      if (saveTimers.current[prevId]) {
        clearTimeout(saveTimers.current[prevId])
        delete saveTimers.current[prevId]
      }
    }
    lastActiveIdRef.current = activeNoteId
  }, [activeNoteId, notes, getBoardTargetDir, getNoteTargetDir])

  // Redundant filesystem loading removed. State is populated by App.tsx.

  // Sync local title when active note changes
  // IMPORTANT: This effect MUST be declared AFTER the flush effect above so that
  // titleEffectRef.current is not yet overwritten when the flush reads it.
  useEffect(() => {
    const currentNote = notes.find(n => n.id === activeNoteId)
    if (currentNote) {
      setLocalTitle(currentNote.title)
      titleEffectRef.current = currentNote.title
    }
  }, [activeNoteId]) // eslint-disable-line react-hooks-exhaustive-deps

  useEffect(() => {
    if (!activeNoteId && filteredNotes.length > 0) {
      setActiveNoteId(filteredNotes[0].id)
    }
  }, [activeNoteId, filteredNotes, setActiveNoteId])

  useEffect(() => {
    const currentNoteIds = filteredNotes.map((n) => n.id)
    if (currentNoteIds.length > 0 && !currentNoteIds.includes(activeNoteId || '')) {
      const firstId = currentNoteIds[0]
      if (activeNoteId !== firstId) {
        setTimeout(() => setActiveNoteId(firstId), 0)
      }
    } else if (currentNoteIds.length === 0 && activeNoteId !== null) {
      setTimeout(() => setActiveNoteId(null), 0)
    }
  }, [activeProjectId, showTrash, activeNoteId, filteredNotes, setActiveNoteId])

  const handleCreateNote = (type: 'markdown' | 'board' = 'markdown'): void => {
    let initialContent = ''
    if (type === 'board') {
      // Small valid json structure for empty board if needed, otherwise empty string is fine.
      // We will handle it in the BoardsView component
      initialContent = ''
    }
    const noteProjId = activeProjectId
    const newNote: AppNote = {
      id: uuidv4(),
      title: type === 'board' ? 'Untitled Board' : 'Untitled Note',
      content: initialContent,
      type,
      projectId: noteProjId,
      isTrash: false,
      lastModified: Date.now(),
      createdAt: Date.now()
    }

    const isBoard = type === 'board'
    const targetDir = isBoard
      ? getBoardTargetDir(noteProjId, false)
      : getNoteTargetDir(noteProjId, false)

    const initialFileName = getFileName(newNote.title, newNote.id, isBoard ? 'board' : 'md')
    // @ts-ignore
    newNote.fileName = initialFileName

    setNotes((prev) => [newNote, ...prev])
    setActiveNoteId(newNote.id)

    // Save physical file immediately
    if (targetDir) {
      if (isBoard) {
        // Initialize empty board in cache and pack to .board ZIP
        const emptyBoard = JSON.stringify({
          elements: [],
          viewport: { x: 0, y: 0, scale: 1 },
          id: newNote.id,
          title: newNote.title,
          projectId: noteProjId,
          type: 'board'
        })
        // @ts-ignore
        window.api.writeBoardJson(newNote.id, emptyBoard).then((ok) => {
          // @ts-ignore
          if (ok) window.api.packBoard(newNote.id, targetDir, initialFileName)
        })
      } else {
        // @ts-ignore
        window.api.saveNote(targetDir, initialFileName, newNote)
      }
    }
  }

  const getNameFromPath = (filePath: string): string => {
    const raw = filePath.split(/[/\\]/).pop() || 'Imported'
    return raw.replace(/\.[^/.]+$/, '') || 'Imported'
  }

  const handleImportFile = async (): Promise<void> => {
    // @ts-ignore
    const filePath: string | null = await window.api.selectFile()
    if (!filePath) return
    // @ts-ignore
    const text: string | null = await window.api.readTextFile(filePath)
    if (text === null) {
      // @ts-ignore
      window.api.showNotification('Import Failed', 'Could not read selected file as text.')
      return
    }

    const noteProjId = activeProjectId
    const targetDir = getNoteTargetDir(noteProjId, false)
    const baseTitle = sanitizeFileName(getNameFromPath(filePath))
    const newNote: AppNote = {
      id: uuidv4(),
      title: baseTitle || 'Imported Note',
      content: text,
      type: 'markdown',
      projectId: noteProjId,
      isTrash: false,
      lastModified: Date.now(),
      createdAt: Date.now()
    }
    const fileName = getFileName(newNote.title, newNote.id, 'md')
    newNote.fileName = fileName
    setNotes((prev) => [newNote, ...prev])
    setActiveNoteId(newNote.id)
    // @ts-ignore
    await window.api.saveNote(targetDir, fileName, newNote)
  }

  const handleImportBoard = async (): Promise<void> => {
    let sourcePath: string | null = null
    try {
      // @ts-ignore
      sourcePath = await window.api.selectBoardImportFile()
    } catch (err) {
      console.error('[renderer] selectBoardImportFile failed, fallback to selectFile:', err)
      // @ts-ignore
      sourcePath = await window.api.selectFile()
    }
    if (!sourcePath) return

    const noteProjId = activeProjectId
    const targetDir = getBoardTargetDir(noteProjId, false)
    const id = uuidv4()
    const baseTitle = sanitizeFileName(getNameFromPath(sourcePath)) || 'Imported Board'
    const targetFileName = getFileName(baseTitle, id, 'board')

    let importedFileName: string | null = null
    try {
      // @ts-ignore
      importedFileName = await window.api.importBoardFile(sourcePath, targetDir, targetFileName)
    } catch (err) {
      console.error('[renderer] importBoardFile failed:', err)
      // @ts-ignore
      window.api.showNotification('Ошибка импорта', 'Не удалось импортировать файл доски.')
      return
    }
    if (!importedFileName) {
      // @ts-ignore
      window.api.showNotification('Ошибка импорта', 'Не удалось импортировать файл доски.')
      return
    }

    // @ts-ignore
    const loaded: string | null = await window.api.openBoard(targetDir, importedFileName, id)
    if (!loaded) {
      // @ts-ignore
      window.api.showNotification('Ошибка импорта', 'Файл доски импортирован, но не удалось открыть содержимое.')
      return
    }

    let parsedTitle = baseTitle
    try {
      const parsed = JSON.parse(loaded)
      if (parsed?.title && typeof parsed.title === 'string') parsedTitle = parsed.title
    } catch { }

    const newBoard: AppNote = {
      id,
      title: parsedTitle || 'Imported Board',
      content: loaded,
      type: 'board',
      projectId: noteProjId,
      isTrash: false,
      lastModified: Date.now(),
      createdAt: Date.now(),
      fileName: importedFileName
    }

    setBoardContent((prev) => ({ ...prev, [id]: loaded }))
    setNotes((prev) => [newBoard, ...prev])
    setActiveNoteId(id)
  }

  // Create a child note inside a parent note
  const handleCreateChildNote = (parentId: string, e: React.MouseEvent): void => {
    e.stopPropagation()
    const parentNote = notes.find((n) => n.id === parentId)
    if (!parentNote || parentNote.type === 'board') return

    const noteProjId = parentNote.projectId || activeProjectId
    const newNote: AppNote = {
      id: uuidv4(),
      title: 'Untitled Note',
      content: '',
      type: 'markdown',
      projectId: noteProjId,
      parentId: parentId,
      isTrash: false,
      lastModified: Date.now(),
      createdAt: Date.now()
    }

    const targetDir = getNoteTargetDir(noteProjId, false)
    const initialFileName = getFileName(newNote.title, newNote.id, 'md')
    // @ts-ignore
    newNote.fileName = initialFileName

    setNotes((prev) => [newNote, ...prev])
    setActiveNoteId(newNote.id)

    // Expand parent
    setCollapsedNotes((prev) => {
      const next = new Set(prev)
      next.delete(parentId)
      return next
    })

    if (targetDir) {
      // @ts-ignore
      window.api.saveNote(targetDir, initialFileName, newNote)
    }
  }

  // Toggle collapse/expand
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedNoteId(id)
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
    // Make the drag image slightly transparent
    if (e.target instanceof HTMLElement) {
      e.target.style.opacity = '0.5'
    }
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    if (dragTargetId !== id) {
      setDragTargetId(id)
    }
  }

  const handleDragLeave = (_e: React.DragEvent, id: string) => {
    if (dragTargetId === id) {
      setDragTargetId(null)
    }
  }

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.target instanceof HTMLElement) {
      e.target.style.opacity = '1'
    }
    setDraggedNoteId(null)
    setDragTargetId(null)
  }

  const handleDrop = (e: React.DragEvent, dropTargetId: string, itemType: string) => {
    e.preventDefault()
    setDragTargetId(null)

    if (itemType === 'project') return
    if (!draggedNoteId || draggedNoteId === dropTargetId) {
      handleDragEnd(e)
      return
    }

    const targetNote = notes.find(n => n.id === dropTargetId)
    if (!targetNote) return

    const actualParentId = targetNote.parentId
    const siblings = notes
      .filter(n => n.parentId === actualParentId && n.projectId === targetNote.projectId && n.id !== draggedNoteId)
      .sort((a, b) => {
        const diff = (a.order ?? 0) - (b.order ?? 0);
        if (diff !== 0) return diff;
        const aTime = a.createdAt || a.id.charCodeAt(0);
        const bTime = b.createdAt || b.id.charCodeAt(0);
        if (aTime !== bTime) return aTime - bTime;
        return a.id.localeCompare(b.id);
      })

    const targetIdx = siblings.findIndex(n => n.id === dropTargetId)
    siblings.splice(targetIdx + 1, 0, notes.find(n => n.id === draggedNoteId)!)

    const updatedNotes = siblings.map((sib, index) => ({
      ...sib,
      order: index * 10
    }))

    const draggedNote = updatedNotes.find(n => n.id === draggedNoteId)
    if (draggedNote) draggedNote.parentId = actualParentId

    setNotes(prev => prev.map(n => {
      const up = updatedNotes.find(u => u.id === n.id)
      return up ? up : n
    }))

    for (const up of updatedNotes) {
      handleUpdateNote(up.id, { order: up.order, parentId: up.parentId })
    }
    handleDragEnd(e)
  }

  const handleToggleCollapse = (noteId: string, e: React.MouseEvent): void => {
    e.stopPropagation()
    setCollapsedNotes((prev) => {
      const next = new Set(prev)
      if (next.has(noteId)) {
        next.delete(noteId)
      } else {
        next.add(noteId)
      }
      return next
    })
  }

  // Compute breadcrumbs for the active note
  const breadcrumbs = React.useMemo(() => {
    if (!activeNote || !activeNote.parentId) return []
    const crumbs: { id: string; title: string }[] = []
    let currentParentId: string | undefined = activeNote.parentId
    const visited = new Set<string>()
    while (currentParentId && !visited.has(currentParentId)) {
      visited.add(currentParentId)
      const parent = notes.find((n) => n.id === currentParentId)
      if (parent) {
        crumbs.unshift({ id: parent.id, title: parent.title || 'Untitled' })
        currentParentId = parent.parentId
      } else {
        break
      }
    }
    return crumbs
  }, [activeNote, notes])

  const extendedProjects = React.useMemo(() => [...projects], [projects])
  // trashProject is not needed here as it is handled by the projects state if it exists

  const handleDeleteNote = (id: string, e: React.MouseEvent): void => {
    e.stopPropagation()
    const noteToDelete = notes.find((n) => n.id === id)
    if (!noteToDelete) return
    const isBoard = noteToDelete.type === 'board'

    if (showTrash) {
      // Permanent Delete
      const updatedNotes = notes.filter((n) => n.id !== id)
      setNotes(updatedNotes)

      const targetDir = isBoard
        ? getBoardTargetDir(noteToDelete.projectId, true)
        : getNoteTargetDir(noteToDelete.projectId, true)
      if (targetDir) {
        const fileName = noteToDelete.fileName || getFileName(noteToDelete.title, id, isBoard ? 'board' : 'md')
        if (isBoard) {
          // @ts-ignore: Delete stable .board file
          window.api.deleteBoard(targetDir, fileName)
          // Also cleanup legacy .ibo if it exists (using id only)
          // @ts-ignore
          window.api.deleteBoard(targetDir, `${id}.ibo`)
        } else {
          // @ts-ignore: Delete stable .json file
          window.api.deleteNote(targetDir, fileName)
        }
      }
    } else {
      // Soft delete to Trash
      const pId =
        noteToDelete.projectId === 'trash' ? 'default' : noteToDelete.projectId || 'default'

      // Orphan direct children: set their parentId to undefined (move to root)
      const childNotes = notes.filter((n) => n.parentId === id)

      const updatedNotes = notes.map((n) => {
        if (n.id === id) {
          return { ...n, projectId: pId, isTrash: true, lastModified: Date.now() }
        }
        // Orphan children to root
        if (n.parentId === id) {
          return { ...n, parentId: undefined, lastModified: Date.now() }
        }
        return n
      })
      setNotes(updatedNotes)

      // Re-save orphaned children to disk with cleared parentId
      for (const child of childNotes) {
        const childIsBoard = child.type === 'board'
        const childDir = childIsBoard
          ? getBoardTargetDir(child.projectId, child.isTrash)
          : getNoteTargetDir(child.projectId, child.isTrash)
        if (childDir) {
          const childExt = childIsBoard ? 'board' : 'md'
          const childFileName = child.fileName || getFileName(child.title, child.id, childExt)
          const updatedChild = { ...child, parentId: undefined, lastModified: Date.now() }
          // @ts-ignore
          window.api.saveNote(childDir, childFileName, updatedChild)
        }
      }

      const oldDir = isBoard ? getBoardTargetDir(pId, false) : getNoteTargetDir(pId, false)
      const newDir = isBoard ? getBoardTargetDir(pId, true) : getNoteTargetDir(pId, true)

      if (oldDir && newDir) {
        const fileName = noteToDelete.fileName || getFileName(noteToDelete.title, id, isBoard ? 'board' : 'md')
        if (isBoard) {
          // @ts-ignore
          window.api.moveBoard(oldDir, newDir, fileName)
          // Also cleanup legacy .ibo if it exists
          // @ts-ignore
          window.api.moveBoard(oldDir, newDir, `${id}.ibo`)
        } else {
          // @ts-ignore: Move stable .md to trash
          window.api.moveNote(oldDir, newDir, fileName)
        }
      }
    }
  }

  const handleRestoreNote = (id: string, e: React.MouseEvent): void => {
    e.stopPropagation()
    const noteToRestore = notes.find((n) => n.id === id)
    if (!noteToRestore) return
    const pId =
      noteToRestore.projectId === 'trash' ? 'default' : noteToRestore.projectId || 'default'

    const updatedNotes = notes.map((n) =>
      n.id === id ? { ...n, projectId: pId, isTrash: false, lastModified: Date.now() } : n
    )
    setNotes(updatedNotes)

    const isBoard = noteToRestore.type === 'board'
    const oldDir = isBoard ? getBoardTargetDir(pId, true) : getNoteTargetDir(pId, true)
    const newDir = isBoard ? getBoardTargetDir(pId, false) : getNoteTargetDir(pId, false)

    if (oldDir && newDir) {
      const fileName = noteToRestore.fileName || getFileName(noteToRestore.title, id, isBoard ? 'board' : 'md')
      if (isBoard) {
        // @ts-ignore
        window.api.moveBoard(oldDir, newDir, fileName)
        // Also cleanup legacy .ibo if it exists
        // @ts-ignore
        window.api.moveBoard(oldDir, newDir, `${id}.ibo`)
      } else {
        // @ts-ignore: Restore stable json note
        window.api.moveNote(oldDir, newDir, fileName)
      }
    }
  }

  const handleTitleBlur = async (): Promise<void> => {
    setIsEditingTitle(false)
    if (!activeNoteId || !activeNote) return

    const isBoard = activeNote.type === 'board'
    const targetDir = isBoard
      ? getBoardTargetDir(activeNote.projectId, activeNote.isTrash)
      : getNoteTargetDir(activeNote.projectId, activeNote.isTrash)

    if (targetDir) {
      const ext = isBoard ? 'board' : 'md'
      const newFileName = getFileName(localTitle, activeNoteId, ext)
      // @ts-ignore
      const oldFileName = activeNote.fileName || getFileName(activeNote.title, activeNoteId, ext)

      if (oldFileName && oldFileName !== newFileName) {
        // Atomic Rename: old physically becomes new
        // @ts-ignore
        await window.api.renameNote(targetDir, oldFileName, newFileName)
      }

      // commit current local title and filename to the global state once
      setNotes(prev => prev.map(n => n.id === activeNoteId ? { ...n, fileName: newFileName, title: localTitle } : n))

      if (isBoard) {
        let boardPayload = boardContentRef.current[activeNoteId] || activeNote.content || '{}'
        try {
          const parsed = JSON.parse(boardPayload)
          boardPayload = JSON.stringify({
            ...parsed,
            id: activeNoteId,
            title: localTitle,
            projectId: activeNote.projectId,
            type: 'board'
          })
        } catch (e) { }

        // @ts-ignore
        const ok = await window.api.writeBoardJson(activeNoteId, boardPayload)
        // @ts-ignore
        if (ok) await window.api.packBoard(activeNoteId, targetDir, newFileName)
      } else {
        // @ts-ignore
        const noteToSave = { ...activeNote, title: localTitle, fileName: newFileName }
        // @ts-ignore
        await window.api.saveNote(targetDir, newFileName, noteToSave)
      }
    }
  }

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setLocalTitle(newTitle)
      // NO MORE setNotes here to prevent global re-renders while typing
    },
    []
  )

  const handleBoardChange = useCallback(
    (content: string): void => {
      if (!activeNote) return

      const noteId = activeNote.id

      // ── Step 1: Update in-memory state (temp file in memory) ──
      setBoardContent(prev => {
        const next = { ...prev, [noteId]: content }
        boardContentRef.current = next
        return next
      })
      setNotes((prev) =>
        prev.map((n) => {
          if (n.id === noteId) return { ...n, content, lastModified: Date.now() }
          return n
        })
      )

      // Mark as dirty: source file (.board) is now out of date
      boardIsDirtyRef.current[noteId] = true
      setSaveStatus('unsaved')

      // ── Step 2: Debounced write to temp file on disk (writeBoardJson only, NO packBoard) ──
      // This persists the working state to cache so it survives a crash.
      // The source .board file is updated only by autosave timer or manual save.
      if (saveTimers.current[noteId]) clearTimeout(saveTimers.current[noteId])
      saveTimers.current[noteId] = setTimeout(async () => {
        const currentNote = notesRef.current.find(n => n.id === noteId)
        if (!currentNote || currentNote.type !== 'board') {
          delete saveTimers.current[noteId]
          return
        }

        let boardPayload = boardContentRef.current[noteId] || content || '{}'
        try {
          const parsedContent = JSON.parse(boardPayload)
          boardPayload = JSON.stringify({
            ...parsedContent,
            id: currentNote.id,
            title: currentNote.title,
            projectId: currentNote.projectId,
            type: 'board'
          })
        } catch (e) { /* keep as-is */ }

        // Write to temp file (cache) only — source file NOT updated here
        // @ts-ignore
        await window.api.writeBoardJson(noteId, boardPayload)
        delete saveTimers.current[noteId]
      }, 500)
    },
    [activeNote, setNotes]
  )

  // Open board: unpack from .board archive into cache when switching to a board
  useEffect(() => {
    if (!activeNote || activeNote.type !== 'board') return
    const latestNote = notesRef.current.find(n => n.id === activeNote.id) || activeNote
    const note = latestNote
    const targetDir = getBoardTargetDir(note.projectId, note.isTrash)
    const fileName = note.fileName || getFileName(note.title, note.id, 'board')
    // @ts-ignore
    window.api.openBoard(targetDir, fileName, note.id).then((loaded: string | null) => {
      if (loaded) {
        setBoardContent(prev => ({ ...prev, [note.id]: loaded }))
        setNotes(prev => prev.map(n => n.id === note.id ? { ...n, content: loaded } : n))
      }
    })
  }, [activeNote?.id, activeNote?.fileName, activeNote?.title, activeNote?.projectId, activeNote?.isTrash, getBoardTargetDir])

  type FlattenedItem =
    | { type: 'project'; project: Project; level: number }
    | { type: 'note'; note: AppNote; project?: Project; level: number; hasChildren: boolean }

  const flattenedNotesList = React.useMemo(() => {
    if (filteredNotes.length === 0) return []

    if (activeProjectId === 'trash') {
      return filteredNotes
        .sort((a, b) => b.lastModified - a.lastModified)
        .map((note) => ({
          type: 'note' as const,
          note,
          project: extendedProjects.find((p) => p.id === note.projectId),
          level: 0,
          hasChildren: false
        }))
    }

    const result: FlattenedItem[] = []

    // Build note tree based on parentId
    const renderNoteTree = (parentId: string | undefined, level: number, project?: Project): void => {
      const children = filteredNotes
        .filter((n) => (parentId ? n.parentId === parentId : !n.parentId))
        .sort((a, b) => {
          const diff = (a.order ?? 0) - (b.order ?? 0);
          if (diff !== 0) return diff;
          const aTime = a.createdAt || a.id.charCodeAt(0);
          const bTime = b.createdAt || b.id.charCodeAt(0);
          if (aTime !== bTime) return aTime - bTime;
          return a.id.localeCompare(b.id);
        })

      for (const note of children) {
        const noteChildren = filteredNotes.filter((n) => n.parentId === note.id)
        const hasChildren = noteChildren.length > 0
        result.push({ type: 'note', note, project, level, hasChildren })

        // Only render children if this note is not collapsed
        if (hasChildren && !collapsedNotes.has(note.id)) {
          renderNoteTree(note.id, level + 1, project)
        }
      }
    }

    const traverse = (projectId: string | null, level: number, isRoot: boolean): void => {
      const project = extendedProjects.find((p) => p.id === projectId)
      const projectNotes = filteredNotes
        .filter((n) => (projectId === 'default' ? !n.projectId : n.projectId === projectId))

      const subprojects = project?.subprojects || []

      const hasNotesRecursively = (projId: string | null): boolean => {
        if (
          filteredNotes.some((n) => (projId === 'default' ? !n.projectId : n.projectId === projId))
        )
          return true
        const proj = extendedProjects.find((p) => p.id === projId)
        return (proj?.subprojects || []).some((sub) => hasNotesRecursively(sub.id))
      }

      if (projectNotes.length === 0 && subprojects.every((sub) => !hasNotesRecursively(sub.id))) {
        return
      }

      if (!isRoot && project && projectNotes.length > 0) {
        result.push({ type: 'project', project, level })
      }

      // Render root-level notes of this project as a tree
      const rootNotes = projectNotes
        .filter((n) => !n.parentId)
        .sort((a, b) => {
          const diff = (a.order ?? 0) - (b.order ?? 0);
          if (diff !== 0) return diff;
          const aTime = a.createdAt || a.id.charCodeAt(0);
          const bTime = b.createdAt || b.id.charCodeAt(0);
          if (aTime !== bTime) return aTime - bTime;
          return a.id.localeCompare(b.id);
        })

      for (const note of rootNotes) {
        const noteChildren = filteredNotes.filter((n) => n.parentId === note.id)
        const hasChildren = noteChildren.length > 0
        result.push({ type: 'note', note, project, level, hasChildren })

        if (hasChildren && !collapsedNotes.has(note.id)) {
          renderNoteTree(note.id, level + 1, project)
        }
      }

      for (const sub of subprojects) {
        traverse(sub.id, isRoot ? 0 : level + 1, false)
      }
    }

    traverse(activeProjectId, 0, true)
    return result
  }, [filteredNotes, activeProjectId, extendedProjects, collapsedNotes])

  // Sync state to parent toolbar
  useEffect(() => { onSaveStatusChange?.(saveStatus) }, [saveStatus, onSaveStatusChange])
  useEffect(() => { onSidebarChange?.(showSidebar) }, [showSidebar, onSidebarChange])
  useEffect(() => { onActiveNoteTypeChange?.(activeNote?.type ?? null) }, [activeNote?.type, onActiveNoteTypeChange])

  // Expose toolbar actions to parent via mutable ref
  useEffect(() => {
    if (!notesToolbarActionsRef) return
    notesToolbarActionsRef.current = {
      getSaveStatus: () => saveStatus,
      getSidebarOpen: () => showSidebar,
      getActiveNoteType: () => activeNote?.type ?? null,
      manualSave: handleManualSave,
      toggleSidebar: () => setShowSidebar(prev => !prev),
      openHistory: (rect: DOMRect) => {
        setShowBoardVersionsDropdown(false)
        setBoardVersionsMenuPos(null)
        if (showHistoryDropdown) {
          setShowHistoryDropdown(false)
          setBoardHistoryMenuPos(null)
          return
        }
        setBoardHistoryMenuPos({ top: rect.bottom + 8, left: rect.left })
        handleLoadHistory()
      },
      openBoardHistory: (rect: DOMRect) => {
        setShowBoardVersionsDropdown(false)
        setBoardVersionsMenuPos(null)
        if (showHistoryDropdown) {
          setShowHistoryDropdown(false)
          setBoardHistoryMenuPos(null)
          return
        }
        setBoardHistoryMenuPos({ top: rect.bottom + 8, left: rect.left })
        handleLoadHistory()
      },
      openBoardVersions: (rect: DOMRect) => {
        setShowHistoryDropdown(false)
        setBoardHistoryMenuPos(null)
        if (showBoardVersionsDropdown) {
          setShowBoardVersionsDropdown(false)
          setBoardVersionsMenuPos(null)
          return
        }
        setBoardVersionsMenuPos({ top: rect.bottom + 8, left: rect.left })
        handleLoadBoardVersions()
      }
    }
  }) // no deps — always keep ref current

  return (
    <>
      <div
        className="notes-view-container"
        style={{
          display: 'flex',
          height: '100%',
          width: '100%',
          overflow: 'hidden',
          padding: 0,
          background: 'var(--card-bg)',
          ['--note-project-accent' as any]: activeNoteProjectColor
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'row-reverse',
            flex: 1,
            overflow: 'hidden'
          }}
        >
          <style>{`
        .tiptap-editor {
          flex: 1;
          padding: 0 0 32px !important;
          line-height: 1.6;
          color: var(--text-primary);
          max-width: 700px;
          margin: 0 auto;
          width: 100%;
          outline: none;
        }
        .tiptap-editor p.is-editor-empty:first-child::before {
          color: rgba(255,255,255,0.2);
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
          font-style: normal;
        }
        .centered-container {
          max-width: 700px;
          margin: 0 auto;
          width: 100%;
          display: flex;
          align-items: center;
          position: relative;
        }
        .toolbar-scroll-container::-webkit-scrollbar {
          display: none;
        }
        .toolbar-scroll-container {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .document-guide {
          position: absolute;
          top: -100vh;
          bottom: -100vh;
          width: 1px;
          background: rgba(255,255,255,0.03);
          pointer-events: none;
          z-index: 10;
        }
        .document-guide-left {
          left: -20px;
        }
        .document-guide-right {
          right: -20px;
        }
        .tiptap-editor p {
          margin-bottom: 0.5em;
        }
        .tiptap-editor h1, .tiptap-editor h2, .tiptap-editor h3 {
          color: var(--text-primary);
          margin-top: 1em;
          margin-bottom: 0.5em;
          font-weight: 600;
        }
        .tiptap-editor ul, .tiptap-editor ol {
          padding-left: 1.5em;
        }
        .tiptap-editor ul[data-type="taskList"] {
          list-style: none;
          padding-left: 0;
        }
        .tiptap-editor ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }
        .tiptap-editor ul[data-type="taskList"] li label {
          flex-shrink: 0;
          margin-top: 3px;
        }
        .tiptap-editor ul[data-type="taskList"] li input[type="checkbox"] {
          accent-color: var(--accent-primary, #7c5cbf);
          cursor: pointer;
        }
        .tiptap-editor hr {
          border: none;
          border-top: 1px solid rgba(255,255,255,0.1);
          margin: 1em 0;
        }
        .tiptap-editor a.tiptap-link {
          color: #8e8e8e;
          text-decoration: underline;
          text-decoration-color: color-mix(in srgb, #8e8e8e 60%, transparent);
          text-underline-offset: 3px;
          cursor: text;
          pointer-events: none; /* Links are inert unless Ctrl/Cmd is held */
          transition: color 0.15s, text-decoration-color 0.15s, opacity 0.15s;
          border-radius: 2px;
          position: relative;
        }
        /* When Ctrl is held anywhere in the editor — links become clickable */
        .ctrl-held .tiptap-editor a.tiptap-link,
        .tiptap-editor.ctrl-held a.tiptap-link {
          cursor: pointer !important;
          pointer-events: auto !important;
          text-decoration-color: #8e8e8e !important;
          opacity: 0.85;
        }
        .ctrl-held .tiptap-editor a.tiptap-link:hover,
        .tiptap-editor.ctrl-held a.tiptap-link:hover {
          opacity: 1;
          text-decoration-color: var(--note-project-accent, var(--accent, #9ba8f0)) !important;
          color: var(--note-project-accent, var(--accent, #9ba8f0));
        }
        .tiptap-editor img.tiptap-image {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 1em 0;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .tiptap-editor img.tiptap-image.ProseMirror-selectednode {
          outline: 2px solid #8e8e8e;
        }
        /* Link dialog overlay */
        .link-dialog-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.55);
          backdrop-filter: blur(4px);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .link-dialog-box {
          background: var(--card-bg, #1e1e2e);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 12px;
          padding: 24px;
          width: 480px;
          max-width: 90vw;
          box-shadow: 0 24px 64px rgba(0,0,0,0.7);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .link-dialog-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .link-dialog-input-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .link-dialog-input {
          flex: 1;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 8px;
          color: var(--text-primary);
          font-size: 13px;
          padding: 10px 14px;
          outline: none;
          transition: border-color 0.2s;
          font-family: inherit;
        }
        .link-dialog-input:focus {
          border-color: var(--accent-primary, #7c8bdc);
          background: rgba(255,255,255,0.07);
        }
        .link-dialog-hint {
          font-size: 11px;
          color: var(--text-secondary);
          opacity: 0.7;
          line-height: 1.5;
        }
        .link-dialog-actions {
          display: flex;
          gap: 8px;
          justifyContent: flex-end;
        }
        .link-btn-secondary {
          padding: 8px 16px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.12);
          background: transparent;
          color: var(--text-primary);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }
        .link-btn-secondary:hover {
          background: rgba(255,255,255,0.06);
        }
        .link-btn-primary {
          padding: 8px 20px;
          border-radius: 8px;
          border: none;
          background: var(--accent-primary, #7c8bdc);
          color: white;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }
        .link-btn-primary:hover {
          opacity: 0.85;
        }
        .link-btn-browse {
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          color: var(--text-secondary);
          font-size: 12px;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
          font-family: inherit;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .link-btn-browse:hover {
          background: rgba(255,255,255,0.08);
          color: var(--text-primary);
        }
      `}</style>
          {/* Sidebar list */}
          <div
            style={{
              width: showSidebar ? '280px' : '0px',
              minWidth: showSidebar ? '280px' : '0px',
              overflow: 'hidden',
              borderLeft: showSidebar ? '1px solid rgba(255,255,255,0.06)' : 'none',
              transition: 'width 0.25s ease, min-width 0.25s ease'
            }}
          >
            <div
              style={{
                width: '280px',
                minWidth: '280px',
                display: 'flex',
                flexDirection: 'column',
                height: '100%'
              }}
            >
              <div
                style={{
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    width: '100%'
                  }}
                >
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => handleCreateNote('markdown')}
                      className="icon-btn"
                      title="New Text Note"
                      style={{
                        padding: '4px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <FileText size={16} />
                    </button>
                    <button
                      onClick={() => handleCreateNote('board')}
                      className="icon-btn"
                      title="New Board"
                      style={{
                        padding: '4px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Presentation size={16} />
                    </button>
                  </div>

                  <button
                    onClick={() => setShowTrash(!showTrash)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      background: showTrash ? '#ef444433' : 'rgba(255,255,255,0.03)',
                      color: showTrash ? '#ef4444' : 'var(--text-secondary)',
                      border: showTrash ? '1px solid #ef444455' : '1px solid transparent',
                      fontSize: '11px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    🗑 Trash
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, paddingTop: '4px' }}>
                {filteredNotes.length === 0 ? (
                  <div
                    style={{
                      padding: '24px',
                      textAlign: 'center',
                      color: 'var(--text-secondary)',
                      fontSize: '13px'
                    }}
                  >
                    No notes yet. Click + to create one.
                  </div>
                ) : (
                  <Virtuoso
                    className="custom-scrollbar"
                    style={{ flex: 1 }}
                    data={flattenedNotesList}
                    itemContent={(index, item) => {
                      if (item.type === 'project') {
                        const { project, level } = item
                        return (
                          <div
                            style={{
                              fontSize: '11px',
                              textTransform: 'uppercase',
                              color: project.color || 'var(--text-secondary)',
                              marginTop: index === 0 ? '4px' : '8px',
                              marginBottom: '8px',
                              paddingLeft: `${12 + level * 12}px`,
                              opacity: 0.8,
                              fontWeight: 600,
                              letterSpacing: '0.05em',
                              borderTop: index === 0 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                              paddingTop: index === 0 ? '0px' : '8px'
                            }}
                          >
                            {project.name}
                          </div>
                        )
                      } else {
                        const { note, project, level, hasChildren } = item
                        const isActive = activeNoteId === note.id
                        const projectColor = project?.color || 'var(--accent)'
                        const renderLevel = activeProjectId === 'trash' ? 0 : level
                        const isCollapsed = collapsedNotes.has(note.id)
                        const isTextNote = note.type !== 'board'

                        return (
                          <div
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, note.id)}
                            onDragOver={(e) => handleDragOver(e, note.id)}
                            onDragLeave={(e) => handleDragLeave(e, note.id)}
                            onDragEnd={handleDragEnd}
                            onDrop={(e) => handleDrop(e, note.id, 'note')}
                            onClick={() => setActiveNoteId(note.id)}
                            onContextMenu={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setSidebarContextMenu({
                                x: e.clientX,
                                y: e.clientY,
                                note
                              })
                            }}
                            style={{
                              margin: '0 4px',
                              borderRadius: '6px',
                              padding: `4px 12px 4px ${12 + renderLevel * 12}px`,
                              borderBottom: dragTargetId === note.id ? '2px solid var(--accent)' : '1px solid transparent',
                              background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.15s',
                              position: 'relative'
                            }}
                          >
                            {/* Toggle arrow for notes with children */}
                            {hasChildren ? (
                              <button
                                onClick={(e) => handleToggleCollapse(note.id, e)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--text-secondary)',
                                  cursor: 'pointer',
                                  padding: '0px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '16px',
                                  height: '16px',
                                  flexShrink: 0,
                                  opacity: 0.5,
                                  transition: 'transform 0.15s, opacity 0.15s'
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
                              >
                                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                              </button>
                            ) : (
                              <div style={{ width: '16px', flexShrink: 0 }} />
                            )}
                            {note.type === 'board' ? (
                              <Pencil
                                size={14}
                                color={isActive ? projectColor : 'var(--text-secondary)'}
                                style={{ opacity: isActive ? 1 : 0.4, flexShrink: 0 }}
                              />
                            ) : (
                              <FileText
                                size={14}
                                color={isActive ? projectColor : 'var(--text-secondary)'}
                                style={{ opacity: isActive ? 1 : 0.4, flexShrink: 0 }}
                              />
                            )}
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                              <div
                                style={{
                                  fontSize: '13px',
                                  fontWeight: isActive ? 600 : 400,
                                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {note.title || 'Untitled Note'}
                              </div>
                            </div>
                            {/* Action buttons */}
                            {isActive && !showTrash && (
                              <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                                {/* Create child note (only for text notes) */}
                                {isTextNote && (
                                  <button
                                    onClick={(e) => handleCreateChildNote(note.id, e)}
                                    title="Create sub-note"
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: 'var(--text-secondary)',
                                      cursor: 'pointer',
                                      padding: '2px',
                                      opacity: 0.5,
                                      borderRadius: 'var(--radius-sm)',
                                      transition: 'opacity 0.2s',
                                      display: 'flex',
                                      alignItems: 'center'
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
                                  >
                                    <Plus size={14} />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => handleDeleteNote(note.id, e)}
                                  title="Move to Trash"
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    padding: '2px',
                                    opacity: 0.5,
                                    borderRadius: 'var(--radius-sm)',
                                    transition: 'opacity 0.2s',
                                    display: 'flex',
                                    alignItems: 'center'
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                            {isActive && showTrash && (
                              <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                                <button
                                  onClick={(e) => handleRestoreNote(note.id, e)}
                                  title="Restore Note"
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    padding: '2px',
                                    opacity: 0.7,
                                    borderRadius: 'var(--radius-sm)',
                                    transition: 'opacity 0.2s',
                                    display: 'flex',
                                    alignItems: 'center'
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
                                >
                                  <Plus size={14} />
                                </button>
                                <button
                                  onClick={(e) => handleDeleteNote(note.id, e)}
                                  title="Permanent Delete"
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    padding: '2px',
                                    opacity: 0.7,
                                    borderRadius: 'var(--radius-sm)',
                                    transition: 'opacity 0.2s',
                                    display: 'flex',
                                    alignItems: 'center'
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      }
                    }}
                  />
                )}
              </div>
              <div
                style={{
                  padding: '10px 12px',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  gap: '4px',
                  justifyContent: 'flex-start'
                }}
              >
                <button
                  onClick={handleImportFile}
                  className="icon-btn"
                  style={{
                    padding: '4px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '24px',
                    height: '24px'
                  }}
                  title="Загрузить текстовый файл как заметку"
                >
                  <FileText size={14} />
                </button>
                <button
                  onClick={handleImportBoard}
                  className="icon-btn"
                  style={{
                    padding: '4px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '24px',
                    height: '24px'
                  }}
                  title="Загрузить файл доски (.board/.ibo/.zip)"
                >
                  <Presentation size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div
            style={{
              flex: 1,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {activeNote ? (
              <>
                {activeNote.type === 'board' ? (
                  <>
                    <div
                      style={{
                        padding: '0 10px',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'transparent',
                        height: '45px',
                        boxSizing: 'border-box',
                        gap: '8px'
                      }}
                    >
                      <button
                        onClick={() => setCurrentView('overview')}
                        title="Back to Project"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 'var(--radius-sm)',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                          e.currentTarget.style.color = 'var(--text-primary)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.color = 'var(--text-secondary)'
                        }}
                      >
                        <ArrowLeft size={18} />
                      </button>
                      <input
                        type="text"
                        value={localTitle}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        onBlur={handleTitleBlur}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as any).blur() }}
                        onFocus={() => setIsEditingTitle(true)}
                        readOnly={!isEditingTitle}
                        placeholder="Board Title"
                        style={{
                          flex: 1,
                          fontSize: '14px',
                          fontWeight: 400,
                          background: isEditingTitle ? 'rgba(255,255,255,0.03)' : 'transparent',
                          border: 'none',
                          color: 'var(--text-primary)',
                          outline: 'none',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          cursor: isEditingTitle ? 'text' : 'pointer'
                        }}
                      />
                      {/* History dropdown portal (trigger moved to App toolbar) */}
                      {showHistoryDropdown && boardHistoryMenuPos && (
                          <div data-history-menu-root="true" style={{
                            position: 'fixed',
                            top: `${boardHistoryMenuPos.top}px`,
                            left: `${boardHistoryMenuPos.left}px`,
                            zIndex: 2147483000,
                            background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 'var(--radius-md)', padding: '8px', minWidth: '220px',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.7)'
                          }}>
                            <div style={{ padding: '0 4px 6px', fontSize: '11px', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '4px' }}>Board Backup History</div>
                            {historyList.length === 0 ? (
                              <div style={{ padding: '8px 4px', fontSize: '12px', color: 'var(--text-secondary)' }}>No backups yet.</div>
                            ) : (
                              <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {historyList.map((h, i) => {
                                  const dt = new Date(h.timestamp)
                                  const dateStr = dt.toLocaleDateString()
                                  const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '2px' }} className="file-item-hover">
                                      <button onClick={() => handlePreviewHistory(h)} style={{
                                        flex: 1, padding: '6px 8px', fontSize: '12px', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px',
                                        background: 'transparent', border: 'none', color: 'var(--text-primary)', textAlign: 'left', outline: 'none'
                                      }}>
                                        <RotateCcw size={12} color="var(--text-secondary)" />
                                        <span style={{ flex: 1 }}>{dateStr} <span style={{ opacity: 0.6 }}>{timeStr}</span></span>
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleDeleteBackup(h)
                                        }}
                                        title="Delete backup"
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          color: 'rgba(255,255,255,0.2)',
                                          padding: '6px',
                                          cursor: 'pointer',
                                          borderRadius: '4px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center'
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                                        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )}

                      {/* Board Versions dropdown portal (trigger moved to App toolbar) */}
                      {showBoardVersionsDropdown && boardVersionsMenuPos && (
                           <div
                             data-versions-menu-root="true"
                             style={{
                             position: 'fixed',
                             top: `${boardVersionsMenuPos.top}px`,
                             left: `${boardVersionsMenuPos.left}px`,
                             zIndex: 2147483000,
                            background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 'var(--radius-md)', padding: '8px', minWidth: '240px',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.7)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 6px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '8px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>VERSIONS</span>
                              <button
                                onClick={handleAddBoardSave}
                                style={{
                                  background: 'var(--accent)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '2px 8px',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                ADD SAVE
                              </button>
                            </div>

                            {boardVersions.length === 0 ? (
                              <div style={{ padding: '8px 4px', fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>No versions yet.</div>
                            ) : (
                              <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {boardVersions.map((v, i) => {
                                  const dt = new Date(v.mtime)
                                  const dateStr = dt.toLocaleDateString()
                                  const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  return (
                                    <div
                                      key={i}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '2px 4px',
                                        borderRadius: '4px',
                                        background: 'rgba(255,255,255,0.03)'
                                      }}
                                    >
                                      <button
                                        onClick={() => {
                                          handleRestoreBoardVersion(v.path)
                                        }}
                                        style={{
                                          flex: 1,
                                          padding: '6px 8px',
                                          fontSize: '12px',
                                          cursor: 'pointer',
                                          borderRadius: '4px',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          background: 'transparent',
                                          border: 'none',
                                          color: 'var(--text-primary)',
                                          textAlign: 'left',
                                          outline: 'none'
                                        }}
                                        className="file-item-hover"
                                      >
                                        <span style={{ fontWeight: 600 }}>{v.name}</span>
                                        <span style={{ fontSize: '10px', opacity: 0.5 }}>{dateStr} {timeStr}</span>
                                      </button>

                                      <button
                                        onClick={() => handleRestoreBoardVersion(v.path)}
                                        title="Restore this version as main"
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          color: 'var(--text-secondary)',
                                          padding: '6px',
                                          cursor: 'pointer',
                                          borderRadius: '4px'
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                                      >
                                        <RotateCcw size={14} />
                                      </button>

                                      <button
                                        onClick={() => handleDeleteBoardVersion(v.path)}
                                        title="Delete version"
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          color: 'rgba(255,255,255,0.2)',
                                          padding: '6px',
                                          cursor: 'pointer',
                                          borderRadius: '4px'
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                                        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                        width: '100%',
                        overflow: 'hidden',
                        position: 'relative'
                      }}
                    >
                      <BoardsView
                        key={activeNote.id}
                        boardData={boardContent[activeNote.id] ?? activeNote.content}
                        onChange={handleBoardChange}
                        theme={theme}
                        setTheme={setTheme}
                        showFPS={showFPS}
                        isSidebarOpen={showSidebar}
                        boardId={activeNote.id}
                        boardDir={getBoardTargetDir(activeNote.projectId, activeNote.isTrash)}
                        boardFileName={activeNote.fileName || getFileName(activeNote.title, activeNote.id, 'board')}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        background: 'transparent',
                        overflowY: 'scroll',
                        position: 'relative',
                        padding: '15px'
                      }}
                    >
                      <div
                        className="centered-container"
                        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                      >
                        {/* Breadcrumbs & Action Bar */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            padding: '8px 0 4px',
                            minHeight: '32px',
                            gap: '12px'
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              flexWrap: 'wrap',
                              flex: 1
                            }}
                          >
                            <button
                              onClick={() => setCurrentView('overview')}
                              title="Back to Project"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 'var(--radius-sm)',
                                transition: 'all 0.2s',
                                opacity: 0.6
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                                e.currentTarget.style.color = 'var(--text-primary)'
                                e.currentTarget.style.opacity = '1'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent'
                                e.currentTarget.style.color = 'var(--text-secondary)'
                                e.currentTarget.style.opacity = '0.6'
                              }}
                            >
                              <ArrowLeft size={16} />
                            </button>

                            {breadcrumbs.map((crumb) => (
                              <React.Fragment key={crumb.id}>
                                <button
                                  onClick={() => setActiveNoteId(crumb.id)}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    padding: '2px 4px',
                                    borderRadius: '4px',
                                    transition: 'all 0.15s',
                                    opacity: 0.7,
                                    maxWidth: '150px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                                    e.currentTarget.style.opacity = '1'
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent'
                                    e.currentTarget.style.opacity = '0.7'
                                  }}
                                >
                                  {crumb.title}
                                </button>
                                <span style={{ color: 'var(--text-secondary)', opacity: 0.4, fontSize: '12px' }}>/</span>
                              </React.Fragment>
                            ))}
                            <span style={{ color: 'var(--text-secondary)', opacity: 0.9, fontSize: '12px', padding: '2px 4px' }}>
                              {localTitle || 'Untitled'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {/* History dropdown portal (trigger moved to App toolbar) */}
                            {showHistoryDropdown && boardHistoryMenuPos && (
                              <div
                                data-history-menu-root="true"
                                style={{
                                  position: 'fixed',
                                  top: `${boardHistoryMenuPos.top}px`,
                                  left: `${boardHistoryMenuPos.left}px`,
                                  zIndex: 2147483000,
                                  background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.1)',
                                  borderRadius: 'var(--radius-md)', padding: '8px', minWidth: '220px',
                                  boxShadow: '0 8px 32px rgba(0,0,0,0.7)'
                                }}>
                                <div style={{ padding: '0 4px 6px', fontSize: '11px', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '4px' }}>Version History</div>
                                {historyList.length === 0 ? (
                                  <div style={{ padding: '8px 4px', fontSize: '12px', color: 'var(--text-secondary)' }}>No backups yet.</div>
                                ) : (
                                  <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    {historyList.map((h, i) => {
                                      const dt = new Date(h.timestamp)
                                      const dateStr = dt.toLocaleDateString()
                                      const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                      return (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '2px' }} className="file-item-hover">
                                          <button onClick={() => handlePreviewHistory(h)} style={{
                                            flex: 1, padding: '6px 8px', fontSize: '12px', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px',
                                            background: 'transparent', border: 'none', color: 'var(--text-primary)', textAlign: 'left', outline: 'none'
                                          }}>
                                            <RotateCcw size={12} color="var(--text-secondary)" />
                                            <span style={{ flex: 1 }}>{dateStr} <span style={{ opacity: 0.6 }}>{timeStr}</span></span>
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleDeleteBackup(h)
                                            }}
                                            title="Delete backup"
                                            style={{
                                              background: 'transparent',
                                              border: 'none',
                                              color: 'rgba(255,255,255,0.2)',
                                              padding: '6px',
                                              cursor: 'pointer',
                                              borderRadius: '4px',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center'
                                            }}
                                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                                            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )}

                            {activeNote.createdAt && (
                              <div
                                style={{
                                  color: 'var(--text-secondary)',
                                  opacity: 0.5,
                                  fontSize: '11px',
                                  padding: '2px 4px',
                                  marginLeft: '4px'
                                }}
                              >
                                {new Date(activeNote.createdAt).toLocaleDateString(undefined, {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        <input
                          type="text"
                          value={localTitle}
                          onChange={(e) => handleTitleChange(e.target.value)}
                          onBlur={handleTitleBlur}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as any).blur() }}
                          onFocus={() => setIsEditingTitle(true)}
                          readOnly={!isEditingTitle}
                          placeholder="Note Title"
                          style={{
                            width: '100%',
                            fontSize: '32px',
                            fontWeight: 600,
                            background: isEditingTitle ? 'rgba(255,255,255,0.03)' : 'transparent',
                            border: 'none',
                            color: 'var(--text-primary)',
                            outline: 'none',
                            padding: '4px 8px',
                            borderRadius: '8px',
                            cursor: isEditingTitle ? 'text' : 'pointer',
                            transition: 'background 0.2s',
                            lineHeight: 1.3
                          }}
                        />
                        <div
                          style={{
                            width: '100%',
                            height: '2px',
                            background: 'rgba(255,255,255,0.08)',
                            marginBottom: '0px'
                          }}
                        />
                        {/* Children links */}
                        {(() => {
                          const childNotes = notes.filter(
                            (n) => n.parentId === activeNote.id && !n.isTrash && n.projectId !== 'trash'
                          ).sort((a, b) => (a.createdAt || a.lastModified) - (b.createdAt || b.lastModified))
                          if (childNotes.length === 0) return <div style={{ marginBottom: '16px' }} />
                          return (
                            <>
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'flex-start',
                                  width: '100%',
                                  gap: '4px',
                                  padding: '10px 0'
                                }}
                              >
                                {childNotes.map((child) => (
                                  <button
                                    key={child.id}
                                    onClick={() => setActiveNoteId(child.id)}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      background: 'rgba(255,255,255,0.04)',
                                      border: '1px solid rgba(255,255,255,0.06)',
                                      borderRadius: '6px',
                                      color: 'var(--text-secondary)',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      padding: '4px 10px',
                                      transition: 'all 0.15s',
                                      textDecoration: 'none',
                                      maxWidth: '200px',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                                      e.currentTarget.style.color = 'var(--text-primary)'
                                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                                      e.currentTarget.style.color = 'var(--text-secondary)'
                                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                                    }}
                                  >
                                    <FileText size={12} style={{ flexShrink: 0, opacity: 0.6 }} />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {child.title || 'Untitled'}
                                    </span>
                                  </button>
                                ))}
                              </div>
                              <div
                                style={{
                                  width: '100%',
                                  height: '2px',
                                  background: 'rgba(255,255,255,0.08)',
                                  marginBottom: '16px'
                                }}
                              />
                            </>
                          )
                        })()}

                        {isPreviewMode && (
                          <div style={{
                            background: 'rgba(120, 120, 120, 0.1)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-md)',
                            padding: '10px 14px', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <RotateCcw size={16} color="var(--accent)" />
                              <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>Previewing History Version</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={handleCancelPreview} style={{
                                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)',
                                padding: '6px 12px', borderRadius: 'var(--radius-md)', fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s'
                              }}>Cancel</button>
                              <button onClick={handleRestorePreview} style={{
                                background: 'var(--accent)', border: 'none', color: 'white',
                                padding: '6px 12px', borderRadius: 'var(--radius-md)', fontSize: '12px', cursor: 'pointer', fontWeight: 500, transition: 'all 0.2s'
                              }}>Restore this version</button>
                            </div>
                          </div>
                        )}

                        {editor && !isPreviewMode && (
                          <BubbleMenu
                            editor={editor}
                            shouldShow={({ editor: bubbleEditor }) => {
                              if (!bubbleEditor?.isEditable || !showBubbleMenu) return false
                              const { from, to } = bubbleEditor.state.selection
                              return from !== to
                            }}
                          >
                            <div
                              style={{
                                background: 'rgba(18,18,18,0.92)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '12px',
                                padding: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px',
                                backdropFilter: 'blur(14px)',
                                boxShadow: '0 8px 26px rgba(0,0,0,0.45)'
                              }}
                            >
                              <button title="Bold" onClick={() => applyFormatting('bold')} style={floatingBtnStyle(editor.isActive('bold'))}>
                                <Bold size={14} />
                              </button>
                              <button title="Italic" onClick={() => applyFormatting('italic')} style={floatingBtnStyle(editor.isActive('italic'))}>
                                <Italic size={14} />
                              </button>
                              <button title="Underline" onClick={() => applyFormatting('underline')} style={floatingBtnStyle(editor.isActive('underline'))}>
                                <Underline size={14} />
                              </button>
                              <button title="Strikethrough" onClick={() => applyFormatting('strikethrough')} style={floatingBtnStyle(editor.isActive('strike'))}>
                                <Strikethrough size={14} />
                              </button>

                              <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />

                              <button
                                title="Text Color"
                                onClick={(e) => setTextColorPickerRect((e.currentTarget as HTMLButtonElement).getBoundingClientRect())}
                                style={floatingBtnStyle(!!editor.getAttributes('textStyle')?.color)}
                              >
                                <Palette size={14} />
                              </button>
                              <button title="Clear Formatting" onClick={() => applyFormatting('clear')} style={floatingBtnStyle(false)}>
                                <Eraser size={14} />
                              </button>

                              <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />

                              <button title="Heading 1" onClick={() => applyFormatting('h1')} style={floatingBtnStyle(editor.isActive('heading', { level: 1 }))}>
                                <Heading1 size={14} />
                              </button>
                              <button title="Heading 2" onClick={() => applyFormatting('h2')} style={floatingBtnStyle(editor.isActive('heading', { level: 2 }))}>
                                <Heading2 size={14} />
                              </button>
                              <button title="Heading 3" onClick={() => applyFormatting('h3')} style={floatingBtnStyle(editor.isActive('heading', { level: 3 }))}>
                                <Heading3 size={14} />
                              </button>

                              <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />

                              <button title="Bullet List" onClick={() => applyFormatting('list')} style={floatingBtnStyle(editor.isActive('bulletList'))}>
                                <List size={14} />
                              </button>
                              <button title="Task List" onClick={() => applyFormatting('task')} style={floatingBtnStyle(editor.isActive('taskList'))}>
                                <ListTodo size={14} />
                              </button>
                              <button title="Separator" onClick={() => applyFormatting('separator')} style={floatingBtnStyle(false)}>
                                <Minus size={14} />
                              </button>

                              <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />

                              <button title="Insert Link (Ctrl+K)" onClick={handleOpenLinkDialog} style={floatingBtnStyle(editor.isActive('link'))}>
                                <Link2 size={14} />
                              </button>
                              <button
                                title="Remove Link"
                                onClick={handleUnlink}
                                disabled={!editor?.isActive('link')}
                                style={floatingBtnStyle(false)}
                              >
                                <Unlink size={14} style={{ opacity: editor?.isActive('link') ? 1 : 0.5 }} />
                              </button>
                              <button title="Insert Image" onClick={handleInsertImage} style={floatingBtnStyle(false)}>
                                <ImageIcon size={14} />
                              </button>
                            </div>
                          </BubbleMenu>
                        )}

                        <EditorContent
                          editor={editor}
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            width: '100%'
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  position: 'relative'
                }}
              >
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-secondary)'
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <FileText
                      size={48}
                      style={{ opacity: 0.2, marginBottom: '16px', margin: '0 auto' }}
                    />
                    <div>Select a note or create a new one</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Text Color Picker Popup */}
      {textColorPickerRect && (
        <ColorPicker
          color="#ffffff"
          onChange={(color) => applyFormatting('color', color)}
          onClose={() => setTextColorPickerRect(null)}
          anchorRect={textColorPickerRect}
        />
      )}

      {/* Link Insert Dialog */}
      {linkDialog?.open && (
        <div
          className="link-dialog-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setLinkDialog(null) }}
        >
          <div className="link-dialog-box">
            <div className="link-dialog-title">
              <Link2 size={16} style={{ opacity: 0.8 }} />
              Insert Link
            </div>

            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>
                URL or File Path
              </div>
              <div className="link-dialog-input-row">
                <input
                  autoFocus
                  className="link-dialog-input"
                  type="text"
                  placeholder="https://example.com  or  C:\Users\...\file.pdf"
                  value={linkDialogUrl}
                  onChange={(e) => setLinkDialogUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleApplyLink(linkDialogUrl)
                    if (e.key === 'Escape') setLinkDialog(null)
                  }}
                />
                <button className="link-btn-browse" onClick={handleBrowseFile}>
                  <FolderOpen size={13} />
                  File
                </button>
                <button className="link-btn-browse" onClick={handleBrowseFolder}>
                  <Folder size={13} />
                  Folder
                </button>
              </div>
            </div>

            <div className="link-dialog-hint">
              <ExternalLink size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
              Web links (https://...) open in the browser. Local file paths open with the default app.
            </div>

            <div className="link-dialog-actions">
              {linkDialog.initialUrl && (
                <button
                  className="link-btn-secondary"
                  style={{ marginRight: 'auto', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                  onClick={() => handleApplyLink('')}
                >
                  Remove Link
                </button>
              )}
              <button className="link-btn-secondary" onClick={() => setLinkDialog(null)}>
                Cancel
              </button>
              <button className="link-btn-primary" onClick={() => handleApplyLink(linkDialogUrl)}>
                Insert
              </button>
            </div>
          </div>
        </div>
      )}

      {sidebarContextMenu && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9999 }}
            onClick={(e) => {
              e.stopPropagation()
              setSidebarContextMenu(null)
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              setSidebarContextMenu(null)
            }}
          />
          <div
            style={{
              position: 'fixed',
              left: sidebarContextMenu.x,
              top: sidebarContextMenu.y,
              zIndex: 10000,
              background: 'var(--card-bg)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '6px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              minWidth: '160px'
            }}
          >
            <button
              onClick={() => {
                const { note } = sidebarContextMenu
                const targetDir = note.type === 'board'
                  ? getBoardTargetDir(note.projectId, note.isTrash)
                  : getNoteTargetDir(note.projectId, note.isTrash)
                if (targetDir) {
                  // @ts-ignore
                  window.api.openPath(targetDir)
                }
                setSidebarContextMenu(null)
              }}
              className="file-item-hover"
              style={{
                width: '100%',
                padding: '6px 10px',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                borderRadius: '4px'
              }}
            >
              <FolderOpen size={14} />
              Open Folder
            </button>
          </div>
        </>
      )}

      <AnimatePresence>
        {confirmDialog.isOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 2147483647,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              background: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(4px)'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{
                width: '100%',
                maxWidth: '400px',
                background: 'var(--card-bg, #1e1e1e)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '2px',
                  background: 'linear-gradient(90deg, transparent, var(--accent, #7c5cbf), transparent)'
                }}
              />

              <h3
                style={{
                  margin: '0 0 12px 0',
                  fontSize: '18px',
                  fontWeight: 600,
                  color: 'var(--text-primary, #fff)'
                }}
              >
                {confirmDialog.title}
              </h3>

              <p
                style={{
                  margin: '0 0 24px 0',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  color: 'var(--text-secondary, #aaa)'
                }}
              >
                {confirmDialog.message}
              </p>

              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'flex-end'
                }}
              >
                <button
                  onClick={handleCancel}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'transparent',
                    color: 'var(--text-primary, #fff)',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--accent, #7c5cbf)',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(124, 92, 191, 0.3)'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
