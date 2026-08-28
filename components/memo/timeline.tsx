import type { EventType } from '@/db/schema'
import {
  IconCheckCircle, IconClock, IconEdit, IconXCircle, IconCircleDashed, IconSlashCircle, IconPaperclip,
  IconUsers,
} from '@/components/ui/icons'

export type TimelineEvent = {
  id: string
  type: EventType
  actorName: string | null
  onBehalfOfName: string | null
  comment: string | null
  detail: string | null
  createdAt: Date | string
}

function fmtTime(d: Date | string): string {
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

const VERB: Record<EventType, string> = {
  created: 'created the memo',
  submitted: 'submitted the memo',
  resubmitted: 'resubmitted the memo',
  approved: 'approved',
  reviewed: 'completed review',
  rejected: 'rejected the memo',
  changes_requested: 'requested changes',
  comment: 'commented',
  forwarded: 'forwarded the memo',
  completed: 'completed the workflow',
  cancelled: 'cancelled the memo',
  attachment_added: 'added an attachment',
  attachment_deleted: 'removed an attachment',
  version_created: 'created a new version',
  participant_assigned: 'set the workflow participants',
  edited: 'edited the memo',
  reassigned: 'handed a step to someone else',
  participant_added: 'added a participant',
  participant_removed: 'removed a participant',
}

const ICON: Record<EventType, typeof IconClock> = {
  created: IconCircleDashed, submitted: IconClock, resubmitted: IconClock,
  approved: IconCheckCircle, reviewed: IconCheckCircle, rejected: IconXCircle,
  changes_requested: IconEdit, comment: IconEdit, forwarded: IconClock,
  completed: IconCheckCircle, cancelled: IconSlashCircle,
  attachment_added: IconPaperclip, attachment_deleted: IconPaperclip,
  version_created: IconEdit, participant_assigned: IconEdit, edited: IconEdit,
  reassigned: IconUsers, participant_added: IconUsers, participant_removed: IconUsers,
}

const TONE: Record<EventType, string> = {
  created: 'text-(--color-ink)/50', submitted: 'text-(--color-gold-deep)', resubmitted: 'text-(--color-gold-deep)',
  approved: 'text-(--color-green-deep)', reviewed: 'text-(--color-green-deep)', rejected: 'text-(--color-red-deep)',
  changes_requested: 'text-(--color-gold-deep)', comment: 'text-(--color-ink)/50', forwarded: 'text-(--color-ink)/50',
  completed: 'text-(--color-green-deep)', cancelled: 'text-(--color-ink)/50',
  attachment_added: 'text-(--color-ink)/50', attachment_deleted: 'text-(--color-ink)/50',
  version_created: 'text-(--color-gold-deep)', participant_assigned: 'text-(--color-ink)/50', edited: 'text-(--color-ink)/50',
  reassigned: 'text-(--color-blue-deep)', participant_added: 'text-(--color-blue-deep)',
  participant_removed: 'text-(--color-blue-deep)',
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-[0.8125rem] text-(--color-ink)/50">No activity yet.</p>
  }

  return (
    <ol className="flex flex-col">
      {events.map((e, i) => {
        const Icon = ICON[e.type]
        return (
          <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
            {i < events.length - 1 ? (
              <span className="absolute left-[0.5625rem] top-5 bottom-0 w-px bg-(--color-sand)" />
            ) : null}
            <span className={`z-10 flex size-[1.125rem] shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-(--color-paper) ${TONE[e.type]}`}>
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[0.8125rem] text-(--color-ink)">
                <span className="font-bold">{e.actorName ?? 'System'}</span>{' '}
                {e.onBehalfOfName ? <span className="text-(--color-ink)/70">(on behalf of {e.onBehalfOfName}) </span> : null}
                {VERB[e.type]}
                {e.detail && e.type !== 'created' ? <span className="text-(--color-ink)/70"> — {e.detail}</span> : null}
              </p>
              <p className="mt-0.5 font-mono-nums text-[0.6875rem] text-(--color-ink)/50">{fmtTime(e.createdAt)}</p>
              {e.comment ? (
                <p className="mt-1.5 rounded-[var(--radius-control)] bg-(--color-cream) px-2.5 py-1.5 text-[0.8125rem] text-(--color-ink)/70">
                  &ldquo;{e.comment}&rdquo;
                </p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
