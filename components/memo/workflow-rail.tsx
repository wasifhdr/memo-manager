import {
  IconCheckCircle, IconClock, IconEdit, IconXCircle, IconSlashCircle,
} from '@/components/ui/icons'
import type { RequiredAction, StepOutcome } from '@/db/schema'

export type RailStep = {
  id: string
  cycle: number
  stepNo: number
  positionTitle: string | null
  assigneeName: string
  requiredAction: RequiredAction
  outcome: StepOutcome
  actedByName: string | null
  onBehalfOfName: string | null
  actedAt: Date | string | null
  comment: string | null
}

function fmtTime(d: Date | string): string {
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

const OUTCOME_META: Record<StepOutcome, { label: string; tone: 'done' | 'stopped' | 'changes' | 'pending' }> = {
  pending: { label: 'Awaiting', tone: 'pending' },
  approved: { label: 'Approved', tone: 'done' },
  reviewed: { label: 'Reviewed', tone: 'done' },
  rejected: { label: 'Rejected', tone: 'stopped' },
  changes_requested: { label: 'Changes requested', tone: 'changes' },
  skipped: { label: 'Skipped', tone: 'stopped' },
}

function StepIcon({ outcome, isCurrent }: { outcome: StepOutcome; isCurrent: boolean }) {
  const cls = 'size-4'
  if (outcome === 'approved' || outcome === 'reviewed') return <IconCheckCircle className={`${cls} text-(--st-approved-fg)`} />
  if (outcome === 'rejected') return <IconXCircle className={`${cls} text-(--st-rejected-fg)`} />
  if (outcome === 'changes_requested') return <IconEdit className={`${cls} text-(--st-changes-fg)`} />
  if (outcome === 'skipped') return <IconSlashCircle className={`${cls} text-(--text-faint)`} />
  return <IconClock className={`${cls} ${isCurrent ? 'text-(--accent)' : 'text-(--text-faint)'}`} />
}

function StepCard({ step, isCurrent }: { step: RailStep; isCurrent: boolean }) {
  const meta = OUTCOME_META[step.outcome]
  const base = 'flex-1 min-w-0 rounded-[var(--radius-md)] border px-3.5 py-3 transition-colors'
  const toneClass = isCurrent
    ? 'border-(--accent) bg-(--accent-tint) shadow-[var(--shadow-sm)]'
    : meta.tone === 'stopped'
      ? 'border-(--border) bg-(--surface-sunken) opacity-70'
      : meta.tone === 'pending'
        ? 'border-dashed border-(--border) bg-(--surface) opacity-60'
        : 'border-(--border) bg-(--surface)'

  return (
    <div className={`${base} ${toneClass}`}>
      <div className="flex items-start gap-2">
        <StepIcon outcome={step.outcome} isCurrent={isCurrent} />
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[0.8125rem] font-semibold ${isCurrent ? 'text-(--accent)' : 'text-(--text)'}`}>
            {step.positionTitle || `Step ${step.stepNo}`}
          </p>
          <p className="truncate text-[0.75rem] text-(--text-muted)">{step.assigneeName}</p>
          <p className="mt-1 text-[0.6875rem] font-medium uppercase tracking-wide text-(--text-faint)">
            {isCurrent
              ? `Needs ${step.requiredAction === 'review' ? 'review' : 'approval'} now`
              : meta.label}
          </p>
          {step.outcome !== 'pending' && step.actedAt ? (
            <p className="mt-1 text-[0.6875rem] text-(--text-faint)">
              {step.actedByName}
              {step.onBehalfOfName ? ` (on behalf of ${step.onBehalfOfName})` : ''} · {fmtTime(step.actedAt)}
            </p>
          ) : null}
          {step.comment ? (
            <p className="mt-1.5 text-[0.75rem] text-(--text-muted)">&ldquo;{step.comment}&rdquo;</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function WorkflowRail({
  cycles, currentCycle, currentStepNo,
}: {
  cycles: { cycle: number; steps: RailStep[] }[]
  currentCycle: number
  currentStepNo: number | null
}) {
  const current = cycles.find((c) => c.cycle === currentCycle) ?? cycles.at(-1)
  const previous = cycles.filter((c) => c.cycle !== current?.cycle)

  return (
    <div>
      {current ? (
        <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
          {current.steps.map((step) => (
            <StepCard
              key={step.id} step={step}
              isCurrent={step.cycle === currentCycle && step.stepNo === currentStepNo && step.outcome === 'pending'}
            />
          ))}
        </div>
      ) : null}

      {previous.length > 0 ? (
        <details className="mt-4 group">
          <summary className="cursor-pointer text-[0.75rem] font-medium text-(--text-faint) hover:text-(--text-muted)">
            Previous rounds ({previous.length})
          </summary>
          <div className="mt-3 flex flex-col gap-4">
            {previous.map((c) => (
              <div key={c.cycle}>
                <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-(--text-faint)">
                  Round {c.cycle}
                </p>
                <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
                  {c.steps.map((step) => <StepCard key={step.id} step={step} isCurrent={false} />)}
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  )
}
