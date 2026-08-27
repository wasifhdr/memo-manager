export const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/inbox", label: "Inbox" },
  { href: "/memos", label: "My Memos" },
  { href: "/completed", label: "Completed" },
  { href: "/search", label: "Search" },
] as const;

export const ADMIN_NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/departments", label: "Departments" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/templates", label: "Workflow Templates" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/audit", label: "Audit Log" },
  { href: "/admin/organization", label: "Organization" },
] as const;
