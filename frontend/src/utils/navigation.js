export const all = [
  ["Dashboard", "LayoutDashboard"],
  ["Employees", "Users"],
  ["Intern Management", "GraduationCap"],
  ["Projects", "FolderKanban"],
  ["Tasks", "ListChecks"],
  ["Attendance", "CalendarDays"],
  ["Leave Management", "Umbrella"],
  ["Daily Work", "ClipboardList"],
  ["Code Management", "GitBranch"],
  ["Chat", "MessagesSquare"],
  ["Message Monitoring", "Eye"],
  // ["Salary", "Banknote"],
  // ["Overtime", "Timer"],
  ["Announcements", "Megaphone"],
  ["Calendar", "Calendar"],
  ["Organization", "Network"],
  ["Profile", "CircleUser"],
  ["Settings", "Settings"],
];

export function normalizeRole(role) {
  return String(role || "").toUpperCase();
}

export function allowed(role) {
  const r = normalizeRole(role);

  let items = [
    "Dashboard",
    "Profile",
    "Settings",
    "Announcements",
    "Calendar",
  ];

  if (r === "EMPLOYEE") {
    items.push(
      "Projects",
      "Tasks",
      "Attendance",
      "Leave Management",
      "Daily Work",
      "Code Management",
      "Chat"
    );
  }

  if (r === "INTERN") {
    items.push(
      "Projects",
      "Tasks",
      "Attendance",
      "Daily Work",
      "Code Management",
      "Chat"
    );
  }

  if (["CEO", "ADMIN", "HR"].includes(r)) {
  items = [
    "Dashboard",
    "Employees",
    "Intern Management",
    "Projects",
    "Tasks",
    "Attendance",
    "Leave Management",
    "Daily Work",
    // "Salary",
    // "Overtime",
    "Announcements",
    "Calendar",
    "Organization",
    "Profile",
    "Settings",
    "Chat",
    "Message Monitoring",
    "Code Management",
  ];
}

  return all.filter(([name]) => items.includes(name));
}

const sidebarGroups = [
  {
    id: "workspace",
    label: "Workspace",
    icon: "LayoutGrid",
    items: ["Dashboard", "Projects", "Tasks", "Chat", "Calendar"],
  },
  {
    id: "people",
    label: "People",
    icon: "Users",
    items: ["Employees", "Intern Management", "Attendance", "Leave Management", "Daily Work"],
  },
  {
    id: "admin",
    label: "Admin",
    icon: "ShieldCheck",
    items: ["Message Monitoring"],
  },
  {
    id: "company",
    label: "Company",
    icon: "Building2",
    items: ["Announcements", "Organization"],
  },
  {
    id: "tools",
    label: "Tools",
    icon: "Wrench",
    items: ["Code Management"],
  },
  {
    id: "account",
    label: "Account",
    icon: "CircleUser",
    items: ["Profile", "Settings"],
  },
];



const pagePermissions = {
  Dashboard: ["dashboard.view"],
  Employees: ["employees.view"],
  "Intern Management": ["interns.view", "employees.view"],
  Projects: ["projects.view_all", "projects.view_assigned"],
  Tasks: ["tasks.view_all", "tasks.view_assigned"],
  Attendance: ["attendance.view_all", "attendance.view_own"],
  "Leave Management": ["leave.view_all", "leave.view_own"],
  "Daily Work": ["daily_work.view_all", "daily_work.view_own"],
  Chat: ["chat.use"],
  "Message Monitoring": ["message_monitoring.view"],
  // "Salary": ["salary.view_all", "salary.view_own"],
  // "Overtime": ["overtime.view_all", "overtime.view_own"],
  Announcements: ["announcements.view"],
  Calendar: ["calendar.view"],
  Organization: ["organization.view"],
  Profile: ["account.view"],
  Settings: ["account.view", "account.manage"],
};

export function buildSidebarGroups(role, permissions = null) {
  const allowedNames = new Set(allowed(role).map(([name]) => name));
  const permissionSet = permissions ? new Set(permissions.filter((p) => p.access === "ALLOW").map((p) => p.permission_key)) : null;

  return sidebarGroups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((name) => allowedNames.has(name))
        .filter((name) =>
          name === "Code Management" ||
          name === "Profile" ||
          name === "Settings" ||
          !permissionSet ||
          (pagePermissions[name] || []).some((key) => permissionSet.has(key))
        )
        .map((name) => all.find(([itemName]) => itemName === name))
        .filter(Boolean),
    }))
    .filter((group) => group.items.length > 0);
}

export function hasPermission(permissions, key) {
  return Array.isArray(permissions) && permissions.some((p) => p.permission_key === key && p.access === "ALLOW");
}

export function hasAnyPermission(permissions, keys = []) {
  return keys.some((key) => hasPermission(permissions, key));
}
