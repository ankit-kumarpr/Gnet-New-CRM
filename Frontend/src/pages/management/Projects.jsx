import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Edit2, Eye, Plus, Search, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Pager } from "../../components/ui/Pager";
import { RichText, plainRichText } from "../../components/ui/RichText";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { PROJECT_PRIORITIES, PROJECT_STATUSES, formatDate, priorityClass, priorityLabel, toDateInput } from "./projectOptions";
import { ProjectStatusControl } from "./ProjectStatus";
import { ServiceWorkPlanEditor, suggestPlanForService } from "./ServiceWorkPlanEditor";
import { cn } from "../../utils/cn";

const selectClass = "h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-600";
const compactSelectClass = "h-8 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-600";
const textAreaClass = "flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-50";

const emptyForm = {
  name: "",
  description: "",
  client: "",
  serviceAssignments: [],
  reportingManager: "",
  priority: "MEDIUM",
  eod: "",
  remark: "",
};

const names = (people) => (people || []).map((person) => person?.name).filter(Boolean);

const assignmentRows = (services, existing = [], fallbackEod = "") => {
  const byService = new Map(
    (existing || []).map((row) => [String(row.service?._id || row.service), {
      service: String(row.service?._id || row.service || ""),
      employee: String(row.employee?._id || row.employee || ""),
      work: row.work || "",
      workPlan: row.workPlan || null,
      eod: row.eod ? toDateInput(row.eod) : "",
    }])
  );
  return (services || []).map((service) => {
    const id = service._id || service;
    const current = byService.get(String(id));
    if (current) {
      return {
        ...current,
        eod: current.eod || fallbackEod || "",
        workPlan: current.workPlan || suggestPlanForService(service.name),
      };
    }
    return {
      service: String(id),
      employee: "",
      work: "",
      eod: fallbackEod || "",
      workPlan: suggestPlanForService(service?.name),
    };
  });
};

export function Projects() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useAuth();
  const seesAll = hasPermission(["VIEW_PROJECTS", "MANAGE_PROJECTS", "CREATE_PROJECTS", "EDIT_PROJECTS", "DELETE_PROJECTS"]);
  const canCreate = hasPermission("MANAGE_PROJECTS") || hasPermission("CREATE_PROJECTS");
  const canEdit = hasPermission("MANAGE_PROJECTS") || hasPermission("EDIT_PROJECTS");
  const canDelete = hasPermission("MANAGE_PROJECTS") || hasPermission("DELETE_PROJECTS");
  const [rows, setRows] = useState([]);
  const [people, setPeople] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const [reportingManager, setReportingManager] = useState("");
  const [employee, setEmployee] = useState("");
  const [eod, setEod] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/projects/list", {
        params: { search: debouncedSearch, priority, status, reportingManager, employee, eod, page, limit },
      });
      setRows(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [debouncedSearch, priority, status, reportingManager, employee, eod, page, limit]);

  useEffect(() => {
    if (!seesAll && !canCreate && !canEdit) return;
    api.get("/admin/projects/employees")
      .then((res) => setPeople(res.data.data || []))
      .catch(() => toast.error("Failed to load employees"));
    api.get("/admin/projects/clients")
      .then((res) => setClients(res.data.data || []))
      .catch(() => toast.error("Failed to load clients"));
  }, [seesAll, canCreate, canEdit]);

  const setField = (name, value) => {
    setForm((current) => {
      if (name === "eod") {
        return {
          ...current,
          eod: value,
          serviceAssignments: current.serviceAssignments.map((row) => (
            !row.eod || row.eod === current.eod ? { ...row, eod: value } : row
          )),
        };
      }
      return { ...current, [name]: value };
    });
  };

  const clientServices = useMemo(() => {
    const match = clients.find((item) => item._id === form.client);
    return match?.services || [];
  }, [clients, form.client]);

  const pickClient = (clientId) => {
    const match = clients.find((item) => item._id === clientId);
    setForm((current) => ({
      ...current,
      client: clientId,
      serviceAssignments: assignmentRows(match?.services || [], [], current.eod),
    }));
  };

  const setAssignment = (serviceId, field, value) => {
    setForm((current) => ({
      ...current,
      serviceAssignments: current.serviceAssignments.map((row) => (
        row.service === serviceId ? { ...row, [field]: value } : row
      )),
    }));
  };

  const setAssignmentPlan = (serviceId, workPlan) => {
    setAssignment(serviceId, "workPlan", workPlan);
  };

  const openCreate = () => {
    setSelected(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  };

  const openEdit = (row) => {
    setSelected(row);
    const services = row.serviceAssignments?.length
      ? row.serviceAssignments.map((item) => item.service)
      : (row.services || []);
    setForm({
      name: row.name || "",
      description: row.description || "",
      client: row.client?._id || "",
      serviceAssignments: assignmentRows(services, row.serviceAssignments, toDateInput(row.eod)),
      reportingManager: row.reportingManager?._id || "",
      priority: row.priority || "MEDIUM",
      eod: toDateInput(row.eod),
      remark: row.remark || "",
    });
    setShowForm(true);
  };

  useEffect(() => {
    const editId = location.state?.editId;
    if (!editId) return;
    const open = async () => {
      try {
        const res = await api.get(`/admin/projects/details/${editId}`);
        openEdit(res.data.data);
        navigate("/dashboard/projects", { replace: true, state: null });
      } catch (error) {
        toast.error(error.response?.data?.message || "Failed to open project");
      }
    };
    open();
  }, [location.state]);

  useEffect(() => {
    if (!form.client || !clientServices.length) return;
    setForm((current) => {
      if (current.client !== form.client) return current;
      const next = assignmentRows(clientServices, current.serviceAssignments, current.eod);
      const same = next.length === current.serviceAssignments.length
        && next.every((row, index) => (
          row.service === current.serviceAssignments[index]?.service
          && row.employee === current.serviceAssignments[index]?.employee
          && row.eod === current.serviceAssignments[index]?.eod
        ));
      return same ? current : { ...current, serviceAssignments: next };
    });
  }, [form.client, clientServices]);

  const closeForm = () => {
    setShowForm(false);
    setSelected(null);
    setForm(emptyForm);
  };

  const options = useMemo(() => {
    const map = new Map(people.map((person) => [person._id, person]));
    const extras = [
      selected?.reportingManager,
      ...(selected?.workingEmployees || []),
      ...((selected?.serviceAssignments || []).map((row) => row.employee)),
    ];
    extras.forEach((person) => {
      if (person?._id && !map.has(person._id)) map.set(person._id, person);
    });
    return [...map.values()];
  }, [people, selected]);

  const save = async (event) => {
    event.preventDefault();
    if (form.name.trim().length < 2) {
      toast.error("Project name must be at least 2 characters");
      return;
    }
    if (!form.client) {
      toast.error("Select a client");
      return;
    }
    if (!clientServices.length) {
      toast.error("This client has no services. Add services on the client first.");
      return;
    }
    for (const row of form.serviceAssignments) {
      const serviceName = clientServices.find((item) => item._id === row.service)?.name || "service";
      if (!row.employee) {
        toast.error(`Select an employee for ${serviceName}`);
        return;
      }
      if (!(row.eod || form.eod)) {
        toast.error(`Set EOD for ${serviceName}`);
        return;
      }
      const plan = row.workPlan;
      if (!plan) {
        toast.error(`Set work plan for ${serviceName}`);
        return;
      }
      if (plan.mode === "QUANTITY") {
        const total = (plan.deliverables || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
        if (!total) {
          toast.error(`Add quantities for ${serviceName}`);
          return;
        }
      } else {
        const total = (plan.phases || []).reduce((sum, item) => sum + (Number(item.percent) || 0), 0);
        if (!total) {
          toast.error(`Add phase % for ${serviceName}`);
          return;
        }
      }
    }
    if (!form.reportingManager) {
      toast.error("Select a reporting manager");
      return;
    }
    if (!form.eod) {
      toast.error("Project EOD is required");
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: plainRichText(form.description) ? form.description : "",
      client: form.client,
      serviceAssignments: form.serviceAssignments.map((row) => ({
        service: row.service,
        employee: row.employee,
        eod: row.eod || form.eod,
        workPlan: row.workPlan,
      })),
      reportingManager: form.reportingManager,
      priority: form.priority,
      eod: form.eod,
      remark: form.remark.trim(),
    };

    try {
      setSaving(true);
      if (selected) {
        await api.patch(`/admin/projects/update/${selected._id}`, payload);
        toast.success("Project updated");
      } else {
        const res = await api.post("/admin/projects/create", payload);
        toast.success("Project created");
        closeForm();
        navigate(`/dashboard/projects/${res.data.data._id}`);
        return;
      }
      closeForm();
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete project ${row.name}?`)) return;
    try {
      await api.delete(`/admin/projects/${row._id}`);
      toast.success("Project deleted");
      if (selected?._id === row._id) closeForm();
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete project");
    }
  };

  const workingLabel = (row) => {
    const assigned = (row.serviceAssignments || [])
      .map((item) => item.employee?.name)
      .filter(Boolean);
    const list = assigned.length ? [...new Set(assigned)] : names(row.workingEmployees);
    if (!list.length) return "—";
    if (list.length <= 2) return list.join(", ");
    return `${list.slice(0, 2).join(", ")} +${list.length - 2}`;
  };

  const assignmentHint = (row) => {
    const list = row.serviceAssignments || [];
    if (!list.length) {
      return (row.services || []).map((service) => service.name).filter(Boolean).join(", ");
    }
    return list
      .map((item) => {
        const service = item.service?.name || "Service";
        const person = item.employee?.name || "Unassigned";
        return `${service} → ${person}`;
      })
      .join(" · ");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Projects</h1>
          <p className="mt-1 text-sm text-slate-500">{seesAll ? "Assign each client service to an employee with clear work details." : "Projects where you are the reporting manager or assigned on a service."}</p>
        </div>
        {canCreate && !showForm && (
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add project</Button>
        )}
      </div>

      {showForm && (selected ? canEdit : canCreate) && (
        <form onSubmit={save} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{selected ? "Edit project" : "Add project"}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Project name *</label>
              <Input maxLength={120} value={form.name} onChange={(event) => setField("name", event.target.value)} disabled={saving} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Client *</label>
              <select className={selectClass} value={form.client} onChange={(event) => pickClient(event.target.value)} disabled={saving}>
                <option value="">Select client</option>
                {clients.map((client) => <option key={client._id} value={client._id}>{client.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Reporting manager *</label>
              <select className={selectClass} value={form.reportingManager} onChange={(event) => setField("reportingManager", event.target.value)} disabled={saving}>
                <option value="">Select manager</option>
                {options.map((person) => <option key={person._id} value={person._id}>{person.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Priority *</label>
              <select className={selectClass} value={form.priority} onChange={(event) => setField("priority", event.target.value)} disabled={saving}>
                {PROJECT_PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">EOD *</label>
              <Input type="date" value={form.eod} onChange={(event) => setField("eod", event.target.value)} disabled={saving} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <RichText key={selected?._id || "new"} value={form.description} onChange={(value) => setField("description", value)} placeholder="What is this project about?" disabled={saving} />
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-700">Service assignments *</p>
              <p className="mt-0.5 text-xs text-slate-500">Har service pe employee, EOD aur work detail. Project EOD default hai — service pe alag EOD set kar sakte ho.</p>
            </div>
            {!form.client ? (
              <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">Select a client to load their services.</p>
            ) : clientServices.length === 0 ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">This client has no services yet. Add services on the client first.</p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {form.serviceAssignments.map((row) => {
                  const service = clientServices.find((item) => item._id === row.service);
                  return (
                    <div key={row.service} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Service</p>
                          <p className="text-sm font-semibold text-slate-900">{service?.name || "Service"}</p>
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <label className="mb-0.5 block text-xs font-medium text-slate-700">Employee *</label>
                          <select
                            className={compactSelectClass}
                            value={row.employee}
                            onChange={(event) => setAssignment(row.service, "employee", event.target.value)}
                            disabled={saving}
                          >
                            <option value="">Select</option>
                            {options.map((person) => <option key={person._id} value={person._id}>{person.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="mb-0.5 block text-xs font-medium text-slate-700">EOD *</label>
                          <Input
                            type="date"
                            className="h-8 px-2 py-0.5 text-sm"
                            value={row.eod || form.eod || ""}
                            onChange={(event) => setAssignment(row.service, "eod", event.target.value)}
                            disabled={saving}
                          />
                        </div>
                      </div>
                      <div className="mt-2">
                        <ServiceWorkPlanEditor
                          compact
                          serviceName={service?.name}
                          value={row.workPlan}
                          disabled={saving}
                          onChange={(workPlan) => setAssignmentPlan(row.service, workPlan)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Remark</label>
            <textarea
              value={form.remark}
              maxLength={2000}
              rows={3}
              disabled={saving}
              onChange={(event) => setField("remark", event.target.value)}
              className={textAreaClass}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={closeForm} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      )}

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        <div className="relative md:col-span-2 xl:col-span-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search project, client, or remark..." className="pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        </div>
        <select className={selectClass} value={priority} onChange={(event) => { setPriority(event.target.value); setPage(1); }}>
          <option value="">All priorities</option>
          {PROJECT_PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <select className={selectClass} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {PROJECT_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        {seesAll && (
          <>
            <select className={selectClass} value={reportingManager} onChange={(event) => { setReportingManager(event.target.value); setPage(1); }}>
              <option value="">All reporting managers</option>
              {people.map((person) => <option key={person._id} value={person._id}>{person.name}</option>)}
            </select>
            <select className={selectClass} value={employee} onChange={(event) => { setEmployee(event.target.value); setPage(1); }}>
              <option value="">All working employees</option>
              {people.map((person) => <option key={person._id} value={person._id}>{person.name}</option>)}
            </select>
          </>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">EOD</label>
          <Input type="date" value={eod} onChange={(event) => { setEod(event.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {["Project", "Client", "Status", "Priority", "EOD", "Reporting manager", "Working", "Actions"].map((heading) => (
                  <th key={heading} className={cn("px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500", heading === "Actions" && "text-right")}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-500">No projects found.</td></tr>
              ) : rows.map((row) => (
                <tr key={row._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm">
                    <button type="button" className="text-left font-medium text-slate-900 hover:text-emerald-700" onClick={() => navigate(`/dashboard/projects/${row._id}`)}>{row.name}</button>
                    {assignmentHint(row) && (
                      <p className="mt-0.5 text-xs text-slate-500">{assignmentHint(row)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{row.client?.name || "—"}</td>
                  <td className="px-4 py-3">
                    <ProjectStatusControl
                      project={row}
                      compact
                      onUpdated={(next) => setRows((current) => current.map((item) => item._id === row._id ? { ...item, ...next } : item))}
                    />
                  </td>
                  <td className="px-4 py-3"><span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", priorityClass(row.priority))}>{priorityLabel(row.priority)}</span></td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{formatDate(row.eod)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{row.reportingManager?.name || "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{workingLabel(row)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" title="View" onClick={() => navigate(`/dashboard/projects/${row._id}`)}><Eye className="h-4 w-4 text-slate-500" /></Button>
                      {canEdit && <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(row)}><Edit2 className="h-4 w-4 text-slate-500" /></Button>}
                      {canDelete && <Button variant="ghost" size="icon" title="Delete" onClick={() => remove(row)}><Trash2 className="h-4 w-4 text-red-500" /></Button>}
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
