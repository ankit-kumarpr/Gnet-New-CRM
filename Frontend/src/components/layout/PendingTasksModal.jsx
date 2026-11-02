import { Link } from "react-router-dom";
import { CheckSquare, X } from "lucide-react";
export function PendingTasksModal({ open, pending, partial, tasks, onClose }) {
  if (!open) return null;
  const openCount = (pending || 0) + (partial || 0);
  const preview = (tasks || []).slice(0, 3);
  const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

  return (
    <div className="pointer-events-none fixed right-3 top-16 z-[80] w-[min(100%-1.5rem,22rem)] sm:right-6 sm:top-[4.5rem]">
      <div className="pointer-events-auto animate-[toast-slide-in_0.28s_ease-out] overflow-hidden rounded-xl border border-amber-200 bg-white shadow-lg shadow-amber-900/10 ring-1 ring-black/5">
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-700">
            <CheckSquare className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">Today&apos;s client work open</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {openCount} open
                  {pending ? ` · ${pending} pending` : ""}
                  {partial ? ` · ${partial} partial` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {preview.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {preview.map((task) => (
                  <div key={task._id} className="rounded-lg bg-amber-50 px-2.5 py-1.5">
                    <p className="truncate text-xs font-medium text-slate-800">{task.title}</p>
                    <p className="truncate text-[11px] text-slate-500">
                      {task.status === "PARTIAL" ? "Partial" : task.status === "DONE" ? "Done" : "Pending"}
                      {" · "}
                      {task.assignee?.name || "Employee"}
                      {task.date ? ` · ${when.format(new Date(task.date))}` : ""}
                    </p>
                  </div>
                ))}
                {openCount > preview.length && (
                  <p className="text-[11px] text-slate-400">+{openCount - preview.length} more</p>
                )}
              </div>
            )}

            <div className="mt-3 flex items-center gap-2">
              <Link
                to="/dashboard/daily-tasks"
                onClick={onClose}
                className="inline-flex h-8 items-center rounded-md bg-emerald-700 px-3 text-xs font-medium text-white hover:bg-emerald-800"
              >
                Open tasks
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 items-center rounded-md px-3 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
