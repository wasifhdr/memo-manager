import type { Metadata } from 'next'
import { requireSession } from '@/lib/tenant'
import { listMyDelegations } from '@/lib/repo/delegations'
import { listActiveUsers } from '@/lib/repo/org'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { NewDelegationForm, OutgoingRow, IncomingRow } from './delegation-forms'

export const metadata: Metadata = { title: 'Delegations' }

export default async function DelegationsPage() {
  const ctx = await requireSession()
  const [{ outgoing, incoming }, activeUsers] = await Promise.all([
    listMyDelegations(ctx),
    listActiveUsers(ctx),
  ])
  const delegateOptions = activeUsers
    .filter((u) => u.id !== ctx.user.id)
    .map((u) => ({ value: u.id, label: u.name }))

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Delegations"
        description="Let another user act on your behalf for a specified period. Their actions record both identities."
      />

      <Card>
        <CardHeader><h2 className="text-sm font-semibold">Delegate your authority</h2></CardHeader>
        <CardBody>
          <NewDelegationForm users={delegateOptions} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h2 className="text-sm font-semibold">Your delegations</h2></CardHeader>
        <CardBody>
          {outgoing.length === 0 ? (
            <EmptyState title="You haven't delegated to anyone" />
          ) : (
            <ul className="flex flex-col divide-y divide-(--color-sand)">
              {outgoing.map((d) => <OutgoingRow key={d.id} d={d} />)}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h2 className="text-sm font-semibold">Delegated to you</h2></CardHeader>
        <CardBody>
          {incoming.length === 0 ? (
            <EmptyState title="No one has delegated to you" />
          ) : (
            <ul className="flex flex-col divide-y divide-(--color-sand)">
              {incoming.map((d) => <IncomingRow key={d.id} d={d} />)}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
