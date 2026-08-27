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
      <p className={`text-[0.8125rem] ${unread ? 'font-semibold text-(--color-ink)' : 'text-(--color-ink)/70'}`}>{n.title}</p>
      {n.body ? <p className="mt-0.5 truncate text-[0.8125rem] text-(--color-ink)/50">{n.body}</p> : null}
      <p className="mt-1 font-mono-nums text-[0.6875rem] text-(--color-ink)/50">{formatDateTime(n.createdAt)}</p>
    </div>
  )

  return (
    <li className={`flex items-start gap-3 rounded-[var(--radius-control)] px-3 py-3 ${unread ? 'bg-(--color-orange)/10' : ''}`}>
      {unread ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-(--color-orange)" /> : <span className="mt-1.5 size-2 shrink-0" />}
      {n.memoId ? <Link href={`/memos/${n.memoId}`} className="min-w-0 flex-1 hover:text-(--color-orange-deep)">{content}</Link> : content}
      {unread ? (
        <form action={formAction}>
          <input type="hidden" name="id" value={n.id} />
          <button
            type="submit" disabled={pending}
            aria-label="Mark as read"
            className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-(--color-ink)/50 hover:bg-(--color-cream) hover:text-(--color-green-deep)"
          >
            <IconCheckCircle className="size-4" />
          </button>
        </form>
      ) : null}
    </li>
  )
}
