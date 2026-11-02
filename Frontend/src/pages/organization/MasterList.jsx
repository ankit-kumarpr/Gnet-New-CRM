import { useEffect, useState } from "react";
import { Edit2, Plus, Search, Shield, ShieldOff, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Pager } from "../../components/ui/Pager";
import { NameModal } from "../../components/organization/NameModal";
import api from "../../services/api";
import toast from "react-hot-toast";
import { cn } from "../../utils/cn";
import { useAuth } from "../../context/AuthContext";

export function MasterList({ title, description, endpoint, placeholder, permissionModule = "EMPLOYEES" }) {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission([`MANAGE_${permissionModule}`, `CREATE_${permissionModule}`]);
  const canEdit = hasPermission([`MANAGE_${permissionModule}`, `EDIT_${permissionModule}`]);
  const canDelete = hasPermission([`MANAGE_${permissionModule}`, `DELETE_${permissionModule}`]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get(`${endpoint}/list`, { params: { search, status: statusFilter, page, limit } });
      setRows(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (error) {
      toast.error(error.response?.data?.message || `Failed to fetch ${title.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [search, statusFilter, page, limit]);

  const handleToggleStatus = async (row) => {
    try {
      const status = row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await api.patch(`${endpoint}/status/${row._id}`, { status });
      toast.success(`${title} status updated`);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update status");
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete ${row.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`${endpoint}/${row._id}`);
      toast.success(`${title} deleted`);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || `Failed to delete ${title.toLowerCase()}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        {canCreate && (
          <Button onClick={() => { setSelected(null); setIsModalOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Add {title}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder={`Search ${title.toLowerCase()}...`} className="pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        </div>
        <select
          className="h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-600"
          value={statusFilter}
          onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr><td colSpan="3" className="px-6 py-8 text-center text-slate-500">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="3" className="px-6 py-8 text-center text-slate-500">No records found.</td></tr>
              ) : rows.map((row) => (
                <tr key={row._id} className="transition-colors hover:bg-slate-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900">{row.name}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", row.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                      {row.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      {canEdit && (
                        <Button variant="ghost" size="icon" title="Edit" onClick={() => { setSelected(row); setIsModalOpen(true); }}>
                          <Edit2 className="h-4 w-4 text-slate-500 hover:text-emerald-600" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="icon" title={row.status === "ACTIVE" ? "Deactivate" : "Activate"} onClick={() => handleToggleStatus(row)}>
                          {row.status === "ACTIVE" ? <ShieldOff className="h-4 w-4 text-red-500" /> : <Shield className="h-4 w-4 text-green-500" />}
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

      <NameModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        item={selected}
        onSuccess={load}
        title={title}
        placeholder={placeholder}
        endpoint={endpoint}
      />
    </div>
  );
}
