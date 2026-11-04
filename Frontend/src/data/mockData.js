import {
  LayoutDashboard,
  Building2,
  Building,
  Briefcase,
  ShieldCheck,
  IdCard,
  Laptop,
  CalendarDays,
  CalendarPlus,
  CalendarCheck,
  Layers,
  Contact,
  UserPlus,
  CalendarClock,
  Handshake,
  Wallet,
  IndianRupee,
  BarChart3,
  UserSearch,
  FolderKanban,
  LifeBuoy,
  ListTodo,
  CheckSquare,
  Settings,
  MapPin,
  ClipboardCheck,
  ClipboardList,
  MessageCircle,
  Image,
  Video,
  Mail,
} from "lucide-react";

export const navigationData = [
  {
    group: "Dashboard",
    items: [
      // Staff overview needs VIEW_DASHBOARD; client portal overview has no permission gate.
      { name: "Overview", href: "/dashboard", icon: LayoutDashboard, allowedRoles: ["ADMIN", "EMPLOYEE"], permissionsNeeded: ["VIEW_DASHBOARD"] },
      { name: "Chat", href: "/dashboard/chat", icon: MessageCircle, allowedRoles: ["ADMIN", "EMPLOYEE"], permissionsNeeded: ["VIEW_CHAT", "MANAGE_CHAT"] },
    ],
  },
  {
    group: "Client portal",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, allowedRoles: ["CLIENT"] },
      { name: "My reports", href: "/dashboard/my-reports", icon: ClipboardList, allowedRoles: ["CLIENT"] },
      { name: "Google Meet", href: "/dashboard/my-meetings", icon: Video, allowedRoles: ["CLIENT"] },
      { name: "My profile", href: "/dashboard/profile", icon: Contact, allowedRoles: ["CLIENT"] },
    ],
  },
  {
    group: "Employee",
    items: [
      { name: "Employees", href: "/dashboard/employees", icon: Building2, allowedRoles: ["ADMIN", "EMPLOYEE"], permissionsNeeded: ["VIEW_EMPLOYEES", "MANAGE_EMPLOYEES", "CREATE_EMPLOYEES", "EDIT_EMPLOYEES", "DELETE_EMPLOYEES"] },
      { name: "Employee types", href: "/dashboard/employee-types", icon: IdCard, allowedRoles: ["ADMIN", "EMPLOYEE"], permissionsNeeded: ["VIEW_EMPLOYEE_TYPES", "MANAGE_EMPLOYEE_TYPES", "CREATE_EMPLOYEE_TYPES", "EDIT_EMPLOYEE_TYPES", "DELETE_EMPLOYEE_TYPES"] },
      { name: "Departments", href: "/dashboard/departments", icon: Building, allowedRoles: ["ADMIN", "EMPLOYEE"], permissionsNeeded: ["VIEW_DEPARTMENTS", "MANAGE_DEPARTMENTS", "CREATE_DEPARTMENTS", "EDIT_DEPARTMENTS", "DELETE_DEPARTMENTS"] },
      { name: "Designations", href: "/dashboard/designations", icon: Briefcase, allowedRoles: ["ADMIN", "EMPLOYEE"], permissionsNeeded: ["VIEW_DESIGNATIONS", "MANAGE_DESIGNATIONS", "CREATE_DESIGNATIONS", "EDIT_DESIGNATIONS", "DELETE_DESIGNATIONS"] },
      { name: "Work modes", href: "/dashboard/work-modes", icon: Laptop, allowedRoles: ["ADMIN", "EMPLOYEE"], permissionsNeeded: ["VIEW_WORK_MODES", "MANAGE_WORK_MODES", "CREATE_WORK_MODES", "EDIT_WORK_MODES", "DELETE_WORK_MODES"] },
      { name: "Leave types", href: "/dashboard/leave-types", icon: CalendarDays, allowedRoles: ["ADMIN", "EMPLOYEE"], permissionsNeeded: ["VIEW_LEAVE_TYPES", "MANAGE_LEAVE_TYPES", "CREATE_LEAVE_TYPES", "EDIT_LEAVE_TYPES", "DELETE_LEAVE_TYPES"] },
      { name: "Leave assign", href: "/dashboard/leave-assign", icon: CalendarPlus, allowedRoles: ["ADMIN", "EMPLOYEE"], permissionsNeeded: ["VIEW_LEAVE_ASSIGN", "MANAGE_LEAVE_ASSIGN", "CREATE_LEAVE_ASSIGN", "EDIT_LEAVE_ASSIGN", "DELETE_LEAVE_ASSIGN"] },
      { name: "Leave", href: "/dashboard/leave", icon: CalendarCheck, allowedRoles: ["ADMIN", "EMPLOYEE"], permissionsNeeded: ["VIEW_LEAVE", "CREATE_LEAVE", "VIEW_LEAVE_QUEUE", "APPROVE_LEAVE"] },
      { name: "Attendance", href: "/dashboard/attendance", icon: MapPin, allowedRoles: ["ADMIN", "EMPLOYEE"], permissionsNeeded: ["PUNCH_ATTENDANCE", "VIEW_ATTENDANCE", "MANAGE_ATTENDANCE"] },
      { name: "Attendance report", href: "/dashboard/attendance-report", icon: ClipboardCheck, allowedRoles: ["ADMIN", "EMPLOYEE"], permissionsNeeded: ["VIEW_ATTENDANCE_REPORT", "VIEW_TEAM_ATTENDANCE", "VIEW_ALL_ATTENDANCE", "MANAGE_ATTENDANCE", "VIEW_ATTENDANCE"] },
      { name: "Interviews", href: "/dashboard/interviews", icon: UserSearch, allowedRoles: ["ADMIN", "EMPLOYEE"], permissionsNeeded: ["VIEW_INTERVIEWS", "MANAGE_INTERVIEWS", "CREATE_INTERVIEWS", "EDIT_INTERVIEWS", "DELETE_INTERVIEWS"] },
    ],
  },
  {
    group: "Client",
    items: [
      { name: "Clients", href: "/dashboard/clients", icon: Contact, allowedRoles: ["ADMIN", "EMPLOYEE"], permissionsNeeded: ["VIEW_CLIENTS", "MANAGE_CLIENTS", "CREATE_CLIENTS", "EDIT_CLIENTS", "DELETE_CLIENTS"] },
      { name: "Google Meet", href: "/dashboard/meetings", icon: Video, allowedRoles: ["ADMIN", "EMPLOYEE"], permissionsNeeded: ["VIEW_CLIENTS", "MANAGE_CLIENTS", "CREATE_CLIENTS", "EDIT_CLIENTS", "DELETE_CLIENTS"] },
      { name: "Services", href: "/dashboard/services", icon: Layers, allowedRoles: ["ADMIN", "EMPLOYEE"], permissionsNeeded: ["VIEW_SERVICES", "MANAGE_SERVICES", "CREATE_SERVICES", "EDIT_SERVICES", "DELETE_SERVICES"] },
    ],
  },
  {
    group: "Sales",
    items: [
      { name: "Leads", href: "/dashboard/leads", icon: UserPlus, allowedRoles: ["ADMIN", "EMPLOYEE"], permissionsNeeded: ["VIEW_LEADS", "MANAGE_LEADS", "CREATE_LEADS", "EDIT_LEADS", "DELETE_LEADS"] },
      { name: "Follow-ups", href: "/dashboard/follow-ups", icon: CalendarClock, allowedRoles: ["ADMIN", "EMPLOYEE"], permissionsNeeded: ["VIEW_FOLLOW_UPS", "MANAGE_FOLLOW_UPS", "CREATE_FOLLOW_UPS", "EDIT_FOLLOW_UPS", "DELETE_FOLLOW_UPS", "VIEW_LEADS", "MANAGE_LEADS"] },
      { name: "Sales", href: "/dashboard/sales", icon: Handshake, allowedRoles: ["ADMIN", "EMPLOYEE"], permissionsNeeded: ["VIEW_SALES", "VIEW_LEADS", "MANAGE_LEADS"] },
      { name: "Payments", href: "/dashboard/payments", icon: Wallet, allowedRoles: ["ADMIN", "EMPLOYEE"], permissionsNeeded: ["VIEW_PAYMENTS", "VIEW_LEADS", "MANAGE_LEADS"] },
      { name: "Revenue", href: "/dashboard/revenue", icon: IndianRupee, allowedRoles: ["ADMIN", "EMPLOYEE"], permissionsNeeded: ["VIEW_REVENUE", "VIEW_LEADS", "MANAGE_LEADS"] },
      { name: "Reports", href: "/dashboard/reports", icon: BarChart3, allowedRoles: ["ADMIN", "EMPLOYEE"], permissionsNeeded: ["VIEW_REPORTS", "MANAGE_REPORTS"] },
    ],
  },
  {
    group: "Work",
    items: [
      {
        name: "Projects",
        icon: FolderKanban,
        allowedRoles: ["ADMIN", "EMPLOYEE"],
        permissionsNeeded: ["VIEW_PROJECTS", "CREATE_PROJECTS", "EDIT_PROJECTS", "DELETE_PROJECTS", "MANAGE_PROJECTS"],
        children: [
          { name: "All projects", href: "/dashboard/projects", permissionsNeeded: ["VIEW_PROJECTS", "CREATE_PROJECTS", "EDIT_PROJECTS", "DELETE_PROJECTS", "MANAGE_PROJECTS"] },
          { name: "Evening reports", href: "/dashboard/evening-reports", end: false, permissionsNeeded: ["VIEW_PROJECTS", "EDIT_PROJECTS", "MANAGE_PROJECTS"] },
          { name: "Today's reports", href: "/dashboard/evening-reports/today", end: false, permissionsNeeded: ["VIEW_PROJECTS", "EDIT_PROJECTS", "MANAGE_PROJECTS"] },
        ],
      },
      { name: "Daily tasks", href: "/dashboard/daily-tasks", icon: CheckSquare, allowedRoles: ["ADMIN", "EMPLOYEE"], permissionsNeeded: ["VIEW_DAILY_TASKS", "CREATE_DAILY_TASKS", "EDIT_DAILY_TASKS", "DELETE_DAILY_TASKS", "MANAGE_DAILY_TASKS"] },
      { name: "Urgent work", href: "/dashboard/urgent-work", icon: ListTodo, allowedRoles: ["ADMIN", "EMPLOYEE"], permissionsNeeded: ["VIEW_URGENT_WORK", "CREATE_URGENT_WORK", "EDIT_URGENT_WORK", "DELETE_URGENT_WORK", "MANAGE_URGENT_WORK"] },
      { name: "Help", href: "/dashboard/help", icon: LifeBuoy, allowedRoles: ["ADMIN", "EMPLOYEE"], permissionsNeeded: ["VIEW_TICKETS", "CREATE_TICKETS", "MANAGE_TICKETS", "EDIT_TICKETS", "DELETE_TICKETS"] },
    ],
  },
  {
    group: "App",
    items: [
      { name: "Offer banners", href: "/dashboard/offer-banners", icon: Image, allowedRoles: ["ADMIN", "EMPLOYEE"], permissionsNeeded: ["VIEW_OFFER_BANNERS", "MANAGE_OFFER_BANNERS", "CREATE_OFFER_BANNERS", "EDIT_OFFER_BANNERS", "DELETE_OFFER_BANNERS", "MANAGE_SETTINGS"] },
      { name: "Client emails", href: "/dashboard/client-emails", icon: Mail, allowedRoles: ["ADMIN", "EMPLOYEE"], permissionsNeeded: ["VIEW_EMAIL_TEMPLATES", "CREATE_EMAIL_TEMPLATES", "EDIT_EMAIL_TEMPLATES", "DELETE_EMAIL_TEMPLATES", "SEND_CLIENT_MAILS", "MANAGE_EMAIL_TEMPLATES"] },
    ],
  },
  {
    group: "System",
    items: [
      { name: "Permissions", href: "/dashboard/permissions", icon: ShieldCheck, allowedRoles: ["ADMIN"], permissionsNeeded: ["MANAGE_PERMISSIONS"] },
      { name: "Settings", href: "/dashboard/settings", icon: Settings, allowedRoles: ["ADMIN", "EMPLOYEE"], permissionsNeeded: ["MANAGE_SETTINGS"] },
    ],
  },
];
