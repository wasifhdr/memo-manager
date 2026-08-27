'use client'

import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useState } from 'react'

function ToolbarButton({
  active, onClick, label, children,
}: {
  active?: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`flex h-8 min-w-8 items-center justify-center rounded-[var(--radius-sm)] px-2 text-[0.8125rem] font-medium transition-colors ${
        active ? 'bg-(--accent-tint) text-(--accent)' : 'text-(--text-muted) hover:bg-(--surface-sunken) hover:text-(--text)'
      }`}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-(--border) bg-(--surface-sunken) px-2 py-1.5">
      <ToolbarButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <span className="font-bold">B</span>
      </ToolbarButton>
      <ToolbarButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <span className="italic">I</span>
      </ToolbarButton>
      <ToolbarButton label="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <span className="underline">U</span>
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-(--border)" />
      <ToolbarButton label="Heading" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        H2
      </ToolbarButton>
      <ToolbarButton label="Subheading" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        H3
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-(--border)" />
      <ToolbarButton label="Bulleted list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        •—
      </ToolbarButton>
      <ToolbarButton label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1.
      </ToolbarButton>
      <ToolbarButton label="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        &ldquo;
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-(--border)" />
      <ToolbarButton
        label="Link"
        active={editor.isActive('link')}
        onClick={() => {
          const prev = editor.getAttributes('link').href as string | undefined
          const url = window.prompt('Link URL', prev ?? 'https://')
          if (url === null) return
          if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
          } else {
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
          }
        }}
      >
        Link
      </ToolbarButton>
    </div>
  )
}

export function MemoEditor({
  name, initialHtml = '', placeholder = 'Write the memo…',
}: {
  name: string
  initialHtml?: string
  placeholder?: string
}) {
  const [html, setHtml] = useState(initialHtml)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit],
    content: initialHtml,
    editorProps: {
      attributes: {
        class: 'prose-memo min-h-48 max-w-none px-3.5 py-3 text-sm text-(--text) focus:outline-none',
        'aria-label': placeholder,
      },
    },
    onUpdate: ({ editor }) => setHtml(editor.getHTML()),
  })

  // Keep the hidden field in sync if the initial value changes out from under
  // us (e.g. after a server action revalidates with fresh data).
  useEffect(() => {
    if (editor && initialHtml !== editor.getHTML()) {
      editor.commands.setContent(initialHtml)
      setHtml(initialHtml)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialHtml])

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-(--border-strong) bg-(--surface)">
      <input type="hidden" name={name} value={html} />
      {editor ? <Toolbar editor={editor} /> : null}
      <EditorContent editor={editor} />
    </div>
  )
}
