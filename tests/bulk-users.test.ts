import { describe, it, expect } from 'vitest'
import {
  validateBulkUsers, emptyDraft, isBlankDraft, BULK_MAX_ROWS,
  type BulkUserDraft,
} from '@/app/(admin)/admin/users/bulk-users'

const draft = (over: Partial<BulkUserDraft> = {}): BulkUserDraft => ({
  ...emptyDraft(), name: 'Ayesha Rahman', email: 'ayesha@x.edu', ...over,
})

describe('isBlankDraft', () => {
  it('treats a fresh row as blank even though it carries a default role', () => {
    expect(isBlankDraft(emptyDraft())).toBe(true)
  })
  it('is not blank once any field is filled', () => {
    expect(isBlankDraft({ ...emptyDraft(), name: 'A' })).toBe(false)
    expect(isBlankDraft({ ...emptyDraft(), departmentId: 'dept-1' })).toBe(false)
  })
})

describe('validateBulkUsers', () => {
  it('accepts a single filled row and normalises it', () => {
    const { valid, errors } = validateBulkUsers([draft({ name: '  Ayesha Rahman ', email: '  AYESHA@X.EDU ' })])
    expect(errors).toEqual([])
    expect(valid).toHaveLength(1)
    expect(valid[0].draft).toMatchObject({ name: 'Ayesha Rahman', email: 'ayesha@x.edu', role: 'user' })
  })

  it('ignores untouched rows instead of reporting them', () => {
    // the form always keeps a spare empty row around
    const { valid, errors, blank } = validateBulkUsers([draft(), emptyDraft(), emptyDraft()])
    expect(valid).toHaveLength(1)
    expect(errors).toEqual([])
    expect(blank).toBe(2)
  })

  it('reports a bad email against its own row index', () => {
    const { valid, errors } = validateBulkUsers([draft(), draft({ email: 'nope' }), draft({ email: 'c@x.edu' })])
    expect(valid).toHaveLength(2)
    expect(errors).toHaveLength(1)
    expect(errors[0].index).toBe(1)
  })

  it('requires an email when other fields are filled', () => {
    const { errors } = validateBulkUsers([draft({ email: '' })])
    expect(errors[0].message).toBe('Email is required.')
  })

  it('rejects a too-short name', () => {
    const { valid, errors } = validateBulkUsers([draft({ name: 'A' })])
    expect(valid).toHaveLength(0)
    expect(errors[0].message).toMatch(/2–120/)
  })

  it('flags a duplicate email and points at the earlier row, case-insensitively', () => {
    const { valid, errors } = validateBulkUsers([
      draft({ email: 'dup@x.edu' }),
      draft({ email: 'DUP@X.EDU' }),
    ])
    expect(valid).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(errors[0].index).toBe(1)
    expect(errors[0].message).toBe('Duplicate of row 1.')
  })

  it('keeps a department id through validation', () => {
    const { valid } = validateBulkUsers([draft({ departmentId: 'dept-uuid' })])
    expect(valid[0].draft.departmentId).toBe('dept-uuid')
  })

  it('accepts the admin role', () => {
    const { valid, errors } = validateBulkUsers([draft({ role: 'org_admin' })])
    expect(errors).toEqual([])
    expect(valid[0].draft.role).toBe('org_admin')
  })

  it('rejects a role that is not one of the two', () => {
    const { valid, errors } = validateBulkUsers([draft({ role: 'superuser' as never })])
    expect(valid).toHaveLength(0)
    expect(errors[0].message).toBe('Choose a role.')
  })

  it('caps the batch and explains the overflow rows', () => {
    const many = Array.from({ length: BULK_MAX_ROWS + 3 }, (_, i) =>
      draft({ name: `User ${i}`, email: `u${i}@x.edu` }))
    const { valid, errors } = validateBulkUsers(many)
    expect(valid).toHaveLength(BULK_MAX_ROWS)
    expect(errors).toHaveLength(3)
    expect(errors[0].message).toMatch(/can be added at once/)
  })

  it('returns nothing for an all-blank form', () => {
    const { valid, errors } = validateBulkUsers([emptyDraft()])
    expect(valid).toEqual([])
    expect(errors).toEqual([])
  })
})
