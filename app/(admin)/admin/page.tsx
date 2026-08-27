import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/tenant'
import { adminDashboard } from '@/lib/repo/stats'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { StatTile } from '@/components/dashboard/stat-tile'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import {
  IconUsers, IconCheckCircle, IconBuilding, IconDocument, IconClock, IconXCircle,
} from '@/components/ui/icons'

export const metadata: Metadata = { title: 'Administration' }

export default async function AdminOverviewPage() {
  const ctx = await requireAdmin()
  const d = await adminDashboard(ctx)

  return (
    <div>
      <PageHeader title="Organization overview" description="Organization-wide statistics and recent system activity." />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Users" value={d.userCount} icon={IconUsers} />
        <StatTile label="Active users" value={d.activeUserCount} tone="info" icon={IconCheckCircle} />
        <StatTile label="Departments" value={d.departmentCount} icon={IconBuilding} />
        <StatTile label="Total memos" value={d.memoCount} tone="accent" icon={IconDocument} />
        <StatTile label="Pending workflows" value={d.pendingWorkflows} tone="info" icon={IconClock} />
        <StatTile label="Completed workflows" value={d.completedWorkflows} tone="success" icon={IconCheckCircle} />
        <StatTile label="Rejected workflows" value={d.rejectedWorkflows} tone="danger" icon={IconXCircle} />
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
