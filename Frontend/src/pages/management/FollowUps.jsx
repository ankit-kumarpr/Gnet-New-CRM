import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/Button";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { LEAD_STATUSES, followUpTone, formatDate, leadLabel, statusClass } from "./leadOptions";
import { cn } from "../../utils/cn";

const ranges = [
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "upcoming", label: "Upcoming" },
];

export function FollowUps() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [range, setRange] = useState("today");
  const [scope, setScope] = useState(user?.userType === "ADMIN" ? "all" : "mine");
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({ overdue: 0, today: 0, tomorrow: 0, upcoming: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get("/admin/follow-ups/due", { params: { range, scope } });
        if (cancelled) return;
        setRows(res.data.data || []);
        setCounts(res.data.counts || { overdue: 0, today: 0, tomorrow: 0, upcoming: 0 });
      } catch (error) {
        if (!cancelled) toast.error(error.response?.data?.message || "Failed to load follow-ups");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [range, scope]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Follow-ups</h1>
          <p className="mt-1 text-sm text-slate-500">Calls due today, tomorrow, and the ones already late.</p>
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          <Button type="button" variant={scope === "mine" ? "default" : "ghost"} size="sm" onClick={() => setScope("mine")}>Mine</Button>
          <Button type="button" variant={scope === "all" ? "default" : "ghost"} size="sm" onClick={() => setScope("all")}>All</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {ranges.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setRange(item.id)}
            className={cn(
              "rounded-xl border px-4 py-3 text-left shadow-sm",
              range === item.id ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"
            )}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{counts[item.id] || 0}</p>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Lead</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Phone</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Next follow-up</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Assigned to</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">No follow-ups in this list.</td></tr>
              ) : rows.map((row) => (
                <tr key={row._id} className="cursor-pointer transition-colors hover:bg-slate-50" onClick={() => navigate(`/dashboard/leads/${row._id}`, { state: { follow: true } })}>
                  <td className="px-6 py-4 text-sm">
                    <p className="font-medium text-slate-900">{row.name}</p>
                    {row.companyName && <div className="text-slate-500">{row.companyName}</div>}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">{row.phone}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", statusClass(row.status))}>{leadLabel(LEAD_STATUSES, row.status)}</span>
                  </td>
                  <td className={cn("whitespace-nowrap px-6 py-4 text-sm", followUpTone(row.nextFollowUpAt, row.status))}>{formatDate(row.nextFollowUpAt)}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">{row.assignedTo?.name || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
