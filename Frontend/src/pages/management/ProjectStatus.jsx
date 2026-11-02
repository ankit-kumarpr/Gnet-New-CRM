import { useState } from "react";
import toast from "react-hot-toast";
import api from "../../services/api";
import { PROJECT_STATUSES, statusClass, statusLabel } from "./projectOptions";
import { cn } from "../../utils/cn";

export function ProjectStatusControl({ project, onUpdated, compact = false }) {
  const [saving, setSaving] = useState(false);
  const value = project?.status || "START";

  if (!project?.canUpdateStatus) {
    return (
      <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", statusClass(value))}>
        {statusLabel(value)}
      </span>
    );
  }

  const change = async (event) => {
    const status = event.target.value;
    if (status === value) return;
    try {
      setSaving(true);
      const res = await api.patch(`/admin/projects/${project._id}/status`, { status });
      onUpdated?.(res.data.data);
      toast.success("Status updated");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update status");
    } finally {
      setSaving(false);
    }
  };

  return (
    <select
      aria-label="Project status"
      className={cn(
        "rounded-md border border-slate-300 bg-white text-slate-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:opacity-60",
        compact ? "h-8 px-2 text-xs" : "h-10 px-3 text-sm",
      )}
      value={value}
      disabled={saving}
      onChange={change}
    >
      {PROJECT_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
    </select>
  );
}
