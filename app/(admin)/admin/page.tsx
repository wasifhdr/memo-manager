import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/tenant'
import { adminDashboard } from '@/lib/repo/stats'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { StatTile } from '@/components/dashboard/stat-tile'
import { RecentActivity } from '@/components/dashboard/recent-activity'

export const metadata: Metadata = { title: 'Administration' }

export default async function AdminOverviewPage() {
  const ctx = await requireAdmin()
  const d = await adminDashboard(ctx)

  return (
    <div>
      <PageHeader title="Organization overview" description="Organization-wide statistics and recent system activity." />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Users" value={d.userCount} />
        <StatTile label="Active users" value={d.activeUserCount} />
        <StatTile label="Departments" value={d.departmentCount} />
        <StatTile label="Total memos" value={d.memoCount} />
        <StatTile label="Pending workflows" value={d.pendingWorkflows} />
        <StatTile label="Completed workflows" value={d.completedWorkflows} />
        <StatTile label="Rejected workflows" value={d.rejectedWorkflows} />
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold">Recent system activity</h2>
        </CardHeader>
        <CardBody>
          <RecentActivity items={d.recentActivity} />
        </CardBody>
      </Card>
    </div>
  )
}
