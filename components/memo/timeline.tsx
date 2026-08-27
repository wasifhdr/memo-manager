import type { EventType } from '@/db/schema'
import {
  IconCheckCircle, IconClock, IconEdit, IconXCircle, IconCircleDashed, IconSlashCircle, IconPaperclip,
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
}

const ICON: Record<EventType, typeof IconClock> = {
  created: IconCircleDashed, submitted: IconClock, resubmitted: IconClock,
  approved: IconCheckCircle, reviewed: IconCheckCircle, rejected: IconXCircle,
  changes_requested: IconEdit, comment: IconEdit, forwarded: IconClock,
  completed: IconCheckCircle, cancelled: IconSlashCircle,
  attachment_added: IconPaperclip, attachment_deleted: IconPaperclip,
  version_created: IconEdit, participant_assigned: IconEdit, edited: IconEdit,
}

const TONE: Record<EventType, string> = {
  created: 'text-(--text-faint)', submitted: 'text-(--st-pending-fg)', resubmitted: 'text-(--st-pending-fg)',
  approved: 'text-(--st-approved-fg)', reviewed: 'text-(--st-approved-fg)', rejected: 'text-(--st-rejected-fg)',
  changes_requested: 'text-(--st-changes-fg)', comment: 'text-(--text-faint)', forwarded: 'text-(--text-faint)',
  completed: 'text-(--st-approved-fg)', cancelled: 'text-(--text-faint)',
  attachment_added: 'text-(--text-faint)', attachment_deleted: 'text-(--text-faint)',
  version_created: 'text-(--st-changes-fg)', participant_assigned: 'text-(--text-faint)', edited: 'text-(--text-faint)',
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-[0.8125rem] text-(--text-faint)">No activity yet.</p>
  }

  return (
    <ol className="flex flex-col">
      {events.map((e, i) => {
        const Icon = ICON[e.type]
        return (
          <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
            {i < events.length - 1 ? (
              <span className="absolute left-[0.5625rem] top-5 bottom-0 w-px bg-(--border)" />
            ) : null}
            <span className={`z-10 flex size-[1.125rem] shrink-0 items-center justify-center rounded-full bg-(--surface) ${TONE[e.type]}`}>
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[0.8125rem] text-(--text)">
                <span className="font-medium">{e.actorName ?? 'System'}</span>{' '}
                {e.onBehalfOfName ? <span className="text-(--text-muted)">(on behalf of {e.onBehalfOfName}) </span> : null}
                {VERB[e.type]}
                {e.detail && e.type !== 'created' ? <span className="text-(--text-muted)"> — {e.detail}</span> : null}
              </p>
              <p className="mt-0.5 font-mono-nums text-[0.6875rem] text-(--text-faint)">{fmtTime(e.createdAt)}</p>
              {e.comment ? (
                <p className="mt-1.5 rounded-[var(--radius-sm)] bg-(--surface-sunken) px-2.5 py-1.5 text-[0.8125rem] text-(--text-muted)">
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
