import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = ["#047857", "#0f766e", "#0369a1", "#b45309", "#475569", "#65a30d", "#0e7490", "#334155"];

export function Panel({ title, subtitle, action, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyChart({ children }) {
  return <p className="flex h-48 items-center justify-center text-center text-sm text-slate-500">{children}</p>;
}

function RangeToggle({ value, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs font-medium">
      {[7, 30].map((days) => (
        <button
          key={days}
          type="button"
          aria-pressed={value === days}
          onClick={() => onChange(days)}
          className={`rounded-md px-2.5 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 ${value === days ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}
        >
          {days} days
        </button>
      ))}
    </div>
  );
}

const tipStyle = { border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, color: "#0f172a" };

export function AttendanceChart({ series }) {
  const [days, setDays] = useState(7);
  const rows = (series || []).slice(-days);
  const empty = rows.every((row) => !row.present && !row.onLeave);
  return (
    <Panel
      title="Attendance"
      subtitle="Active employees who punched in, and those on approved leave without a punch. Past days use the current active roster."
      action={<RangeToggle value={days} onChange={setDays} />}
    >
      {empty ? <EmptyChart>No attendance or approved leave in this period.</EmptyChart> : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="present" name="Punched in" fill="#047857" radius={[3, 3, 0, 0]} maxBarSize={18} />
              <Bar dataKey="onLeave" name="On leave" fill="#0f766e" radius={[3, 3, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

export function WorkforceChart({ rows }) {
  const navigate = useNavigate();
  if (!rows?.length) return <Panel title="Departments"><EmptyChart>No active employees yet.</EmptyChart></Panel>;
  return (
    <Panel title="Workforce by department" subtitle="Active employees. Select a department to open that list.">
      <div style={{ height: Math.max(220, rows.length * 36) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: "#334155" }} tickFormatter={(value) => (value.length > 16 ? `${value.slice(0, 15)}…` : value)} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tipStyle} formatter={(value, _name, item) => [`${value} · ${item.payload.percent}%`, "Employees"]} />
            <Bar
              dataKey="count"
              fill="#047857"
              radius={[0, 4, 4, 0]}
              barSize={14}
              cursor="pointer"
              onClick={(entry) => {
                const id = entry?.id || entry?.payload?.id;
                if (id) navigate(`/dashboard/employees?department=${id}`);
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

export function CompositionChart({ employeeTypes, workModes }) {
  const hasTypes = employeeTypes?.length > 0;
  const hasModes = workModes?.length > 0;
  const [kind, setKind] = useState(hasTypes ? "type" : "mode");
  const rows = kind === "type" ? employeeTypes : workModes;
  if (!hasTypes && !hasModes) return <Panel title="Employee mix"><EmptyChart>No employee type or work mode is assigned yet.</EmptyChart></Panel>;
  return (
    <Panel
      title="Employee mix"
      subtitle="Share of active employees."
      action={hasTypes && hasModes ? (
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs font-medium">
          {[["type", "Type"], ["mode", "Work mode"]].map(([id, label]) => (
            <button key={id} type="button" aria-pressed={kind === id} onClick={() => setKind(id)} className={`rounded-md px-2.5 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 ${kind === id ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}>{label}</button>
          ))}
        </div>
      ) : null}
    >
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="count" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={2} stroke="none">
              {rows.map((row, index) => <Cell key={row.id || row.name} fill={COLORS[index % COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={tipStyle} formatter={(value, _name, item) => [`${value} · ${item.payload.percent}%`, item.payload.name]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

export function LeaveChart({ leave }) {
  const [days, setDays] = useState(7);
  const rows = (leave?.series || []).slice(-days);
  const empty = rows.every((row) => !row.pending && !row.approved && !row.rejected);
  const totals = rows.reduce((sum, row) => ({
    pending: sum.pending + row.pending,
    approved: sum.approved + row.approved,
    rejected: sum.rejected + row.rejected,
  }), { pending: 0, approved: 0, rejected: 0 });
  return (
    <Panel
      title="Leave requests"
      subtitle="Requests created in the selected period, grouped by their current status. The pending count above is the live queue."
      action={<RangeToggle value={days} onChange={setDays} />}
    >
      <div className="mb-4 flex flex-wrap gap-4 text-xs text-slate-500">
        <span>Pending in range <strong className="text-slate-900">{totals.pending}</strong></span>
        <span>Approved <strong className="text-slate-900">{totals.approved}</strong></span>
        <span>Rejected <strong className="text-slate-900">{totals.rejected}</strong></span>
      </div>
      {empty ? <EmptyChart>No leave requests in this period.</EmptyChart> : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="pending" name="Pending" stackId="leave" fill="#d97706" maxBarSize={18} />
              <Bar dataKey="approved" name="Approved" stackId="leave" fill="#047857" maxBarSize={18} />
              <Bar dataKey="rejected" name="Rejected" stackId="leave" fill="#64748b" radius={[3, 3, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

export function HiringChart({ rows }) {
  const empty = !rows?.length || rows.every((row) => !row.count);
  return (
    <Panel title="Hiring" subtitle="Employees with a joining date in the last 6 months. People without a joining date are not included.">
      {empty ? <EmptyChart>No joining dates in the last 6 months.</EmptyChart> : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tipStyle} />
              <Bar dataKey="count" name="Joined" fill="#047857" radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
