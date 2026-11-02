import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ExternalLink, Plus, Video } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Pager } from "../../components/ui/Pager";
import api from "../../services/api";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { cn } from "../../utils/cn";

const selectClass = "h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-600";

const whenLabel = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const statusClass = (status) => {
  if (status === "APPROVED") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (status === "PENDING") return "bg-amber-50 text-amber-800 border-amber-200";
  if (status === "REJECTED") return "bg-rose-50 text-rose-800 border-rose-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
};

export function Meetings() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState([]);
  const [clientQ, setClientQ] = useState("");
  const debouncedClientQ = useDebouncedValue(clientQ, 300);
  const [employees, setEmployees] = useState([]);
  const [empQ, setEmpQ] = useState("");
  const debouncedEmpQ = useDebouncedValue(empQ, 300);
  const [form, setForm] = useState({
    clientId: "",
    scheduledAt: "",
    agenda: "",
    meetLink: "",
    employees: [],
  });
  const [approveId, setApproveId] = useState("");
  const [approveForm, setApproveForm] = useState({ meetLink: "", employees: [] });

  const load = async () => {
    try {
      setLoading(true);
      const params = { page, limit };
      if (status) params.status = status;
      const res = await api.get("/admin/meetings", { params });
      setRows(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
      setPages(res.data.pagination?.pages || 1);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load meetings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, limit, status]);

  useEffect(() => {
    api.get("/admin/clients/list", { params: { search: debouncedClientQ || undefined, page: 1, limit: 30 } })
      .then((res) => setClients(res.data.data || []))
      .catch(() => setClients([]));
  }, [debouncedClientQ]);

  useEffect(() => {
    api.get("/admin/employees/list", { params: { picker: "1", search: debouncedEmpQ || undefined, limit: 40 } })
      .then((res) => setEmployees(res.data.data || []))
      .catch(() => setEmployees([]));
  }, [debouncedEmpQ]);

  const createMeeting = async (event) => {
    event.preventDefault();
    if (!form.clientId) return toast.error("Select a client");
    if (!form.scheduledAt) return toast.error("Pick date & time");
    if (form.agenda.trim().length < 5) return toast.error("Agenda too short");
    if (!form.meetLink.trim()) return toast.error("Paste Google Meet link");
    try {
      setSaving(true);
      await api.post("/admin/meetings", {
        clientId: form.clientId,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        agenda: form.agenda.trim(),
        meetLink: form.meetLink.trim(),
        employees: form.employees,
      });
      toast.success("Meeting created for client");
      setShowCreate(false);
      setForm({ clientId: "", scheduledAt: "", agenda: "", meetLink: "", employees: [] });
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not create meeting");
    } finally {
      setSaving(false);
    }
  };

  const openApprove = (row) => {
    setApproveId(row._id);
    setApproveForm({ meetLink: "", employees: [] });
  };

  const submitApprove = async () => {
    if (!approveForm.meetLink.trim()) return toast.error("Paste Google Meet link");
    try {
      setSaving(true);
      await api.post(`/admin/meetings/${approveId}/approve`, {
        meetLink: approveForm.meetLink.trim(),
        employees: approveForm.employees,
      });
      toast.success("Approved — client can join");
      setApproveId("");
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Approve failed");
    } finally {
      setSaving(false);
    }
  };

  const reject = async (row) => {
    const reason = window.prompt("Reject reason (optional)") || "";
    try {
      await api.post(`/admin/meetings/${row._id}/reject`, { reason });
      toast.success("Rejected");
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Reject failed");
    }
  };

  const cancel = async (row) => {
    if (!window.confirm("Cancel this meeting?")) return;
    try {
      await api.post(`/admin/meetings/${row._id}/cancel`);
      toast.success("Cancelled");
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Cancel failed");
    }
  };

  const EmployeePicker = ({ value, onChange }) => (
    <div className="space-y-2 rounded-lg border border-dashed border-slate-200 p-3">
      <p className="text-xs font-medium text-slate-600">Also share with employees (optional, multi-select)</p>
      <Input placeholder="Search employees..." value={empQ} onChange={(e) => setEmpQ(e.target.value)} />
      <div className="max-h-40 space-y-1 overflow-y-auto">
        {employees.map((person) => {
          const checked = value.includes(person._id);
          return (
            <label key={person._id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  onChange(
                    checked
                      ? value.filter((id) => id !== person._id)
                      : [...value, person._id],
                  );
                }}
              />
              <span>{person.name}{person.employeeId ? ` · ${person.employeeId}` : ""}</span>
            </label>
          );
        })}
      </div>
      {value.length > 0 && (
        <p className="text-xs text-emerald-700">{value.length} employee(s) selected</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Google Meet</h1>
          <p className="mt-1 text-sm text-slate-500">
            Client requests need RM/admin approval + Meet link. You can also schedule directly for a client.
          </p>
        </div>
        <Button type="button" onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Schedule meeting
        </Button>
      </div>

      {showCreate && (
        <form onSubmit={createMeeting} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Schedule for a client</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Client *</label>
              <Input placeholder="Search client..." value={clientQ} onChange={(e) => setClientQ(e.target.value)} />
              <select
                className={cn(selectClass, "mt-2")}
                value={form.clientId}
                onChange={(e) => setForm((c) => ({ ...c, clientId: e.target.value }))}
                required
              >
                <option value="">Select client</option>
                {clients.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}{c.clientId ? ` · ${c.clientId}` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Date & time *</label>
              <Input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm((c) => ({ ...c, scheduledAt: e.target.value }))}
                required
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Agenda *</label>
            <textarea
              rows={3}
              value={form.agenda}
              onChange={(e) => setForm((c) => ({ ...c, agenda: e.target.value }))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-600"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Google Meet link *</label>
            <Input
              placeholder="https://meet.google.com/abc-defg-hij"
              value={form.meetLink}
              onChange={(e) => setForm((c) => ({ ...c, meetLink: e.target.value }))}
              required
            />
          </div>
          <EmployeePicker
            value={form.employees}
            onChange={(next) => setForm((c) => ({ ...c, employees: next }))}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowCreate(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Create & share"}</Button>
          </div>
        </form>
      )}

      {approveId && (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Approve meet request</h2>
          <Input
            placeholder="https://meet.google.com/..."
            value={approveForm.meetLink}
            onChange={(e) => setApproveForm((c) => ({ ...c, meetLink: e.target.value }))}
          />
          <EmployeePicker
            value={approveForm.employees}
            onChange={(next) => setApproveForm((c) => ({ ...c, employees: next }))}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setApproveId("")} disabled={saving}>Cancel</Button>
            <Button type="button" onClick={submitApprove} disabled={saving}>{saving ? "Saving..." : "Approve & send link"}</Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <select className={cn(selectClass, "max-w-xs")} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="rounded-xl border bg-white p-6 text-sm text-slate-500">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="rounded-xl border bg-white p-6 text-sm text-slate-500">No meetings yet.</p>
        ) : rows.map((row) => (
          <div key={row._id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Video className="h-4 w-4 text-emerald-700" />
                  <p className="font-semibold text-slate-900">{row.client?.name || "Client"}</p>
                  <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", statusClass(row.status))}>{row.status}</span>
                  <span className="text-xs text-slate-500">{row.origin === "CLIENT" ? "Client request" : "Staff scheduled"}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{whenLabel(row.scheduledAt)}</p>
                <p className="mt-2 text-sm text-slate-800 whitespace-pre-wrap">{row.agenda}</p>
                {(row.employees || []).length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Employees: {row.employees.map((e) => e.name).join(", ")}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {row.status === "APPROVED" && row.meetLink && (
                  <a href={row.meetLink} target="_blank" rel="noreferrer">
                    <Button type="button" variant="outline" size="sm">
                      <ExternalLink className="mr-1 h-4 w-4" /> Join Meet
                    </Button>
                  </a>
                )}
                {row.canApprove && (
                  <Button type="button" size="sm" onClick={() => openApprove(row)}>Approve</Button>
                )}
                {row.canReject && (
                  <Button type="button" size="sm" variant="outline" className="text-rose-600" onClick={() => reject(row)}>Reject</Button>
                )}
                {row.canCancel && (
                  <Button type="button" size="sm" variant="outline" onClick={() => cancel(row)}>Cancel</Button>
                )}
              </div>
            </div>
            {row.rejectReason ? <p className="mt-2 text-xs text-rose-600">Reason: {row.rejectReason}</p> : null}
          </div>
        ))}
      </div>

      <Pager page={page} pages={pages} limit={limit} total={total} onPage={setPage} onLimit={(size) => { setLimit(size); setPage(1); }} />
    </div>
  );
}
