export const INTERVIEW_STATUSES = [
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "NEXT_ROUND", label: "Next round" },
  { value: "SELECTED", label: "Selected" },
  { value: "NOT_SELECTED", label: "Not selected" },
];

export const interviewLabel = (value) => INTERVIEW_STATUSES.find((item) => item.value === value)?.label || value || "—";

export const interviewStatusClass = (status) => {
  if (status === "SELECTED") return "bg-green-100 text-green-800";
  if (status === "NOT_SELECTED") return "bg-red-100 text-red-800";
  if (status === "NEXT_ROUND") return "bg-amber-100 text-amber-800";
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
