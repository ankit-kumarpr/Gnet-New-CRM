import { useState, useEffect } from "react";
import { Plus, Search, Edit2, Eye, ShieldOff, Shield, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { EmployeeSelect } from "../../components/ui/EmployeeSelect";
import api from "../../services/api";
import toast from "react-hot-toast";
import { cn } from "../../utils/cn";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Pager } from "../../components/ui/Pager";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

export function Employees() {
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [managerFilter, setManagerFilter] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [departmentFilter, setDepartmentFilter] = useState(() => searchParams.get("department") || "");
  const [designationFilter, setDesignationFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const navigate = useNavigate();

  const fetchFiltersData = async () => {
    try {
      const [deptRes, desigRes] = await Promise.all([
        api.get("/admin/departments/list", { params: { limit: 100 } }),
        api.get("/admin/designations/list", { params: { limit: 100 } }),
      ]);
      setDepartments(deptRes.data.data || []);
      setDesignations(desigRes.data.data || []);
    } catch (error) {
      console.error("Error fetching filters", error);
    }
  };

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/employees/list", {
        params: { search: debouncedSearch, department: departmentFilter, designation: designationFilter, manager: managerFilter, page, limit }
      });
      setEmployees(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch employees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiltersData();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [debouncedSearch, departmentFilter, designationFilter, managerFilter, page, limit]);

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await api.patch(`/admin/employees/status/${id}`, { status: newStatus });
      toast.success("Employee status updated");
      fetchEmployees();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update status");
    }
  };

  const handleDelete = async (employee) => {
    if (!window.confirm(`Delete ${employee.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/employees/${employee._id}`);
      toast.success("Employee deleted");
      fetchEmployees();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete employee");
    }
  };

  const openEditPage = (employee) => {
    navigate(`/dashboard/employees/edit/${employee._id}`);
  };

  const openCreatePage = () => {
    navigate(`/dashboard/employees/create`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Employees</h1>
          <p className="text-sm text-slate-500 mt-1">Manage all employees in your organization.</p>
        </div>
        {(hasPermission("MANAGE_EMPLOYEES") || hasPermission("CREATE_EMPLOYEES")) && (
          <Button onClick={openCreatePage}>
            <Plus className="mr-2 h-4 w-4" />
            Add Employee
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search by name, email or phone..." 
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        
        <select 
          className="h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent min-w-[150px]"
          value={departmentFilter}
          onChange={(e) => {
            const value = e.target.value;
            setDepartmentFilter(value);
            setPage(1);
            const next = new URLSearchParams(searchParams);
            if (value) next.set("department", value);
            else next.delete("department");
            setSearchParams(next, { replace: true });
          }}
        >
          <option value="">All Departments</option>
          {departments.map(d => (
            <option key={d._id} value={d._id}>{d.name}</option>
          ))}
        </select>

        <select 
          className="h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent min-w-[150px]"
          value={designationFilter}
          onChange={(e) => { setDesignationFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Designations</option>
          {designations.map(d => (
            <option key={d._id} value={d._id}>{d.name}</option>
          ))}
        </select>

        <div className="min-w-[220px]">
          <EmployeeSelect
            value={managerFilter}
            onChange={(next) => { setManagerFilter(next); setPage(1); }}
            placeholder="All managers"
            allowEmpty
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Designation</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Reports to</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-slate-500">Loading employees...</td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-slate-500">No employees found.</td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <button type="button" className="text-left" onClick={() => navigate(`/dashboard/employees/${emp._id}`)}>
                          <span className="text-sm font-medium text-emerald-700 hover:underline">{emp.name}</span>
                          <span className="block text-xs text-slate-500">ID: {emp.employeeId}</span>
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm text-slate-600">{emp.email}</span>
                        <span className="text-xs text-slate-500">{emp.phone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-600">{emp.department?.name || "-"}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-600">{emp.designation?.name || "-"}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm text-slate-600">{emp.reportingManager?.name || "—"}</span>
                        {emp.reportingManager?.employeeId && (
                          <span className="text-xs text-slate-500">{emp.reportingManager.employeeId}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                        emp.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      )}>
                        {emp.status || "ACTIVE"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/dashboard/employees/${emp._id}`)} title="Profile">
                          <Eye className="h-4 w-4 text-slate-500 hover:text-emerald-600" />
                        </Button>
                        {(hasPermission("MANAGE_EMPLOYEES") || hasPermission("EDIT_EMPLOYEES")) && (
                          <Button variant="ghost" size="icon" onClick={() => openEditPage(emp)} title="Edit">
                            <Edit2 className="h-4 w-4 text-slate-500 hover:text-emerald-600" />
                          </Button>
                        )}
                        {(hasPermission("MANAGE_EMPLOYEES") || hasPermission("DELETE_EMPLOYEES")) && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleToggleStatus(emp._id, emp.status || "ACTIVE")}
                            title={emp.status === "ACTIVE" || !emp.status ? "Deactivate" : "Activate"}
                          >
                            {emp.status === "ACTIVE" || !emp.status ? (
                              <ShieldOff className="h-4 w-4 text-red-500 hover:text-red-700" />
                            ) : (
                              <Shield className="h-4 w-4 text-green-500 hover:text-green-700" />
                            )}
                          </Button>
                        )}
                        {(hasPermission("MANAGE_EMPLOYEES") || hasPermission("DELETE_EMPLOYEES")) && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(emp)} title="Delete">
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
    </div>
  );
}
