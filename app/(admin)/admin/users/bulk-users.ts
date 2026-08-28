/**
 * Validation for the bulk "add users" form. Dependency-free and pure so the
 * client and the server action share one implementation and cannot disagree
 * about which rows are acceptable.
 */

export type BulkRole = 'user' | 'org_admin'

export type BulkUserDraft = {
  name: string
  email: string
  designation: string
  /** Department id, chosen from a select; '' means none. */
  departmentId: string
  role: BulkRole
}

/** Row index (0-based, matching the form) plus what is wrong with it. */
export type BulkRowError = { index: number; message: string }

export type BulkValidation = {
  /** Rows worth submitting, in form order. */
  valid: { index: number; draft: BulkUserDraft }[]
  errors: BulkRowError[]
  /** Rows left entirely untouched — ignored rather than reported. */
  blank: number
}

/** Each row costs a bcrypt hash, so a batch is bounded. */
export const BULK_MAX_ROWS = 100

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function emptyDraft(): BulkUserDraft {
  return { name: '', email: '', designation: '', departmentId: '', role: 'user' }
}

export function isBlankDraft(d: BulkUserDraft): boolean {
  return !d.name.trim() && !d.email.trim() && !d.designation.trim() && !d.departmentId
}

export function validateBulkUsers(rows: BulkUserDraft[]): BulkValidation {
  const valid: BulkValidation['valid'] = []
  const errors: BulkRowError[] = []
  const seen = new Map<string, number>()
  let blank = 0

  rows.forEach((row, index) => {
    // A row nobody typed into is not an error — it is just an unused slot.
    if (isBlankDraft(row)) { blank++; return }

    const name = row.name.trim()
    const email = row.email.trim().toLowerCase()
    const designation = row.designation.trim()

    if (name.length < 2 || name.length > 120) {
      errors.push({ index, message: 'Name must be 2–120 characters.' })
      return
    }
    if (!EMAIL.test(email)) {
      errors.push({ index, message: email ? `"${row.email.trim()}" is not a valid email.` : 'Email is required.' })
      return
    }
    if (designation.length > 120) {
      errors.push({ index, message: 'Designation must be 120 characters or fewer.' })
      return
    }
    if (row.role !== 'user' && row.role !== 'org_admin') {
      errors.push({ index, message: 'Choose a role.' })
      return
    }

    const first = seen.get(email)
    if (first !== undefined) {
      errors.push({ index, message: `Duplicate of row ${first + 1}.` })
      return
    }
    seen.set(email, index)

    valid.push({ index, draft: { name, email, designation, departmentId: row.departmentId, role: row.role } })
  })

  if (valid.length > BULK_MAX_ROWS) {
    for (const extra of valid.slice(BULK_MAX_ROWS)) {
      errors.push({
        index: extra.index,
        message: `Only ${BULK_MAX_ROWS} users can be added at once.`,
      })
    }
    valid.length = BULK_MAX_ROWS
  }

  return { valid, errors, blank }
}
