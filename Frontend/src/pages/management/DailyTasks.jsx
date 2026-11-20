import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, Plus, RefreshCw, Send, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../utils/cn";

const selectClass =
  "h-10 w-full rounded-[6px] border border-[#E5EAF1] bg-white px-3 py-2 text-sm focus:border-[#3569A8] focus:outline-none focus:ring-2 focus:ring-[#3569A8]/20";

const todayInput = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const statusClass = (status) => {
  if (status === "DONE") return "bg-[#16A36A]/12 text-[#16A36A]";
  if (status === "PARTIAL") return "bg-amber-100 text-amber-900";
  if (status === "HOLD") return "bg-orange-100 text-orange-800";
  return "bg-slate-100 text-slate-700";
};

export function DailyTasks() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayInput());
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [form, setForm] = useState({ project: "", title: "", work: "" });

  const loadOptions = async () => {
    try {
      const res = await api.get("/admin/daily-tasks/options");
      setProjects(res.data.data?.projects || []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not load assigned projects");
    }
  };

  const loadTasks = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/daily-tasks/list", {
        params: { date, assignee: user?._id, limit: 100 },
      });
      setTasks(res.data.data || []);
      setCounts(res.data.counts || {});
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not load todos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOptions();
  }, []);

  useEffect(() => {
    if (user?._id) loadTasks();
  }, [date, user?._id]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const task of tasks) {
      const clientKey = String(task.client?._id || task.client || "none");
      const clientName = task.client?.name || task.clientName || "No client";
      if (!map.has(clientKey)) map.set(clientKey, { clientId: clientKey === "none" ? "" : clientKey, clientName, items: [] });
      map.get(clientKey).items.push(task);
    }
    return [...map.values()];
  }, [tasks]);

  const addTodo = async (event) => {
    event.preventDefault();
    if (!form.project) return toast.error("Select an assigned project");
    if (!form.title.trim()) return toast.error("Enter what you will do");
    try {
      setSaving(true);
      await api.post("/admin/daily-tasks/create", {
        date,
        project: form.project,
        title: form.title.trim(),
        work: form.work.trim() || form.title.trim(),
        assignee: user._id,
        status: "PENDING",
      });
      toast.success("Todo added");
      setForm({ project: form.project, title: "", work: "" });
      await loadTasks();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not add todo");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (task, status) => {
    try {
      setSaving(true);
      await api.patch(`/admin/daily-tasks/${task._id}/status`, {
        status,
        workDone: status === "DONE" ? (task.workDone || task.work || task.title) : task.workDone,
        pendingWork: status === "PENDING" ? "" : task.pendingWork,
      });
      toast.success(status === "DONE" ? "Marked complete" : "Marked pending");
      await loadTasks();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update status");
    } finally {
      setSaving(false);
    }
  };

  const removeTodo = async (task) => {
    if (!window.confirm("Delete this todo?")) return;
    try {
      setSaving(true);
      await api.delete(`/admin/daily-tasks/${task._id}`);
      toast.success("Deleted");
      await loadTasks();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not delete");
    } finally {
      setSaving(false);
    }
  };

  const pushReports = async (clientId = "") => {
    try {
      setPushing(true);
      const res = await api.post("/admin/daily-tasks/push-evening-report", {
        date,
        ...(clientId ? { client: clientId } : {}),
      });
      const rows = res.data.data || [];
      const ok = rows.filter((row) => !row.skipped).length;
      const skipped = rows.filter((row) => row.skipped).length;
      toast.success(`Evening report updated for ${ok} client(s)${skipped ? ` · ${skipped} skipped` : ""}`);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not build evening report");
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#26364A]">My daily todos</h1>
          <p className="mt-1 text-sm text-[#718096]">
            Add your own todos on assigned projects, mark Complete / Pending, then push to evening report per client.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={loadTasks} disabled={loading || saving}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button type="button" onClick={() => pushReports()} disabled={pushing || !tasks.length}>
            <Send className="mr-2 h-4 w-4" />
            {pushing ? "Building..." : "Push all to evening reports"}
          </Button>
          <Link to="/dashboard/evening-reports/today">
            <Button type="button" variant="outline">Open today&apos;s reports</Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-[10px] border border-[#E5EAF1] bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-medium text-[#718096]">Date</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-[6px] bg-slate-100 px-2.5 py-1 font-medium text-slate-700">All {counts.ALL || tasks.length || 0}</span>
          <span className="rounded-[6px] bg-slate-100 px-2.5 py-1 font-medium text-slate-700">Pending {counts.PENDING || 0}</span>
          <span className="rounded-[6px] bg-[#16A36A]/12 px-2.5 py-1 font-medium text-[#16A36A]">Done {counts.DONE || 0}</span>
        </div>
      </div>

      <form onSubmit={addTodo} className="grid gap-3 rounded-[10px] border border-[#E5EAF1] bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <label className="mb-1 block text-xs font-medium text-[#718096]">Assigned project *</label>
          <select
            className={selectClass}
            value={form.project}
            onChange={(e) => setForm((current) => ({ ...current, project: e.target.value }))}
            disabled={saving}
          >
            <option value="">Select project</option>
            {projects.map((project) => (
              <option key={project._id} value={project._id}>
                {project.clientName ? `${project.clientName} · ` : ""}{project.name}
              </option>
            ))}
          </select>
          {!projects.length && (
            <p className="mt-1 text-[11px] text-amber-700">No project assigned to you yet.</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#718096]">Todo *</label>
          <Input
            placeholder="e.g. 3 reels for Instagram"
            value={form.title}
            onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
            disabled={saving}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#718096]">Detail (optional)</label>
          <Input
            placeholder="More detail…"
            value={form.work}
            onChange={(e) => setForm((current) => ({ ...current, work: e.target.value }))}
            disabled={saving}
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" className="w-full" disabled={saving || !projects.length}>
            <Plus className="mr-2 h-4 w-4" />
            Add todo
          </Button>
        </div>
      </form>

      {loading ? (
        <p className="rounded-[10px] border border-[#E5EAF1] bg-white p-6 text-sm text-[#718096]">Loading todos...</p>
      ) : grouped.length === 0 ? (
        <p className="rounded-[10px] border border-[#E5EAF1] bg-white p-6 text-sm text-[#718096]">
          No todos for this date. Pick an assigned project and add what you will do today.
        </p>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <section key={group.clientId || group.clientName} className="overflow-hidden rounded-[10px] border border-[#E5EAF1] bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5EAF1] bg-[#F7F9FC] px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-[#26364A]">{group.clientName}</h2>
                  <p className="text-xs text-[#718096]">{group.items.length} todo(s)</p>
                </div>
                {group.clientId && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pushing}
                    onClick={() => pushReports(group.clientId)}
                  >
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                    Push to evening report
                  </Button>
                )}
              </div>
              <ul className="divide-y divide-[#E5EAF1]">
                {group.items.map((task) => (
                  <li key={task._id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-[#26364A]">{task.title}</p>
                        <span className={cn("rounded-[6px] px-2 py-0.5 text-[11px] font-semibold", statusClass(task.status))}>
                          {task.status === "DONE" ? "Complete" : task.status === "PARTIAL" ? "Partial" : task.status === "HOLD" ? "Hold" : "Pending"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[#718096]">
                        {task.project?.name || task.projectName || "Project"}
                        {task.work && task.work !== task.title ? ` · ${task.work}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={task.status === "DONE" ? "default" : "outline"}
                        disabled={saving}
                        onClick={() => setStatus(task, "DONE")}
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        Complete
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={task.status === "PENDING" ? "secondary" : "outline"}
                        disabled={saving}
                        onClick={() => setStatus(task, "PENDING")}
                      >
                        <Circle className="mr-1.5 h-3.5 w-3.5" />
                        Pending
                      </Button>
                      <Button type="button" size="icon" variant="ghost" disabled={saving} onClick={() => removeTodo(task)} title="Delete">
                        <Trash2 className="h-4 w-4 text-[#DC5454]" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
