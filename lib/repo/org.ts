import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { organizations } from '@/db/schema'
import type { TenantContext } from '@/lib/tenant'

export async function getOrganization(ctx: TenantContext) {
  const [org] = await db.select().from(organizations)
    .where(eq(organizations.id, ctx.orgId)).limit(1)
  return org
}
