import { useState, useEffect } from "react";
import { Plus, Search, Edit2, Shield, ShieldOff, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import api from "../../services/api";
import toast from "react-hot-toast";
import { DepartmentModal } from "../../components/organization/DepartmentModal";
import { cn } from "../../utils/cn";
import { useAuth } from "../../context/AuthContext";
import { Pager } from "../../components/ui/Pager";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

export function Departments() {
  const { hasPermission } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/departments/list", {
        params: { search: debouncedSearch, status: statusFilter, page, limit }
      });
      setDepartments(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch departments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, [debouncedSearch, statusFilter, page, limit]);

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await api.patch(`/admin/departments/status/${id}`, { status: newStatus });
      toast.success("Department status updated");
      fetchDepartments();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update status");
    }
  };

  const openEditModal = (department) => {
    setSelectedDepartment(department);
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setSelectedDepartment(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (department) => {
    if (!window.confirm(`Delete ${department.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/departments/${department._id}`);
      toast.success("Department deleted");
      fetchDepartments();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete department");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Departments</h1>
          <p className="text-sm text-slate-500 mt-1">Manage organization departments and their statuses.</p>
        </div>
        {(hasPermission("MANAGE_DEPARTMENTS") || hasPermission("CREATE_DEPARTMENTS")) && (
          <Button onClick={openCreateModal}>
            <Plus className="mr-2 h-4 w-4" />
            Add Department
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search departments..." 
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select 
          className="h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Department Name</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan="3" className="px-6 py-8 text-center text-slate-500">Loading departments...</td>
                </tr>
              ) : departments.length === 0 ? (
                <tr>
                  <td colSpan="3" className="px-6 py-8 text-center text-slate-500">No departments found.</td>
                </tr>
              ) : (
                departments.map((dept) => (
                  <tr key={dept._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">{dept.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                        dept.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      )}>
                        {dept.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {(hasPermission("MANAGE_DEPARTMENTS") || hasPermission("EDIT_DEPARTMENTS")) && (
                          <Button variant="ghost" size="icon" onClick={() => openEditModal(dept)} title="Edit">
                            <Edit2 className="h-4 w-4 text-slate-500 hover:text-emerald-600" />
                          </Button>
                        )}
                        {(hasPermission("MANAGE_DEPARTMENTS") || hasPermission("DELETE_DEPARTMENTS")) && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleToggleStatus(dept._id, dept.status)}
                            title={dept.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          >
                            {dept.status === "ACTIVE" ? (
                              <ShieldOff className="h-4 w-4 text-red-500 hover:text-red-700" />
                            ) : (
                              <Shield className="h-4 w-4 text-green-500 hover:text-green-700" />
                            )}
                          </Button>
                        )}
                        {(hasPermission("MANAGE_DEPARTMENTS") || hasPermission("DELETE_DEPARTMENTS")) && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(dept)} title="Delete">
                            <Trash2 className="h-4 w-4 text-red-500 hover:text-red-700" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <Pager page={page} pages={totalPages} limit={limit} total={total} onPage={setPage} onLimit={(size) => { setLimit(size); setPage(1); }} />
      </div>

      <DepartmentModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        department={selectedDepartment}
        onSuccess={fetchDepartments}
      />
    </div>
  );
}
