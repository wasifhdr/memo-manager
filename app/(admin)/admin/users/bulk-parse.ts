/**
 * CSV parsing for bulk user creation. Deliberately dependency-free and pure so
 * the client can preview exactly what the server will act on, and so it can be
 * unit tested without a database.
 *
 * Columns: name, email, designation, department, role
 * Only name and email are required. Role defaults to `user`.
 */

export type BulkRole = 'user' | 'org_admin'

export type BulkUserRow = {
  /** 1-based line number in the pasted text, for error reporting. */
  line: number
  name: string
  email: string
  designation: string
  /** Department *name*; resolved to an id server-side against the org. */
  department: string
  role: BulkRole
}

export type BulkParseError = { line: number; message: string }

export type BulkParseResult = {
  rows: BulkUserRow[]
  errors: BulkParseError[]
}

/** Guards against a paste large enough to time the request out — each row costs
 * a bcrypt hash. */
export const BULK_MAX_ROWS = 100

export const BULK_CSV_TEMPLATE =
  'name,email,designation,department,role\n' +
  'Ayesha Rahman,ayesha@example.edu,Lecturer,Computer Science,user\n' +
  'Imran Chowdhury,imran@example.edu,Director,Administration,admin'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Splits one CSV line, honouring double-quoted fields and "" escapes. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i++ } else { quoted = false }
      } else field += c
    } else if (c === '"') {
      quoted = true
    } else if (c === ',') {
      out.push(field)
      field = ''
    } else field += c
  }
  out.push(field)
  return out.map((f) => f.trim())
}

function normaliseRole(raw: string): BulkRole | null {
  const v = raw.trim().toLowerCase()
  if (v === '' || v === 'user' || v === 'member') return 'user'
  if (v === 'admin' || v === 'org_admin' || v === 'organization admin') return 'org_admin'
  return null
}

export function parseBulkUsers(input: string): BulkParseResult {
  const rows: BulkUserRow[] = []
  const errors: BulkParseError[] = []
  const seen = new Map<string, number>()

  const lines = input.split(/\r?\n/)

  lines.forEach((raw, i) => {
    const line = i + 1
    if (!raw.trim()) return

    const f = splitCsvLine(raw)

    // A header row is optional; skip it rather than treating it as a user.
    if (i === 0 && f[0]?.toLowerCase() === 'name' && (f[1] ?? '').toLowerCase() === 'email') return

    const [name = '', email = '', designation = '', department = '', roleRaw = ''] = f

    if (!name && !email) {
      errors.push({ line, message: 'Needs at least a name and an email.' })
      return
    }
    if (name.length < 2 || name.length > 120) {
      errors.push({ line, message: `Name "${name}" must be 2–120 characters.` })
      return
    }
    if (!EMAIL.test(email)) {
      errors.push({ line, message: `"${email || '(blank)'}" is not a valid email.` })
      return
    }
    if (designation.length > 120) {
      errors.push({ line, message: 'Designation must be 120 characters or fewer.' })
      return
    }

    const role = normaliseRole(roleRaw)
    if (!role) {
      errors.push({ line, message: `Unknown role "${roleRaw}". Use admin or user.` })
      return
    }

    const key = email.toLowerCase()
    const first = seen.get(key)
    if (first !== undefined) {
      errors.push({ line, message: `${email} is already on line ${first}.` })
      return
    }
    seen.set(key, line)

    rows.push({ line, name, email: key, designation, department, role })
  })

  if (rows.length > BULK_MAX_ROWS) {
    errors.push({
      line: rows[BULK_MAX_ROWS].line,
      message: `Only ${BULK_MAX_ROWS} users can be added at once — split the rest into another batch.`,
    })
    rows.length = BULK_MAX_ROWS
  }

  return { rows, errors }
}
