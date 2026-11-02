export const PROJECT_STATUSES = [
  { value: "START", label: "Start" },
  { value: "WORKING", label: "Working" },
  { value: "PENDING", label: "Pending" },
  { value: "COMPLETED", label: "Completed" },
  { value: "HOLD", label: "Hold" },
];

export const statusLabel = (value) => PROJECT_STATUSES.find((item) => item.value === value)?.label || "Start";

export const statusClass = (status) => {
  if (status === "WORKING") return "bg-sky-100 text-sky-800";
  if (status === "PENDING") return "bg-amber-100 text-amber-800";
  if (status === "COMPLETED") return "bg-emerald-100 text-emerald-800";
  if (status === "HOLD") return "bg-orange-100 text-orange-800";
  return "bg-slate-100 text-slate-700";
};

export const PROJECT_PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

export const priorityLabel = (value) => PROJECT_PRIORITIES.find((item) => item.value === value)?.label || value || "—";

export const priorityClass = (priority) => {
  if (priority === "URGENT") return "bg-red-100 text-red-800";
  if (priority === "HIGH") return "bg-amber-100 text-amber-800";
  if (priority === "LOW") return "bg-slate-100 text-slate-700";
  return "bg-sky-100 text-sky-800";
};

export const toDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

export const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
};
