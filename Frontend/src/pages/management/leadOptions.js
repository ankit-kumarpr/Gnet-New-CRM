import { permissionGranted } from "../../constants/permissions";

export const LEAD_SOURCES = [
  { value: "GMB", label: "GMB" },
  { value: "COLD_CALL", label: "Cold call" },
  { value: "META_ADS", label: "Meta ads" },
  { value: "WEBSITE", label: "Website" },
  { value: "REFERRAL", label: "Referral" },
  { value: "OTHER", label: "Other" },
];

export const LEAD_STATUSES = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "INTERESTED", label: "Interested" },
  { value: "FOLLOW_UP", label: "Follow up" },
  { value: "PROPOSAL", label: "Proposal" },
  { value: "CONVERTED", label: "Converted" },
  { value: "PAYMENT", label: "Payment" },
  { value: "LOST", label: "Lost" },
];

export const isClosedLead = (status) => status === "LOST" || status === "CONVERTED" || status === "PAYMENT";

export const FOLLOW_UP_TYPES = [
  { value: "CALL", label: "Call" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "MEETING", label: "Meeting" },
  { value: "NOTE", label: "Note" },
];

export const leadLabel = (list, value) => list.find((item) => item.value === value)?.label || value || "—";

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

export const formatMoney = (value) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
}).format(Number(value) || 0);

export const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
};

const personId = (person) => String(person?._id || person || "");

export const canEditLead = (user, lead) => {
  if (!user || !lead) return false;
  if (user.userType === "ADMIN") return true;
  if (personId(lead.createdBy) === String(user.id || user._id)) return true;
  if (personId(lead.assignedTo) === String(user.id || user._id)) return false;
  return permissionGranted(user, ["MANAGE_LEADS", "EDIT_LEADS"]);
};

export const canDeleteLead = (user, lead) => {
  if (!user || !lead) return false;
  if (user.userType === "ADMIN") return true;
  if (personId(lead.createdBy) === String(user.id || user._id)) return true;
  if (personId(lead.assignedTo) === String(user.id || user._id)) return false;
  return permissionGranted(user, ["MANAGE_LEADS", "DELETE_LEADS"]);
};

export const canFollowLead = (user, lead) => {
  if (!user || !lead) return false;
  if (user.userType === "ADMIN") return true;
  const me = String(user.id || user._id);
  if (personId(lead.createdBy) === me || personId(lead.assignedTo) === me) return true;
  return permissionGranted(user, ["MANAGE_LEADS", "EDIT_LEADS", "CREATE_LEADS", "CREATE_FOLLOW_UPS", "MANAGE_FOLLOW_UPS"]);
};

export const followUpTone = (value, status) => {
  if (!value || isClosedLead(status)) return "text-slate-400";
  const date = new Date(value);
  const today = new Date();
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diff = Math.round((day - start) / 86400000);
  if (diff < 0) return "font-medium text-red-600";
  if (diff === 0) return "font-medium text-amber-700";
  return "text-slate-700";
};

export const statusClass = (status) => {
  if (status === "CONVERTED") return "bg-emerald-100 text-emerald-800";
  if (status === "PAYMENT") return "bg-violet-100 text-violet-800";
  if (status === "INTERESTED") return "bg-green-100 text-green-800";
  if (status === "LOST") return "bg-red-100 text-red-800";
  if (status === "NEW") return "bg-sky-100 text-sky-800";
  return "bg-amber-100 text-amber-800";
};
