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
  PenTool,
  PanelRight
} from 'lucide-react'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import { Virtuoso } from 'react-virtuoso'

import { AppNote, Project } from '../types'
import ColorPicker from './ColorPicker'
import BoardsView from './boards/BoardsView'

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
  showFPS
}: NotesViewProps): React.ReactElement {
  const activeProjectId = selectedProjectId || 'default'
  const [showTrash, setShowTrash] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const [textColorPickerRect, setTextColorPickerRect] = useState<DOMRect | null>(null)
  const quillRef = useRef<ReactQuill>(null)
  const saveTimers = useRef<{ [id: string]: ReturnType<typeof setTimeout> }>({})
  const quillContentRef = useRef<string>('')
  const [localTitle, setLocalTitle] = useState('')
  const titleSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastActiveIdRef = useRef<string | null>(activeNoteId)

  const applyFormatting = (type: string, value?: string): void => {
    const quill = quillRef.current?.getEditor()
    if (!quill) {
      console.error('Quill editor not found')
      return
    }

    // Force focus
    quill.focus()

    switch (type) {
      case 'bold': {
        const current = quill.getFormat().bold
        quill.format('bold', !current)
        break
      }
      case 'italic': {
        const current = quill.getFormat().italic
        quill.format('italic', !current)
        break
      }
      case 'underline': {
        const current = quill.getFormat().underline
        quill.format('underline', !current)
        break
      }
      case 'strikethrough': {
        const current = quill.getFormat().strike
        quill.format('strike', !current)
        break
      }
      case 'color':
        quill.format('color', value)
        break
      case 'clear':
        quill.removeFormat(quill.getSelection()?.index || 0, quill.getSelection()?.length || 0)
        break
      case 'h1':
        quill.format('header', 1)
        break
      case 'h2':
        quill.format('header', 2)
        break
      case 'h3':
        quill.format('header', 3)
        break
      case 'list':
        quill.format('list', 'bullet')
        break
      case 'task':
        quill.format('list', 'unchecked')
        break
      case 'separator':
        quill.insertText(quill.getSelection()?.index || 0, '\n', 'api')
        quill.insertEmbed(quill.getSelection()?.index || 0, 'divider', true)
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

  const filteredNotes = notes.filter((n) => {
    const isTrash = n.isTrash || n.projectId === 'trash'
    const pId = n.projectId === 'trash' ? 'default' : n.projectId || 'default'

    if (showTrash) {
      return isTrash && projectScopeIds.includes(pId)
    } else {
      return !isTrash && projectScopeIds.includes(pId)
    }
  })

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

  const activeNote = notes.find((n) => n.id === activeNoteId)
  const lastLoadedRef = useRef<string | null>(null)

  // Sync local title when active note changes
  useEffect(() => {
    if (activeNote) {
      setLocalTitle(activeNote.title)
    }
  }, [activeNoteId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load content from file-system when note changes
  useEffect(() => {
    const loadContent = async (): Promise<void> => {
      if (activeNote && activeNoteId && lastLoadedRef.current !== activeNoteId) {
        lastLoadedRef.current = activeNoteId
        const isBoard = activeNote.type === 'tldraw'
        const targetDir = isBoard
          ? getBoardTargetDir(activeNote.projectId, activeNote.isTrash)
          : getNoteTargetDir(activeNote.projectId, activeNote.isTrash)

        const api = (window as any).api
        let diskContent: string | null = null

        if (isBoard) {
          // Try .ibo first with title-based name
          const iboName = getFileName(activeNote.title, activeNoteId, 'ibo')
          diskContent = await api.readIbo(targetDir, iboName)
          if (diskContent === null) {
            // Fallback to legacy UUID-based name
            diskContent = await api.readIbo(targetDir, `${activeNoteId}.ibo`)
          }
          if (diskContent === null) {
            // Fallback to old .board format
            diskContent = await api.readBoard(targetDir, `${activeNoteId}.board`)
          }
        } else {
          const mdName = getFileName(activeNote.title, activeNoteId, 'md')
          diskContent = await api.readNote(targetDir, mdName)
          if (diskContent === null) {
            // Fallback to legacy UUID-based name
            diskContent = await api.readNote(targetDir, `${activeNoteId}.md`)
          }
        }

        // Only update state if disk has content, otherwise use what's in state
        if (diskContent !== null && diskContent !== activeNote.content) {
          setNotes((prev) =>
            prev.map((n) => (n.id === activeNoteId ? { ...n, content: diskContent } : n))
          )
        } else if (diskContent === null && activeNote.content) {
          if (isBoard) {
            const iboName = getFileName(activeNote.title, activeNoteId, 'ibo')
            // @ts-ignore - saveIbo has custom API signature
            window.api.saveIbo(targetDir, iboName, activeNote.content)
          } else {
            const mdName = getFileName(activeNote.title, activeNoteId, 'md')
            // @ts-ignore - saveNote persists markdown content
            window.api.saveNote(targetDir, mdName, activeNote.content)
          }
        }
      }
    }
    loadContent()
  }, [
    activeNoteId,
    workspacePath,
    activeNote,
    setNotes,
    projects,
    getNoteTargetDir,
    getBoardTargetDir
  ])

  // Flush pending saves when switching notes
  useEffect(() => {
    const flushSave = (id: string): void => {
      const noteToSave = notes.find((n) => n.id === id)
      if (!noteToSave) return

      const isBoard = noteToSave.type === 'tldraw'
      const targetDir = isBoard
        ? getBoardTargetDir(noteToSave.projectId, noteToSave.isTrash)
        : getNoteTargetDir(noteToSave.projectId, noteToSave.isTrash)

      if (targetDir) {
        const fileName = getFileName(noteToSave.title, id, isBoard ? 'ibo' : 'md')
        if (isBoard) {
          // @ts-ignore - api defined in preload
          window.api.saveIbo(targetDir, fileName, noteToSave.content)
        } else {
          // @ts-ignore - api defined in preload
          window.api.saveNote(targetDir, fileName, noteToSave.content)
        }
      }
    }

    if (lastActiveIdRef.current && lastActiveIdRef.current !== activeNoteId) {
      const prevId = lastActiveIdRef.current
      if (saveTimers.current[prevId]) {
        clearTimeout(saveTimers.current[prevId])
        delete saveTimers.current[prevId]
        flushSave(prevId)
      }
    }
    lastActiveIdRef.current = activeNoteId
  }, [activeNoteId, notes, getBoardTargetDir, getNoteTargetDir])

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

  const handleCreateNote = (type: 'markdown' | 'tldraw' = 'markdown'): void => {
    let initialContent = ''
    if (type === 'tldraw') {
      // Small valid json structure for empty tldraw if needed, otherwise empty string is fine.
      // We will handle it in the Tldraw component
      initialContent = ''
    }
    const noteProjId = activeProjectId
    const newNote: AppNote = {
      id: uuidv4(),
      title: type === 'tldraw' ? 'Untitled Board' : 'Untitled Note',
      content: initialContent,
      type,
      projectId: noteProjId,
      isTrash: false,
      lastModified: Date.now(),
      createdAt: Date.now()
    }

    const isBoard = type === 'tldraw'
    const targetDir = isBoard
      ? getBoardTargetDir(noteProjId, false)
      : getNoteTargetDir(noteProjId, false)

    setNotes([newNote, ...notes])
    setActiveNoteId(newNote.id)

    // Save empty physical file
    if (targetDir) {
      const fileName = getFileName(newNote.title, newNote.id, isBoard ? 'ibo' : 'md')
      if (isBoard) {
        // @ts-ignore: saveIbo is a custom container API that bundles board JSON and media
        window.api.saveIbo(targetDir, fileName, initialContent)
      } else {
        // @ts-ignore: saveNote handles standard markdown note persisting
        window.api.saveNote(targetDir, fileName, initialContent)
      }
    }
  }

  const extendedProjects = React.useMemo(() => [...projects], [projects])
  // trashProject is not needed here as it is handled by the projects state if it exists

  const handleDeleteNote = (id: string, e: React.MouseEvent): void => {
    e.stopPropagation()
    const noteToDelete = notes.find((n) => n.id === id)
    if (!noteToDelete) return
    const isBoard = noteToDelete.type === 'tldraw'

    if (showTrash) {
      // Permanent Delete
      const updatedNotes = notes.filter((n) => n.id !== id)
      setNotes(updatedNotes)

      const targetDir = isBoard
        ? getBoardTargetDir(noteToDelete.projectId, true)
        : getNoteTargetDir(noteToDelete.projectId, true)
      if (targetDir) {
        const titleName = getFileName(noteToDelete.title, id, isBoard ? 'ibo' : 'md')
        if (isBoard) {
          // @ts-ignore: Delete title-based .ibo file
          window.api.deleteBoard(targetDir, titleName)
          // @ts-ignore: Attempt deletion of legacy UUID-based .ibo
          window.api.deleteBoard(targetDir, `${id}.ibo`)
          // @ts-ignore: Fallback for older .board files
          window.api.deleteBoard(targetDir, `${id}.board`)
        } else {
          // @ts-ignore: Delete title-based .md file
          window.api.deleteNote(targetDir, titleName)
          // @ts-ignore: Delete legacy UUID-based .md
          window.api.deleteNote(targetDir, `${id}.md`)
        }
      }
    } else {
      // Soft delete to Trash
      const pId =
        noteToDelete.projectId === 'trash' ? 'default' : noteToDelete.projectId || 'default'

      const updatedNotes = notes.map((n) =>
        n.id === id ? { ...n, projectId: pId, isTrash: true, lastModified: Date.now() } : n
      )
      setNotes(updatedNotes)

      const oldDir = isBoard ? getBoardTargetDir(pId, false) : getNoteTargetDir(pId, false)
      const newDir = isBoard ? getBoardTargetDir(pId, true) : getNoteTargetDir(pId, true)

      if (oldDir && newDir) {
        const titleName = getFileName(noteToDelete.title, id, isBoard ? 'ibo' : 'md')
        if (isBoard) {
          // @ts-ignore: Move title-based .ibo to trash
          window.api.moveBoard(oldDir, newDir, titleName)
          // @ts-ignore: Move any existing UUID-based .ibo file to trash
          window.api.moveBoard(oldDir, newDir, `${id}.ibo`)
          // @ts-ignore: Support legacy format move
          window.api.moveBoard(oldDir, newDir, `${id}.board`)
        } else {
          // @ts-ignore: Move title-based .md to trash
          window.api.moveNote(oldDir, newDir, titleName)
          // @ts-ignore: Move legacy UUID-based .md to trash
          window.api.moveNote(oldDir, newDir, `${id}.md`)
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

    const isBoard = noteToRestore.type === 'tldraw'
    const oldDir = isBoard ? getBoardTargetDir(pId, true) : getNoteTargetDir(pId, true)
    const newDir = isBoard ? getBoardTargetDir(pId, false) : getNoteTargetDir(pId, false)

    if (oldDir && newDir) {
      const noteTitle = noteToRestore?.title || 'Untitled'
      if (isBoard) {
        const iboName = getFileName(noteTitle, id, 'ibo')
        // @ts-ignore: Restore either format from trash
        window.api.moveBoard(oldDir, newDir, iboName)
        // @ts-ignore: Fallback for legacy UUID name
        window.api.moveBoard(oldDir, newDir, `${id}.ibo`)
        // @ts-ignore: Fallback for legacy board restoration
        window.api.moveBoard(oldDir, newDir, `${id}.board`)
      } else {
        const mdName = getFileName(noteTitle, id, 'md')
        // @ts-ignore: Restore markdown note
        window.api.moveNote(oldDir, newDir, mdName)
        // @ts-ignore: Fallback for legacy UUID name
        window.api.moveNote(oldDir, newDir, `${id}.md`)
      }
    }
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

      // Build updatedNote for file-save logic
      const targetNote = notes.find((n) => n.id === id)
      if (!targetNote) return
      const updatedNote = { ...targetNote, ...updates, lastModified: Date.now() }

      // Get targetDir dynamically
      const type = updatedNote.type || 'markdown'
      const isBoard = type === 'tldraw'
      let targetDir = isBoard ? workspacePath + '/boards' : workspacePath + '/notes'

      const noteProjectId = updatedNote.projectId || 'default'
      if (noteProjectId !== 'trash') {
        const project = findProjectRecursive(projects, noteProjectId)
        if (project) {
          if (isBoard) {
            // @ts-ignore - boardsPath exists on Project but TS doesn't see it
            if (project.boardsPath) targetDir = project.boardsPath
            else if (project.path) targetDir = `${project.path}/boards`
          } else {
            if (project.notesPath) targetDir = project.notesPath
            else if (project.path) targetDir = `${project.path}/notes`
          }
        }
      }

      if (!targetDir) return

      // If title changed, immediately rename (delete old, save new)
      if (updates.title !== undefined && targetNote.title !== updates.title) {
        const oldFileName = getFileName(targetNote.title, id, isBoard ? 'ibo' : 'md')
        if (isBoard) {
          // @ts-ignore - api defined in preload
          window.api.deleteBoard(targetDir, oldFileName)
        } else {
          // @ts-ignore - api defined in preload
          window.api.deleteNote(targetDir, oldFileName)
        }
      }

      // Save content
      if (updates.content !== undefined || updates.title !== undefined) {
        const contentToSave = updatedNote.content

        if (saveTimers.current[id]) clearTimeout(saveTimers.current[id])
        saveTimers.current[id] = setTimeout(
          (): void => {
            const noteTitle = updatedNote?.title || 'Untitled'
            const fileName = getFileName(noteTitle, id, isBoard ? 'ibo' : 'md')
            if (isBoard) {
              // @ts-ignore - api defined in preload
              window.api.saveIbo(targetDir, fileName, contentToSave)
              // Cleanup legacy boards
              // @ts-ignore - api defined in preload
              window.api.deleteBoard(targetDir, `${id}.board`)
              // @ts-ignore - api defined in preload
              window.api.deleteBoard(targetDir, `${id}.ibo`)
            } else {
              // @ts-ignore - api defined in preload
              window.api.saveNote(targetDir, fileName, contentToSave)
              // @ts-ignore - api defined in preload
              window.api.deleteNote(targetDir, `${id}.md`)
            }
          },
          updates.content !== undefined ? 1000 : 0
        )
      }
    },
    [notes, workspacePath, projects, setNotes]
  )

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setLocalTitle(newTitle)
      if (titleSyncTimer.current) clearTimeout(titleSyncTimer.current)
      titleSyncTimer.current = setTimeout(() => {
        if (activeNoteId) {
          handleUpdateNote(activeNoteId, { title: newTitle })
        }
      }, 300)
    },
    [activeNoteId, handleUpdateNote]
  )

  const handleBoardChange = useCallback(
    (content: string): void => {
      if (activeNote) {
        handleUpdateNote(activeNote.id, { content })
      }
    },
    [activeNote, handleUpdateNote]
  )

  const formatDate = (ts: number): string => {
    return new Date(ts).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  type FlattenedItem =
    | { type: 'project'; project: Project; level: number }
    | { type: 'note'; note: AppNote; project?: Project; level: number }

  const flattenedNotesList = React.useMemo(() => {
    if (filteredNotes.length === 0) return []

    if (activeProjectId === 'trash') {
      return filteredNotes
        .sort((a, b) => b.lastModified - a.lastModified)
        .map((note) => ({
          type: 'note' as const,
          note,
          project: extendedProjects.find((p) => p.id === note.projectId),
          level: 0
        }))
    }

    const result: FlattenedItem[] = []

    const traverse = (projectId: string | null, level: number, isRoot: boolean): void => {
      const project = extendedProjects.find((p) => p.id === projectId)
      const projectNotes = filteredNotes
        .filter((n) => (projectId === 'default' ? !n.projectId : n.projectId === projectId))
        .sort((a, b) => (b.createdAt || b.lastModified) - (a.createdAt || a.lastModified))

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

      for (const note of projectNotes) {
        result.push({ type: 'note', note, project, level })
      }

      for (const sub of subprojects) {
        traverse(sub.id, level + 1, false)
      }
    }

    traverse(activeProjectId, 0, true)
    return result
  }, [filteredNotes, activeProjectId, extendedProjects])

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
          background: 'var(--card-bg)'
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
        .ql-container {
          font-family: inherit;
          font-size: 16px;
          border: none !important;
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .ql-editor {
          flex: 1;
          padding: 0 0 32px !important; /* Top padding removed - divider margin handles spacing */
          line-height: 1.6;
          color: var(--text-primary);
          max-width: 700px;
          margin: 0 auto;
          width: 100%;
        }
        .ql-editor.ql-blank::before {
          color: rgba(255,255,255,0.2) !important;
          left: 0 !important; /* Perfect alignment with text start */
          font-style: normal !important;
        }
        .centered-container {
          max-width: 700px;
          margin: 0 auto;
          width: 100%;
          display: flex;
          align-items: center;
          position: relative;
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
        .ql-snow .ql-stroke {
          stroke: var(--text-secondary) !important;
        }
        .ql-snow .ql-fill {
          fill: var(--text-secondary) !important;
        }
        .ql-editor p {
          margin-bottom: 0.5em;
        }
        .ql-editor h1, .ql-editor h2, .ql-editor h3 {
          color: var(--text-primary);
          margin-top: 1em;
          margin-bottom: 0.5em;
          font-weight: 600;
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
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <h2
                    style={{
                      fontSize: '14px',
                      margin: 0,
                      fontWeight: 600,
                      color: 'var(--text-secondary)'
                    }}
                  >
                    Boards (Visual Mode)
                  </h2>
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
                      onClick={() => handleCreateNote('tldraw')}
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
                      <PenTool size={16} />
                    </button>
                  </div>
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
                    marginTop: '4px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  🗑 Trash
                </button>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
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
                    itemContent={(_, item) => {
                      if (item.type === 'project') {
                        const { project, level } = item
                        return (
                          <div
                            style={{
                              fontSize: '11px',
                              textTransform: 'uppercase',
                              color: project.color || 'var(--text-secondary)',
                              marginTop: '16px',
                              marginBottom: '0px',
                              paddingLeft: `${16 + level * 12}px`,
                              opacity: 0.8,
                              fontWeight: 600,
                              letterSpacing: '0.05em',
                              borderBottom: '1px solid rgba(255,255,255,0.05)',
                              paddingBottom: '6px'
                            }}
                          >
                            {project.name}
                          </div>
                        )
                      } else {
                        const { note, project, level } = item
                        const isActive = activeNoteId === note.id
                        const projectColor = project?.color || 'var(--accent)'
                        const renderLevel = activeProjectId === 'trash' ? 0 : level

                        return (
                          <div
                            onClick={() => setActiveNoteId(note.id)}
                            style={{
                              padding: `12px 16px 12px ${16 + renderLevel * 12}px`,
                              borderBottom: '1px solid rgba(255,255,255,0.03)',
                              background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '12px',
                              transition: 'all 0.2s',
                              position: 'relative',
                              borderRight: isActive
                                ? `3px solid ${projectColor}`
                                : '3px solid transparent'
                            }}
                          >
                            {note.type === 'tldraw' ? (
                              <PenTool
                                size={16}
                                color={isActive ? projectColor : 'var(--text-secondary)'}
                                style={{ marginTop: '2px', opacity: isActive ? 1 : 0.4 }}
                              />
                            ) : (
                              <FileText
                                size={16}
                                color={isActive ? projectColor : 'var(--text-secondary)'}
                                style={{ marginTop: '2px', opacity: isActive ? 1 : 0.4 }}
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
                                  textOverflow: 'ellipsis',
                                  marginBottom: '4px'
                                }}
                              >
                                {note.title || 'Untitled Note'}
                              </div>
                              <div
                                style={{
                                  fontSize: '10px',
                                  color: 'var(--text-secondary)',
                                  opacity: 0.6,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                {formatDate(note.lastModified)}
                              </div>
                            </div>
                            {isActive && activeProjectId !== 'trash' && (
                              <button
                                onClick={(e) => handleDeleteNote(note.id, e)}
                                title="Move to Trash"
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--text-secondary)',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  opacity: 0.5,
                                  borderRadius: 'var(--radius-sm)',
                                  transition: 'opacity 0.2s'
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                            {isActive && activeProjectId === 'trash' && (
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                  onClick={(e) => handleRestoreNote(note.id, e)}
                                  title="Restore Note"
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    opacity: 0.7,
                                    borderRadius: 'var(--radius-sm)',
                                    transition: 'opacity 0.2s'
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
                                    padding: '4px',
                                    opacity: 0.7,
                                    borderRadius: 'var(--radius-sm)',
                                    transition: 'opacity 0.2s'
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
                {activeNote.type === 'tldraw' ? (
                  <>
                    <div
                      style={{
                        padding: '8px 16px',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'transparent',
                        minHeight: '44px',
                        boxSizing: 'border-box'
                      }}
                    >
                      <input
                        type="text"
                        value={localTitle}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        placeholder="Board Title"
                        style={{
                          flex: 1,
                          fontSize: '14px',
                          fontWeight: 400,
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-primary)',
                          outline: 'none',
                          padding: 0
                        }}
                      />
                      <button
                        onClick={() => setShowSidebar(!showSidebar)}
                        title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: showSidebar ? 'var(--text-primary)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: showSidebar ? 0.6 : 0.4,
                          flexShrink: 0
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.opacity = showSidebar ? '0.6' : '0.4')
                        }
                      >
                        <PanelRight size={18} />
                      </button>
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
                        boardData={activeNote.content}
                        onChange={handleBoardChange}
                        theme={theme}
                        setTheme={setTheme}
                        showFPS={showFPS}
                        isSidebarOpen={showSidebar}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Toolbar at top */}
                    <div
                      style={{
                        padding: '8px 16px',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'transparent'
                      }}
                    >
                      <div
                        className="centered-container"
                        style={{ gap: '8px', flexWrap: 'wrap', flex: 1 }}
                      >
                        <ToolbarButton onClick={() => applyFormatting('bold')} title="Bold">
                          <Bold size={16} />
                        </ToolbarButton>
                        <ToolbarButton onClick={() => applyFormatting('italic')} title="Italic">
                          <Italic size={16} />
                        </ToolbarButton>
                        <ToolbarButton
                          onClick={() => applyFormatting('underline')}
                          title="Underline"
                        >
                          <Underline size={16} />
                        </ToolbarButton>
                        <ToolbarButton
                          onClick={() => applyFormatting('strikethrough')}
                          title="Strikethrough"
                        >
                          <Strikethrough size={16} />
                        </ToolbarButton>

                        <div
                          style={{
                            width: '1px',
                            height: '20px',
                            background: 'rgba(255,255,255,0.1)',
                            margin: '0 4px'
                          }}
                        />

                        <div style={{ position: 'relative' }}>
                          <ToolbarButton
                            onClick={() => {
                              const btn = document.querySelector(
                                '[title="Text Color"]'
                              ) as HTMLElement
                              if (btn) setTextColorPickerRect(btn.getBoundingClientRect())
                            }}
                            title="Text Color"
                          >
                            <Palette size={16} />
                          </ToolbarButton>
                        </div>

                        <ToolbarButton
                          onClick={() => applyFormatting('clear')}
                          title="Clear Formatting"
                        >
                          <Eraser size={16} />
                        </ToolbarButton>

                        <div
                          style={{
                            width: '1px',
                            height: '20px',
                            background: 'rgba(255,255,255,0.1)',
                            margin: '0 4px'
                          }}
                        />

                        <ToolbarButton onClick={() => applyFormatting('h1')} title="Heading 1">
                          <Heading1 size={16} />
                        </ToolbarButton>
                        <ToolbarButton onClick={() => applyFormatting('h2')} title="Heading 2">
                          <Heading2 size={16} />
                        </ToolbarButton>
                        <ToolbarButton onClick={() => applyFormatting('h3')} title="Heading 3">
                          <Heading3 size={16} />
                        </ToolbarButton>

                        <div
                          style={{
                            width: '1px',
                            height: '20px',
                            background: 'rgba(255,255,255,0.1)',
                            margin: '0 4px'
                          }}
                        />

                        <ToolbarButton onClick={() => applyFormatting('list')} title="Bullet List">
                          <List size={16} />
                        </ToolbarButton>
                        <ToolbarButton onClick={() => applyFormatting('task')} title="Task List">
                          <ListTodo size={16} />
                        </ToolbarButton>
                        <ToolbarButton
                          onClick={() => applyFormatting('separator')}
                          title="Separator"
                        >
                          <Minus size={16} />
                        </ToolbarButton>
                      </div>
                      <button
                        onClick={() => setShowSidebar(!showSidebar)}
                        title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: showSidebar ? 'var(--text-primary)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: showSidebar ? 0.6 : 0.4,
                          flexShrink: 0
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.opacity = showSidebar ? '0.6' : '0.4')
                        }
                      >
                        <PanelRight size={18} />
                      </button>
                    </div>

                    {/* Title below toolbar */}

                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        background: 'transparent',
                        overflowY: 'auto',
                        position: 'relative'
                      }}
                    >
                      <div
                        className="centered-container"
                        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                      >
                        <input
                          type="text"
                          value={localTitle}
                          onChange={(e) => handleTitleChange(e.target.value)}
                          placeholder="Note Title"
                          style={{
                            width: '100%',
                            fontSize: '32px',
                            fontWeight: 600,
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-primary)',
                            outline: 'none',
                            padding: '24px 0 16px',
                            lineHeight: 1.3
                          }}
                        />
                        <div
                          style={{
                            width: '100%',
                            height: '2px',
                            background: 'rgba(255,255,255,0.08)',
                            marginBottom: '16px'
                          }}
                        />
                        <ReactQuill
                          key={activeNoteId}
                          ref={(el) => {
                            ;(quillRef as React.MutableRefObject<ReactQuill | null>).current = el
                            if (el) {
                              quillContentRef.current = activeNote.content || ''
                            }
                          }}
                          theme="snow"
                          defaultValue={activeNote.content}
                          onChange={(content) => {
                            quillContentRef.current = content
                            handleUpdateNote(activeNote.id, { content })
                          }}
                          placeholder="Start typing your notes here..."
                          modules={{ toolbar: false }}
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
                  style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 24px 0' }}
                >
                  <button
                    onClick={() => setShowSidebar(!showSidebar)}
                    title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: showSidebar ? 'var(--text-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: showSidebar ? 0.6 : 0.4,
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.opacity = showSidebar ? '0.6' : '0.4')
                    }
                  >
                    <PanelRight size={18} />
                  </button>
                </div>
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
    </>
  )
}

function ToolbarButton({
  children,
  onClick,
  title
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: '6px',
        background: 'transparent',
        border: 'none',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '0px',
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e): void => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
        e.currentTarget.style.color = 'var(--text-primary)'
      }}
      onMouseLeave={(e): void => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--text-secondary)'
      }}
    >
      {children}
    </button>
  )
}
