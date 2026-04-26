import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import UnderlineExt from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import { Markdown } from 'tiptap-markdown'
import { Edit2, Save } from 'lucide-react'


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
      StarterKit.configure({ heading: false, code: false, codeBlock: false }),
      UnderlineExt,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder: 'Add a description for this project...' }),
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
  }, [editor, saveContent])


  const accent = projectColor || 'var(--accent)'
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
          border: isEditing ? `1px solid ${accent + '55'}` : 'none',
          background: isEditing ? 'rgba(0,0,0,0.15)' : 'transparent',
          transition: 'all 0.2s ease',
          minHeight: '60px'
        }}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Tiptap editor styles scoped to overview */}
      <style>{`
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