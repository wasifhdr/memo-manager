'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { markNotificationReadAction } from './actions'
import type { ActionState } from '@/app/(auth)/actions'
import { IconCheckCircle } from '@/components/ui/icons'
import { formatDateTime } from '@/lib/format'

export type NotificationItem = {
  id: string
  title: string
  body: string | null
  memoId: string | null
  readAt: Date | string | null
  createdAt: Date | string
}

export function NotificationRow({ n }: { n: NotificationItem }) {
  const [, formAction, pending] = useActionState<ActionState, FormData>(markNotificationReadAction, undefined)
  const unread = !n.readAt
  const content = (
    <div className="min-w-0 flex-1">
      <p className={`text-[0.8125rem] ${unread ? 'font-semibold text-(--text)' : 'text-(--text-muted)'}`}>{n.title}</p>
      {n.body ? <p className="mt-0.5 truncate text-[0.8125rem] text-(--text-faint)">{n.body}</p> : null}
      <p className="mt-1 font-mono-nums text-[0.6875rem] text-(--text-faint)">{formatDateTime(n.createdAt)}</p>
    </div>
  )

  return (
    <li className={`flex items-start gap-3 rounded-[var(--radius-md)] px-3 py-3 ${unread ? 'bg-(--accent-tint)' : ''}`}>
      {unread ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-(--accent)" /> : <span className="mt-1.5 size-2 shrink-0" />}
      {n.memoId ? <Link href={`/memos/${n.memoId}`} className="min-w-0 flex-1 hover:text-(--accent)">{content}</Link> : content}
      {unread ? (
        <form action={formAction}>
          <input type="hidden" name="id" value={n.id} />
          <button
            type="submit" disabled={pending}
            aria-label="Mark as read"
            className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-(--text-faint) hover:bg-(--surface-sunken) hover:text-(--st-approved-fg)"
          >
            <IconCheckCircle className="size-4" />
          </button>
        </form>
      ) : null}
    </li>
  )
}
