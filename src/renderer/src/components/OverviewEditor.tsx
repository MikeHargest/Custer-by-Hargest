import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import UnderlineExt from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import { Markdown } from 'tiptap-markdown'

const MAX_CHARS = 400

interface OverviewEditorProps {
  projectPath: string
  projectColor?: string
  projectId: string // used to reset editor when project changes
}

export default function OverviewEditor({
  projectPath,
  projectColor,
  projectId
}: OverviewEditorProps): React.ReactElement {
  const [charCount, setCharCount] = useState(0)
  const [isFocused, setIsFocused] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const projectIdRef = useRef(projectId)
  const projectPathRef = useRef(projectPath)

  // Keep refs up to date
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
    editorProps: {
      attributes: { class: 'overview-tiptap' }
    },
    onFocus: () => setIsFocused(true),
    onBlur: () => setIsFocused(false),
    onUpdate: ({ editor: e }) => {
      const text = e.getText()
      const len = text.length

      // Enforce char limit — revert last change if over limit
      if (len > MAX_CHARS) {
        e.commands.undo()
        return
      }

      setCharCount(len)

      const markdown = (e.storage as any).markdown.getMarkdown()

      // Debounced autosave
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        saveContent(markdown)
      }, 1200)
    }
  })

  // Load description from file when project changes
  useEffect(() => {
    if (!editor || !projectPath) return

    setIsLoaded(false)

    const load = async () => {
      try {
        const content = await (window as any).api.readOverviewDescription(projectPath)
        if (projectIdRef.current === projectId) {
          // Only apply if still same project
          editor.commands.setContent(content || '', { emitUpdate: false })
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

  // Flush save on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  const accent = projectColor || 'var(--accent)'
  const isNearLimit = charCount >= MAX_CHARS * 0.85
  const isAtLimit = charCount >= MAX_CHARS

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
      {/* Editor container */}
      <div
        style={{
          position: 'relative',
          borderRadius: '10px',
          border: `1px solid ${isFocused ? accent + '55' : 'rgba(255,255,255,0.06)'}`,
          background: 'rgba(0,0,0,0.15)',
          transition: 'border-color 0.2s ease',
          minHeight: '100px'
        }}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Character counter */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '6px'
        }}
      >
        {isAtLimit && (
          <span
            style={{
              fontSize: '11px',
              color: 'var(--danger, #f87171)',
              fontWeight: 500,
              opacity: 0.9
            }}
          >
            Limit reached
          </span>
        )}
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
          {charCount} / {MAX_CHARS}
        </span>
      </div>

      {/* Tiptap editor styles scoped to overview */}
      <style>{`
        .overview-tiptap {
          outline: none;
          padding: 12px 14px;
          font-size: 13px;
          line-height: 1.7;
          color: var(--text-secondary);
          min-height: 80px;
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
