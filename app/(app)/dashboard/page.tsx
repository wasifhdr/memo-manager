import type { Metadata } from 'next'
import { requireSession } from '@/lib/tenant'
import { userDashboard } from '@/lib/repo/stats'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { LinkButton } from '@/components/ui/button'
import { StatTile } from '@/components/dashboard/stat-tile'
import { MiniMemoList } from '@/components/dashboard/mini-memo-list'
import { RecentActivity } from '@/components/dashboard/recent-activity'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const ctx = await requireSession()
  const d = await userDashboard(ctx)

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${ctx.user.name.split(' ')[0]}`}
        actions={<LinkButton href="/memos/new">New memo</LinkButton>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Awaiting your action" value={d.awaitingMyAction.total} />
        <StatTile label="Pending approvals" value={d.pendingApprovals} />
        <StatTile label="Pending reviews" value={d.pendingReviews} />
        <StatTile label="Urgent memos" value={d.urgentMemos} tone="urgent" />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader className="justify-between">
            <h2 className="text-sm font-semibold">Awaiting your action</h2>
            <a href="/inbox" className="text-[0.75rem] text-(--color-orange-deep) hover:underline">View inbox</a>
          </CardHeader>
          <CardBody>
            <MiniMemoList
              items={d.awaitingMyAction.rows.map((r) => ({
                id: r.id, memoNumber: r.memoNumber, subject: r.subject,
                caption: r.requiredAction === 'review' ? 'Needs review' : 'Needs approval',
              }))}
              emptyText="Nothing is waiting on you"
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="justify-between">
            <h2 className="text-sm font-semibold">Submitted by you</h2>
            <a href="/memos" className="text-[0.75rem] text-(--color-orange-deep) hover:underline">View my memos</a>
          </CardHeader>
          <CardBody>
            <MiniMemoList
              items={d.submittedByMe.rows.map((r) => ({
                id: r.id, memoNumber: r.memoNumber, subject: r.subject, status: r.status,
                caption: r.currentParticipantName ? `with ${r.currentParticipantName}` : null,
              }))}
              emptyText="You haven't created any memos yet"
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="justify-between">
            <h2 className="text-sm font-semibold">Recently completed</h2>
            <a href="/completed" className="text-[0.75rem] text-(--color-orange-deep) hover:underline">View all</a>
          </CardHeader>
          <CardBody>
            <MiniMemoList
              items={d.recentlyCompleted.rows.map((r) => ({
                id: r.id, memoNumber: r.memoNumber, subject: r.subject, status: r.status,
              }))}
              emptyText="Nothing completed yet"
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Recent activity</h2>
          </CardHeader>
          <CardBody>
            <RecentActivity items={d.recentActivity} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Your memos by status</h2>
          </CardHeader>
          <CardBody>
            <dl className="flex flex-col gap-2 text-[0.8125rem]">
              {Object.entries(d.countsByStatus).filter(([, n]) => n > 0).map(([status, n]) => (
                <div key={status} className="flex items-center justify-between">
                  <dt className="capitalize text-(--color-ink)/70">{status.replace(/_/g, ' ')}</dt>
                  <dd className="font-mono-nums font-medium text-(--color-ink)">{n}</dd>
                </div>
              ))}
              {Object.values(d.countsByStatus).every((n) => n === 0) ? (
                <p className="text-(--color-ink)/50">No memos yet.</p>
              ) : null}
            </dl>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
