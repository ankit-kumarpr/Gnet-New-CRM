import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Plus, Search } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/Button";
import { FilePicker } from "../../components/ui/FilePicker";
import { Input } from "../../components/ui/Input";
import { Pager } from "../../components/ui/Pager";
import { RichText, plainRichText } from "../../components/ui/RichText";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { TICKET_PRIORITIES, TICKET_STATUSES, formatDateTime, ticketPriorityClass, ticketPriorityLabel, ticketStatusClass, ticketStatusLabel } from "./ticketOptions";
import { cn } from "../../utils/cn";

const selectClass = "h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-600";

const emptyForm = { subject: "", content: "", priority: "MEDIUM", file: null };

export function Tickets() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const seesAll = hasPermission(["VIEW_TICKETS", "MANAGE_TICKETS"]);
  const canCreate = hasPermission(["CREATE_TICKETS", "MANAGE_TICKETS"]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/tickets/list", { params: { search: debouncedSearch, status, priority, page, limit } });
      setRows(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [debouncedSearch, status, priority, page, limit]);

  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const closeForm = () => {
    setShowForm(false);
    setForm(emptyForm);
  };

  const save = async (event) => {
    event.preventDefault();
    if (form.subject.trim().length < 2) {
      toast.error("Subject must be at least 2 characters");
      return;
    }
    if (!plainRichText(form.content)) {
      toast.error("Content is required");
      return;
    }
    const data = new FormData();
    data.append("subject", form.subject.trim());
    data.append("content", form.content);
    data.append("priority", form.priority);
    if (form.file) data.append("file", form.file);
    try {
      setSaving(true);
      await api.post("/admin/tickets/create", data);
      toast.success("Ticket raised");
      closeForm();
      if (page === 1) load();
      else setPage(1);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not raise the ticket");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Help</h1>
          <p className="mt-1 text-sm text-slate-500">
            {seesAll ? "Every ticket. You can reply, change status, and delete." : "Raise a ticket. You and your reporting manager can see it and reply."}
          </p>
        </div>
        {!showForm && canCreate && <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" />Raise ticket</Button>}
      </div>

      {showForm && canCreate && (
        <form onSubmit={save} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Raise ticket</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-2 xl:col-span-3">
              <label className="mb-1 block text-sm font-medium text-slate-700">Subject *</label>
              <Input maxLength={160} value={form.subject} onChange={(event) => setField("subject", event.target.value)} disabled={saving} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Priority *</label>
              <select className={selectClass} value={form.priority} onChange={(event) => setField("priority", event.target.value)} disabled={saving}>
                {TICKET_PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Content *</label>
            <RichText key="new-ticket" value={form.content} onChange={(value) => setField("content", value)} placeholder="What do you need help with?" disabled={saving} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">File</label>
            <FilePicker
              accept="application/pdf,image/jpeg,image/png,image/webp,image/avif"
              disabled={saving}
              file={form.file}
              onChange={(file) => setField("file", file)}
              hint="Optional. PDF or image, up to 8 MB."
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={closeForm} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Raise ticket"}</Button>
          </div>
        </form>
      )}

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
        <div className="relative md:col-span-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search subject..." className="pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        </div>
        <select className={selectClass} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {TICKET_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <select className={selectClass} value={priority} onChange={(event) => { setPriority(event.target.value); setPage(1); }}>
          <option value="">All priorities</option>
          {TICKET_PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {["Subject", "Raised by", "Priority", "Status", "Updated", "Actions"].map((heading) => (
                  <th key={heading} className={cn("px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500", heading === "Actions" && "text-right")}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-500">No tickets found.</td></tr>
              ) : rows.map((row) => (
                <tr key={row._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm">
                    <button type="button" className="text-left font-medium text-slate-900 hover:text-emerald-700" onClick={() => navigate(`/dashboard/help/${row._id}`)}>{row.subject}</button>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{row.raisedBy?.name || "—"}</td>
                  <td className="px-4 py-3"><span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", ticketPriorityClass(row.priority))}>{ticketPriorityLabel(row.priority)}</span></td>
                  <td className="px-4 py-3"><span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", ticketStatusClass(row.status))}>{ticketStatusLabel(row.status)}</span></td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{formatDateTime(row.updatedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" title="View" onClick={() => navigate(`/dashboard/help/${row._id}`)}><Eye className="h-4 w-4 text-slate-500" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={page} pages={totalPages} limit={limit} total={total} onPage={setPage} onLimit={(size) => { setLimit(size); setPage(1); }} />
      </div>
    </div>
  );
}
