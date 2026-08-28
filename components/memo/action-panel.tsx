'use client'

import { useActionState, useState } from 'react'
import { workflowAction, reassignAction } from '@/app/(app)/memos/[id]/workflow-actions'
import type { ActionState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Textarea, Select, FieldError, Label } from '@/components/ui/field'
import { requiresReason } from '@/lib/decision-rules'
import { PositionField, peopleForPosition, type ActiveUser } from '@/components/memo/participant-picker'

export function ActionPanel({
  memoId, canAct, actingForName, currentStepId, activeUsers, designations,
}: {
  memoId: string
  canAct: boolean
  actingForName: string | null
  /** The step the memo is sitting on — the seat this panel can hand over. */
  currentStepId: string | null
  activeUsers: ActiveUser[]
  /** The organization's designations, offered as position titles. */
  designations: string[]
}) {
  if (!canAct) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[var(--radius-card)] border-2 border-(--color-gold-deep)/50 bg-(--color-gold)/10 p-4">
        <p className="mb-3 text-[0.8125rem] font-bold text-(--color-gold-deep)">
          {actingForName ? `You are acting on behalf of ${actingForName}.` : 'This memo is waiting on your decision.'}
        </p>
        <DecisionForm memoId={memoId} />
        {currentStepId ? (
          <PassItOn
            memoId={memoId} stepId={currentStepId}
            activeUsers={activeUsers} designations={designations}
          />
        ) : null}
      </div>
    </div>
  )
}

/**
 * One comment box for all three decisions. The button that submits carries the
 * action, so there is no second prompt to fill in afterwards.
 */
function DecisionForm({ memoId }: { memoId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(workflowAction, undefined)
  const [comment, setComment] = useState('')

  // Same rule the server applies, from the same module, so the disabled button
  // and the validation cannot drift apart.
  const hasReason = comment.trim().length > 0
  const blocked = (action: string) => requiresReason(action) && !hasReason

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="memoId" value={memoId} />

      <Textarea
        name="comment"
        rows={3}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comment — optional to approve, required to reject or request changes"
        aria-label="Comment"
      />

      <div className="flex flex-wrap gap-2">
        {/* the submitter's name/value lands in the FormData, so each button
            carries its own action without a hidden field per decision */}
        <Button type="submit" name="action" value="approve" size="sm" disabled={pending}>
          {pending ? 'Submitting…' : 'Approve'}
        </Button>
        <Button
          type="submit" name="action" value="request_changes"
          variant="secondary" size="sm"
          disabled={pending || blocked('request_changes')}
          title={blocked('request_changes') ? 'Add a comment explaining what needs to change' : undefined}
        >
          Request changes
        </Button>
        <Button
          type="submit" name="action" value="reject"
          variant="danger" size="sm"
          disabled={pending || blocked('reject')}
          title={blocked('reject') ? 'Add a comment explaining the rejection' : undefined}
        >
          Reject
        </Button>
      </div>

      {!hasReason ? (
        <p className="text-[0.75rem] text-(--color-ink)/60">
          Rejecting or requesting changes needs a comment.
        </p>
      ) : null}

      <FieldError>{state && 'error' in state ? state.error : undefined}</FieldError>
    </form>
  )
}

/**
 * The two ways to move the memo sideways rather than down the queue: approve it
 * and route it through someone outside the workflow first, or decline and hand
 * the seat over without deciding. One person picker, two verbs.
 */
function PassItOn({
  memoId, stepId, activeUsers, designations,
}: {
  memoId: string
  stepId: string
  activeUsers: ActiveUser[]
  designations: string[]
}) {
  const [userId, setUserId] = useState('')
  const [position, setPosition] = useState('')
  const [forwardState, forwardAction, forwarding] = useActionState<ActionState, FormData>(workflowAction, undefined)
  const [handState, handAction, handing] = useActionState<ActionState, FormData>(reassignAction, undefined)

  // Choosing a position narrows the people to those who hold it.
  const candidates = peopleForPosition(activeUsers, position, userId)
  const options = candidates.map((u) => ({
    value: u.id, label: u.designation ? `${u.name} — ${u.designation}` : u.name,
  }))

  function changePosition(next: string) {
    setPosition(next)
    if (!peopleForPosition(activeUsers, next).some((u) => u.id === userId)) setUserId('')
  }
  const busy = forwarding || handing
  const error = (forwardState && 'error' in forwardState ? forwardState.error : undefined)
    ?? (handState && 'error' in handState ? handState.error : undefined)

  return (
    <div className="mt-4 border-t border-(--color-gold-deep)/30 pt-3">
      <Label htmlFor="passTo" hint="optional">Pass it on</Label>
      <PositionField
        value={position} onChange={changePosition} designations={designations}
        placeholder="Their position (optional)"
        ariaLabel="Position for the person you are passing to"
      />
      <Select
        id="passTo" value={userId} onChange={(e) => setUserId(e.target.value)}
        placeholder={position.trim() && candidates.length === 0 ? 'Nobody holds this position' : 'Choose a person…'}
        options={options} className="mt-2"
      />

      <div className="mt-2 flex flex-wrap gap-2">
        {/* Approve my step, then slot them in ahead of the rest of the queue. */}
        <form action={forwardAction}>
          <input type="hidden" name="memoId" value={memoId} />
          <input type="hidden" name="action" value="approve" />
          <input type="hidden" name="forwardToUserId" value={userId} />
          <input type="hidden" name="forwardPosition" value={position} />
          <Button type="submit" size="sm" variant="secondary" disabled={busy || !userId}>
            {forwarding ? 'Forwarding…' : 'Approve & forward'}
          </Button>
        </form>

        {/* Hand my seat over without deciding. */}
        <form action={handAction}>
          <input type="hidden" name="memoId" value={memoId} />
          <input type="hidden" name="stepId" value={stepId} />
          <input type="hidden" name="toUserId" value={userId} />
          <input type="hidden" name="positionTitle" value={position} />
          <Button type="submit" size="sm" variant="ghost" disabled={busy || !userId}>
            {handing ? 'Handing over…' : 'Decline & hand over'}
          </Button>
        </form>
      </div>

      <p className="mt-1.5 text-[0.75rem] text-(--color-ink)/60">
        Forwarding approves your step and sends the memo to them first. Handing over gives them
        your seat without a decision.
      </p>
      <FieldError>{error}</FieldError>
    </div>
  )
}
