import { useState } from "react";
import toast from "react-hot-toast";
import api from "../../services/api";
import { PROJECT_STATUSES, formatDateTime, statusClass, statusLabel } from "./projectOptions";
import { cn } from "../../utils/cn";

export function ProjectStatusControl({ project, onUpdated, compact = false, onDark = false }) {
  const [saving, setSaving] = useState(false);
  const value = project?.status || "START";
  const heldAt = project?.heldAt;
  const heldByName = project?.heldBy?.name;

  const holdNote = value === "HOLD" && heldAt ? (
    <p className={cn(
      compact ? "mt-1 text-[10px] leading-tight" : "mt-1 text-xs",
      onDark ? "text-orange-100" : "text-orange-700",
    )}>
      On hold since {formatDateTime(heldAt)}
      {heldByName ? ` · ${heldByName}` : ""}
    </p>
  ) : null;

  if (!project?.canUpdateStatus) {
    return (
      <div>
        <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", statusClass(value))}>
          {statusLabel(value)}
        </span>
        {holdNote}
      </div>
    );
  }

  const change = async (event) => {
    const status = event.target.value;
    if (status === value) return;
    try {
      setSaving(true);
      const res = await api.patch(`/admin/projects/${project._id}/status`, { status });
      onUpdated?.(res.data.data);
      toast.success(status === "HOLD" ? "Project put on hold" : value === "HOLD" ? "Project activated" : "Status updated");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update status");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <select
        aria-label="Project status"
        className={cn(
          "rounded-md border border-slate-300 bg-white text-slate-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#3569A8] disabled:opacity-60",
          compact ? "h-8 px-2 text-xs" : "h-10 px-3 text-sm",
          value === "HOLD" && "border-orange-300 bg-orange-50 text-orange-900",
        )}
        value={value}
        disabled={saving}
        onChange={change}
      >
        {PROJECT_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      {holdNote}
    </div>
  );
}
