import { db } from '@/lib/db'
import { organizations, users, departments, memoCategories } from '@/db/schema'
import { hashPassword } from '@/lib/auth'
import { audit } from '@/lib/audit'

/**
 * A new organization starts with categories and a department, but deliberately
 * with no workflow templates: a template's steps are position titles, and those
 * are chosen from the designations the organization's own users carry. Canned
 * positions like "Line Manager" would match nobody, leaving every step of a
 * bootstrapped template unfillable. Admins create templates once real people
 * and designations exist.
 */
const STARTER_CATEGORIES = [
  ['Administrative', 'General administrative matters'],
  ['Financial', 'Budgets, expenditure and financial approvals'],
  ['Procurement', 'Purchase and vendor requests'],
  ['HR', 'Personnel, leave and recruitment'],
  ['Academic', 'Academic and curricular matters'],
  ['Technical', 'IT and infrastructure'],
  ['General', 'Anything not covered above'],
] as const

export function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}

export type CreateOrgResult =
  | { ok: true; orgId: string; userId: string }
  | { ok: false; error: string }

export async function createOrganization(input: {
  orgName: string; orgCode: string
  adminName: string; adminEmail: string; password: string
  contactEmail?: string | null; contactPhone?: string | null; address?: string | null
}): Promise<CreateOrgResult> {
  const slug = slugify(input.orgName)
  const passwordHash = await hashPassword(input.password)

  try {
    return await db.transaction(async (tx) => {
      const [org] = await tx.insert(organizations).values({
        name: input.orgName.trim(), slug, code: input.orgCode.trim().toUpperCase(),
        contactEmail: input.contactEmail ?? null,
        contactPhone: input.contactPhone ?? null,
        address: input.address ?? null,
        config: { memoPrefix: input.orgCode.trim().toUpperCase() },
      }).returning()

      const [dept] = await tx.insert(departments).values({
        orgId: org.id, name: 'Administration',
        description: 'Default department created with the organization',
      }).returning()

      await tx.insert(memoCategories).values(
        STARTER_CATEGORIES.map(([name, description]) => ({ orgId: org.id, name, description })),
      )

      const [user] = await tx.insert(users).values({
        orgId: org.id, name: input.adminName.trim(),
        email: input.adminEmail.trim().toLowerCase(),
        designation: 'Organization Administrator',
        departmentId: dept.id, role: 'org_admin', passwordHash,
      }).returning()

      await audit(tx, {
        orgId: org.id, actorId: user.id, eventType: 'organization_created',
        entityType: 'organization', entityId: org.id,
        description: `Organization ${org.name} created`,
      })

      return { ok: true as const, orgId: org.id, userId: user.id }
    })
  } catch (e) {
    console.error('createOrganization failed', e)
    return { ok: false, error: 'That organization name is already taken.' }
  }
}
