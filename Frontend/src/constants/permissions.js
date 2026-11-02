/**
 * Full CRM + App permission catalog.
 * MANAGE_X implies VIEW/CREATE/EDIT/DELETE (and module-specific actions) for that X.
 */

export const PERMISSION_GROUPS = [
  {
    category: "Employee & Staff",
    permissions: [
      { key: "VIEW_EMPLOYEES", label: "View employees", desc: "See employee list and profiles" },
      { key: "CREATE_EMPLOYEES", label: "Create employees", desc: "Add new employees" },
      { key: "EDIT_EMPLOYEES", label: "Edit employees", desc: "Update employee details" },
      { key: "DELETE_EMPLOYEES", label: "Delete employees", desc: "Remove or deactivate employees" },
      { key: "MANAGE_EMPLOYEES", label: "Manage employees", desc: "Full employee access" },
    ],
  },
  {
    category: "Employee types",
    permissions: [
      { key: "VIEW_EMPLOYEE_TYPES", label: "View employee types", desc: "See employee type master" },
      { key: "CREATE_EMPLOYEE_TYPES", label: "Create employee types", desc: "Add employee types" },
      { key: "EDIT_EMPLOYEE_TYPES", label: "Edit employee types", desc: "Update employee types" },
      { key: "DELETE_EMPLOYEE_TYPES", label: "Delete employee types", desc: "Remove employee types" },
      { key: "MANAGE_EMPLOYEE_TYPES", label: "Manage employee types", desc: "Full employee type access" },
    ],
  },
  {
    category: "Work modes",
    permissions: [
      { key: "VIEW_WORK_MODES", label: "View work modes", desc: "See work mode master" },
      { key: "CREATE_WORK_MODES", label: "Create work modes", desc: "Add work modes" },
      { key: "EDIT_WORK_MODES", label: "Edit work modes", desc: "Update work modes" },
      { key: "DELETE_WORK_MODES", label: "Delete work modes", desc: "Remove work modes" },
      { key: "MANAGE_WORK_MODES", label: "Manage work modes", desc: "Full work mode access" },
    ],
  },
  {
    category: "Departments",
    permissions: [
      { key: "VIEW_DEPARTMENTS", label: "View departments", desc: "See departments" },
      { key: "CREATE_DEPARTMENTS", label: "Create departments", desc: "Add departments" },
      { key: "EDIT_DEPARTMENTS", label: "Edit departments", desc: "Update departments" },
      { key: "DELETE_DEPARTMENTS", label: "Delete departments", desc: "Remove departments" },
      { key: "MANAGE_DEPARTMENTS", label: "Manage departments", desc: "Full department access" },
    ],
  },
  {
    category: "Designations",
    permissions: [
      { key: "VIEW_DESIGNATIONS", label: "View designations", desc: "See designations" },
      { key: "CREATE_DESIGNATIONS", label: "Create designations", desc: "Add designations" },
      { key: "EDIT_DESIGNATIONS", label: "Edit designations", desc: "Update designations" },
      { key: "DELETE_DESIGNATIONS", label: "Delete designations", desc: "Remove designations" },
      { key: "MANAGE_DESIGNATIONS", label: "Manage designations", desc: "Full designation access" },
    ],
  },
  {
    category: "Services",
    permissions: [
      { key: "VIEW_SERVICES", label: "View services", desc: "See services" },
      { key: "CREATE_SERVICES", label: "Create services", desc: "Add services" },
      { key: "EDIT_SERVICES", label: "Edit services", desc: "Update services" },
      { key: "DELETE_SERVICES", label: "Delete services", desc: "Remove services" },
      { key: "MANAGE_SERVICES", label: "Manage services", desc: "Full service access" },
    ],
  },
  {
    category: "Clients",
    permissions: [
      { key: "VIEW_CLIENTS", label: "View clients", desc: "See client list" },
      { key: "CREATE_CLIENTS", label: "Create clients", desc: "Add clients" },
      { key: "EDIT_CLIENTS", label: "Edit clients", desc: "Update clients" },
      { key: "DELETE_CLIENTS", label: "Delete clients", desc: "Remove clients" },
      { key: "MANAGE_CLIENTS", label: "Manage clients", desc: "Full client access" },
    ],
  },
  {
    category: "Leads & CRM sales",
    permissions: [
      { key: "VIEW_LEADS", label: "View leads", desc: "See leads" },
      { key: "CREATE_LEADS", label: "Create leads", desc: "Add leads" },
      { key: "EDIT_LEADS", label: "Edit leads", desc: "Update leads" },
      { key: "DELETE_LEADS", label: "Delete leads", desc: "Remove leads" },
      { key: "MANAGE_LEADS", label: "Manage leads", desc: "Full lead access" },
      { key: "VIEW_FOLLOW_UPS", label: "View follow-ups", desc: "See follow-up list" },
      { key: "CREATE_FOLLOW_UPS", label: "Create follow-ups", desc: "Add follow-ups" },
      { key: "EDIT_FOLLOW_UPS", label: "Edit follow-ups", desc: "Update follow-ups" },
      { key: "DELETE_FOLLOW_UPS", label: "Delete follow-ups", desc: "Remove follow-ups" },
      { key: "MANAGE_FOLLOW_UPS", label: "Manage follow-ups", desc: "Full follow-up access" },
      { key: "VIEW_SALES", label: "View sales", desc: "See sales list" },
      { key: "VIEW_PAYMENTS", label: "View payments", desc: "See payments list" },
      { key: "VIEW_REVENUE", label: "View revenue", desc: "See revenue list" },
    ],
  },
  {
    category: "Projects",
    permissions: [
      { key: "VIEW_PROJECTS", label: "View all projects", desc: "See every project beyond own assignments" },
      { key: "CREATE_PROJECTS", label: "Create projects", desc: "Add projects" },
      { key: "EDIT_PROJECTS", label: "Edit projects", desc: "Update projects" },
      { key: "DELETE_PROJECTS", label: "Delete projects", desc: "Remove projects" },
      { key: "MANAGE_PROJECTS", label: "Manage projects", desc: "Full project access" },
    ],
  },
  {
    category: "Daily tasks",
    permissions: [
      { key: "VIEW_DAILY_TASKS", label: "View all daily tasks", desc: "See every daily task beyond own/team" },
      { key: "CREATE_DAILY_TASKS", label: "Create daily tasks", desc: "Assign daily tasks" },
      { key: "EDIT_DAILY_TASKS", label: "Edit daily tasks", desc: "Update daily tasks" },
      { key: "DELETE_DAILY_TASKS", label: "Delete daily tasks", desc: "Remove daily tasks" },
      { key: "MANAGE_DAILY_TASKS", label: "Manage daily tasks", desc: "Full daily task access" },
    ],
  },
  {
    category: "Urgent work",
    permissions: [
      { key: "VIEW_URGENT_WORK", label: "View all urgent work", desc: "See every urgent work beyond own/team" },
      { key: "CREATE_URGENT_WORK", label: "Create urgent work", desc: "Add urgent work" },
      { key: "EDIT_URGENT_WORK", label: "Edit urgent work", desc: "Update urgent work" },
      { key: "DELETE_URGENT_WORK", label: "Delete urgent work", desc: "Remove urgent work" },
      { key: "MANAGE_URGENT_WORK", label: "Manage urgent work", desc: "Full urgent work access" },
    ],
  },
  {
    category: "Help / Tickets",
    permissions: [
      { key: "VIEW_TICKETS", label: "View all tickets", desc: "See every help ticket beyond own" },
      { key: "CREATE_TICKETS", label: "Create tickets", desc: "Raise help tickets" },
      { key: "EDIT_TICKETS", label: "Edit / reply tickets", desc: "Update status and reply" },
      { key: "DELETE_TICKETS", label: "Delete tickets", desc: "Remove tickets" },
      { key: "MANAGE_TICKETS", label: "Manage tickets", desc: "Full ticket access" },
    ],
  },
  {
    category: "Interviews",
    permissions: [
      { key: "VIEW_INTERVIEWS", label: "View interviews", desc: "See interviews" },
      { key: "CREATE_INTERVIEWS", label: "Create interviews", desc: "Schedule interviews" },
      { key: "EDIT_INTERVIEWS", label: "Edit interviews", desc: "Update interviews" },
      { key: "DELETE_INTERVIEWS", label: "Delete interviews", desc: "Remove interviews" },
      { key: "MANAGE_INTERVIEWS", label: "Manage interviews", desc: "Full interview access" },
    ],
  },
  {
    category: "Leave",
    permissions: [
      { key: "VIEW_LEAVE", label: "View own leave", desc: "See own leave applications" },
      { key: "CREATE_LEAVE", label: "Apply leave", desc: "Submit leave requests" },
      { key: "VIEW_LEAVE_QUEUE", label: "View leave queue", desc: "See team/company leave for review" },
      { key: "APPROVE_LEAVE", label: "Approve leave", desc: "Approve or reject leave" },
      { key: "VIEW_LEAVE_TYPES", label: "View leave types", desc: "See leave type master" },
      { key: "CREATE_LEAVE_TYPES", label: "Create leave types", desc: "Add leave types" },
      { key: "EDIT_LEAVE_TYPES", label: "Edit leave types", desc: "Update leave types" },
      { key: "DELETE_LEAVE_TYPES", label: "Delete leave types", desc: "Remove leave types" },
      { key: "MANAGE_LEAVE_TYPES", label: "Manage leave types", desc: "Full leave type access" },
      { key: "VIEW_LEAVE_ASSIGN", label: "View leave assign", desc: "See leave balances assignment" },
      { key: "CREATE_LEAVE_ASSIGN", label: "Create leave assign", desc: "Assign leave balances" },
      { key: "EDIT_LEAVE_ASSIGN", label: "Edit leave assign", desc: "Update leave balances" },
      { key: "DELETE_LEAVE_ASSIGN", label: "Delete leave assign", desc: "Remove leave assignments" },
      { key: "MANAGE_LEAVE_ASSIGN", label: "Manage leave assign", desc: "Full leave assign access" },
    ],
  },
  {
    category: "Attendance",
    permissions: [
      { key: "PUNCH_ATTENDANCE", label: "Punch attendance", desc: "Punch in / punch out (own)" },
      { key: "VIEW_ATTENDANCE", label: "View own attendance", desc: "See own punch history" },
      { key: "VIEW_TEAM_ATTENDANCE", label: "View team attendance", desc: "See attendance of people under you" },
      { key: "VIEW_ALL_ATTENDANCE", label: "View all attendance", desc: "See every employee attendance" },
      { key: "VIEW_ATTENDANCE_REPORT", label: "Attendance report", desc: "Open attendance report page" },
      { key: "MANAGE_ATTENDANCE", label: "Manage attendance", desc: "Full attendance access" },
    ],
  },
  {
    category: "Chat",
    permissions: [
      { key: "VIEW_CHAT", label: "Use chat", desc: "Open chat and message" },
      { key: "CREATE_CHAT_GROUPS", label: "Create chat groups", desc: "Create groups / start DMs (staff)" },
      { key: "MANAGE_CHAT", label: "Manage chat", desc: "Full chat access including group admin tools" },
    ],
  },
  {
    category: "Reports",
    permissions: [
      { key: "VIEW_REPORTS", label: "View reports", desc: "Open CRM reports" },
      { key: "MANAGE_REPORTS", label: "Manage reports", desc: "Full reports access" },
    ],
  },
  {
    category: "Offer banners (App)",
    permissions: [
      { key: "VIEW_OFFER_BANNERS", label: "See offer banners", desc: "Banners show on app home" },
      { key: "CREATE_OFFER_BANNERS", label: "Create offer banners", desc: "Add banners" },
      { key: "EDIT_OFFER_BANNERS", label: "Edit offer banners", desc: "Update banners" },
      { key: "DELETE_OFFER_BANNERS", label: "Delete offer banners", desc: "Remove banners" },
      { key: "MANAGE_OFFER_BANNERS", label: "Manage offer banners", desc: "Full banner access" },
    ],
  },
  {
    category: "System",
    permissions: [
      { key: "MANAGE_PERMISSIONS", label: "Manage permissions", desc: "Grant or revoke permissions" },
      { key: "MANAGE_SETTINGS", label: "Manage settings", desc: "Company name, logo, office location" },
      { key: "VIEW_DASHBOARD", label: "View dashboard", desc: "See dashboard overview widgets" },
    ],
  },
];

export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key));

/** Subset shown when assigning app permissions to clients */
export const CLIENT_PERMISSION_GROUPS = [
  {
    category: "Offer banners",
    permissions: [
      { key: "VIEW_OFFER_BANNERS", label: "See offer banners", desc: "Banners show on app home" },
    ],
  },
  {
    category: "Help / Tickets",
    permissions: [
      { key: "CREATE_TICKETS", label: "Create tickets", desc: "Raise help tickets from CRM (if exposed)" },
      { key: "VIEW_TICKETS", label: "View tickets", desc: "See own help tickets" },
    ],
  },
];

export const CLIENT_PERMISSION_KEYS = CLIENT_PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key)
);

/** Client app defaults when no permissions saved yet */
export const DEFAULT_CLIENT_PERMISSIONS = ["VIEW_OFFER_BANNERS"];

/** Employee defaults when no permissions saved yet */
export const DEFAULT_EMPLOYEE_PERMISSIONS = [
  "VIEW_DASHBOARD",
  "VIEW_CHAT",
  "CREATE_CHAT_GROUPS",
  "PUNCH_ATTENDANCE",
  "VIEW_ATTENDANCE",
  "VIEW_LEAVE",
  "CREATE_LEAVE",
  "VIEW_OFFER_BANNERS",
  "CREATE_TICKETS",
  "VIEW_CLIENTS",
  "VIEW_PROJECTS",
  "VIEW_DAILY_TASKS",
  "VIEW_URGENT_WORK",
];

/** Always kept for employees so assigned work stays visible in the sidebar. */
export const EMPLOYEE_ASSIGNED_WORK_PERMISSIONS = [
  "VIEW_CLIENTS",
  "VIEW_PROJECTS",
  "VIEW_DAILY_TASKS",
  "VIEW_URGENT_WORK",
];

const ACTION_PREFIX = /^(VIEW|CREATE|EDIT|DELETE|PUNCH|APPROVE)_(.+)$/;

export function permissionGranted(user, required) {
  if (!user) return false;
  if (String(user.userType || "").toUpperCase() === "ADMIN") return true;
  if (!required || (Array.isArray(required) && required.length === 0)) return true;

  const userType = String(user.userType || "").toUpperCase();
  const granted = new Set(user.permissions || []);
  if (userType === "EMPLOYEE") {
    for (const key of EMPLOYEE_ASSIGNED_WORK_PERMISSIONS) granted.add(key);
  }
  const list = Array.isArray(required) ? required : [required];

  return list.some((key) => {
    if (!key) return true;
    if (granted.has(key)) return true;
    const match = String(key).match(ACTION_PREFIX);
    if (match) {
      const moduleKey = match[2];
      if (granted.has(`MANAGE_${moduleKey}`)) return true;
      // Attendance specials under MANAGE_ATTENDANCE
      if (moduleKey === "ATTENDANCE" || moduleKey === "ATTENDANCE_REPORT" || moduleKey === "TEAM_ATTENDANCE" || moduleKey === "ALL_ATTENDANCE") {
        if (granted.has("MANAGE_ATTENDANCE")) return true;
      }
      if (moduleKey === "CHAT_GROUPS" && granted.has("MANAGE_CHAT")) return true;
      if (moduleKey === "LEAVE_QUEUE" && granted.has("APPROVE_LEAVE")) return true;
    }
    return false;
  });
}

export function canCreate(user, module) {
  return permissionGranted(user, [`CREATE_${module}`, `MANAGE_${module}`]);
}

export function canEdit(user, module) {
  return permissionGranted(user, [`EDIT_${module}`, `MANAGE_${module}`]);
}

export function canDelete(user, module) {
  return permissionGranted(user, [`DELETE_${module}`, `MANAGE_${module}`]);
}

export function canView(user, module) {
  return permissionGranted(user, [`VIEW_${module}`, `MANAGE_${module}`, `CREATE_${module}`, `EDIT_${module}`, `DELETE_${module}`]);
}
