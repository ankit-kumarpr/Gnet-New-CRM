import { useState, useEffect } from "react";
import {
  ShieldCheck, Search, CheckCircle2, Lock, Users, Building2, CheckSquare, Square, Save,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import employeeService from "../../services/employeeService";
import api from "../../services/api";
import toast from "react-hot-toast";
import { cn } from "../../utils/cn";
import { Pager } from "../../components/ui/Pager";
import {
  PERMISSION_GROUPS,
  CLIENT_PERMISSION_GROUPS,
  ALL_PERMISSION_KEYS,
  CLIENT_PERMISSION_KEYS,
} from "../../constants/permissions";

export function Permissions() {
  const [tab, setTab] = useState("employees");
  const [usersList, setUsersList] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const isClients = tab === "clients";
  const groups = isClients ? CLIENT_PERMISSION_GROUPS : PERMISSION_GROUPS;
  const allKeys = isClients ? CLIENT_PERMISSION_KEYS : ALL_PERMISSION_KEYS;

  const fetchList = async () => {
    try {
      setLoading(true);
      if (isClients) {
        const res = await api.get("/admin/clients/list", {
          params: { page, limit, search: debouncedSearch || undefined },
        });
        const list = (res.data.data || []).map((c) => ({
          ...c,
          _kind: "CLIENT",
          displayId: c.clientId || c._id,
        }));
        setUsersList(list);
        setPages(res.data.pagination?.pages || 1);
        setTotal(res.data.pagination?.total || 0);
        const stillVisible = selectedUser && list.some((row) => row._id === selectedUser._id);
        if (list.length === 0) {
          setSelectedUser(null);
          setUserPermissions([]);
        } else if (!stillVisible) {
          setSelectedUser(list[0]);
          setUserPermissions(list[0].permissions || []);
        }
      } else {
        const res = await employeeService.getEmployees({
          page,
          limit,
          userType: "EMPLOYEE",
          search: debouncedSearch || undefined,
        });
        const list = (res.data || []).map((u) => ({
          ...u,
          _kind: "EMPLOYEE",
          displayId: u.employeeId || u.userType,
        }));
        setUsersList(list);
        setPages(res.pagination?.pages || 1);
        setTotal(res.pagination?.total || 0);
        const stillVisible = selectedUser && list.some((row) => row._id === selectedUser._id);
        if (list.length === 0) {
          setSelectedUser(null);
          setUserPermissions([]);
        } else if (!stillVisible) {
          setSelectedUser(list[0]);
          setUserPermissions(list[0].permissions || []);
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
    setSelectedUser(null);
    setUserPermissions([]);
  }, [tab, debouncedSearch, limit]);

  useEffect(() => {
    fetchList();
  }, [tab, debouncedSearch, page, limit]);

  const handleSelectUser = (usr) => {
    setSelectedUser(usr);
    setUserPermissions(usr.permissions || []);
  };

  const togglePermission = (permKey) => {
    setUserPermissions((prev) =>
      prev.includes(permKey) ? prev.filter((k) => k !== permKey) : [...prev, permKey]
    );
  };

  const handleSelectAllGroup = (group) => {
    const groupKeys = group.permissions.map((p) => p.key);
    const allSelected = groupKeys.every((k) => userPermissions.includes(k));
    if (allSelected) {
      setUserPermissions((prev) => prev.filter((k) => !groupKeys.includes(k)));
    } else {
      setUserPermissions((prev) => Array.from(new Set([...prev, ...groupKeys])));
    }
  };

  const handleSelectAllSystem = () => setUserPermissions([...allKeys]);
  const handleClearAll = () => setUserPermissions([]);

  const handleSavePermissions = async () => {
    if (!selectedUser) return;
    try {
      setSaving(true);
      if (selectedUser._kind === "CLIENT") {
        await employeeService.updateClientPermissions(selectedUser._id, userPermissions);
      } else {
        await employeeService.updateUserPermissions(selectedUser._id, userPermissions);
      }
      toast.success(`Permissions updated for ${selectedUser.name}`);
      setUsersList((prev) =>
        prev.map((u) => (u._id === selectedUser._id ? { ...u, permissions: userPermissions } : u))
      );
      setSelectedUser((prev) => (prev ? { ...prev, permissions: userPermissions } : null));
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  if (loading && usersList.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-emerald-600" />
          <p className="font-medium text-slate-500">Loading permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-slate-900">
            <ShieldCheck className="h-7 w-7 text-emerald-600" />
            Permissions
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Grant every screen and action for employees and app clients. Nothing shows without a matching permission.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleClearAll} className="text-slate-600">
            Clear All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAllSystem}
            className="border-emerald-200 text-emerald-600 hover:bg-emerald-50"
          >
            Select All
          </Button>
          <Button
            onClick={handleSavePermissions}
            disabled={saving || !selectedUser}
            className="bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("employees")}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
            !isClients ? "bg-emerald-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
          )}
        >
          <Users className="h-4 w-4" />
          Employees
        </button>
        <button
          type="button"
          onClick={() => setTab("clients")}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
            isClients ? "bg-emerald-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
          )}
        >
          <Building2 className="h-4 w-4" />
          Clients (App)
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Users className="h-4 w-4 text-emerald-600" />
              {isClients ? "Select client" : "Select employee"}
            </h3>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
              {total} Total
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, email, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
            {usersList.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">No matching records.</p>
            ) : (
              usersList.map((usr) => {
                const isSelected = selectedUser?._id === usr._id;
                const permCount = usr.permissions?.length || 0;
                return (
                  <button
                    key={usr._id}
                    type="button"
                    onClick={() => handleSelectUser(usr)}
                    className={cn(
                      "w-full space-y-1.5 rounded-lg border p-3 text-left transition-all",
                      isSelected
                        ? "border-emerald-300 bg-emerald-50/80 shadow-sm ring-1 ring-emerald-500/20"
                        : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold text-slate-900">{usr.name}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                        {usr.displayId}
                      </span>
                    </div>
                    <p className="truncate text-xs text-slate-500">{usr.email || usr.phone || "—"}</p>
                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                      <span className="truncate">
                        {isClients ? "Client" : usr.designation?.name || usr.userType}
                      </span>
                      <span className="rounded bg-emerald-100/70 px-1.5 py-0.5 font-semibold text-emerald-600">
                        {permCount} Permissions
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <Pager
            page={page}
            pages={pages}
            limit={limit}
            total={total}
            onPage={setPage}
            onLimit={(size) => {
              setLimit(size);
              setPage(1);
            }}
          />
        </div>

        <div className="space-y-6 lg:col-span-2">
          {selectedUser ? (
            <div className="space-y-6">
              <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-900 p-5 text-white shadow-sm sm:flex-row sm:items-center">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold">{selectedUser.name}</h2>
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-200">
                      {selectedUser.displayId}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    {selectedUser.email || "—"}
                    {selectedUser.phone ? ` • ${selectedUser.phone}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="space-y-0.5 rounded-lg border border-white/10 bg-white/10 px-3 py-1.5">
                    <span className="block text-[10px] font-semibold uppercase text-slate-400">Type</span>
                    <span className="font-bold text-white">{isClients ? "Client" : selectedUser.designation?.name || "Employee"}</span>
                  </div>
                  <div className="space-y-0.5 rounded-lg border border-white/10 bg-white/10 px-3 py-1.5">
                    <span className="block text-[10px] font-semibold uppercase text-slate-400">Active</span>
                    <span className="font-bold text-emerald-400">{userPermissions.length}</span>
                  </div>
                </div>
              </div>

              <div className="max-h-[620px] space-y-6 overflow-y-auto pb-4 pr-2">
                {groups.map((group) => {
                  const groupKeys = group.permissions.map((p) => p.key);
                  const isAllSelected = groupKeys.every((k) => userPermissions.includes(k));
                  return (
                    <div key={group.category} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-900">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          {group.category}
                        </h3>
                        <button
                          type="button"
                          onClick={() => handleSelectAllGroup(group)}
                          className="text-xs font-semibold text-emerald-600 transition-colors hover:text-emerald-800"
                        >
                          {isAllSelected ? "Deselect Group" : "Select Entire Group"}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {group.permissions.map((perm) => {
                          const isChecked = userPermissions.includes(perm.key);
                          return (
                            <label
                              key={perm.key}
                              onClick={() => togglePermission(perm.key)}
                              className={cn(
                                "flex cursor-pointer select-none items-start gap-3 rounded-lg border p-3 transition-all",
                                isChecked
                                  ? "border-emerald-300 bg-emerald-50/60 text-emerald-900"
                                  : "border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100/60"
                              )}
                            >
                              <div className="mt-0.5 shrink-0">
                                {isChecked ? (
                                  <CheckSquare className="h-4 w-4 text-emerald-600" />
                                ) : (
                                  <Square className="h-4 w-4 text-slate-400" />
                                )}
                              </div>
                              <div className="space-y-0.5">
                                <span className="block text-xs font-bold">{perm.label}</span>
                                <span className="block text-[11px] leading-tight text-slate-500">{perm.desc}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
              <Lock className="mx-auto h-10 w-10 text-slate-300" />
              <p className="text-base font-semibold">
                Select {isClients ? "a client" : "an employee"} from the left to manage permissions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Permissions;
