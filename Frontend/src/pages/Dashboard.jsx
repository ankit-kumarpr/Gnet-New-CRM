import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, Building, Building2, CalendarCheck, CalendarClock, ClipboardCheck, Contact, FolderKanban, Handshake, IdCard, IndianRupee, Laptop, LifeBuoy, ListTodo, MapPin, RefreshCw, UserPlus, UserSearch, Users } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useBrand } from "../context/BrandContext";
import { AttendanceChart, CompositionChart, HiringChart, LeaveChart, Panel, WorkforceChart } from "../components/dashboard/DashboardCharts";
import { ClientDashboard } from "./ClientDashboard";

const icons = {
  leads: UserPlus,
  follow: CalendarClock,
  sales: Handshake,
  revenue: IndianRupee,
  projects: FolderKanban,
  "projects-late": FolderKanban,
  tickets: LifeBuoy,
  work: ListTodo,
  clients: Contact,
  interviews: UserSearch,
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function compareYesterday(today, yesterday) {
  if (today == null || yesterday == null) return "";
  const delta = today - yesterday;
  if (delta === 0) return "Same as yesterday";
  if (delta > 0) return `${delta} more than yesterday`;
  return `${Math.abs(delta)} fewer than yesterday`;
}

function Sparkline({ points }) {
  if (!points?.length || points.every((value) => value === 0)) return null;
  const max = Math.max(...points, 1);
  const width = 96;
  const height = 28;
  const step = points.length === 1 ? 0 : width / (points.length - 1);
  const path = points.map((value, index) => `${index === 0 ? "M" : "L"} ${index * step} ${height - (value / max) * (height - 2) - 1}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-7 w-24 text-emerald-700" aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Kpi({ label, value, hint, href, icon: Icon, spark }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <Icon className="h-4 w-4 shrink-0 text-emerald-700" />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {spark}
    </>
  );
  const className = "block rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-emerald-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700";
  if (!href) return <div className={className}>{body}</div>;
  return <Link to={href} className={className}>{body}</Link>;
}

function formatWhen(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function Dashboard() {
  const { user, hasPermission } = useAuth();
  const { brand } = useBrand();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const isClient = user?.userType === "CLIENT";

  const load = useCallback((refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    api.get("/admin/dashboard/summary")
      .then((res) => setData(res.data.data))
      .catch((err) => setError(err.response?.data?.message || "Could not load the dashboard"))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    if (isClient) {
      setLoading(false);
      return;
    }
    load(false);
  }, [load, isClient]);

  // Keep today's employee work % fresh while dashboard tab is visible.
  useEffect(() => {
    if (isClient || (!data?.admin && !data?.todayWork)) return undefined;
    const tick = () => {
      if (document.visibilityState === "visible") load(true);
    };
    const timer = window.setInterval(tick, 120000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [data?.admin, data?.todayWork, load, isClient]);

  if (isClient) return <ClientDashboard />;

  const workforce = data?.workforce;
  const todayWork = data?.todayWork;
  const attendanceHint = compareYesterday(workforce?.presentToday, workforce?.presentYesterday);
  const spark = (data?.attendance || []).slice(-7).map((row) => row.present);
  const personal = data?.personal;
  const personalLabel = personal?.state === "out" ? "Punched out" : personal?.state === "in" ? "Punched in" : "Not punched in";
  const company = brand?.companyName || "";

  const actions = [
    hasPermission(["MANAGE_EMPLOYEES", "CREATE_EMPLOYEES"]) && { label: "Add employee", href: "/dashboard/employees/create", icon: Users },
    hasPermission(["MANAGE_DEPARTMENTS", "VIEW_DEPARTMENTS", "CREATE_DEPARTMENTS", "EDIT_DEPARTMENTS", "DELETE_DEPARTMENTS"]) && { label: "Departments", href: "/dashboard/departments", icon: Building },
    hasPermission(["MANAGE_DESIGNATIONS", "VIEW_DESIGNATIONS", "CREATE_DESIGNATIONS", "EDIT_DESIGNATIONS", "DELETE_DESIGNATIONS"]) && { label: "Designations", href: "/dashboard/designations", icon: Briefcase },
    hasPermission(["VIEW_LEAVE", "CREATE_LEAVE", "VIEW_LEAVE_QUEUE", "APPROVE_LEAVE"]) && { label: "Leave requests", href: "/dashboard/leave", icon: CalendarCheck },
    hasPermission(["VIEW_ATTENDANCE_REPORT", "VIEW_TEAM_ATTENDANCE", "VIEW_ALL_ATTENDANCE", "MANAGE_ATTENDANCE"])
      ? { label: "Attendance report", href: "/dashboard/attendance-report", icon: ClipboardCheck }
      : hasPermission(["PUNCH_ATTENDANCE", "VIEW_ATTENDANCE", "MANAGE_ATTENDANCE"]) && { label: "Attendance", href: "/dashboard/attendance", icon: MapPin },
    hasPermission(["VIEW_WORK_MODES", "MANAGE_WORK_MODES", "CREATE_WORK_MODES", "EDIT_WORK_MODES", "DELETE_WORK_MODES"]) && { label: "Work modes", href: "/dashboard/work-modes", icon: Laptop },
    hasPermission(["VIEW_EMPLOYEE_TYPES", "MANAGE_EMPLOYEE_TYPES", "CREATE_EMPLOYEE_TYPES", "EDIT_EMPLOYEE_TYPES", "DELETE_EMPLOYEE_TYPES"]) && { label: "Employee types", href: "/dashboard/employee-types", icon: IdCard },
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Dashboard{company ? ` · ${company}` : ""}</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{greeting()}, {user?.name || "there"}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data?.staff ? "Here's your workforce overview for today." : "Here's what needs attention today."}
            {data?.dateLabel ? ` ${data.dateLabel}.` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          <button type="button" onClick={() => load(false)} className="font-medium underline">Try again</button>
        </div>
      )}

      {loading && !data && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-xl bg-white" />)}
        </div>
      )}

      {data && (
        <>
          {todayWork && (
            <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Today&apos;s work progress</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Live from daily / urgent work · updates every minute
                    {todayWork.asOf ? ` · last checked ${formatWhen(todayWork.asOf)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-teal-100 px-3 py-1 text-sm font-semibold text-teal-900">
                    Team avg {todayWork.averagePercent}%
                  </span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                    {todayWork.doneItems}/{todayWork.totalItems} done
                  </span>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
                    {todayWork.pendingItems} pending
                  </span>
                  <Link to="/dashboard/daily-tasks" className="text-sm font-medium text-emerald-700 hover:underline">
                    Open daily tasks
                  </Link>
                </div>
              </div>

              {(todayWork.employees || []).length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">Aaj kisi employee pe scheduled daily work nahi hai.</p>
              ) : (
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {todayWork.employees.map((emp) => (
                    <li key={emp.id} className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{emp.name}</p>
                          <p className="text-xs text-slate-500">
                            {emp.done}/{emp.total} items · {emp.pending} pending
                          </p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          emp.status === "DONE"
                            ? "bg-emerald-100 text-emerald-800"
                            : emp.status === "PARTIAL"
                              ? "bg-amber-100 text-amber-900"
                              : "bg-slate-200 text-slate-700"
                        }`}>
                          {emp.percent}%
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            emp.percent >= 100 ? "bg-emerald-600" : emp.percent > 0 ? "bg-amber-500" : "bg-slate-400"
                          }`}
                          style={{ width: `${Math.min(100, emp.percent)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {data.operations.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Operations</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {data.operations.map((item) => {
                  const Icon = icons[item.key] || FolderKanban;
                  return (
                    <Link key={item.key} to={item.href} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-emerald-200">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-medium text-slate-500">{item.label}</p>
                        <Icon className="h-4 w-4 text-teal-700" />
                      </div>
                      <p className="mt-2 text-xl font-semibold text-slate-900">{item.value}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{item.hint}</p>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {data.lists.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              {data.lists.map((list) => (
                <section key={list.title} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <h2 className="text-sm font-semibold text-slate-900">{list.title}</h2>
                    <Link to={list.href} className="text-sm font-medium text-emerald-700">View all</Link>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {list.rows.map((row) => (
                      <li key={row.id}>
                        <Link to={row.href} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                          <span className="truncate text-sm font-medium text-slate-800">{row.label}</span>
                          <span className="shrink-0 text-xs text-slate-500">{row.meta}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {workforce && (
              <>
                <Kpi label="Total employees" value={workforce.totalEmployees} hint="Everyone on record" href="/dashboard/employees" icon={Users} />
                <Kpi label="Active employees" value={workforce.activeEmployees} hint="Status is active" href="/dashboard/employees" icon={Building2} />
                {workforce.presentToday != null && (
                  <Kpi label="Present today" value={workforce.presentToday} hint={attendanceHint || "Punched in"} href="/dashboard/attendance-report" icon={MapPin} spark={<Sparkline points={spark} />} />
                )}
                {workforce.absentToday != null && (
                  <Kpi label="Absent today" value={workforce.absentToday} hint="No punch and no approved leave" href="/dashboard/attendance-report" icon={Users} />
                )}
                {workforce.onLeaveToday != null && (
                  <Kpi label="On leave today" value={workforce.onLeaveToday} hint="Approved leave, no punch-in" href="/dashboard/leave" icon={CalendarCheck} />
                )}
              </>
            )}
            {!data.admin && (
              <Kpi label="Your attendance" value={personalLabel} hint={personal?.at ? `Punch in ${formatWhen(personal.at)}` : "Punch in is still open"} href="/dashboard/attendance" icon={MapPin} />
            )}
            <Kpi label="Pending leave" value={data.leave.pending} hint={data.admin ? "Waiting for a decision" : "Yours and your team"} href="/dashboard/leave" icon={CalendarCheck} />
            {workforce?.departments != null && (
              <Kpi label="Departments" value={workforce.departments} hint="Active departments" href="/dashboard/departments" icon={Building} />
            )}
            {workforce && (
              <Kpi label="New joiners" value={workforce.joinersThisMonth} hint={`${workforce.joinersLastMonth} last month`} href="/dashboard/employees" icon={UserPlus} />
            )}
          </section>

          {(data.admin || workforce) && (
            <div className="grid gap-4 xl:grid-cols-2">
              {data.admin && <AttendanceChart series={data.attendance} />}
              {workforce && <WorkforceChart rows={workforce.departmentsChart} />}
              {workforce && <CompositionChart employeeTypes={workforce.employeeTypes} workModes={workforce.workModes} />}
              <LeaveChart leave={data.leave} />
              {workforce && <HiringChart rows={workforce.hiring} />}
            </div>
          )}

          {!data.admin && !workforce && <LeaveChart leave={data.leave} />}

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Recent activity" subtitle="Taken from employees, leave, and today's punch-ins. There is no separate activity log.">
              {data.activity.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">Nothing recent to show.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.activity.map((row) => (
                    <li key={row.id}>
                      <Link to={row.href} className="flex items-center justify-between gap-3 py-3 hover:text-emerald-800">
                        <span className="truncate text-sm text-slate-800">{row.title}</span>
                        <span className="shrink-0 text-xs text-slate-500">{formatWhen(row.at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Quick actions">
              <div className="grid gap-2 sm:grid-cols-2">
                {actions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link key={action.href + action.label} to={action.href} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">
                      <Icon className="h-4 w-4 text-emerald-700" />
                      {action.label}
                    </Link>
                  );
                })}
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
