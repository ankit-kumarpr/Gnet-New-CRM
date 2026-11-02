export const TASK_PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

export const TASK_STATUSES = [
  { value: "PENDING", label: "Pending" },
  { value: "DONE", label: "Done" },
  { value: "PARTIAL", label: "Partially pending" },
  { value: "HOLD", label: "Hold" },
];

export const STATUS_TABS = [
  { value: "PENDING,PARTIAL", label: "Open / Pending", key: "OPEN" },
  { value: "PENDING", label: "Pending", key: "PENDING" },
  { value: "PARTIAL", label: "Partially pending", key: "PARTIAL" },
  { value: "HOLD", label: "Hold", key: "HOLD" },
  { value: "DONE", label: "Done", key: "DONE" },
  { value: "", label: "All", key: "ALL" },
];

export const EVENING_STATUSES = [
  { value: "DONE", label: "Done" },
  { value: "PARTIAL", label: "Partially pending" },
  { value: "HOLD", label: "Hold" },
];

export const isOpenStatus = (status) => status === "PENDING" || status === "PARTIAL";

export const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const toDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const todayInput = () => toDateInput(new Date());

export const priorityClass = (priority) => ({
  LOW: "bg-slate-100 text-slate-700",
  MEDIUM: "bg-sky-50 text-sky-700",
  HIGH: "bg-amber-50 text-amber-800",
  URGENT: "bg-rose-50 text-rose-700",
}[priority] || "bg-slate-100 text-slate-700");

export const priorityLabel = (priority) => TASK_PRIORITIES.find((item) => item.value === priority)?.label || priority || "—";

export const statusClass = (status) => ({
  PENDING: "bg-amber-50 text-amber-800",
  DONE: "bg-emerald-50 text-emerald-800",
  PARTIAL: "bg-orange-50 text-orange-800",
  HOLD: "bg-slate-100 text-slate-700",
}[status] || "bg-slate-100 text-slate-700");

export const statusLabel = (status) => TASK_STATUSES.find((item) => item.value === status)?.label || status || "—";
