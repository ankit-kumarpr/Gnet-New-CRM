import { useEffect, useState } from "react";
import { Edit2, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Pager } from "../../components/ui/Pager";
import { RichText, plainRichText } from "../../components/ui/RichText";
import api from "../../services/api";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

export function Services() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("MANAGE_SERVICES") || hasPermission("CREATE_SERVICES");
  const canEdit = hasPermission("MANAGE_SERVICES") || hasPermission("EDIT_SERVICES");
  const canDelete = hasPermission("MANAGE_SERVICES") || hasPermission("DELETE_SERVICES");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/services/list", { params: { search: debouncedSearch, page, limit } });
      setRows(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch services");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [debouncedSearch, page, limit]);

  const openCreate = () => {
    setSelected(null);
    setName("");
    setDescription("");
    setShowForm(true);
  };

  const openEdit = (row) => {
    setSelected(row);
    setName(row.name || "");
    setDescription(row.description || "");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setSelected(null);
    setName("");
    setDescription("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Service name is required");
      return;
    }

    const payload = { name: name.trim(), description: plainRichText(description) ? description : "" };
    try {
      setSaving(true);
      if (selected) {
        await api.patch(`/admin/services/update/${selected._id}`, payload);
        toast.success("Service updated");
      } else {
        await api.post("/admin/services/create", payload);
        toast.success("Service created");
      }
      closeForm();
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete ${row.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/services/${row._id}`);
      toast.success("Service deleted");
      if (selected?._id === row._id) closeForm();
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete service");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Services</h1>
          <p className="mt-1 text-sm text-slate-500">Service name and description.</p>
        </div>
        {canCreate && !showForm && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add service
          </Button>
        )}
      </div>

      {showForm && (selected ? canEdit : canCreate) && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{selected ? "Edit service" : "Add service"}</h2>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Service name</label>
            <Input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} placeholder="e.g. Website design" disabled={saving} autoFocus />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <RichText
              key={selected?._id || "new-service"}
              value={description}
              placeholder="What this service includes"
              disabled={saving}
              onChange={setDescription}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={closeForm} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search services..." className="pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Description</th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr><td colSpan="3" className="px-6 py-8 text-center text-slate-500">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="3" className="px-6 py-8 text-center text-slate-500">No services found.</td></tr>
              ) : rows.map((row) => (
                <tr key={row._id} className="transition-colors hover:bg-slate-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900">{row.name}</td>
                  <td className="max-w-md px-6 py-4 text-sm text-slate-600">{plainRichText(row.description) || "—"}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
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
