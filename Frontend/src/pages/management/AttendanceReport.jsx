import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Input } from "../../components/ui/Input";
import { Pager } from "../../components/ui/Pager";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { formatDate, formatDateTime } from "./leadOptions";

const selectClass = "h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-600";

const shotTime = (shot) => (shot?.at ? formatDateTime(shot.at) : "—");

const ShotCell = ({ shot }) => (
  <div className="flex items-center gap-2">
    {shot?.photoUrl ? (
      <a href={shot.photoUrl} target="_blank" rel="noreferrer" className="shrink-0">
        <img src={shot.photoUrl} alt="" className="h-9 w-9 rounded-md object-cover ring-1 ring-slate-200" />
      </a>
    ) : null}
    <span>{shotTime(shot)}</span>
  </div>
);

export function AttendanceReport() {
  const { hasPermission } = useAuth();
  const canSeeAll = hasPermission(["VIEW_ALL_ATTENDANCE", "MANAGE_ATTENDANCE"]);
  const canSeeTeam = hasPermission(["VIEW_TEAM_ATTENDANCE", "VIEW_ALL_ATTENDANCE", "MANAGE_ATTENDANCE"]);
  const canPickPeople = canSeeAll || canSeeTeam;
  const [params, setParams] = useSearchParams();
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const employee = params.get("employee") || "";
  const status = params.get("status") || "";
  const asked = params.get("scope") || "";
  const scope = asked === "mine"
    ? "mine"
    : asked === "team" && canSeeTeam
      ? "team"
      : canSeeAll
        ? "all"
        : canSeeTeam
          ? "team"
          : "mine";
  const page = Math.max(parseInt(params.get("page") || "1", 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(params.get("limit") || "10", 10) || 10, 1), 100);
  const [payload, setPayload] = useState(null);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);

  const setQuery = (patch, resetPage = true) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === "" || value == null) next.delete(key);
      else next.set(key, String(value));
    });
    if (resetPage) next.delete("page");
    setParams(next);
  };

  useEffect(() => {
    if (!canPickPeople) return undefined;
    let cancelled = false;
    api.get("/admin/attendance/employees")
      .then((res) => { if (!cancelled) setPeople(res.data.data || []); })
      .catch(() => { if (!cancelled) toast.error("Failed to load employees"); });
    return () => { cancelled = true; };
  }, [canPickPeople]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get("/admin/attendance", {
          params: {
            from,
            to,
            employee: scope === "mine" ? "" : employee,
            status,
            scope,
            page,
            limit,
          },
        });
        if (!cancelled) setPayload(res.data);
      } catch (error) {
        if (!cancelled) toast.error(error.response?.data?.message || "Failed to load the attendance report");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [from, to, employee, status, scope, page, limit]);

  const rows = payload?.data || [];
  const showPeople = scope === "all" || scope === "team";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Attendance report</h1>
        <p className="mt-1 text-sm text-slate-500">
          {scope === "all"
            ? "Every employee's punch in and punch out. Filters stay in the page address."
            : scope === "team"
              ? "Your team's punch in and punch out. Filters stay in the page address."
              : "Your punch in and punch out. Filters stay in the page address."}
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        {canPickPeople && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="attendance-scope">Report</label>
            <select
              id="attendance-scope"
              className={selectClass}
              value={scope}
              onChange={(event) => setQuery({ scope: event.target.value, employee: "" })}
            >
              {canSeeAll && <option value="all">Everyone</option>}
              {canSeeTeam && <option value="team">My team</option>}
              <option value="mine">My attendance</option>
            </select>
          </div>
        )}
        {showPeople && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="attendance-employee">Employee</label>
            <select id="attendance-employee" className={selectClass} value={employee} onChange={(event) => setQuery({ employee: event.target.value })}>
              <option value="">All</option>
              {people.map((person) => <option key={person._id} value={person._id}>{person.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="attendance-status">Punch</label>
          <select id="attendance-status" className={selectClass} value={status} onChange={(event) => setQuery({ status: event.target.value })}>
            <option value="">All</option>
            <option value="open">Punch in only</option>
            <option value="closed">Completed</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="attendance-from">From</label>
          <Input id="attendance-from" type="date" value={from} onChange={(event) => setQuery({ from: event.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="attendance-to">To</label>
          <Input id="attendance-to" type="date" value={to} onChange={(event) => setQuery({ to: event.target.value })} />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
                {showPeople && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Employee</th>}
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Punch in</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Punch out</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={showPeople ? 5 : 4} className="px-4 py-8 text-center text-sm text-slate-500">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={showPeople ? 5 : 4} className="px-4 py-8 text-center text-sm text-slate-500">No records.</td></tr>
              ) : rows.map((row) => (
                <tr key={row._id}>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-800">{formatDate(row.date)}</td>
                  {showPeople && (
                    <td className="px-4 py-3 text-sm text-slate-800">
                      {row.user?.name || "—"}
                      {row.user?.employeeId ? ` (${row.user.employeeId})` : ""}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700"><ShotCell shot={row.punchIn} /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700"><ShotCell shot={row.punchOut} /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{row.hours || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager
          page={page}
          pages={payload?.pagination?.pages || 1}
          total={payload?.pagination?.total || 0}
          limit={limit}
          onPage={(next) => setQuery({ page: next }, false)}
          onLimit={(value) => setQuery({ limit: value })}
        />
      </div>
    </div>
  );
}
