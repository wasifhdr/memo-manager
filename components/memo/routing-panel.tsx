'use client'

import { useActionState, useState } from 'react'
import {
  addParticipantAction, removeParticipantAction, reassignAction,
} from '@/app/(app)/memos/[id]/workflow-actions'
import type { ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Select, FieldError } from '@/components/ui/field'
import { IconClose } from '@/components/ui/icons'
import { PositionField, peopleForPosition, type ActiveUser } from '@/components/memo/participant-picker'

export type QueueStep = {
  id: string
  stepNo: number
  positionTitle: string | null
  assigneeName: string
}

/**
 * The rest of the queue, while the memo is in flight: whoever is holding it and
 * the author can drop someone still waiting, or slot a new person in. The seat
 * holding the memo is shown but never removable — the holder hands it over from
 * the decision box, and the author from here.
 */
export function RoutingPanel({
  memoId, current, pending, canReassignCurrent, activeUsers, designations,
}: {
  memoId: string
  /** The seat holding the memo. */
  current: QueueStep
  /** Steps after the current one that have not acted, in order. */
  pending: QueueStep[]
  /** The author may move the memo off a seat that is sitting on it. */
  canReassignCurrent: boolean
  activeUsers: ActiveUser[]
  /** The organization's designations, offered as position titles. */
  designations: string[]
}) {
  const currentStepNo = current.stepNo
  const currentLabel = current.positionTitle || current.assigneeName
  const [userId, setUserId] = useState('')
  const [position, setPosition] = useState('')
  const [afterStepNo, setAfterStepNo] = useState(String(pending.at(-1)?.stepNo ?? currentStepNo))

  const [state, formAction, adding] = useActionState<ActionState, FormData>(
    (prev, fd) => addParticipantAction(prev, fd).then((r) => {
      if (r?.ok) { setUserId(''); setPosition('') }
      return r
    }),
    undefined,
  )

  // Only people who hold the chosen position; blank position means anyone.
  const candidates = peopleForPosition(activeUsers, position, userId)
  const userOptions = candidates.map((u) => ({
    value: u.id, label: u.designation ? `${u.name} — ${u.designation}` : u.name,
  }))

  function changePosition(next: string) {
    setPosition(next)
    if (!peopleForPosition(activeUsers, next).some((u) => u.id === userId)) setUserId('')
  }
  const afterOptions = [
    { value: String(currentStepNo), label: `After ${currentLabel}` },
    ...pending.map((s) => ({ value: String(s.stepNo), label: `After ${s.positionTitle || s.assigneeName}` })),
  ]

  return (
    <div className="rounded-[var(--radius-card)] border border-(--color-sand) bg-(--color-paper) p-4">
      <p className="mb-2.5 text-[0.8125rem] font-bold text-(--color-ink)">Rest of the workflow</p>

      <div className="mb-1.5 rounded-[var(--radius-control)] border-2 border-(--color-orange-deep) bg-(--color-orange)/10 px-3 py-2">
        <p className="text-label uppercase text-(--color-orange-deep)">Holding the memo</p>
        <p className="mt-0.5 truncate text-[0.8125rem] font-bold text-(--color-ink)">{currentLabel}</p>
        <p className="truncate text-[0.75rem] text-(--color-ink)/70">{current.assigneeName}</p>
        {canReassignCurrent ? <HandOverForm memoId={memoId} step={current} activeUsers={activeUsers} /> : null}
      </div>

      {pending.length === 0 ? (
        <p className="text-[0.8125rem] text-(--color-ink)/50">
          Nobody is queued after this step — approving here approves the memo.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {pending.map((s) => (
            <QueueRow key={s.id} memoId={memoId} step={s} />
          ))}
        </ul>
      )}

      <form action={formAction} className="mt-3 flex flex-col gap-2 border-t border-(--color-sand) pt-3">
        <input type="hidden" name="memoId" value={memoId} />
        <input type="hidden" name="positionTitle" value={position} />
        <PositionField
          value={position} onChange={changePosition} designations={designations}
          placeholder="Their position (optional)" ariaLabel="Position"
        />
        <Select
          name="userId" value={userId} onChange={(e) => setUserId(e.target.value)}
          placeholder={position.trim() && candidates.length === 0 ? 'Nobody holds this position' : 'Add someone…'}
          options={userOptions} aria-label="Person to add"
        />
        <div className="flex items-center gap-2">
          <Select
            name="afterStepNo" value={afterStepNo} onChange={(e) => setAfterStepNo(e.target.value)}
            options={afterOptions} aria-label="Where to add them" className="flex-1"
          />
          <Button type="submit" size="sm" variant="secondary" disabled={adding || !userId}>
            {adding ? 'Adding…' : 'Add'}
          </Button>
        </div>
        <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>
      </form>
    </div>
  )
}

function QueueRow({ memoId, step }: { memoId: string; step: QueueStep }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(removeParticipantAction, undefined)

  return (
    <li className="rounded-[var(--radius-control)] border border-(--color-sand) bg-(--color-cream) px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8125rem] font-bold text-(--color-ink)">
            {step.positionTitle || `Step ${step.stepNo}`}
          </p>
          <p className="truncate text-[0.75rem] text-(--color-ink)/70">{step.assigneeName}</p>
        </div>
        <form action={formAction}>
          <input type="hidden" name="memoId" value={memoId} />
          <input type="hidden" name="stepId" value={step.id} />
          <button
            type="submit"
            disabled={pending}
            aria-label={`Remove ${step.assigneeName} from the workflow`}
            className="flex size-6 shrink-0 items-center justify-center rounded-[var(--radius-dot)] text-(--color-ink)/50 hover:bg-(--color-paper) hover:text-(--color-red-deep)"
          >
            <IconClose className="size-3.5" />
          </button>
        </form>
      </div>
      <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>
    </li>
  )
}

/** Moves a seat that is holding the memo to somebody else — the author's way of
 *  unsticking a memo parked with someone who is away. */
function HandOverForm({
  memoId, step, activeUsers,
}: {
  memoId: string
  step: QueueStep
  activeUsers: ActiveUser[]
}) {
  const [userId, setUserId] = useState('')
  const [state, formAction, pending] = useActionState<ActionState, FormData>(reassignAction, undefined)

  return (
    <form action={formAction} className="mt-2 flex items-center gap-2">
      <input type="hidden" name="memoId" value={memoId} />
      <input type="hidden" name="stepId" value={step.id} />
      <Select
        name="toUserId" value={userId} onChange={(e) => setUserId(e.target.value)}
        placeholder="Hand over to…" aria-label="Hand this seat to"
        options={activeUsers.map((u) => ({
          value: u.id, label: u.designation ? `${u.name} — ${u.designation}` : u.name,
        }))}
        className="h-9 flex-1"
      />
      <Button type="submit" size="sm" variant="secondary" disabled={pending || !userId}>
        {pending ? 'Moving…' : 'Hand over'}
      </Button>
      <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>
    </form>
  )
}
