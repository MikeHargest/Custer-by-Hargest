import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import UnderlineExt from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import { Markdown } from 'tiptap-markdown'
import {
  Bold,
  Edit2,
  Eraser,
  Folder,
  FolderOpen,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  ExternalLink,
  List,
  Palette,
  Save,
  Strikethrough,
  Underline,
  Unlink
} from 'lucide-react'
import ColorPicker from './ColorPicker'


const MAX_CHARS = 500


interface OverviewEditorProps {
  projectPath: string
  projectColor?: string
  projectId: string
}


export default function OverviewEditor({
  projectPath,
  projectColor,
  projectId
}: OverviewEditorProps): React.ReactElement {
  const [charCount, setCharCount] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [selectionMenuPos, setSelectionMenuPos] = useState<{ left: number; top: number } | null>(null)
  const [showSelectionMenu, setShowSelectionMenu] = useState(false)
  const [textColorPickerRect, setTextColorPickerRect] = useState<DOMRect | null>(null)
  const [linkDialog, setLinkDialog] = useState<{ open: boolean; initialUrl: string } | null>(null)
  const [linkDialogUrl, setLinkDialogUrl] = useState('')
  const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selectionMenuRef = useRef<HTMLDivElement>(null)
  const savedSelectionRef = useRef<{ from: number; to: number } | null>(null)
  const projectIdRef = useRef(projectId)
  const projectPathRef = useRef(projectPath)
  const editorContainerRef = useRef<HTMLDivElement>(null)

  const NonInclusiveLink = Link.extend({
    inclusive: false
  })

  // Stable ref for openLink so editorProps.handleClick never has a stale closure
  const openLinkRef = useRef((href: string) => {
    if (!href) return
    const trimmed = href.trim()
    if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) {
      ;(window as any).api.openExternal(trimmed)
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
      ;(window as any).api.openPath(decodeURIComponent(pathToOpen))
    }
  })

  // Migrate legacy local-file:// and bare /C:/... paths to canonical file:/// format.
  const migrateLocalFilePaths = useCallback((markdown: string): string => {
    let result = markdown.replace(/local-file:\/\/\//g, 'file:///')
    result = result.replace(/file:\/\/\/([A-Za-z])%3A\//g, 'file:///$1:/')
    result = result.replace(/(\])\(\/(([a-zA-Z]):[\\/][^)]*)\)/g, (_match, bracket, rest) => {
      const normalized = rest.replace(/\\/g, '/')
      return `${bracket}(file:///${normalized})`
    })
    result = result.replace(/!\\\[([^\]]*)\\\]\(([^)]+)\)/g, '![$1]($2)')
    result = result.replace(/\\\[([^\]]*)\\\]\(([^)]+)\)/g, '[$1]($2)')
    return result
  }, [])

  // Ctrl key detection for links
  useEffect(() => {
    const container = editorContainerRef.current
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

  useEffect(() => {
    projectIdRef.current = projectId
    projectPathRef.current = projectPath
  }, [projectId, projectPath])

  const saveContent = useCallback(async (content: string) => {
    if (!projectPathRef.current) return
    try {
      await (window as any).api.saveOverviewDescription(projectPathRef.current, content)
    } catch (e) {
      console.error('[OverviewEditor] save failed:', e)
    }
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        code: false,
        codeBlock: false
      }),
      UnderlineExt,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder: 'Add a description for this project...' }),
      Markdown.configure({
        html: true,
        transformPastedText: true,
        transformCopiedText: true
      }),
      NonInclusiveLink.configure({
        openOnClick: false, // We handle clicks manually
        autolink: true,
        linkOnPaste: true,
        protocols: ['http', 'https', 'mailto', 'ftp', 'file', 'local-file'],
        HTMLAttributes: {
          class: 'overview-link',
          rel: 'noopener noreferrer'
        }
      })
    ],
    content: '',
    editable: false,
    editorProps: {
      attributes: { class: 'overview-tiptap' },
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
      },
      handleKeyDown: (_view, event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
          event.preventDefault()
          openLinkDialog()
          return true
        }
        return false
      }
    },
    onUpdate: ({ editor: e }) => {
      const text = e.getText()
      const len = text.length

      if (len > MAX_CHARS) {
        e.commands.undo()
        return
      }

      setCharCount(len)
    }
  })

  // Патч markdown-it validateLink напрямую через storage редактора.
  useEffect(() => {
    if (!editor) return
    const md = (editor.storage as any)?.markdown?.parser?.md
    if (!md) return
    const originalValidate = md.validateLink?.bind(md)
    md.validateLink = (url: string) => {
      if (url.startsWith('file://') || url.startsWith('local-file://')) return true
      return originalValidate ? originalValidate(url) : true
    }
  }, [editor])

  const hideSelectionMenu = useCallback(() => {
    if (selectionTimerRef.current) {
      clearTimeout(selectionTimerRef.current)
      selectionTimerRef.current = null
    }
    setShowSelectionMenu(false)
    setSelectionMenuPos(null)
  }, [])

  const getSelectionRect = useCallback((): DOMRect | null => {
    if (!editor || !isEditing) return null
    const { from, to } = editor.state.selection
    if (from === to) return null
    const nativeSelection = window.getSelection()
    if (!nativeSelection || nativeSelection.rangeCount === 0) return null
    const range = nativeSelection.getRangeAt(0)
    if (!editor.view.dom.contains(range.commonAncestorContainer)) return null
    const rect = range.getBoundingClientRect()
    if (!rect || (rect.width === 0 && rect.height === 0)) return null
    return rect
  }, [editor, isEditing])

  const scheduleSelectionMenu = useCallback(() => {
    if (selectionTimerRef.current) {
      clearTimeout(selectionTimerRef.current)
      selectionTimerRef.current = null
    }
    selectionTimerRef.current = setTimeout(() => {
      const rect = getSelectionRect()
      if (!rect) {
        hideSelectionMenu()
        return
      }
      const padding = 12
      const desiredLeft = rect.left + rect.width / 2
      const clampedLeft = Math.max(padding, Math.min(window.innerWidth - padding, desiredLeft))
      const desiredTop = rect.top - 10
      const clampedTop = Math.max(56, desiredTop)
      setSelectionMenuPos({ left: clampedLeft, top: clampedTop })
      setShowSelectionMenu(true)
    }, 120)
  }, [getSelectionRect, hideSelectionMenu])

  const applyFormatting = useCallback(
    (type: string, value?: string): void => {
      if (!editor || !isEditing) return
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
        default:
          break
      }
      scheduleSelectionMenu()
    },
    [editor, isEditing, scheduleSelectionMenu]
  )

  const openLinkDialog = useCallback(() => {
    if (!editor || !isEditing) return
    const { from, to } = editor.state.selection
    savedSelectionRef.current = { from, to }
    const existingHref = editor.getAttributes('link').href || ''
    setLinkDialogUrl(existingHref)
    setLinkDialog({ open: true, initialUrl: existingHref })
  }, [editor, isEditing])

  const handleApplyLink = useCallback((url: string) => {
    if (!editor) return
    setLinkDialog(null)

    const sel = savedSelectionRef.current
    savedSelectionRef.current = null

    const chain = editor.chain().focus()

    if (sel && sel.from !== sel.to) {
      chain.setTextSelection({ from: sel.from, to: sel.to })
    }

    let finalUrl = url.trim()
    if (!finalUrl) {
      chain.extendMarkRange('link').unsetLink().run()
      return
    }

    if (/^[a-zA-Z]:[\\/]/.test(finalUrl)) {
      const normalized = finalUrl.replace(/\\/g, '/')
      finalUrl = `file:///${encodeURI(normalized)}`
    } else if (/^\/[a-zA-Z]:[\/]/.test(finalUrl)) {
      finalUrl = `file://${encodeURI(finalUrl)}`
    }

    chain.extendMarkRange('link').setLink({ href: finalUrl }).run()
  }, [editor])

  const handleBrowseLinkFile = useCallback(async () => {
    const filePath: string | null = await (window as any).api.selectFile()
    if (filePath) {
      setLinkDialogUrl(filePath)
    }
  }, [])

  const handleBrowseLinkFolder = useCallback(async () => {
    const folderPath: string | null = await (window as any).api.selectFolder()
    if (folderPath) {
      setLinkDialogUrl(folderPath)
    }
  }, [])

  const removeLink = useCallback(() => {
    if (!editor || !isEditing) return
    const savedSel = savedSelectionRef.current
    const activeSel = editor.state.selection
    const finalSel =
      savedSel && savedSel.from !== savedSel.to
        ? savedSel
        : activeSel.from !== activeSel.to
          ? { from: activeSel.from, to: activeSel.to }
          : null

    if (finalSel) {
      editor
        .chain()
        .focus()
        .setTextSelection({ from: finalSel.from, to: finalSel.to })
        .unsetMark('link')
        .run()
    } else {
      editor.chain().focus().extendMarkRange('link').unsetMark('link').run()
    }
    savedSelectionRef.current = null
    setLinkDialog(null)
    scheduleSelectionMenu()
  }, [editor, isEditing, scheduleSelectionMenu])

  useEffect(() => {
    if (!editor || !projectPath) return

    setIsLoaded(false)
    setIsEditing(false)

    const load = async () => {
      try {
        const content = await (window as any).api.readOverviewDescription(projectPath)
        if (projectIdRef.current === projectId) {
          const migratedContent = migrateLocalFilePaths(content || '')
          editor.commands.setContent(migratedContent, { emitUpdate: false })
          editor.setEditable(false)
          const text = editor.getText()
          setCharCount(Math.min(text.length, MAX_CHARS))
          setIsLoaded(true)
        }
      } catch (e) {
        console.error('[OverviewEditor] load failed:', e)
        setIsLoaded(true)
      }
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, projectId, projectPath])

  useEffect(() => {
    if (!editor || !isEditing) {
      hideSelectionMenu()
      setLinkDialog(null)
      return
    }

    const updateBySelection = (): void => {
      const { from, to } = editor.state.selection
      if (from === to) {
        hideSelectionMenu()
        return
      }
      scheduleSelectionMenu()
    }

    const handleWindowChange = (): void => {
      if (!showSelectionMenu) return
      scheduleSelectionMenu()
    }

    editor.on('selectionUpdate', updateBySelection)
    window.addEventListener('resize', handleWindowChange)
    window.addEventListener('scroll', handleWindowChange, true)

    return () => {
      editor.off('selectionUpdate', updateBySelection)
      window.removeEventListener('resize', handleWindowChange)
      window.removeEventListener('scroll', handleWindowChange, true)
    }
  }, [editor, hideSelectionMenu, isEditing, scheduleSelectionMenu, showSelectionMenu])

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent): void => {
      const target = e.target as Node
      if (selectionMenuRef.current?.contains(target)) return
      if ((target as HTMLElement).closest('.link-dialog-box')) return
      hideSelectionMenu()
    }
    if (showSelectionMenu || linkDialog?.open) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [hideSelectionMenu, linkDialog?.open, showSelectionMenu])


  useEffect(() => {
    return () => {
      if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current)
    }
  }, [])


  const handleEdit = useCallback(() => {
    if (!editor) return
    editor.setEditable(true)
    setIsEditing(true)
    setTimeout(() => editor.commands.focus('end'), 50)
  }, [editor])


  const handleSave = useCallback(() => {
    if (!editor) return
    const markdown = (editor.storage as any).markdown.getMarkdown()
    saveContent(markdown)
    editor.setEditable(false)
    setIsEditing(false)
    hideSelectionMenu()
    setLinkDialog(null)
    setTextColorPickerRect(null)
  }, [editor, hideSelectionMenu, saveContent])


  const accent = projectColor || 'var(--accent)'
  const accentSoft = projectColor ? `${projectColor}2b` : 'rgba(255,255,255,0.08)'
  const accentBorder = projectColor ? `${projectColor}77` : 'rgba(255,255,255,0.2)'
  const accentEditorBorder = projectColor ? `${projectColor}55` : 'rgba(255,255,255,0.16)'
  const accentLinkDecoration = projectColor ? `${projectColor}99` : 'rgba(255,255,255,0.35)'
  const isNearLimit = charCount >= MAX_CHARS * 0.85
  const isAtLimit = charCount >= MAX_CHARS


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

  const formatButtonStyle = (active = false): React.CSSProperties => ({
    width: '28px',
    height: '28px',
    borderRadius: '7px',
    border: active ? `1px solid ${accentBorder}` : '1px solid transparent',
    background: active ? accentSoft : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.18s ease'
  })

  const keepEditorSelectionOnMenuMouseDown = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>): void => {
      // Prevent focus transfer from editor to toolbar button,
      // otherwise selection is lost before onClick handlers run.
      e.preventDefault()
      e.stopPropagation()
    },
    []
  )


  return (
    <div
      ref={editorContainerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        opacity: isLoaded ? 1 : 0,
        transition: 'opacity 0.2s ease'
      }}
    >
      <style>
        {`
        .overview-tiptap a {
          color: #8e8e8e;
          text-decoration: underline;
          text-decoration-color: color-mix(in srgb, #8e8e8e 60%, transparent);
          text-underline-offset: 3px;
          cursor: text;
          pointer-events: none;
          transition: color 0.15s, text-decoration-color 0.15s, opacity 0.15s;
          border-radius: 2px;
        }

        .ctrl-held .overview-tiptap a {
          cursor: pointer !important;
          pointer-events: auto !important;
          text-decoration-color: #8e8e8e !important;
          opacity: 0.85;
        }

        .ctrl-held .overview-tiptap a:hover {
          opacity: 1;
          background: rgba(255, 255, 255, 0.05);
        }
      `}
      </style>

      {/* Header with label + button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '4px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3
            style={{
              margin: 0,
              fontSize: '10px',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontWeight: 700
            }}
          >
            Description
          </h3>
          {isEditing && (
            <span
              style={{
                fontSize: '11px',
                color: isAtLimit
                  ? 'var(--danger, #f87171)'
                  : isNearLimit
                    ? '#f59e0b'
                    : 'rgba(255,255,255,0.2)',
                fontWeight: isNearLimit ? 600 : 400,
                fontVariantNumeric: 'tabular-nums',
                transition: 'color 0.2s ease'
              }}
            >
              {isAtLimit && (
                <span style={{ marginRight: '4px', opacity: 0.9 }}>Limit reached ·</span>
              )}
              {charCount} / {MAX_CHARS}
            </span>
          )}
        </div>
        <button
          onClick={isEditing ? handleSave : handleEdit}
          style={editBtnStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
            e.currentTarget.style.color = 'var(--text-primary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--text-secondary)'
          }}
        >
          {isEditing ? (
            <>
              <Save size={12} /> Save
            </>
          ) : (
            <>
              <Edit2 size={12} /> Edit
            </>
          )}
        </button>
      </div>

      {/* Editor container */}
      <div
        style={{
          position: 'relative',
          borderRadius: '10px',
          border: isEditing ? `1px solid ${accentEditorBorder}` : 'none',
          background: isEditing ? 'rgba(0,0,0,0.15)' : 'transparent',
          transition: 'all 0.2s ease',
          minHeight: '60px'
        }}
      >
        <EditorContent editor={editor} />
      </div>

      {showSelectionMenu && selectionMenuPos && isEditing && (
        <div
          ref={selectionMenuRef}
          style={{
            position: 'fixed',
            left: selectionMenuPos.left,
            top: selectionMenuPos.top,
            transform: 'translate(-50%, -100%)',
            zIndex: 2200,
            background: 'rgba(18, 18, 18, 0.92)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            backdropFilter: 'blur(14px)',
            boxShadow: '0 8px 26px rgba(0,0,0,0.45)',
            animation: 'overview-float-in 0.14s ease'
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            title="Bold"
            onMouseDown={keepEditorSelectionOnMenuMouseDown}
            onClick={() => applyFormatting('bold')}
            style={formatButtonStyle(!!editor?.isActive('bold'))}
          >
            <Bold size={14} />
          </button>
          <button
            title="Italic"
            onMouseDown={keepEditorSelectionOnMenuMouseDown}
            onClick={() => applyFormatting('italic')}
            style={formatButtonStyle(!!editor?.isActive('italic'))}
          >
            <Italic size={14} />
          </button>
          <button
            title="Underline"
            onMouseDown={keepEditorSelectionOnMenuMouseDown}
            onClick={() => applyFormatting('underline')}
            style={formatButtonStyle(!!editor?.isActive('underline'))}
          >
            <Underline size={14} />
          </button>
          <button
            title="Strikethrough"
            onMouseDown={keepEditorSelectionOnMenuMouseDown}
            onClick={() => applyFormatting('strikethrough')}
            style={formatButtonStyle(!!editor?.isActive('strike'))}
          >
            <Strikethrough size={14} />
          </button>
          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />
          <button
            title="Text Color"
            onMouseDown={keepEditorSelectionOnMenuMouseDown}
            onClick={(e) => setTextColorPickerRect((e.currentTarget as HTMLButtonElement).getBoundingClientRect())}
            style={formatButtonStyle(!!editor?.isActive('textStyle'))}
          >
            <Palette size={14} />
          </button>
          <button
            title="Clear Formatting"
            onMouseDown={keepEditorSelectionOnMenuMouseDown}
            onClick={() => applyFormatting('clear')}
            style={formatButtonStyle(false)}
          >
            <Eraser size={14} />
          </button>
          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />
          <button
            title="Heading 1"
            onMouseDown={keepEditorSelectionOnMenuMouseDown}
            onClick={() => applyFormatting('h1')}
            style={formatButtonStyle(!!editor?.isActive('heading', { level: 1 }))}
          >
            <Heading1 size={14} />
          </button>
          <button
            title="Heading 2"
            onMouseDown={keepEditorSelectionOnMenuMouseDown}
            onClick={() => applyFormatting('h2')}
            style={formatButtonStyle(!!editor?.isActive('heading', { level: 2 }))}
          >
            <Heading2 size={14} />
          </button>
          <button
            title="Heading 3"
            onMouseDown={keepEditorSelectionOnMenuMouseDown}
            onClick={() => applyFormatting('h3')}
            style={formatButtonStyle(!!editor?.isActive('heading', { level: 3 }))}
          >
            <Heading3 size={14} />
          </button>
          <button
            title="Bullet List"
            onMouseDown={keepEditorSelectionOnMenuMouseDown}
            onClick={() => applyFormatting('list')}
            style={formatButtonStyle(!!editor?.isActive('bulletList'))}
          >
            <List size={14} />
          </button>
          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />
          <button
            title="Insert Link"
            onMouseDown={keepEditorSelectionOnMenuMouseDown}
            onClick={openLinkDialog}
            style={formatButtonStyle(!!editor?.isActive('link'))}
          >
            <Link2 size={14} />
          </button>
          <button
            title="Remove Link"
            onMouseDown={keepEditorSelectionOnMenuMouseDown}
            onClick={removeLink}
            style={formatButtonStyle(false)}
          >
            <Unlink size={14} />
          </button>
        </div>
      )}

      {textColorPickerRect && (
        <ColorPicker
          color={editor?.getAttributes('textStyle')?.color || '#EAEAEA'}
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
              <Link2 size="16" style={{ opacity: 0.8 }} />
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
                <button 
                  className="link-btn-browse" 
                  onMouseDown={keepEditorSelectionOnMenuMouseDown}
                  onClick={handleBrowseLinkFile}
                >
                  <FolderOpen size={13} />
                  File
                </button>
                <button 
                  className="link-btn-browse" 
                  onMouseDown={keepEditorSelectionOnMenuMouseDown}
                  onClick={handleBrowseLinkFolder}
                >
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
                  onMouseDown={keepEditorSelectionOnMenuMouseDown}
                  onClick={() => handleApplyLink('')}
                >
                  Remove Link
                </button>
              )}
              <button 
                className="link-btn-secondary" 
                onMouseDown={keepEditorSelectionOnMenuMouseDown}
                onClick={() => setLinkDialog(null)}
              >
                Cancel
              </button>
              <button 
                className="link-btn-primary" 
                onMouseDown={keepEditorSelectionOnMenuMouseDown}
                onClick={() => handleApplyLink(linkDialogUrl)}
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tiptap editor styles scoped to overview */}
      <style>{`
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
          justify-content: flex-end;
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

        @keyframes overview-float-in {
          from {
            opacity: 0;
            transform: translate(-50%, -95%) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -100%) scale(1);
          }
        }
        .overview-tiptap {
          outline: none;
          padding: 4px 0;
          font-size: 13px;
          line-height: 1.7;
          color: var(--text-secondary);
          min-height: 40px;
          max-height: 240px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.1) transparent;
        }
        .overview-tiptap p {
          margin: 0 0 4px 0;
        }
        .overview-tiptap p:last-child {
          margin-bottom: 0;
        }
        .overview-tiptap h1,
        .overview-tiptap h2,
        .overview-tiptap h3 {
          color: var(--text-primary);
          font-weight: 700;
          line-height: 1.3;
          margin: 10px 0 6px 0;
        }
        .overview-tiptap h1 { font-size: 18px; }
        .overview-tiptap h2 { font-size: 16px; }
        .overview-tiptap h3 { font-size: 14px; }
        .overview-tiptap ul {
          margin: 6px 0 8px 20px;
          padding: 0;
        }
        .overview-tiptap li {
          margin: 2px 0;
        }
        .overview-tiptap strong {
          color: var(--text-primary);
          font-weight: 600;
        }
        .overview-tiptap em {
          opacity: 0.8;
        }
        .overview-tiptap u {
          text-decoration-color: rgba(255,255,255,0.3);
        }
        .overview-tiptap s {
          opacity: 0.5;
        }
        .overview-tiptap a {
          color: ${accent};
          text-decoration: underline;
          text-decoration-color: ${accentLinkDecoration};
        }
        .overview-tiptap .is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: rgba(255,255,255,0.18);
          pointer-events: none;
          height: 0;
          font-style: italic;
        }
      `}</style>
    </div>
  )
}
