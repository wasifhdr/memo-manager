import 'server-only'
import { db, type Executor } from '@/lib/db'
import { auditLog } from '@/db/schema'

export async function audit(ex: Executor = db, o: {
  orgId: string | null
  actorId: string | null
  eventType: string
  entityType?: string
  entityId?: string | null
  description: string
  ip?: string | null
}): Promise<void> {
  await ex.insert(auditLog).values({
    orgId: o.orgId, actorId: o.actorId, eventType: o.eventType,
    entityType: o.entityType ?? null, entityId: o.entityId ?? null,
    description: o.description, ip: o.ip ?? null,
  })
}
