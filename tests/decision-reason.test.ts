import { describe, it, expect } from 'vitest'
import { requiresReason, isMissingReason, REASON_REQUIRED_MESSAGE } from '@/lib/decision-rules'

/**
 * The form disables Reject and Request changes until a comment is typed, but a
 * disabled button is not enforcement — the server action applies this same
 * predicate. Testing the rule directly covers both callers at once.
 */
describe('requiresReason', () => {
  it('demands one for the two decisions that turn a memo down', () => {
    expect(requiresReason('reject')).toBe(true)
    expect(requiresReason('request_changes')).toBe(true)
  })

  it('does not demand one to approve, review or comment', () => {
    expect(requiresReason('approve')).toBe(false)
    expect(requiresReason('complete_review')).toBe(false)
    expect(requiresReason('comment')).toBe(false)
  })
})

describe('isMissingReason', () => {
  for (const action of ['reject', 'request_changes']) {
    it(`blocks "${action}" with no comment`, () => {
      expect(isMissingReason(action, undefined)).toBe(true)
      expect(isMissingReason(action, null)).toBe(true)
      expect(isMissingReason(action, '')).toBe(true)
    })

    it(`blocks "${action}" with whitespace only`, () => {
      expect(isMissingReason(action, '   ')).toBe(true)
      expect(isMissingReason(action, '\n\t ')).toBe(true)
    })

    it(`allows "${action}" once something is written`, () => {
      expect(isMissingReason(action, 'Budget exceeded.')).toBe(false)
      // padding around real text still counts as a reason
      expect(isMissingReason(action, '  needs a CV  ')).toBe(false)
    })
  }

  it('never blocks approve, however empty the comment', () => {
    expect(isMissingReason('approve', '')).toBe(false)
    expect(isMissingReason('approve', undefined)).toBe(false)
  })

  it('never blocks a plain comment action', () => {
    expect(isMissingReason('comment', '')).toBe(false)
  })
})

describe('REASON_REQUIRED_MESSAGE', () => {
  it('says what to do, not just what went wrong', () => {
    expect(REASON_REQUIRED_MESSAGE).toBe('Give a reason before rejecting or requesting changes.')
  })
})
