import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { Login } from "../pages/Login";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useAuth } from "../context/AuthContext";

const Dashboard = lazy(() => import("../pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const ClientDashboard = lazy(() => import("../pages/ClientDashboard").then((m) => ({ default: m.ClientDashboard })));
const Departments = lazy(() => import("../pages/organization/Departments").then((m) => ({ default: m.Departments })));
const Designations = lazy(() => import("../pages/organization/Designations").then((m) => ({ default: m.Designations })));
const EmployeeTypes = lazy(() => import("../pages/organization/EmployeeTypes").then((m) => ({ default: m.EmployeeTypes })));
const WorkModes = lazy(() => import("../pages/organization/WorkModes").then((m) => ({ default: m.WorkModes })));
const LeaveTypes = lazy(() => import("../pages/organization/LeaveTypes").then((m) => ({ default: m.LeaveTypes })));
const LeaveAssign = lazy(() => import("../pages/organization/LeaveAssign").then((m) => ({ default: m.LeaveAssign })));
const Leave = lazy(() => import("../pages/organization/Leave").then((m) => ({ default: m.Leave })));
const Services = lazy(() => import("../pages/organization/Services").then((m) => ({ default: m.Services })));
const Clients = lazy(() => import("../pages/management/Clients").then((m) => ({ default: m.Clients })));
const ClientView = lazy(() => import("../pages/management/ClientView").then((m) => ({ default: m.ClientView })));
const Leads = lazy(() => import("../pages/management/Leads").then((m) => ({ default: m.Leads })));
const LeadView = lazy(() => import("../pages/management/LeadView").then((m) => ({ default: m.LeadView })));
const FollowUps = lazy(() => import("../pages/management/FollowUps").then((m) => ({ default: m.FollowUps })));
const Sales = lazy(() => import("../pages/management/DealList").then((m) => ({ default: m.Sales })));
const Payments = lazy(() => import("../pages/management/DealList").then((m) => ({ default: m.Payments })));
const Revenue = lazy(() => import("../pages/management/DealList").then((m) => ({ default: m.Revenue })));
const Reports = lazy(() => import("../pages/management/Reports").then((m) => ({ default: m.Reports })));
const UrgentWorks = lazy(() => import("../pages/management/UrgentWorks").then((m) => ({ default: m.UrgentWorks })));
const UrgentWorkView = lazy(() => import("../pages/management/UrgentWorkView").then((m) => ({ default: m.UrgentWorkView })));
const DailyTasks = lazy(() => import("../pages/management/DailyTasks").then((m) => ({ default: m.DailyTasks })));
const Tickets = lazy(() => import("../pages/management/Tickets").then((m) => ({ default: m.Tickets })));
const TicketView = lazy(() => import("../pages/management/TicketView").then((m) => ({ default: m.TicketView })));
const Projects = lazy(() => import("../pages/management/Projects").then((m) => ({ default: m.Projects })));
const ProjectView = lazy(() => import("../pages/management/ProjectView").then((m) => ({ default: m.ProjectView })));
const EveningReports = lazy(() => import("../pages/management/EveningReports").then((m) => ({ default: m.EveningReports })));
const Meetings = lazy(() => import("../pages/management/Meetings").then((m) => ({ default: m.Meetings })));
const Interviews = lazy(() => import("../pages/management/Interviews").then((m) => ({ default: m.Interviews })));
const InterviewView = lazy(() => import("../pages/management/InterviewView").then((m) => ({ default: m.InterviewView })));
const Employees = lazy(() => import("../pages/management/Employees").then((m) => ({ default: m.Employees })));
const EmployeeForm = lazy(() => import("../pages/management/EmployeeForm").then((m) => ({ default: m.EmployeeForm })));
const EmployeeProfile = lazy(() => import("../pages/management/EmployeeProfile").then((m) => ({ default: m.EmployeeProfile })));
const OfferLetter = lazy(() => import("../pages/management/OfferLetter").then((m) => ({ default: m.OfferLetter })));
const Permissions = lazy(() => import("../pages/management/Permissions").then((m) => ({ default: m.Permissions })));
const SoftwareSettings = lazy(() => import("../pages/management/SoftwareSettings").then((m) => ({ default: m.SoftwareSettings })));
const OfferBanners = lazy(() => import("../pages/management/OfferBanners").then((m) => ({ default: m.OfferBanners })));
const ClientEmails = lazy(() => import("../pages/management/ClientEmails").then((m) => ({ default: m.ClientEmails })));
const Attendance = lazy(() => import("../pages/management/Attendance").then((m) => ({ default: m.Attendance })));
const AttendanceReport = lazy(() => import("../pages/management/AttendanceReport").then((m) => ({ default: m.AttendanceReport })));
const Chat = lazy(() => import("../pages/management/Chat").then((m) => ({ default: m.Chat })));
const ClientReports = lazy(() => import("../pages/ClientReports").then((m) => ({ default: m.ClientReports })));
const ClientMeetings = lazy(() => import("../pages/ClientMeetings").then((m) => ({ default: m.ClientMeetings })));

const PageFallback = () => (
  <div className="flex min-h-[30vh] items-center justify-center text-sm text-slate-500">Loading page...</div>
);

const PrivateRoute = ({ children }) => {
  const { token, isLoading } = useAuth();

  if (isLoading) return <div>Loading...</div>;

  const isAuthenticated = token && token !== "undefined" && token !== "null" && token !== "";
  return isAuthenticated ? children : <Navigate to="/" replace />;
};

const AuthRoute = ({ children }) => {
  const { token, isLoading } = useAuth();

  if (isLoading) return <div>Loading...</div>;

  const isAuthenticated = token && token !== "undefined" && token !== "null" && token !== "";
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
};

const RoleRoute = ({ children, allowedRoles = [], permissionsNeeded = [] }) => {
  const { hasRole, hasPermission, isLoading } = useAuth();

  if (isLoading) return <div>Loading...</div>;

  const roleAllowed = allowedRoles.length === 0 || hasRole(allowedRoles);
  const permissionAllowed = permissionsNeeded.length === 0 || hasPermission(permissionsNeeded);

  if (!roleAllowed || !permissionAllowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const ProfileRoute = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div>Loading...</div>;
  if (user?.userType === "CLIENT") return <ClientDashboard />;
  return <EmployeeProfile />;
};

const LazyPage = ({ children }) => (
  <ErrorBoundary>
    <Suspense fallback={<PageFallback />}>{children}</Suspense>
  </ErrorBoundary>
);

const P = {
  departments: ["VIEW_DEPARTMENTS", "MANAGE_DEPARTMENTS", "CREATE_DEPARTMENTS", "EDIT_DEPARTMENTS", "DELETE_DEPARTMENTS"],
  designations: ["VIEW_DESIGNATIONS", "MANAGE_DESIGNATIONS", "CREATE_DESIGNATIONS", "EDIT_DESIGNATIONS", "DELETE_DESIGNATIONS"],
  employeeTypes: ["VIEW_EMPLOYEE_TYPES", "MANAGE_EMPLOYEE_TYPES", "CREATE_EMPLOYEE_TYPES", "EDIT_EMPLOYEE_TYPES", "DELETE_EMPLOYEE_TYPES"],
  workModes: ["VIEW_WORK_MODES", "MANAGE_WORK_MODES", "CREATE_WORK_MODES", "EDIT_WORK_MODES", "DELETE_WORK_MODES"],
  leaveTypes: ["VIEW_LEAVE_TYPES", "MANAGE_LEAVE_TYPES", "CREATE_LEAVE_TYPES", "EDIT_LEAVE_TYPES", "DELETE_LEAVE_TYPES"],
  leaveAssign: ["VIEW_LEAVE_ASSIGN", "MANAGE_LEAVE_ASSIGN", "CREATE_LEAVE_ASSIGN", "EDIT_LEAVE_ASSIGN", "DELETE_LEAVE_ASSIGN"],
  leave: ["VIEW_LEAVE", "CREATE_LEAVE", "VIEW_LEAVE_QUEUE", "APPROVE_LEAVE"],
  services: ["VIEW_SERVICES", "MANAGE_SERVICES", "CREATE_SERVICES", "EDIT_SERVICES", "DELETE_SERVICES"],
  clients: ["VIEW_CLIENTS", "MANAGE_CLIENTS", "CREATE_CLIENTS", "EDIT_CLIENTS", "DELETE_CLIENTS"],
  leads: ["VIEW_LEADS", "MANAGE_LEADS", "CREATE_LEADS", "EDIT_LEADS", "DELETE_LEADS"],
  followUps: ["VIEW_FOLLOW_UPS", "MANAGE_FOLLOW_UPS", "CREATE_FOLLOW_UPS", "EDIT_FOLLOW_UPS", "DELETE_FOLLOW_UPS", "VIEW_LEADS", "MANAGE_LEADS"],
  sales: ["VIEW_SALES", "VIEW_LEADS", "MANAGE_LEADS"],
  payments: ["VIEW_PAYMENTS", "VIEW_LEADS", "MANAGE_LEADS"],
  revenue: ["VIEW_REVENUE", "VIEW_LEADS", "MANAGE_LEADS"],
  reports: ["VIEW_REPORTS", "MANAGE_REPORTS"],
  attendance: ["PUNCH_ATTENDANCE", "VIEW_ATTENDANCE", "MANAGE_ATTENDANCE"],
  attendanceReport: ["VIEW_ATTENDANCE_REPORT", "VIEW_TEAM_ATTENDANCE", "VIEW_ALL_ATTENDANCE", "MANAGE_ATTENDANCE", "VIEW_ATTENDANCE"],
  tickets: ["VIEW_TICKETS", "CREATE_TICKETS", "MANAGE_TICKETS", "EDIT_TICKETS", "DELETE_TICKETS"],
  urgent: ["VIEW_URGENT_WORK", "CREATE_URGENT_WORK", "EDIT_URGENT_WORK", "DELETE_URGENT_WORK", "MANAGE_URGENT_WORK"],
  dailyTasks: ["VIEW_DAILY_TASKS", "CREATE_DAILY_TASKS", "EDIT_DAILY_TASKS", "DELETE_DAILY_TASKS", "MANAGE_DAILY_TASKS"],
  projects: ["VIEW_PROJECTS", "CREATE_PROJECTS", "EDIT_PROJECTS", "DELETE_PROJECTS", "MANAGE_PROJECTS"],
  interviews: ["VIEW_INTERVIEWS", "MANAGE_INTERVIEWS", "CREATE_INTERVIEWS", "EDIT_INTERVIEWS", "DELETE_INTERVIEWS"],
  offerBanners: ["VIEW_OFFER_BANNERS", "MANAGE_OFFER_BANNERS", "CREATE_OFFER_BANNERS", "EDIT_OFFER_BANNERS", "DELETE_OFFER_BANNERS", "MANAGE_SETTINGS"],
  clientEmails: ["VIEW_EMAIL_TEMPLATES", "CREATE_EMAIL_TEMPLATES", "EDIT_EMAIL_TEMPLATES", "DELETE_EMAIL_TEMPLATES", "SEND_CLIENT_MAILS", "MANAGE_EMAIL_TEMPLATES"],
  employees: ["VIEW_EMPLOYEES", "MANAGE_EMPLOYEES", "CREATE_EMPLOYEES", "EDIT_EMPLOYEES", "DELETE_EMPLOYEES"],
  chat: ["VIEW_CHAT", "MANAGE_CHAT"],
};

export const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<AuthRoute><Login /></AuthRoute>} />

      <Route path="/dashboard" element={<PrivateRoute><DashboardLayout /></PrivateRoute>}>
        <Route index element={<LazyPage><Dashboard /></LazyPage>} />
        <Route path="profile" element={<LazyPage><ProfileRoute /></LazyPage>} />
        <Route path="my-reports/:id" element={<LazyPage><RoleRoute allowedRoles={["CLIENT"]}><ClientReports /></RoleRoute></LazyPage>} />
        <Route path="my-reports" element={<LazyPage><RoleRoute allowedRoles={["CLIENT"]}><ClientReports /></RoleRoute></LazyPage>} />
        <Route path="my-meetings" element={<LazyPage><RoleRoute allowedRoles={["CLIENT"]}><ClientMeetings /></RoleRoute></LazyPage>} />
        <Route path="chat" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.chat}><Chat /></RoleRoute></LazyPage>} />

        <Route path="departments" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.departments}><Departments /></RoleRoute></LazyPage>} />
        <Route path="designations" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.designations}><Designations /></RoleRoute></LazyPage>} />
        <Route path="employee-types" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.employeeTypes}><EmployeeTypes /></RoleRoute></LazyPage>} />
        <Route path="work-modes" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.workModes}><WorkModes /></RoleRoute></LazyPage>} />
        <Route path="leave-types" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.leaveTypes}><LeaveTypes /></RoleRoute></LazyPage>} />
        <Route path="leave-assign" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.leaveAssign}><LeaveAssign /></RoleRoute></LazyPage>} />
        <Route path="leave" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.leave}><Leave /></RoleRoute></LazyPage>} />
        <Route path="services" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.services}><Services /></RoleRoute></LazyPage>} />
        <Route path="clients" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.clients}><Clients /></RoleRoute></LazyPage>} />
        <Route path="clients/:id" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.clients}><ClientView /></RoleRoute></LazyPage>} />
        <Route path="follow-ups" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.followUps}><FollowUps /></RoleRoute></LazyPage>} />
        <Route path="sales" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.sales}><Sales /></RoleRoute></LazyPage>} />
        <Route path="payments" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.payments}><Payments /></RoleRoute></LazyPage>} />
        <Route path="revenue" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.revenue}><Revenue /></RoleRoute></LazyPage>} />
        <Route path="reports" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.reports}><Reports /></RoleRoute></LazyPage>} />
        <Route path="attendance" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.attendance}><Attendance /></RoleRoute></LazyPage>} />
        <Route path="attendance-report" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.attendanceReport}><AttendanceReport /></RoleRoute></LazyPage>} />
        <Route path="urgent-work" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.urgent}><UrgentWorks /></RoleRoute></LazyPage>} />
        <Route path="urgent-work/:id" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.urgent}><UrgentWorkView /></RoleRoute></LazyPage>} />
        <Route path="daily-tasks" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.dailyTasks}><DailyTasks /></RoleRoute></LazyPage>} />
        <Route path="help" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.tickets}><Tickets /></RoleRoute></LazyPage>} />
        <Route path="help/:id" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.tickets}><TicketView /></RoleRoute></LazyPage>} />
        <Route path="evening-reports/today" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.projects}><EveningReports todayMode /></RoleRoute></LazyPage>} />
        <Route path="evening-reports/:id" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.projects}><EveningReports /></RoleRoute></LazyPage>} />
        <Route path="evening-reports" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.projects}><EveningReports /></RoleRoute></LazyPage>} />
        <Route path="meetings" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.clients}><Meetings /></RoleRoute></LazyPage>} />
        <Route path="projects" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.projects}><Projects /></RoleRoute></LazyPage>} />
        <Route path="projects/:id" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.projects}><ProjectView /></RoleRoute></LazyPage>} />
        <Route path="interviews" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.interviews}><Interviews /></RoleRoute></LazyPage>} />
        <Route path="interviews/:id" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.interviews}><InterviewView /></RoleRoute></LazyPage>} />
        <Route path="leads" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.leads}><Leads /></RoleRoute></LazyPage>} />
        <Route path="leads/:id" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.leads}><LeadView /></RoleRoute></LazyPage>} />
        <Route path="permissions" element={<LazyPage><RoleRoute allowedRoles={["ADMIN"]} permissionsNeeded={["MANAGE_PERMISSIONS"]}><Permissions /></RoleRoute></LazyPage>} />
        <Route path="settings" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={["MANAGE_SETTINGS"]}><SoftwareSettings /></RoleRoute></LazyPage>} />
        <Route path="offer-banners" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.offerBanners}><OfferBanners /></RoleRoute></LazyPage>} />
        <Route path="client-emails" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.clientEmails}><ClientEmails /></RoleRoute></LazyPage>} />

        <Route path="employees" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.employees}><Employees /></RoleRoute></LazyPage>} />
        <Route path="employees/create" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={["CREATE_EMPLOYEES", "MANAGE_EMPLOYEES", "EDIT_EMPLOYEES"]}><EmployeeForm /></RoleRoute></LazyPage>} />
        <Route path="employees/edit/:id" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={["EDIT_EMPLOYEES", "MANAGE_EMPLOYEES"]}><EmployeeForm /></RoleRoute></LazyPage>} />
        <Route path="employees/:id/offer-letter" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={["EDIT_EMPLOYEES", "MANAGE_EMPLOYEES"]}><OfferLetter /></RoleRoute></LazyPage>} />
        <Route path="employees/:id" element={<LazyPage><RoleRoute allowedRoles={["ADMIN", "EMPLOYEE"]} permissionsNeeded={P.employees}><EmployeeProfile /></RoleRoute></LazyPage>} />

        <Route path="*" element={<div className="p-4">404 Not Found</div>} />
      </Route>
    </Routes>
  );
};
