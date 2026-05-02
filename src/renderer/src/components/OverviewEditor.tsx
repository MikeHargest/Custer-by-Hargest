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
  const [showLinkPopover, setShowLinkPopover] = useState(false)
  const [linkValue, setLinkValue] = useState('')
  const selectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selectionMenuRef = useRef<HTMLDivElement>(null)
  const linkInputRef = useRef<HTMLInputElement>(null)
  const savedSelectionRef = useRef<{ from: number; to: number } | null>(null)
  const projectIdRef = useRef(projectId)
  const projectPathRef = useRef(projectPath)


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
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        protocols: ['http', 'https', 'mailto', 'ftp', 'file'],
        HTMLAttributes: {
          class: 'overview-link',
          rel: 'noopener noreferrer',
          target: '_blank'
        }
      }),
      Markdown
    ],
    content: '',
    editable: false,
    editorProps: {
      attributes: { class: 'overview-tiptap' }
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

  const hideSelectionMenu = useCallback(() => {
    if (selectionTimerRef.current) {
      clearTimeout(selectionTimerRef.current)
      selectionTimerRef.current = null
    }
    setShowSelectionMenu(false)
    setSelectionMenuPos(null)
    setShowLinkPopover(false)
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

  const normalizeLink = useCallback((raw: string): string => {
    const trimmed = raw.trim()
    if (!trimmed) return ''
    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) return trimmed
    if (/^[a-zA-Z]:[\\/]/.test(trimmed)) {
      const normalized = trimmed.replace(/\\/g, '/')
      return `file:///${encodeURI(normalized)}`
    }
    if (/^\/[a-zA-Z]:[\\/]/.test(trimmed)) {
      const normalized = trimmed.replace(/\\/g, '/')
      return `file://${encodeURI(normalized)}`
    }
    return `https://${trimmed}`
  }, [])

  const applyLinkToSelection = useCallback(
    (rawUrl?: string): void => {
      if (!editor || !isEditing) return
      const normalized = normalizeLink(rawUrl ?? linkValue)
      const savedSel = savedSelectionRef.current
      const activeSel = editor.state.selection
      const finalSel =
        savedSel && savedSel.from !== savedSel.to
          ? savedSel
          : activeSel.from !== activeSel.to
            ? { from: activeSel.from, to: activeSel.to }
            : null

      if (!finalSel) return

      const chain = editor
        .chain()
        .focus()
        .setTextSelection({ from: finalSel.from, to: finalSel.to })

      if (!normalized) {
        chain.unsetMark('link').run()
      } else {
        chain.setMark('link', { href: normalized }).run()
      }
      savedSelectionRef.current = null
      setShowLinkPopover(false)
      scheduleSelectionMenu()
    },
    [editor, isEditing, linkValue, normalizeLink, scheduleSelectionMenu]
  )

  const handleBrowseLinkFile = useCallback(async () => {
    const filePath: string | null = await (window as any).api.selectFile()
    if (filePath) {
      setLinkValue(filePath)
      applyLinkToSelection(filePath)
    }
  }, [applyLinkToSelection])

  const handleBrowseLinkFolder = useCallback(async () => {
    const folderPath: string | null = await (window as any).api.selectFolder()
    if (folderPath) {
      setLinkValue(folderPath)
      applyLinkToSelection(folderPath)
    }
  }, [applyLinkToSelection])

  const openLinkPopover = useCallback(() => {
    if (!editor || !isEditing) return
    const { from, to } = editor.state.selection
    if (from === to) return
    savedSelectionRef.current = { from, to }
    const existingHref = editor.getAttributes('link').href || ''
    setLinkValue(existingHref)
    setShowLinkPopover(true)
    setTimeout(() => linkInputRef.current?.focus(), 10)
  }, [editor, isEditing])

  const applyLink = useCallback(() => {
    applyLinkToSelection()
  }, [applyLinkToSelection])

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
    setShowLinkPopover(false)
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
          editor.commands.setContent(content || '', { emitUpdate: false })
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
      hideSelectionMenu()
    }
    if (showSelectionMenu || showLinkPopover) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [hideSelectionMenu, showLinkPopover, showSelectionMenu])

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
    setTextColorPickerRect(null)
    setShowLinkPopover(false)
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
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        opacity: isLoaded ? 1 : 0,
        transition: 'opacity 0.2s ease'
      }}
    >
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
            onClick={openLinkPopover}
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

          {showLinkPopover && (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: 'calc(100% + 8px)',
                transform: 'translateX(-50%)',
                background: 'rgba(18,18,18,0.97)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                padding: '8px',
                minWidth: '280px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <input
                ref={linkInputRef}
                type="text"
                value={linkValue}
                onChange={(e) => setLinkValue(e.target.value)}
                placeholder="https://example.com"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyLink()
                  if (e.key === 'Escape') setShowLinkPopover(false)
                }}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  padding: '8px 10px',
                  outline: 'none'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
                <button
                  onMouseDown={keepEditorSelectionOnMenuMouseDown}
                  onClick={handleBrowseLinkFile}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '7px',
                    color: 'var(--text-secondary)',
                    fontSize: '12px',
                    padding: '6px 10px',
                    cursor: 'pointer'
                  }}
                >
                  <FolderOpen size={12} />
                  File
                </button>
                <button
                  onMouseDown={keepEditorSelectionOnMenuMouseDown}
                  onClick={handleBrowseLinkFolder}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '7px',
                    color: 'var(--text-secondary)',
                    fontSize: '12px',
                    padding: '6px 10px',
                    cursor: 'pointer'
                  }}
                >
                  <Folder size={12} />
                  Folder
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                <button
                  onMouseDown={keepEditorSelectionOnMenuMouseDown}
                  onClick={() => setShowLinkPopover(false)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '7px',
                    color: 'var(--text-secondary)',
                    fontSize: '12px',
                    padding: '6px 10px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onMouseDown={keepEditorSelectionOnMenuMouseDown}
                  onClick={applyLink}
                  style={{
                    background: accent,
                    border: '1px solid transparent',
                    borderRadius: '7px',
                    color: '#fff',
                    fontSize: '12px',
                    padding: '6px 10px',
                    cursor: 'pointer'
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          )}
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

      {/* Tiptap editor styles scoped to overview */}
      <style>{`
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
