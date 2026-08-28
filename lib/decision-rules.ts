/**
 * Which workflow decisions must be explained.
 *
 * Kept in its own module rather than inside the server action so the form and
 * the server share one definition — the disabled button and the validation
 * cannot drift apart — and so the rule is testable without a request scope.
 */

export const DECISION_ACTIONS = ['approve', 'reject', 'request_changes', 'comment', 'complete_review'] as const
export type DecisionAction = (typeof DECISION_ACTIONS)[number]

/** Turning a memo down, or sending it back, has to come with a reason. */
const REASON_REQUIRED: readonly string[] = ['reject', 'request_changes']

export const REASON_REQUIRED_MESSAGE = 'Give a reason before rejecting or requesting changes.'

export function requiresReason(action: string): boolean {
  return REASON_REQUIRED.includes(action)
}

/** True when the action needs a reason and none was given. */
export function isMissingReason(action: string, comment?: string | null): boolean {
  return requiresReason(action) && (comment ?? '').trim().length === 0
}
