import { describe, it, expect } from 'vitest'
import {
  parseBulkUsers,
  splitCsvLine,
  BULK_MAX_ROWS,
} from '@/app/(admin)/admin/users/bulk-parse'

describe('splitCsvLine', () => {
  it('splits plain fields and trims them', () => {
    expect(splitCsvLine('Ayesha, ayesha@x.edu ,Lecturer')).toEqual(['Ayesha', 'ayesha@x.edu', 'Lecturer'])
  })

  it('keeps commas inside quoted fields', () => {
    expect(splitCsvLine('Nadia,n@x.edu,"Finance, Payroll",Finance'))
      .toEqual(['Nadia', 'n@x.edu', 'Finance, Payroll', 'Finance'])
  })

  it('unescapes doubled quotes', () => {
    expect(splitCsvLine('A,a@x.edu,"He said ""hi"""')).toEqual(['A', 'a@x.edu', 'He said "hi"'])
  })

  it('preserves empty trailing fields', () => {
    expect(splitCsvLine('A,a@x.edu,,,')).toEqual(['A', 'a@x.edu', '', '', ''])
  })
})

describe('parseBulkUsers', () => {
  it('parses a minimal two-column row and defaults the role', () => {
    const { rows, errors } = parseBulkUsers('Ayesha Rahman,ayesha@x.edu')
    expect(errors).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      line: 1, name: 'Ayesha Rahman', email: 'ayesha@x.edu',
      designation: '', department: '', role: 'user',
    })
  })

  it('skips an optional header row', () => {
    const { rows } = parseBulkUsers('name,email,designation,department,role\nA B,a@x.edu')
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('A B')
    // line numbers still refer to the pasted text
    expect(rows[0].line).toBe(2)
  })

  it('does not mistake a real user for a header', () => {
    const { rows } = parseBulkUsers('Name Surname,name@x.edu')
    expect(rows).toHaveLength(1)
  })

  it('accepts role aliases and lowercases the email', () => {
    const { rows } = parseBulkUsers([
      'A B,A@X.EDU,,,admin',
      'C D,c@x.edu,,,Member',
      'E F,e@x.edu,,,org_admin',
    ].join('\n'))
    expect(rows.map((r) => r.role)).toEqual(['org_admin', 'user', 'org_admin'])
    expect(rows[0].email).toBe('a@x.edu')
  })

  it('rejects a bad email and keeps the good rows', () => {
    const { rows, errors } = parseBulkUsers('A B,not-an-email\nC D,c@x.edu')
    expect(rows).toHaveLength(1)
    expect(rows[0].email).toBe('c@x.edu')
    expect(errors).toHaveLength(1)
    expect(errors[0].line).toBe(1)
  })

  it('rejects an unknown role rather than silently defaulting', () => {
    const { rows, errors } = parseBulkUsers('A B,a@x.edu,,,superuser')
    expect(rows).toHaveLength(0)
    expect(errors[0].message).toMatch(/Unknown role/)
  })

  it('flags a duplicate email within the batch and names the first line', () => {
    const { rows, errors } = parseBulkUsers('A B,dup@x.edu\nC D,DUP@x.edu')
    expect(rows).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(errors[0].line).toBe(2)
    expect(errors[0].message).toMatch(/already on line 1/)
  })

  it('ignores blank lines without shifting line numbers', () => {
    const { rows, errors } = parseBulkUsers('A B,a@x.edu\n\n\nC D,c@x.edu')
    expect(errors).toEqual([])
    expect(rows.map((r) => r.line)).toEqual([1, 4])
  })

  it('caps the batch and reports why', () => {
    const many = Array.from({ length: BULK_MAX_ROWS + 5 }, (_, i) => `User ${i},u${i}@x.edu`).join('\n')
    const { rows, errors } = parseBulkUsers(many)
    expect(rows).toHaveLength(BULK_MAX_ROWS)
    expect(errors.some((e) => /can be added at once/.test(e.message))).toBe(true)
  })

  it('returns nothing for empty input', () => {
    expect(parseBulkUsers('   \n  \n')).toEqual({ rows: [], errors: [] })
  })
})
