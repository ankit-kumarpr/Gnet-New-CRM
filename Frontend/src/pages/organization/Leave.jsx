import { useEffect, useState } from "react";
import { Edit2, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/Button";
import { FilePicker } from "../../components/ui/FilePicker";
import { Input } from "../../components/ui/Input";
import { RichText, plainRichText } from "../../components/ui/RichText";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../utils/cn";

const selectClass = "h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-600";

const DURATIONS = [
  { value: "HALF_DAY", label: "Half day" },
  { value: "FULL_DAY", label: "Full day" },
  { value: "MULTI_DAY", label: "Multi day" },
];

const emptyForm = {
  leaveType: "",
  duration: "FULL_DAY",
  date: "",
  startDate: "",
  endDate: "",
  reason: "",
  file: null,
  removeDocument: false,
};

const toDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
};

const durationLabel = (value) => DURATIONS.find((item) => item.value === value)?.label || value;

const dateLabel = (row) => {
  if (row.duration === "MULTI_DAY") return `${formatDate(row.startDate)} – ${formatDate(row.endDate)}`;
  return formatDate(row.startDate);
};

const statusClass = (status) => {
  if (status === "APPROVED") return "bg-green-100 text-green-800";
  if (status === "REJECTED") return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-800";
};

export function Leave() {
  const { user, hasPermission } = useAuth();
  const isEmployee = user?.userType === "EMPLOYEE";
  const canApprove = hasPermission("APPROVE_LEAVE");
  const canCreate = hasPermission("CREATE_LEAVE");
  const [balance, setBalance] = useState([]);
  const [mine, setMine] = useState([]);
  const [queue, setQueue] = useState([]);
  const [queueStatus, setQueueStatus] = useState("PENDING");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadMine = async () => {
    const [balanceRes, mineRes] = await Promise.all([
      api.get("/admin/leave-requests/balance"),
      api.get("/admin/leave-requests/mine"),
    ]);
    setBalance(balanceRes.data.data || []);
    setMine(mineRes.data.data || []);
  };

  const loadQueue = async (status = queueStatus) => {
    const res = await api.get("/admin/leave-requests/queue", { params: { status } });
    setQueue(res.data.data || []);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        if (isEmployee) await loadMine();
        if (canApprove) await loadQueue("PENDING");
      } catch (error) {
        if (!cancelled) toast.error(error.response?.data?.message || "Failed to load leave");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [isEmployee, canApprove]);

  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const openCreate = () => {
    setSelected(null);
    setForm({ ...emptyForm, leaveType: balance[0]?.leaveType || "" });
    setShowForm(true);
  };

  const openEdit = (row) => {
    setSelected(row);
    setForm({
      leaveType: row.leaveType?._id || "",
      duration: row.duration,
      date: row.duration === "MULTI_DAY" ? "" : toDateInput(row.startDate),
      startDate: toDateInput(row.startDate),
      endDate: toDateInput(row.endDate),
      reason: row.reason || "",
      file: null,
      removeDocument: false,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setSelected(null);
    setForm(emptyForm);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.leaveType) {
      toast.error("Select a leave type");
      return;
    }
    if (form.duration === "MULTI_DAY") {
      if (!form.startDate || !form.endDate) {
        toast.error("Select the start and end date");
        return;
      }
      if (form.endDate < form.startDate) {
        toast.error("End date cannot be before the start date");
        return;
      }
    } else if (!form.date) {
      toast.error("Select the date");
      return;
    }
    if (plainRichText(form.reason).length < 2) {
      toast.error("Write a reason for this leave");
      return;
    }

    const data = new FormData();
    data.append("leaveType", form.leaveType);
    data.append("duration", form.duration);
    data.append("reason", form.reason);
    if (form.duration === "MULTI_DAY") {
      data.append("startDate", form.startDate);
      data.append("endDate", form.endDate);
    } else {
      data.append("date", form.date);
    }
    if (form.file) data.append("document", form.file);
    if (selected && form.removeDocument) data.append("removeDocument", "1");

    try {
      setSaving(true);
      if (selected) await api.patch(`/admin/leave-requests/${selected._id}`, data);
      else await api.post("/admin/leave-requests", data);
      toast.success(selected ? "Leave updated" : "Leave applied");
      closeForm();
      await loadMine();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save leave");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm("Delete this leave application?")) return;
    try {
      await api.delete(`/admin/leave-requests/${row._id}`);
      toast.success("Leave deleted");
      if (selected?._id === row._id) closeForm();
      await loadMine();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete leave");
    }
  };

  const review = async (row, status) => {
    try {
      await api.patch(`/admin/leave-requests/${row._id}/review`, { status });
      toast.success(status === "APPROVED" ? "Leave approved" : "Leave rejected");
      await loadQueue();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to review leave");
    }
  };

  const changeQueue = async (status) => {
    setQueueStatus(status);
    try {
      await loadQueue(status);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load leave");
    }
  };

  const typeOptions = [...balance];
  if (selected?.leaveType?._id && !typeOptions.some((item) => item.leaveType === selected.leaveType._id)) {
    typeOptions.unshift({ leaveType: selected.leaveType._id, name: selected.leaveType.name, remaining: 0, assigned: 0 });
  }
  const chosen = typeOptions.find((item) => item.leaveType === form.leaveType);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Leave</h1>
          <p className="mt-1 text-sm text-slate-500">Apply for half day, full day, or several days. Pending leave can be edited or deleted.</p>
        </div>
        {isEmployee && canCreate && !showForm && (
          <Button onClick={openCreate} disabled={loading || balance.length === 0}>Apply leave</Button>
        )}
      </div>

      {isEmployee && canCreate && showForm && (
        <form onSubmit={save} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{selected ? "Edit leave" : "Apply leave"}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Leave type *</label>
              <select className={selectClass} value={form.leaveType} onChange={(event) => setField("leaveType", event.target.value)} disabled={saving}>
                <option value="">Select leave type</option>
                {typeOptions.map((item) => (
                  <option key={item.leaveType} value={item.leaveType}>{item.name} ({item.remaining} left)</option>
                ))}
              </select>
              {chosen && <p className="mt-1 text-xs text-slate-500">{chosen.remaining} of {chosen.assigned} days left, including pending leave.</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Duration *</label>
              <select className={selectClass} value={form.duration} onChange={(event) => setField("duration", event.target.value)} disabled={saving}>
                {DURATIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            {form.duration === "MULTI_DAY" ? (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Start date *</label>
                  <Input type="date" value={form.startDate} onChange={(event) => setField("startDate", event.target.value)} disabled={saving} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">End date *</label>
                  <Input type="date" value={form.endDate} onChange={(event) => setField("endDate", event.target.value)} disabled={saving} />
                </div>
              </>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Date *</label>
                <Input type="date" value={form.date} onChange={(event) => setField("date", event.target.value)} disabled={saving} />
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Reason *</label>
            <RichText key={selected?._id || "new"} value={form.reason} onChange={(value) => setField("reason", value)} placeholder="Why do you need this leave?" disabled={saving} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Document</label>
            <FilePicker
              key={selected?._id || "new-file"}
              accept="image/jpeg,image/png,image/webp,image/avif,application/pdf"
              disabled={saving}
              file={form.file}
              onChange={(file) => setField("file", file)}
              hint="Optional. PDF or image, up to 8 MB. Use this for a medical note or any supporting file."
            />
            {selected?.document?.url && (
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.removeDocument} onChange={(event) => setField("removeDocument", event.target.checked)} disabled={saving} />
                Remove current file ({selected.document.name})
              </label>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={closeForm} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      )}

      {isEmployee && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-sm font-semibold text-slate-900">My leave</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {["Type", "Duration", "Dates", "Days", "Status", "Reason", "File", "Actions"].map((heading) => (
                    <th key={heading} className={cn("px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500", heading === "Actions" && "text-right")}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
                ) : mine.length === 0 ? (
                  <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-500">{balance.length === 0 ? "No leave is assigned to you yet." : "No leave applied yet."}</td></tr>
                ) : mine.map((row) => (
                  <tr key={row._id}>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{row.leaveType?.name || "—"}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{durationLabel(row.duration)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{dateLabel(row)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{row.days}</td>
                    <td className="px-4 py-3"><span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", statusClass(row.status))}>{row.status}</span></td>
                    <td className="max-w-xs px-4 py-3 text-sm text-slate-700"><span className="line-clamp-2">{plainRichText(row.reason)}</span></td>
                    <td className="px-4 py-3 text-sm">{row.document?.url ? <a className="text-emerald-700 hover:underline" href={row.document.url} target="_blank" rel="noreferrer">View</a> : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {row.status === "PENDING" && (
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(row)}><Edit2 className="h-4 w-4 text-slate-500" /></Button>
                          <Button variant="ghost" size="icon" title="Delete" onClick={() => remove(row)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {canApprove && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Leave to review</h2>
            <select className={`${selectClass} sm:w-48`} value={queueStatus} onChange={(event) => changeQueue(event.target.value)}>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {["Employee", "Type", "Duration", "Dates", "Days", "Reason", "File", "Actions"].map((heading) => (
                    <th key={heading} className={cn("px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500", heading === "Actions" && "text-right")}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
                ) : queue.length === 0 ? (
                  <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-500">No leave in this list.</td></tr>
                ) : queue.map((row) => (
                  <tr key={row._id}>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{row.employee?.name || "—"}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{row.leaveType?.name || "—"}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{durationLabel(row.duration)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{dateLabel(row)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{row.days}</td>
                    <td className="max-w-xs px-4 py-3 text-sm text-slate-700"><span className="line-clamp-2">{plainRichText(row.reason)}</span></td>
                    <td className="px-4 py-3 text-sm">{row.document?.url ? <a className="text-emerald-700 hover:underline" href={row.document.url} target="_blank" rel="noreferrer">View</a> : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {row.status === "PENDING" ? (
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" onClick={() => review(row, "APPROVED")}>Approve</Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => review(row, "REJECTED")}>Reject</Button>
                        </div>
                      ) : (
                        <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", statusClass(row.status))}>{row.status}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
