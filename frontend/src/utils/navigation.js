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
  ["Salary", "Banknote"],
  ["Overtime", "Timer"],
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
    "Salary",
    "Overtime",
    "Announcements",
    "Calendar",
    "Organization",
    "Profile",
    "Settings",
    "Chat",
    "Code Management",
  ];
}

  if (r === "HR") {
    items = items.filter((x) => x !== "Code Management");
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
    items: ["Employees", "Intern Management", "Attendance", "Leave Management", "Daily Work", "Salary", "Overtime"],
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



export function buildSidebarGroups(role) {
  const allowedNames = new Set(allowed(role).map(([name]) => name));

  return sidebarGroups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((name) => allowedNames.has(name))
        .map((name) => all.find(([itemName]) => itemName === name))
        .filter(Boolean),
    }))
    .filter((group) => group.items.length > 0);
}