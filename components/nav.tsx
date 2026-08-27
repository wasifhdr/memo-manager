import type { ComponentType, SVGProps } from "react";
import {
  IconGrid, IconInbox, IconDocument, IconCheckCircle, IconSearch, IconBell, IconUsers,
  IconBuilding, IconTag, IconChart, IconClock, IconSettings,
} from "@/components/ui/icons";

export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Renders the unread-notification count when present. */
  badge?: "notifications";
};

export const NAV: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: IconGrid },
  { href: "/inbox", label: "Inbox", icon: IconInbox },
  { href: "/memos", label: "My Memos", icon: IconDocument },
  { href: "/completed", label: "Completed", icon: IconCheckCircle },
  { href: "/search", label: "Search", icon: IconSearch },
  { href: "/notifications", label: "Notifications", icon: IconBell, badge: "notifications" },
  { href: "/delegations", label: "Delegations", icon: IconUsers },
];

export const ADMIN_NAV: readonly NavItem[] = [
  { href: "/admin", label: "Overview", icon: IconGrid },
  { href: "/admin/users", label: "Users", icon: IconUsers },
  { href: "/admin/departments", label: "Departments", icon: IconBuilding },
  { href: "/admin/categories", label: "Categories", icon: IconTag },
  { href: "/admin/templates", label: "Workflow Templates", icon: IconDocument },
  { href: "/admin/reports", label: "Reports", icon: IconChart },
  { href: "/admin/audit", label: "Audit Log", icon: IconClock },
  { href: "/admin/organization", label: "Organization", icon: IconSettings },
];
