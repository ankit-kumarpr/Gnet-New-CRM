import { useEffect, useState } from "react";
import { Edit2, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Pager } from "../../components/ui/Pager";
import { EmployeeSelect } from "../../components/ui/EmployeeSelect";
import api from "../../services/api";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

const selectClass = "h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-600";
const filterSelectClass = `${selectClass} lg:w-56 lg:shrink-0`;

function personLabel(person) {
  if (!person) return "—";
  return person.employeeId ? `${person.name} (${person.employeeId})` : person.name;
}

export function LeaveAssign() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(["MANAGE_LEAVE_ASSIGN", "CREATE_LEAVE_ASSIGN"]);
  const canEdit = hasPermission(["MANAGE_LEAVE_ASSIGN", "EDIT_LEAVE_ASSIGN"]);
  const canDelete = hasPermission(["MANAGE_LEAVE_ASSIGN", "DELETE_LEAVE_ASSIGN"]);
  const [rows, setRows] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/leave-assignments/list", {
        params: { search: debouncedSearch, employee: employeeFilter, leaveType: typeFilter, page, limit },
      });
      setRows(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch leave assignments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [debouncedSearch, employeeFilter, typeFilter, page, limit]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const types = await api.get("/admin/leave-types/list", { params: { status: "ACTIVE", limit: 100 } });
        setLeaveTypes(types.data.data || []);
      } catch (error) {
        toast.error(error.response?.data?.message || "Failed to load leave options");
      }
    };
    loadOptions();
  }, []);

  const handleDelete = async (row) => {
    const label = `${personLabel(row.employee)} / ${row.leaveType?.name || "leave"}`;
    if (!window.confirm(`Remove leave for ${label}?`)) return;
    try {
      await api.delete(`/admin/leave-assignments/${row._id}`);
      toast.success("Leave assignment deleted");
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete leave assignment");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Leave assign</h1>
          <p className="mt-1 text-sm text-slate-500">How many days of each leave type an employee gets.</p>
        </div>
        {canCreate && (
          <Button onClick={() => { setSelected(""); setIsModalOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Assign leave
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search employee or leave type..." className="pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        </div>
        <div className={filterSelectClass.replace("h-10 ", "")}>
          <EmployeeSelect
            value={employeeFilter}
            onChange={(next) => { setEmployeeFilter(next); setPage(1); }}
            placeholder="All employees"
            allowEmpty
          />
        </div>
        <select className={filterSelectClass} value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1); }}>
          <option value="">All leave types</option>
          {leaveTypes.map((type) => (
            <option key={type._id} value={type._id}>{type.name}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Employee</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Leave type</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Days</th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-500">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-500">No leave assignments found.</td></tr>
              ) : rows.map((row) => (
                <tr key={row._id} className="transition-colors hover:bg-slate-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900">{personLabel(row.employee)}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-700">{row.leaveType?.name || "—"}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">{row.days}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      {canEdit && (
                        <Button variant="ghost" size="icon" title="Edit" onClick={() => { setSelected(row.employee?._id || ""); setIsModalOpen(true); }}>
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

      <AssignModal
        isOpen={isModalOpen}
        employeeId={selected}
        leaveTypes={leaveTypes}
        onClose={() => setIsModalOpen(false)}
        onSuccess={load}
      />
    </div>
  );
}

function AssignModal({ isOpen, employeeId, leaveTypes, onClose, onSuccess }) {
  const [employee, setEmployee] = useState("");
  const [daysMap, setDaysMap] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setEmployee(employeeId || "");
    setDaysMap({});
    if (!employeeId) return;

    let cancelled = false;
    api.get("/admin/leave-assignments/list", { params: { employee: employeeId, limit: 100 } })
      .then((res) => {
        if (cancelled) return;
        const next = {};
        (res.data.data || []).forEach((row) => {
          if (row.leaveType?._id) next[row.leaveType._id] = String(row.days);
        });
        setDaysMap(next);
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load this employee's leave");
      });

    return () => {
      cancelled = true;
    };
  }, [employeeId, isOpen]);

  if (!isOpen) return null;

  const setDays = (typeId, value) => {
    const next = value.replace(/\D/g, "").slice(0, 3);
    setDaysMap((current) => ({
      ...current,
      [typeId]: next === "" ? "" : String(Math.min(Number(next), 365)),
    }));
  };

  const handleEmployee = async (id) => {
    setEmployee(id);
    setDaysMap({});
    if (!id) return;
    try {
      const res = await api.get("/admin/leave-assignments/list", { params: { employee: id, limit: 100 } });
      const next = {};
      (res.data.data || []).forEach((row) => {
        if (row.leaveType?._id) next[row.leaveType._id] = String(row.days);
      });
      setDaysMap(next);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not load this employee's leave");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!employee) {
      toast.error("Employee is required");
      return;
    }
    const leaves = leaveTypes
      .filter((type) => daysMap[type._id] !== undefined && daysMap[type._id] !== "")
      .map((type) => ({ leaveType: type._id, days: Number(daysMap[type._id]) }));
    if (!leaves.length) {
      toast.error("Enter days for at least one leave type");
      return;
    }
    if (leaves.some((row) => !Number.isInteger(row.days) || row.days > 365)) {
      toast.error("Days must be a whole number from 0 to 365");
      return;
    }

    try {
      setIsLoading(true);
      const { data } = await api.post("/admin/leave-assignments/save", { employee, leaves });
      toast.success(data?.message || "Leave assigned");
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || "Operation failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Assign leave</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="mb-1 block text-sm font-medium text-slate-700">Employee</label>
              <EmployeeSelect
                value={employee}
                onChange={handleEmployee}
                placeholder="Select employee"
                allowEmpty
                disabled={isLoading}
              />
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto pr-1">
            {leaveTypes.length === 0 ? (
              <p className="text-sm text-slate-500">Add a leave type first.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {leaveTypes.map((type) => (
                  <div key={type._id} className="grid grid-cols-[1fr_5.5rem] items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
                    <label className="truncate text-sm font-medium text-slate-700">{type.name}</label>
                    <Input
                      inputMode="numeric"
                      value={daysMap[type._id] || ""}
                      placeholder="Days"
                      disabled={isLoading}
                      onChange={(event) => setDays(type._id, event.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>{isLoading ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
