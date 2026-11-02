export const TICKET_PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

export const TICKET_STATUSES = [
  { value: "OPEN", label: "Open" },
  { value: "SOLVED", label: "Solved" },
  { value: "CLOSED", label: "Closed" },
];

export const ticketPriorityLabel = (value) => TICKET_PRIORITIES.find((item) => item.value === value)?.label || value || "—";
export const ticketStatusLabel = (value) => TICKET_STATUSES.find((item) => item.value === value)?.label || value || "—";

export const ticketPriorityClass = (priority) => {
  if (priority === "URGENT") return "bg-red-100 text-red-800";
  if (priority === "HIGH") return "bg-amber-100 text-amber-800";
  if (priority === "LOW") return "bg-slate-100 text-slate-700";
  return "bg-sky-100 text-sky-800";
};

export const ticketStatusClass = (status) => {
  if (status === "SOLVED") return "bg-green-100 text-green-800";
  if (status === "CLOSED") return "bg-slate-200 text-slate-700";
  return "bg-indigo-100 text-indigo-800";
};

export const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
};
