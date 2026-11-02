import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Edit2, Eye, Plus, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/Button";
import { FilePicker } from "../../components/ui/FilePicker";
import { Input } from "../../components/ui/Input";
import { Pager } from "../../components/ui/Pager";
import { RichText, plainRichText } from "../../components/ui/RichText";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { WORK_PRIORITIES, formatDate, toDateInput, workPriorityClass, workPriorityLabel } from "./urgentWorkOptions";
import { cn } from "../../utils/cn";

const selectClass = "h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-600";

const emptyForm = { project: "", work: "", assignees: [], priority: "MEDIUM", eod: "", file: null, removeFile: false };

const excerpt = (html) => {
  const text = plainRichText(html);
  if (!text) return "";
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
};

export function UrgentWorks() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.userType === "ADMIN";
  const [rows, setRows] = useState([]);
  const [projects, setProjects] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [project, setProject] = useState("");
  const [priority, setPriority] = useState("");
  const [employee, setEmployee] = useState("");
  const [eod, setEod] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);
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
      const res = await api.get("/admin/urgent-works/list", { params: { project, priority, employee, eod, page, limit } });
      setRows(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch urgent work");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [project, priority, employee, eod, page, limit]);

  useEffect(() => {
    api.get("/admin/urgent-works/options")
      .then((res) => {
        setProjects(res.data.data?.projects || []);
        setPeople(res.data.data?.employees || []);
      })
      .catch(() => toast.error("Failed to load projects and employees"));
  }, []);

  useEffect(() => {
    if (!pickerOpen) return undefined;
    const onPointer = (event) => {
      if (!pickerRef.current?.contains(event.target)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [pickerOpen]);

  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const toggleEmployee = (id) => {
    setForm((current) => ({
      ...current,
      assignees: current.assignees.includes(id) ? current.assignees.filter((item) => item !== id) : [...current.assignees, id],
    }));
  };

  const openCreate = () => {
    setSelected(null);
    setMemberSearch("");
    setPickerOpen(false);
    setForm({ ...emptyForm });
    setShowForm(true);
  };

  const openEdit = (row) => {
    setSelected(row);
    setMemberSearch("");
    setPickerOpen(false);
    setForm({
      project: row.project?._id || "",
      work: row.work || "",
      assignees: (row.assignees || []).map((person) => person._id),
      priority: row.priority || "MEDIUM",
      eod: toDateInput(row.eod),
      file: null,
      removeFile: false,
    });
    setShowForm(true);
  };

  useEffect(() => {
    const editId = location.state?.editId;
    if (!editId) return;
    const open = async () => {
      try {
        const res = await api.get(`/admin/urgent-works/details/${editId}`);
        if (!res.data.data?.canEdit) {
          toast.error("You can only edit urgent work you created");
          navigate("/dashboard/urgent-work", { replace: true, state: null });
          return;
        }
        openEdit(res.data.data);
        navigate("/dashboard/urgent-work", { replace: true, state: null });
      } catch (error) {
        toast.error(error.response?.data?.message || "Failed to open urgent work");
      }
    };
    open();
  }, [location.state]);

  const closeForm = () => {
    setShowForm(false);
    setSelected(null);
    setForm(emptyForm);
    setMemberSearch("");
    setPickerOpen(false);
  };

  const options = useMemo(() => {
    const map = new Map(people.map((person) => [person._id, person]));
    (selected?.assignees || []).forEach((person) => {
      if (person?._id && !map.has(person._id)) map.set(person._id, person);
    });
    return [...map.values()];
  }, [people, selected]);

  const projectOptions = useMemo(() => {
    if (!selected?.project?._id || projects.some((item) => item._id === selected.project._id)) return projects;
    return [selected.project, ...projects];
  }, [projects, selected]);

  const visibleMembers = options.filter((person) => person.name?.toLowerCase().includes(memberSearch.trim().toLowerCase()));

  const save = async (event) => {
    event.preventDefault();
    if (!form.project) {
      toast.error("Select a project");
      return;
    }
    if (!plainRichText(form.work)) {
      toast.error("Work is required");
      return;
    }
    if (!form.assignees.length) {
      toast.error("Select at least one employee");
      return;
    }
    if (!form.eod) {
      toast.error("EOD is required");
      return;
    }
    const data = new FormData();
    data.append("project", form.project);
    data.append("work", form.work);
    form.assignees.forEach((id) => data.append("assignees", id));
    data.append("priority", form.priority);
    data.append("eod", form.eod);
    if (form.file) data.append("file", form.file);
    if (selected && form.removeFile) data.append("removeFile", "1");
    try {
      setSaving(true);
      if (selected) {
        await api.patch(`/admin/urgent-works/update/${selected._id}`, data);
        toast.success("Urgent work updated");
      } else {
        await api.post("/admin/urgent-works/create", data);
        toast.success("Urgent work added");
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
    if (!window.confirm("Delete this urgent work?")) return;
    try {
      await api.delete(`/admin/urgent-works/${row._id}`);
      toast.success("Urgent work deleted");
      if (selected?._id === row._id) closeForm();
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete urgent work");
    }
  };

  const assignedLabel = (row) => {
    const names = (row.assignees || []).map((person) => person?.name).filter(Boolean);
    if (!names.length) return "—";
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Urgent work</h1>
          <p className="mt-1 text-sm text-slate-500">To-do on a project, assigned to employees, with priority and EOD.</p>
        </div>
        {!showForm && <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add work</Button>}
      </div>

      {showForm && (
        <form onSubmit={save} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{selected ? "Edit urgent work" : "Add urgent work"}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-2 xl:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Project *</label>
              <select className={selectClass} value={form.project} onChange={(event) => setField("project", event.target.value)} disabled={saving}>
                <option value="">Select project</option>
                {projectOptions.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Priority *</label>
              <select className={selectClass} value={form.priority} onChange={(event) => setField("priority", event.target.value)} disabled={saving}>
                {WORK_PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">EOD *</label>
              <Input type="date" value={form.eod} onChange={(event) => setField("eod", event.target.value)} disabled={saving} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Work *</label>
            <RichText key={selected?._id || "new-work"} value={form.work} onChange={(value) => setField("work", value)} placeholder="What needs to be done?" disabled={saving} />
          </div>
          <div ref={pickerRef} className="relative">
            <p className="mb-1 text-sm font-medium text-slate-700">Assign employees *</p>
            <div className={cn("flex min-h-10 w-full items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm", saving && "opacity-50")}>
              <div className="flex max-h-16 min-w-0 flex-1 flex-wrap gap-1 overflow-auto" onClick={() => !saving && setPickerOpen(true)}>
                {form.assignees.length === 0 ? (
                  <span className="text-slate-400">Select employees</span>
                ) : options.filter((person) => form.assignees.includes(person._id)).map((person) => (
                  <span key={person._id} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                    {person.name}
                    <button type="button" aria-label={`Remove ${person.name}`} disabled={saving} onClick={(event) => { event.stopPropagation(); toggleEmployee(person._id); }} className="rounded-full text-emerald-500 hover:text-emerald-800">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <button type="button" disabled={saving} aria-label="Choose employees" onClick={() => setPickerOpen((open) => !open)} className="shrink-0 text-slate-400">
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            {pickerOpen && (
              <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white p-2 shadow-lg">
                <Input placeholder="Search employees" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} disabled={saving} autoFocus />
                <div className="mt-2 max-h-48 overflow-auto">
                  {visibleMembers.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-slate-500">No employee matches that search.</p>
                  ) : visibleMembers.map((person) => (
                    <label key={person._id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                      <input type="checkbox" checked={form.assignees.includes(person._id)} onChange={() => toggleEmployee(person._id)} disabled={saving} />
                      {person.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">File</label>
            <FilePicker accept="application/pdf,image/jpeg,image/png,image/webp,image/avif" disabled={saving} file={form.file} onChange={(file) => setField("file", file)} hint="Optional. PDF or image, up to 8 MB." />
            {selected?.file?.url && (
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.removeFile} onChange={(event) => setField("removeFile", event.target.checked)} disabled={saving} />
                Remove current file ({selected.file.name})
              </label>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={closeForm} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      )}

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        <select className={selectClass} value={project} onChange={(event) => { setProject(event.target.value); setPage(1); }}>
          <option value="">All projects</option>
          {projects.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
        </select>
        <select className={selectClass} value={priority} onChange={(event) => { setPriority(event.target.value); setPage(1); }}>
          <option value="">All priorities</option>
          {WORK_PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        {isAdmin && (
          <select className={selectClass} value={employee} onChange={(event) => { setEmployee(event.target.value); setPage(1); }}>
            <option value="">All employees</option>
            {people.map((person) => <option key={person._id} value={person._id}>{person.name}</option>)}
          </select>
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
                {["Project", "Work", "Priority", "Status", "EOD", "Assigned", "Actions"].map((heading) => (
                  <th key={heading} className={cn("px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500", heading === "Actions" && "text-right")}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan="7" className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="7" className="px-4 py-8 text-center text-slate-500">No urgent work found.</td></tr>
              ) : rows.map((row) => (
                <tr key={row._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm">
                    <button type="button" className="text-left font-medium text-slate-900 hover:text-emerald-700" onClick={() => navigate(`/dashboard/urgent-work/${row._id}`)}>{row.project?.name || "—"}</button>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-sm text-slate-600">{excerpt(row.work) || "—"}</td>
                  <td className="px-4 py-3"><span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", workPriorityClass(row.priority))}>{workPriorityLabel(row.priority)}</span></td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                      row.status === "DONE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700",
                    )}>
                      {row.status === "DONE" ? "Done" : "Pending"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{formatDate(row.eod)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{assignedLabel(row)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" title="View" onClick={() => navigate(`/dashboard/urgent-work/${row._id}`)}><Eye className="h-4 w-4 text-slate-500" /></Button>
                      {row.canEdit && <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(row)}><Edit2 className="h-4 w-4 text-slate-500" /></Button>}
                      {row.canEdit && <Button variant="ghost" size="icon" title="Delete" onClick={() => remove(row)}><Trash2 className="h-4 w-4 text-red-500" /></Button>}
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
