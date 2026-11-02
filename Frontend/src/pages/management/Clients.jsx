import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Download, Edit2, Eye, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Pager } from "../../components/ui/Pager";
import { EmployeeSelect } from "../../components/ui/EmployeeSelect";
import api from "../../services/api";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

const emptyAddress = { street: "", city: "", state: "", pincode: "", landmark: "" };
const emptyPayment = () => ({ _id: "", date: "", amount: "", note: "", paid: false });
const emptyForm = {
  name: "",
  email: "",
  phone: "",
  whatsapp: "",
  address: emptyAddress,
  remark: "",
  services: [],
  reportingManager: "",
  payments: [],
};

const digits = (value, max) => value.replace(/\D/g, "").slice(0, max);

const toDateInput = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const money = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

const dateLabel = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

/** Prefer soonest unpaid renewal for list preview */
const nextPaymentRow = (payments = []) => {
  const list = (payments || [])
    .filter((row) => row?.date)
    .map((row) => ({ ...row, _t: new Date(row.date).getTime() }))
    .filter((row) => !Number.isNaN(row._t))
    .sort((a, b) => a._t - b._t);
  if (!list.length) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const unpaid = list.filter((row) => !row.paid);
  const pool = unpaid.length ? unpaid : list;
  const upcoming = pool.find((row) => row._t >= today.getTime());
  return upcoming || pool[pool.length - 1];
};

const paymentsFromClient = (row) => {
  if (Array.isArray(row?.payments) && row.payments.length) {
    return row.payments.map((item) => ({
      _id: item._id || "",
      date: toDateInput(item.date),
      amount: item.amount === null || item.amount === undefined ? "" : String(item.amount),
      note: item.note || "",
      paid: Boolean(item.paid),
    }));
  }
  if (row?.nextPaymentDate || row?.paymentAmount != null) {
    return [{
      _id: "",
      date: toDateInput(row.nextPaymentDate),
      amount: row.paymentAmount === null || row.paymentAmount === undefined ? "" : String(row.paymentAmount),
      note: "",
      paid: false,
    }];
  }
  return [];
};

export function Clients() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("MANAGE_CLIENTS") || hasPermission("CREATE_CLIENTS");
  const canEdit = hasPermission("MANAGE_CLIENTS") || hasPermission("EDIT_CLIENTS");
  const canDelete = hasPermission("MANAGE_CLIENTS") || hasPermission("DELETE_CLIENTS");
  const [rows, setRows] = useState([]);
  const [serviceOptions, setServiceOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [renewalFrom, setRenewalFrom] = useState("");
  const [renewalTo, setRenewalTo] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ ...emptyForm, address: { ...emptyAddress } });
  const [exporting, setExporting] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 300);
  const selectClass = "h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-600";

  const load = async () => {
    try {
      setLoading(true);
      const params = {
        search: debouncedSearch,
        page,
        limit,
        paymentFilter,
      };
      if (renewalFrom) params.renewalFrom = renewalFrom;
      if (renewalTo) params.renewalTo = renewalTo;
      const res = await api.get("/admin/clients/list", { params });
      setRows(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch clients");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [debouncedSearch, page, limit, paymentFilter, renewalFrom, renewalTo]);

  useEffect(() => {
    const editId = location.state?.editId;
    if (!editId) return;
    const open = async () => {
      try {
        const res = await api.get(`/admin/clients/details/${editId}`);
        openEdit(res.data.data);
        navigate("/dashboard/clients", { replace: true, state: null });
      } catch (error) {
        toast.error(error.response?.data?.message || "Failed to open client");
      }
    };
    open();
  }, [location.state]);

  useEffect(() => {
    api.get("/admin/services/list", { params: { limit: 100 } })
      .then((res) => setServiceOptions(res.data.data || []))
      .catch(() => toast.error("Failed to load services"));
  }, []);

  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const setAddress = (name, value) => setForm((current) => ({ ...current, address: { ...current.address, [name]: value } }));

  const openCreate = () => {
    setSelected(null);
    setForm({ ...emptyForm, address: { ...emptyAddress }, services: [], payments: [] });
    setShowForm(true);
  };

  const openEdit = (row) => {
    setSelected(row);
    setForm({
      name: row.name || "",
      email: row.email || "",
      phone: row.phone || "",
      whatsapp: row.whatsapp || "",
      address: { ...emptyAddress, ...(row.address || {}) },
      remark: row.remark || "",
      services: (row.services || []).map((service) => service._id),
      reportingManager: row.reportingManager?._id || "",
      payments: paymentsFromClient(row),
    });
    setShowForm(true);
  };

  const setPaymentField = (index, name, value) => {
    setForm((current) => ({
      ...current,
      payments: current.payments.map((row, i) => (i === index ? { ...row, [name]: value } : row)),
    }));
  };

  const addPaymentRow = () => {
    setForm((current) => ({ ...current, payments: [...current.payments, emptyPayment()] }));
  };

  const removePaymentRow = (index) => {
    setForm((current) => ({
      ...current,
      payments: current.payments.filter((_, i) => i !== index),
    }));
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
      toast.error("Client name must be at least 2 characters");
      return;
    }
    if (!/^[0-9]{10}$/.test(form.phone)) {
      toast.error("Phone number must be 10 digits");
      return;
    }
    if (form.whatsapp && !/^[0-9]{10}$/.test(form.whatsapp)) {
      toast.error("WhatsApp number must be 10 digits");
      return;
    }
    if (form.address.pincode && !/^[0-9]{6}$/.test(form.address.pincode)) {
      toast.error("Pincode must be 6 digits");
      return;
    }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error("Valid email is required for client login mail");
      return;
    }
    if (!form.reportingManager) {
      toast.error("Select a reporting manager");
      return;
    }
    if (!form.services.length) {
      toast.error("Select at least one service");
      return;
    }
    for (const row of form.payments) {
      const hasAnything = row.date || row.amount !== "" || (row.note || "").trim();
      if (!hasAnything) continue;
      if (!row.date) {
        toast.error("Each payment row needs a date (or remove the row)");
        return;
      }
      if (row.amount !== "" && (Number.isNaN(Number(row.amount)) || Number(row.amount) < 0)) {
        toast.error("Payment amount must be a valid number ≥ 0");
        return;
      }
    }

    const payload = {
      ...form,
      payments: form.payments
        .filter((row) => row.date || row.amount !== "" || (row.note || "").trim())
        .map((row) => ({
          _id: row._id || undefined,
          date: row.date,
          amount: row.amount === "" ? "" : Number(row.amount),
          note: row.note || "",
        })),
    };

    try {
      setSaving(true);
      if (selected) {
        await api.patch(`/admin/clients/update/${selected._id}`, payload);
        toast.success("Client updated");
        closeForm();
        load();
      } else {
        const res = await api.post("/admin/clients/create", payload);
        if (res.data.mail?.sent) toast.success(`Client created · ID ${res.data.data.clientId} · mail sent`);
        else toast.success(res.data.message || `Client created · ID ${res.data.data.clientId}`);
        if (res.data.mail?.reason && !res.data.mail?.sent) toast.error(res.data.mail.reason);
        closeForm();
        navigate(`/dashboard/clients/${res.data.data._id}`);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete ${row.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/clients/${row._id}`);
      toast.success("Client deleted");
      if (selected?._id === row._id) closeForm();
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete client");
    }
  };

  const downloadRenewalsExcel = async () => {
    try {
      setExporting(true);
      const params = {
        paymentFilter: paymentFilter === "all" ? "notify" : paymentFilter,
      };
      if (renewalFrom) params.renewalFrom = renewalFrom;
      if (renewalTo) params.renewalTo = renewalTo;
      const res = await api.get("/admin/clients/payments/export", {
        params,
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `client-renewals-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Renewal Excel downloaded");
    } catch (error) {
      let message = "Download failed";
      const data = error.response?.data;
      if (data instanceof Blob) {
        try {
          message = JSON.parse(await data.text()).message || message;
        } catch {
          // keep default
        }
      } else if (error.response?.data?.message) {
        message = error.response.data.message;
      }
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Clients</h1>
          <p className="mt-1 text-sm text-slate-500">Client details and the services they take.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!showForm && (
            <Button type="button" variant="outline" onClick={downloadRenewalsExcel} disabled={exporting}>
              <Download className="mr-2 h-4 w-4" />
              {exporting ? "Exporting..." : "Export renewals Excel"}
            </Button>
          )}
          {canCreate && !showForm && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add client
            </Button>
          )}
        </div>
      </div>

      {showForm && (selected ? canEdit : canCreate) && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{selected ? "Edit client" : "Add client"}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Client name *</label>
              <Input value={form.name} maxLength={120} onChange={(event) => setField("name", event.target.value)} disabled={saving} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email *</label>
              <Input type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} disabled={saving} placeholder="client@email.com" />
              <p className="mt-1 text-xs text-slate-500">Login details mail isi email par jayegi.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Phone number *</label>
              <Input inputMode="numeric" maxLength={10} value={form.phone} onChange={(event) => setField("phone", digits(event.target.value, 10))} disabled={saving} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">WhatsApp number</label>
              <Input inputMode="numeric" maxLength={10} value={form.whatsapp} onChange={(event) => setField("whatsapp", digits(event.target.value, 10))} disabled={saving} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Reporting manager *</label>
              <EmployeeSelect
                value={form.reportingManager}
                onChange={(next) => setField("reportingManager", next)}
                placeholder="Select manager"
                allowEmpty
                disabled={saving}
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Address</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <Input placeholder="Street" value={form.address.street} maxLength={200} onChange={(event) => setAddress("street", event.target.value)} disabled={saving} />
              <Input placeholder="Landmark" value={form.address.landmark} maxLength={120} onChange={(event) => setAddress("landmark", event.target.value)} disabled={saving} />
              <Input placeholder="City" value={form.address.city} maxLength={80} onChange={(event) => setAddress("city", event.target.value)} disabled={saving} />
              <Input placeholder="State" value={form.address.state} maxLength={80} onChange={(event) => setAddress("state", event.target.value)} disabled={saving} />
              <Input placeholder="Pincode" inputMode="numeric" maxLength={6} value={form.address.pincode} onChange={(event) => setAddress("pincode", digits(event.target.value, 6))} disabled={saving} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Remark / extra note</label>
            <textarea
              value={form.remark}
              maxLength={2000}
              rows={3}
              disabled={saving}
              onChange={(event) => setField("remark", event.target.value)}
              className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">Payment / renewal (optional)</p>
                <p className="text-xs text-slate-500">Add multiple renewal dates with amounts. Use + for another row.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addPaymentRow} disabled={saving}>
                <Plus className="mr-1 h-4 w-4" />
                Add payment
              </Button>
            </div>
            {form.payments.length === 0 ? (
              <p className="text-sm text-slate-500">No payment rows yet. Click “Add payment” if needed.</p>
            ) : (
              <div className="space-y-3">
                {form.payments.map((row, index) => (
                  <div
                    key={row._id || index}
                    className={`grid gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-4 ${row.paid ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white"}`}
                  >
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Payment date *</label>
                      <Input
                        type="date"
                        value={row.date}
                        onChange={(event) => setPaymentField(index, "date", event.target.value)}
                        disabled={saving || row.paid}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Amount (₹)</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="e.g. 9999"
                        value={row.amount}
                        onChange={(event) => setPaymentField(index, "amount", event.target.value)}
                        disabled={saving || row.paid}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Note</label>
                      <Input
                        maxLength={200}
                        placeholder="Optional"
                        value={row.note}
                        onChange={(event) => setPaymentField(index, "note", event.target.value)}
                        disabled={saving || row.paid}
                      />
                      {row.paid ? <p className="mt-1 text-xs font-medium text-emerald-700">Paid — alerts stopped</p> : null}
                    </div>
                    <div className="flex items-end">
                      <Button type="button" variant="outline" className="w-full text-red-600" onClick={() => removePaymentRow(index)} disabled={saving}>
                        <Trash2 className="mr-1 h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Services *</p>
            {serviceOptions.length === 0 ? (
              <p className="text-sm text-slate-500">Add a service first.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {serviceOptions.map((service) => (
                  <label key={service._id} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.services.includes(service._id)}
                      onChange={() => toggleService(service._id)}
                      disabled={saving}
                    />
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

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search name, email, or phone..." className="pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Payment / renewal filter</label>
            <select
              className={selectClass}
              value={paymentFilter}
              onChange={(event) => { setPaymentFilter(event.target.value); setPage(1); }}
            >
              <option value="all">All clients</option>
              <option value="notify">Due for notify (≤5 days / overdue)</option>
              <option value="unpaid">Unpaid renewals</option>
              <option value="paid">Paid renewals</option>
              <option value="set">Has renewal date</option>
              <option value="unset">No renewal date</option>
              <option value="overdue">Overdue (unpaid)</option>
              <option value="due30">Due in next 30 days</option>
              <option value="thismonth">Due this month</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Renewal from</label>
            <Input type="date" value={renewalFrom} onChange={(event) => { setRenewalFrom(event.target.value); setPage(1); }} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Renewal to</label>
            <Input type="date" value={renewalTo} onChange={(event) => { setRenewalTo(event.target.value); setPage(1); }} />
          </div>
          {(paymentFilter !== "all" || renewalFrom || renewalTo) && (
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setPaymentFilter("all");
                  setRenewalFrom("");
                  setRenewalTo("");
                  setPage(1);
                }}
              >
                Clear payment filters
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Client</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Phone</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Renewal</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Amount</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Services</th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-500">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-500">No clients found.</td></tr>
              ) : rows.map((row) => (
                <tr key={row._id} className="transition-colors hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm">
                    <button type="button" className="text-left font-medium text-slate-900 hover:text-emerald-700" onClick={() => navigate(`/dashboard/clients/${row._id}`)}>{row.name}</button>
                    {row.email && <div className="text-slate-500">{row.email}</div>}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">{row.phone}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                    {(() => {
                      const next = nextPaymentRow(row.payments);
                      if (!next) return "—";
                      const extra = (row.payments || []).length > 1 ? ` (+${row.payments.length - 1})` : "";
                      const tag = next.paid ? " · paid" : "";
                      return `${dateLabel(next.date)}${tag}${extra}`;
                    })()}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">
                    {money(nextPaymentRow(row.payments)?.amount)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">{(row.services || []).map((service) => service.name).join(", ") || "—"}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" title="View" onClick={() => navigate(`/dashboard/clients/${row._id}`)}>
                        <Eye className="h-4 w-4 text-slate-500 hover:text-emerald-600" />
                      </Button>
                      {canEdit && (
                        <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(row)}>
                          <Edit2 className="h-4 w-4 text-slate-500 hover:text-emerald-600" />
                        </Button>
                      )}
                      {canDelete && (
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
