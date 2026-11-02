import { useState, useEffect } from "react";
import { Plus, Search, Edit2, Shield, ShieldOff, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import api from "../../services/api";
import toast from "react-hot-toast";
import { DesignationModal } from "../../components/organization/DesignationModal";
import { cn } from "../../utils/cn";
import { Pager } from "../../components/ui/Pager";
import { useAuth } from "../../context/AuthContext";

export function Designations() {
  const { hasPermission } = useAuth();
  const [designations, setDesignations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDesignation, setSelectedDesignation] = useState(null);

  // Fetch all active departments for the filter dropdown
  const fetchDepartments = async () => {
    try {
      const res = await api.get("/admin/departments/list", { params: { status: "ACTIVE", limit: 100 } });
      setDepartments(res.data.data || []);
    } catch (error) {
      console.error("Failed to fetch departments", error);
    }
  };

  const fetchDesignations = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/designations/list", {
        params: { search, status: statusFilter, department: departmentFilter, page, limit }
      });
      setDesignations(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch designations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchDesignations();
  }, [search, statusFilter, departmentFilter, page, limit]);

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await api.patch(`/admin/designations/status/${id}`, { status: newStatus });
      toast.success("Designation status updated");
      fetchDesignations();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update status");
    }
  };

  const openEditModal = (designation) => {
    setSelectedDesignation(designation);
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setSelectedDesignation(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (designation) => {
    if (!window.confirm(`Delete ${designation.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/designations/${designation._id}`);
      toast.success("Designation deleted");
      fetchDesignations();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete designation");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Designations</h1>
          <p className="text-sm text-slate-500 mt-1">Manage employee designations under departments.</p>
        </div>
        {(hasPermission("MANAGE_DESIGNATIONS") || hasPermission("CREATE_DESIGNATIONS")) && (
          <Button onClick={openCreateModal}>
            <Plus className="mr-2 h-4 w-4" />
            Add Designation
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search designations..." 
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        
        <select 
          className="h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
          value={departmentFilter}
          onChange={(e) => { setDepartmentFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Departments</option>
          {departments.map(d => (
            <option key={d._id} value={d._id}>{d.name}</option>
          ))}
        </select>

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
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Designation Name</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-slate-500">Loading designations...</td>
                </tr>
              ) : designations.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-slate-500">No designations found.</td>
                </tr>
              ) : (
                designations.map((desig) => (
                  <tr key={desig._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">{desig.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-600">{desig.department?.name || "-"}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                        desig.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      )}>
                        {desig.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {(hasPermission("MANAGE_DESIGNATIONS") || hasPermission("EDIT_DESIGNATIONS")) && (
                          <Button variant="ghost" size="icon" onClick={() => openEditModal(desig)} title="Edit">
                            <Edit2 className="h-4 w-4 text-slate-500 hover:text-emerald-600" />
                          </Button>
                        )}
                        {(hasPermission("MANAGE_DESIGNATIONS") || hasPermission("DELETE_DESIGNATIONS")) && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleToggleStatus(desig._id, desig.status)}
                            title={desig.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          >
                            {desig.status === "ACTIVE" ? (
                              <ShieldOff className="h-4 w-4 text-red-500 hover:text-red-700" />
                            ) : (
                              <Shield className="h-4 w-4 text-green-500 hover:text-green-700" />
                            )}
                          </Button>
                        )}
                        {(hasPermission("MANAGE_DESIGNATIONS") || hasPermission("DELETE_DESIGNATIONS")) && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(desig)} title="Delete">
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
        
        {/* Pagination */}
        <Pager page={page} pages={totalPages} limit={limit} total={total} onPage={setPage} onLimit={(size) => { setLimit(size); setPage(1); }} />
      </div>

      <DesignationModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        designation={selectedDesignation}
        onSuccess={fetchDesignations}
      />
    </div>
  );
}
