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
  PanelRight,
  ArrowLeft,
  ChevronRight,
  ChevronDown
} from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import UnderlineExt from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import { Markdown } from 'tiptap-markdown'
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
  setCurrentView: (view: any) => void
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
  setCurrentView
}: NotesViewProps): React.ReactElement {
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
  const notesRef = useRef(notes)
  
  useEffect(() => {
    notesRef.current = notes
  }, [notes])
  
  useEffect(() => {
    titleEffectRef.current = localTitle
  }, [localTitle])
  
  useEffect(() => {
    activeNoteIdRef.current = activeNoteId
  }, [activeNoteId])


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
        if (saveTimers.current[id]) clearTimeout(saveTimers.current[id])
        saveTimers.current[id] = setTimeout(
          async (): Promise<void> => {
            // Read from ref to always get the LATEST notes state, not a stale closure
            const currentNoteVersion = notesRef.current.find((n) => n.id === id)
            if (!currentNoteVersion) return

            const type = currentNoteVersion.type || 'markdown'
            const isBoard = type === 'board'
            let targetDir = isBoard ? workspacePath + '/boards' : workspacePath + '/notes'

            const noteProjectId = currentNoteVersion.projectId || 'default'
            if (noteProjectId !== 'trash') {
              const project = findProjectRecursive(projects, noteProjectId)
              if (project) {
                if (isBoard) {
                  // @ts-ignore
                  if (project.boardsPath) targetDir = project.boardsPath
                  else if (project.path) targetDir = `${project.path}/boards`
                } else {
                  if (project.notesPath) targetDir = project.notesPath
                  else if (project.path) targetDir = `${project.path}/notes`
                }
              }
            }

            if (!targetDir) return

            const ext = isBoard ? 'board' : 'md'
            // @ts-ignore
            const fileName = currentNoteVersion.fileName || getFileName(currentNoteVersion.title, id, ext)

            if (isBoard) {
              // @ts-ignore
              await window.api.saveContainer(targetDir, fileName, currentNoteVersion)
            } else {
              // @ts-ignore
              window.api.saveNote(targetDir, fileName, currentNoteVersion)
            }
          },
          1000
        )
      }
    },
    [workspacePath, projects, setNotes]
  )

  const activeNote = notes.find((n) => n.id === activeNoteId)
  const handleUpdateNoteRef = useRef(handleUpdateNote)
  
  useEffect(() => {
    handleUpdateNoteRef.current = handleUpdateNote
  }, [handleUpdateNote])

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
      Markdown
    ],
    content: activeNote?.content || '',
    editorProps: {
      attributes: {
        class: 'tiptap-editor'
      }
    }
  })

  // Use a stable update listener that always uses the current activeNoteId from Ref
  useEffect(() => {
    if (!editor) return

    const onUpdate = ({ editor: e }: { editor: any }) => {
      // ONLY save if the editor is focused (meaning user initiated change)
      // This prevents background sync/initialization from wiping content
      if (e.isFocused) {
        const currentId = activeNoteIdRef.current
        if (currentId) {
          const markdownString = (e.storage as any).markdown.getMarkdown()
          handleUpdateNoteRef.current(currentId, { content: markdownString })
        }
      }
    }

    editor.on('update', onUpdate)
    return () => {
      editor.off('update', onUpdate)
    }
  }, [editor])

  // Sync editor content when active note changes or content loads from disk
  useEffect(() => {
    if (editor && activeNote && activeNote.type !== 'board') {
      const noteContent = activeNote.content || ''
      
      // Try to parse as JSON first (modern format fallback for older notes)
      try {
        const json = JSON.parse(noteContent)
        // If it's a valid Tiptap JSON, set it
        if (json && typeof json === 'object') {
          // Compare with current state is hard for JSON, but emitUpdate: false prevents loops
          editor.commands.setContent(json, { emitUpdate: false })
          return
        }
      } catch (e) {
        // Assume markdown
      }

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
          // @ts-ignore
          await window.api.saveContainer(targetDir, newFileName, finalNote)
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
      // @ts-ignore
      window.api.saveNote(targetDir, initialFileName, newNote)
    }
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
      
      // Force immediate save of metadata with new title
      // @ts-ignore
      const noteToSave = { ...activeNote, title: localTitle, fileName: newFileName }
      if (isBoard) {
        // @ts-ignore
        await window.api.saveContainer(targetDir, newFileName, noteToSave)
      } else {
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
      if (activeNote) {
        handleUpdateNote(activeNote.id, { content })
      }
    },
    [activeNote, handleUpdateNote]
  )



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
        .sort((a, b) => (b.createdAt || b.lastModified) - (a.createdAt || a.lastModified))

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
        .sort((a, b) => (b.createdAt || b.lastModified) - (a.createdAt || a.lastModified))

      for (const note of rootNotes) {
        const noteChildren = filteredNotes.filter((n) => n.parentId === note.id)
        const hasChildren = noteChildren.length > 0
        result.push({ type: 'note', note, project, level, hasChildren })

        if (hasChildren && !collapsedNotes.has(note.id)) {
          renderNoteTree(note.id, level + 1, project)
        }
      }

      for (const sub of subprojects) {
        traverse(sub.id, level + 1, false)
      }
    }

    traverse(activeProjectId, 0, true)
    return result
  }, [filteredNotes, activeProjectId, extendedProjects, collapsedNotes])

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
                        const { note, project, level, hasChildren } = item
                        const isActive = activeNoteId === note.id
                        const projectColor = project?.color || 'var(--accent)'
                        const renderLevel = activeProjectId === 'trash' ? 0 : level
                        const isCollapsed = collapsedNotes.has(note.id)
                        const isTextNote = note.type !== 'board'

                        return (
                          <div
                            onClick={() => setActiveNoteId(note.id)}
                            style={{
                              padding: `8px 12px 8px ${12 + renderLevel * 16}px`,
                              borderBottom: '1px solid rgba(255,255,255,0.03)',
                              background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.15s',
                              position: 'relative',
                              borderRight: isActive
                                ? `3px solid ${projectColor}`
                                : '3px solid transparent'
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
                              <PenTool
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
                        padding: '8px 16px',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'transparent',
                        minHeight: '44px',
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
                        boardDir={getBoardTargetDir(activeNote.projectId, activeNote.isTrash)}
                        boardFileName={getFileName(activeNote.title, activeNote.id, 'ibo')}
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
                        background: 'transparent',
                        gap: '12px'
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
                        {/* Breadcrumbs & Date */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            padding: '8px 0 4px',
                            minHeight: '24px'
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              flexWrap: 'wrap'
                            }}
                          >
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

                          {activeNote.createdAt && (
                            <div
                              style={{
                                color: 'var(--text-secondary)',
                                opacity: 0.5,
                                fontSize: '12px',
                                padding: '2px 4px'
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
