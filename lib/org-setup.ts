import { db } from '@/lib/db'
import { organizations, users, departments, memoCategories, workflowTemplates, workflowTemplateSteps } from '@/db/schema'
import { hashPassword } from '@/lib/auth'
import { audit } from '@/lib/audit'

const STARTER_CATEGORIES = [
  ['Administrative', 'General administrative matters'],
  ['Financial', 'Budgets, expenditure and financial approvals'],
  ['Procurement', 'Purchase and vendor requests'],
  ['HR', 'Personnel, leave and recruitment'],
  ['Academic', 'Academic and curricular matters'],
  ['Technical', 'IT and infrastructure'],
  ['General', 'Anything not covered above'],
] as const

const STARTER_TEMPLATES = [
  { name: 'Purchase Request', steps: ['Employee', 'Department Head', 'Finance', 'Director'] },
  { name: 'Leave Request', steps: ['Employee', 'Line Manager', 'HR'] },
  { name: 'Procurement Request', steps: ['Requester', 'Department Head', 'Procurement', 'Finance', 'Director'] },
]

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

      for (const t of STARTER_TEMPLATES) {
        const [tpl] = await tx.insert(workflowTemplates)
          .values({ orgId: org.id, name: t.name }).returning()
        await tx.insert(workflowTemplateSteps).values(
          t.steps.map((positionTitle, i) => ({
            orgId: org.id, templateId: tpl.id, stepNo: i + 1,
            positionTitle, requiredAction: 'approve' as const,
          })),
        )
      }

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
