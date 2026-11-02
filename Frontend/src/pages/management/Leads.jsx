import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Download, Edit2, Eye, FileSpreadsheet, PhoneCall, Plus, Search, Trash2, Upload } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { FilePicker } from "../../components/ui/FilePicker";
import { Pager } from "../../components/ui/Pager";
import api from "../../services/api";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useTaskAlerts } from "../../context/TaskAlertContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { LEAD_SOURCES, LEAD_STATUSES, canDeleteLead, canEditLead, canFollowLead, followUpTone, formatDate, isClosedLead, leadLabel, statusClass } from "./leadOptions";
import { cn } from "../../utils/cn";

const selectClass = "h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-600";
const digits = (value, max) => value.replace(/\D/g, "").slice(0, max);

const emptyForm = {
  name: "",
  phone: "",
  companyName: "",
  address: "",
  source: "GMB",
  services: [],
  remark: "",
  assignedTo: "",
};

export function Leads() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission, user } = useAuth();
  const { refreshAlerts } = useTaskAlerts();
  const canCreate = hasPermission("MANAGE_LEADS") || hasPermission("CREATE_LEADS");
  const [rows, setRows] = useState([]);
  const [serviceOptions, setServiceOptions] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [assigning, setAssigning] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [importing, setImporting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [bulkErrors, setBulkErrors] = useState([]);
  const debouncedSearch = useDebouncedValue(search, 300);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/leads/list", {
        params: { search: debouncedSearch, status: statusFilter, source: sourceFilter, page, limit },
      });
      setRows(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [debouncedSearch, statusFilter, sourceFilter, page, limit]);

  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const openCreate = () => {
    setSelected(null);
    setForm({ ...emptyForm, services: [], assignedTo: "" });
    setShowForm(true);
  };

  const openEdit = (row) => {
    setSelected(row);
    setForm({
      name: row.name || "",
      phone: row.phone || "",
      companyName: row.companyName || "",
      address: row.address || "",
      source: row.source || "GMB",
      services: (row.services || []).map((service) => service._id),
      remark: row.remark || "",
      assignedTo: row.assignedTo?._id || "",
    });
    setShowForm(true);
  };

  useEffect(() => {
    const editId = location.state?.editId;
    if (!editId) return;
    const open = async () => {
      try {
        const res = await api.get(`/admin/leads/details/${editId}`);
        const row = res.data.data;
        if (!canEditLead(user, row)) {
          toast.error("This lead is assigned to you. Pass it to your team from the lead page, and change the status from Follow-up.");
          navigate(`/dashboard/leads/${editId}`, { replace: true, state: { follow: true } });
          return;
        }
        openEdit(row);
        navigate("/dashboard/leads", { replace: true, state: null });
      } catch (error) {
        toast.error(error.response?.data?.message || "Failed to open lead");
      }
    };
    open();
  }, [location.state]);

  useEffect(() => {
    api.get("/admin/services/list", { params: { limit: 100 } })
      .then((res) => setServiceOptions(res.data.data || []))
      .catch(() => toast.error("Failed to load services"));
    api.get("/admin/leads/assignees")
      .then((res) => setAssignees(res.data.data || []))
      .catch(() => toast.error("Failed to load team"));
  }, []);

  const reassign = async (row, assignedTo) => {
    if (!assignedTo || assignedTo === row.assignedTo?._id) return;
    try {
      setAssigning(row._id);
      await api.patch(`/admin/leads/${row._id}/assign`, { assignedTo });
      toast.success("Lead assigned");
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not assign the lead");
    } finally {
      setAssigning("");
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setSelected(null);
  };

  const toggleService = (id) => {
    setForm((current) => ({
      ...current,
      services: current.services.includes(id)
        ? current.services.filter((item) => item !== id)
        : [...current.services, id],
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (form.name.trim().length < 2) {
      toast.error("Name must be at least 2 characters");
      return;
    }
    if (!/^[0-9]{10}$/.test(form.phone)) {
      toast.error("Phone number must be 10 digits");
      return;
    }
    try {
      setSaving(true);
      const payload = {
        ...form,
        assignedTo: form.assignedTo || null,
        services: form.services || [],
      };
      if (selected) {
        await api.patch(`/admin/leads/update/${selected._id}`, payload);
        toast.success("Lead updated");
      } else {
        await api.post("/admin/leads/create", payload);
        toast.success("Lead created");
        refreshAlerts();
      }
      closeForm();
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const saveFile = async (request, filename, fallback) => {
    try {
      const res = await request;
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      let message = fallback;
      const data = error.response?.data;
      if (data instanceof Blob) {
        try {
          message = JSON.parse(await data.text()).message || fallback;
        } catch {
          message = fallback;
        }
      }
      toast.error(message);
    }
  };

  const downloadSample = () => saveFile(
    api.get("/admin/leads/sample", { responseType: "blob" }),
    "lead-sample.xlsx",
    "Could not download the sample",
  );

  const extractLeads = async () => {
    try {
      setExtracting(true);
      await saveFile(
        api.get("/admin/leads/export", { params: { search, status: statusFilter, source: sourceFilter }, responseType: "blob" }),
        "leads.xlsx",
        "Could not extract leads",
      );
    } finally {
      setExtracting(false);
    }
  };

  const importSheet = async () => {
    if (!sheet) {
      toast.error("Choose the Excel file");
      return;
    }
    const data = new FormData();
    data.append("file", sheet);
    try {
      setImporting(true);
      const res = await api.post("/admin/leads/import", data);
      const created = res.data.created || 0;
      const failed = res.data.failed || 0;
      setBulkErrors(res.data.errors || []);
      if (created) {
        toast.success(failed ? `Added ${created} leads. ${failed} rows need a fix.` : `Added ${created} leads`);
        setSheet(null);
        load();
      } else {
        toast.error("No lead was added. Check the rows below.");
      }
    } catch (error) {
      setBulkErrors([]);
      toast.error(error.response?.data?.message || "Could not add the leads");
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete ${row.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/leads/${row._id}`);
      toast.success("Lead deleted");
      if (selected?._id === row._id) closeForm();
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete lead");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Leads</h1>
          <p className="mt-1 text-sm text-slate-500">Assign a lead to yourself or someone on your team. Admin can assign it to anyone.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={extractLeads} disabled={extracting}>
            <Download className="mr-2 h-4 w-4" />
            {extracting ? "Extracting..." : "Extract"}
          </Button>
          {canCreate && (
            <>
              <Button variant="outline" onClick={downloadSample}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Sample Excel
              </Button>
              <Button variant="outline" onClick={() => setShowBulk((open) => !open)}>
                <Upload className="mr-2 h-4 w-4" />
                Bulk add
              </Button>
              {!showForm && (
                <Button onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add lead
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {showBulk && canCreate && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Bulk add</h2>
            <p className="mt-1 text-sm text-slate-500">Download the sample, fill your leads, then upload the same file. The sample row is skipped.</p>
          </div>
          <FilePicker
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            file={sheet}
            disabled={importing}
            onChange={setSheet}
            hint="Excel .xlsx, up to 300 leads."
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => { setShowBulk(false); setSheet(null); setBulkErrors([]); }} disabled={importing}>Cancel</Button>
            <Button type="button" onClick={importSheet} disabled={importing}>{importing ? "Adding..." : "Upload"}</Button>
          </div>
          {bulkErrors.length > 0 && (
            <ul className="space-y-1 text-sm text-red-700">
              {bulkErrors.map((item) => <li key={`${item.row}-${item.message}`}>Row {item.row}: {item.message}</li>)}
            </ul>
          )}
        </div>
      )}

      {showForm && (selected ? canEditLead(user, selected) : canCreate) && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{selected ? "Edit lead" : "Add lead"}</h2>
            {selected && <p className="mt-1 text-sm text-slate-500">Status and the next follow-up change from the Follow button.</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Name *</label>
              <Input value={form.name} maxLength={120} onChange={(event) => setField("name", event.target.value)} disabled={saving} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Phone number *</label>
              <Input inputMode="numeric" maxLength={10} value={form.phone} onChange={(event) => setField("phone", digits(event.target.value, 10))} disabled={saving} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Company name</label>
              <Input value={form.companyName} maxLength={120} onChange={(event) => setField("companyName", event.target.value)} disabled={saving} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Address</label>
              <Input value={form.address} maxLength={300} onChange={(event) => setField("address", event.target.value)} disabled={saving} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Source *</label>
              <select className={selectClass} value={form.source} onChange={(event) => setField("source", event.target.value)} disabled={saving}>
                {LEAD_SOURCES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Assigned to</label>
              <select className={selectClass} value={form.assignedTo} onChange={(event) => setField("assignedTo", event.target.value)} disabled={saving}>
                <option value="">Unassigned (optional)</option>
                {form.assignedTo && !assignees.some((person) => person._id === form.assignedTo) && selected?.assignedTo?._id === form.assignedTo && (
                  <option value={selected.assignedTo._id}>{selected.assignedTo.name}</option>
                )}
                {assignees.map((person) => <option key={person._id} value={person._id}>{person.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Remark</label>
            <textarea
              value={form.remark}
              maxLength={2000}
              rows={3}
              disabled={saving}
              onChange={(event) => setField("remark", event.target.value)}
              className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Services <span className="font-normal text-slate-400">(optional)</span></p>
            {serviceOptions.length === 0 ? (
              <p className="text-sm text-slate-500">No services yet — you can save without selecting any.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {serviceOptions.map((service) => (
                  <label key={service._id} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
                    <input type="checkbox" checked={form.services.includes(service._id)} onChange={() => toggleService(service._id)} disabled={saving} />
                    {service.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={closeForm} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search name, phone, or company..." className="pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        </div>
        <select className={`${selectClass} lg:w-48 lg:shrink-0`} value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <select className={`${selectClass} lg:w-48 lg:shrink-0`} value={sourceFilter} onChange={(event) => { setSourceFilter(event.target.value); setPage(1); }}>
          <option value="">All sources</option>
          {LEAD_SOURCES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Lead</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Phone</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Source</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Next follow-up</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Assigned to</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Created by</th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr><td colSpan="8" className="px-6 py-8 text-center text-slate-500">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="8" className="px-6 py-8 text-center text-slate-500">No leads found.</td></tr>
              ) : rows.map((row) => (
                <tr key={row._id} className="transition-colors hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm">
                    <button type="button" className="text-left font-medium text-slate-900 hover:text-emerald-700" onClick={() => navigate(`/dashboard/leads/${row._id}`)}>{row.name}</button>
                    {row.companyName && <div className="text-slate-500">{row.companyName}</div>}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">{row.phone}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">{leadLabel(LEAD_SOURCES, row.source)}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", statusClass(row.status))}>{leadLabel(LEAD_STATUSES, row.status)}</span>
                  </td>
                  <td className={cn("whitespace-nowrap px-6 py-4 text-sm", followUpTone(row.nextFollowUpAt, row.status))}>
                    {isClosedLead(row.status) ? "—" : formatDate(row.nextFollowUpAt)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                    {row.canAssign ? (
                      <select
                        className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs"
                        value={row.assignedTo?._id || ""}
                        disabled={assigning === row._id}
                        onChange={(event) => reassign(row, event.target.value)}
                      >
                        {row.assignedTo?._id && !assignees.some((person) => person._id === row.assignedTo._id) && (
                          <option value={row.assignedTo._id}>{row.assignedTo.name}</option>
                        )}
                        {assignees.map((person) => <option key={person._id} value={person._id}>{person.name}</option>)}
                      </select>
                    ) : (row.assignedTo?.name || "—")}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">{row.createdBy?.name || "—"}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" title="View" onClick={() => navigate(`/dashboard/leads/${row._id}`)}>
                        <Eye className="h-4 w-4 text-slate-500 hover:text-emerald-600" />
                      </Button>
                      {canFollowLead(user, row) && (
                        <Button variant="ghost" size="icon" title="Follow" onClick={() => navigate(`/dashboard/leads/${row._id}`, { state: { follow: true } })}>
                          <PhoneCall className="h-4 w-4 text-emerald-600" />
                        </Button>
                      )}
                      {canEditLead(user, row) && (
                        <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(row)}>
                          <Edit2 className="h-4 w-4 text-slate-500 hover:text-emerald-600" />
                        </Button>
                      )}
                      {canDeleteLead(user, row) && (
                        <Button variant="ghost" size="icon" title="Delete" onClick={() => handleDelete(row)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
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
