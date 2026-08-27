import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatusBadge, PriorityBadge, Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Input, Label, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import type { MemoStatus, Priority } from "@/db/schema";

// Temporary component showcase for the Task 3 design-system pass.
// Superseded by the real dashboard route once Task 9 lands.

type DemoRow = {
  id: string;
  number: string;
  subject: string;
  status: MemoStatus;
  priority: Priority;
  department: string;
};

const rows: DemoRow[] = [
  { id: "1", number: "NBU-2026-0001", subject: "Laboratory equipment purchase", status: "pending_approval", priority: "urgent", department: "Finance" },
  { id: "2", number: "NBU-2026-0002", subject: "Q3 travel reimbursement policy", status: "changes_requested", priority: "high", department: "Administration" },
  { id: "3", number: "NBU-2026-0003", subject: "New hire onboarding checklist", status: "approved", priority: "normal", department: "Human Resources" },
  { id: "4", number: "NBU-2026-0004", subject: "Server room access revision", status: "rejected", priority: "normal", department: "IT" },
  { id: "5", number: "NBU-2026-0005", subject: "Annual leave calendar", status: "draft", priority: "normal", department: "Human Resources" },
];

const columns: Column<DemoRow>[] = [
  { key: "number", header: "Memo #", render: (r) => <span className="font-mono-nums text-(--text-muted)">{r.number}</span> },
  { key: "subject", header: "Subject", render: (r) => <span className="font-medium">{r.subject}</span> },
  { key: "department", header: "Department", render: (r) => r.department },
  { key: "priority", header: "Priority", render: (r) => <PriorityBadge priority={r.priority} /> },
  { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
];

export default function DesignShowcasePage() {
  return (
    <AppShell orgName="Northbridge University" userName="Ayesha Rahman" userRole="org_admin" unreadCount={3}>
      <PageHeader
        title="Design system showcase"
        description="Temporary page for the Task 3 visual pass — replaced by the real dashboard in Task 9."
        actions={
          <>
            <Button variant="secondary">Secondary</Button>
            <Button variant="primary">New memo</Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Statuses</h2>
          </CardHeader>
          <CardBody className="flex flex-wrap gap-2">
            <StatusBadge status="draft" />
            <StatusBadge status="submitted" />
            <StatusBadge status="pending_review" />
            <StatusBadge status="pending_approval" />
            <StatusBadge status="changes_requested" />
            <StatusBadge status="rejected" />
            <StatusBadge status="approved" />
            <StatusBadge status="cancelled" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Priorities &amp; badges</h2>
          </CardHeader>
          <CardBody className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority="normal" />
            <span className="text-(--text-faint) text-xs">(no badge for normal)</span>
            <PriorityBadge priority="high" />
            <PriorityBadge priority="urgent" />
            <Badge>General</Badge>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="text-sm font-semibold">Form controls</h2>
          </CardHeader>
          <CardBody className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="s">Subject</Label>
              <Input id="s" placeholder="Memo subject" />
            </div>
            <div>
              <Label htmlFor="d">Department</Label>
              <Select id="d" placeholder="Select a department" options={[{ value: "fin", label: "Finance" }, { value: "hr", label: "Human Resources" }]} />
            </div>
            <div>
              <Label htmlFor="p" hint="required">Priority</Label>
              <Select id="p" options={[{ value: "normal", label: "Normal" }, { value: "high", label: "High" }, { value: "urgent", label: "Urgent" }]} />
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="text-sm font-semibold">Memo table</h2>
          </CardHeader>
          <CardBody className="p-0">
            <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="text-sm font-semibold">Empty state</h2>
          </CardHeader>
          <CardBody>
            <EmptyState title="Nothing is waiting on you" description="Memos assigned to you for review or approval will appear here." />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
