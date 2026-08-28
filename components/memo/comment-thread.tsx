'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { workflowAction } from '@/app/(app)/memos/[id]/workflow-actions'
import type { ActionState } from '@/app/(auth)/actions'
import { FieldError } from '@/components/ui/field'

export type ThreadMessage = {
  id: string
  actorId: string | null
  actorName: string | null
  comment: string | null
  createdAt: Date | string
}

function fmtTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function fmtDay(d: Date | string): string {
  const day = new Date(d)
  const today = new Date()
  const sameDay = day.toDateString() === today.toDateString()
  if (sameDay) return 'Today'
  return day.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function initial(name: string | null): string {
  return (name?.trim()[0] ?? '?').toUpperCase()
}

/**
 * The memo conversation as a chat: own messages on the right, everyone else on
 * the left, oldest first, in a container that scrolls on its own so the page
 * around it stays put.
 */
export function CommentThread({
  memoId, currentUserId, messages, canComment,
}: {
  memoId: string
  currentUserId: string
  messages: ThreadMessage[]
  canComment: boolean
}) {
  const [text, setText] = useState('')
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    (prev, fd) => workflowAction(prev, fd).then((r) => { if (r?.ok) setText(''); return r }),
    undefined,
  )
  const scroller = useRef<HTMLDivElement>(null)
  const form = useRef<HTMLFormElement>(null)

  // Land at the newest message, and stay there as the thread grows.
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  return (
    <div className="flex flex-col">
      <div
        ref={scroller}
        className="flex max-h-[26rem] min-h-[12rem] flex-col gap-3 overflow-y-auto px-1 py-1"
      >
        {messages.length === 0 ? (
          <p className="m-auto text-[0.8125rem] text-(--color-ink)/50">No messages yet.</p>
        ) : (
          messages.map((m, i) => {
            const mine = m.actorId === currentUserId
            const prev = messages[i - 1]
            const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString()

            return (
              <div key={m.id} className="flex flex-col gap-3">
                {newDay ? (
                  <p className="text-center font-mono-nums text-[0.6875rem] uppercase text-(--color-ink)/45">
                    {fmtDay(m.createdAt)}
                  </p>
                ) : null}

                <div className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                  <span
                    aria-hidden
                    className={`flex size-6 shrink-0 items-center justify-center rounded-[var(--radius-pill)] text-[0.6875rem] font-bold ${
                      mine ? 'bg-(--color-ink) text-(--color-paper)' : 'bg-(--color-cream) text-(--color-ink)/70'
                    }`}
                  >
                    {initial(m.actorName)}
                  </span>

                  <div className={`flex min-w-0 max-w-[80%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                    {!mine ? (
                      <p className="mb-0.5 text-[0.6875rem] font-bold text-(--color-ink)/70">{m.actorName ?? 'System'}</p>
                    ) : null}
                    <div
                      className={`rounded-[var(--radius-card)] px-3 py-2 text-[0.8125rem] ${
                        mine
                          ? 'bg-(--color-ink) text-(--color-paper)'
                          : 'border border-(--color-sand) bg-(--color-cream) text-(--color-ink)'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.comment}</p>
                      <p className={`mt-1 font-mono-nums text-[0.625rem] ${mine ? 'text-(--color-paper)/60' : 'text-(--color-ink)/50'}`}>
                        {fmtTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {canComment ? (
        <form
          ref={form}
          action={formAction}
          className="mt-3 flex flex-col gap-1 border-t border-(--color-sand) pt-3"
        >
          <input type="hidden" name="memoId" value={memoId} />
          <input type="hidden" name="action" value="comment" />
          <div className="flex items-end gap-2 rounded-[var(--radius-card)] border-2 border-(--color-ink) bg-(--color-paper) px-3 py-2">
            <textarea
              name="comment"
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && text.trim()) {
                  e.preventDefault()
                  form.current?.requestSubmit()
                }
              }}
              placeholder="Type your message…"
              aria-label="Message"
              className="max-h-24 min-h-6 flex-1 resize-none bg-transparent text-[0.8125rem] text-(--color-ink) outline-none placeholder:text-(--color-ink)/40"
            />
            <button
              type="submit"
              disabled={pending || !text.trim()}
              aria-label="Send message"
              className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-(--color-orange) text-white transition-colors hover:bg-(--color-orange-deep) disabled:bg-(--color-sand) disabled:text-(--color-ink)/50 focus-visible:outline-[3px] focus-visible:outline-(--color-ink) focus-visible:outline-offset-2"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                <path d="M22 2 11 13" />
                <path d="M22 2 15 22l-4-9-9-4Z" />
              </svg>
            </button>
          </div>
          <p className="text-[0.6875rem] text-(--color-ink)/45">Enter sends · Shift + Enter adds a line</p>
          <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>
        </form>
      ) : null}
    </div>
  )
}
