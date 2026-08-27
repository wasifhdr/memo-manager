import 'server-only'
import { and, desc, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/lib/db'
import { delegations, users } from '@/db/schema'
import type { TenantContext } from '@/lib/tenant'

export async function listMyDelegations(ctx: TenantContext) {
  const delegate = alias(users, 'delegate')
  const delegator = alias(users, 'delegator')

  const [outgoing, incoming] = await Promise.all([
    db.select({
      id: delegations.id, delegateName: delegate.name, startAt: delegations.startAt,
      endAt: delegations.endAt, reason: delegations.reason, status: delegations.status,
    }).from(delegations)
      .innerJoin(delegate, eq(delegate.id, delegations.delegateId))
      .where(and(eq(delegations.orgId, ctx.orgId), eq(delegations.delegatorId, ctx.user.id)))
      .orderBy(desc(delegations.startAt)),
    db.select({
      id: delegations.id, delegatorName: delegator.name, startAt: delegations.startAt,
      endAt: delegations.endAt, reason: delegations.reason, status: delegations.status,
    }).from(delegations)
      .innerJoin(delegator, eq(delegator.id, delegations.delegatorId))
      .where(and(eq(delegations.orgId, ctx.orgId), eq(delegations.delegateId, ctx.user.id)))
      .orderBy(desc(delegations.startAt)),
  ])

  return { outgoing, incoming }
}
