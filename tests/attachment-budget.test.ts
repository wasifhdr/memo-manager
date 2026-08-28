import { describe, it, expect } from 'vitest'
import {
  ATTACHMENT_MAX_BYTES, ATTACHMENT_MAX_REQUEST_BYTES, overRequestBudget,
} from '@/lib/attachment-limits'

const MB = 1024 * 1024

/**
 * A memo and its attachments are submitted as one Server Action request, and
 * that request has a ceiling — Next's own body limit, and below it whatever the
 * host allows (4.5 MB on Vercel). Files that each pass the per-file check can
 * still blow past it together, which used to surface as a 413 from the platform
 * and a blank "a server error occurred" page. This is the rule that stops it,
 * applied by both the New memo form and the server action.
 */
describe('overRequestBudget', () => {
  it('leaves room for the memo itself inside the platform limit', () => {
    expect(ATTACHMENT_MAX_REQUEST_BYTES).toBeLessThan(4.5 * MB)
    // One file at the advertised per-file cap must still be attachable.
    expect(ATTACHMENT_MAX_BYTES).toBeLessThanOrEqual(ATTACHMENT_MAX_REQUEST_BYTES)
  })

  it('passes nothing, one small file, and one file at the per-file cap', () => {
    expect(overRequestBudget([])).toBe(false)
    expect(overRequestBudget([200 * 1024])).toBe(false)
    expect(overRequestBudget([ATTACHMENT_MAX_BYTES])).toBe(false)
  })

  it('rejects files that individually pass but together exceed the request', () => {
    const half = Math.ceil(ATTACHMENT_MAX_REQUEST_BYTES / 2) + 1
    expect(overRequestBudget([half, half])).toBe(true)
  })

  it('rejects a single file past the budget', () => {
    expect(overRequestBudget([ATTACHMENT_MAX_REQUEST_BYTES + 1])).toBe(true)
  })
})
