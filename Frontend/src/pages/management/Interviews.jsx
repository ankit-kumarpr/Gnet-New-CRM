import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Edit2, Eye, Plus, Search, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/Button";
import { FilePicker } from "../../components/ui/FilePicker";
import { Input } from "../../components/ui/Input";
import { Pager } from "../../components/ui/Pager";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { INTERVIEW_STATUSES, formatDate, interviewLabel, interviewStatusClass, toDateInput } from "./interviewOptions";
import { cn } from "../../utils/cn";

const selectClass = "h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-600";
const digits = (value, max) => value.replace(/\D/g, "").slice(0, max);

const emptyForm = {
  candidateName: "",
  phone: "",
  email: "",
  role: "",
  round: "",
  interviewDate: "",
  status: "SCHEDULED",
  interviewer: "",
  note: "",
  nextRoundDate: "",
  file: null,
  removeResume: false,
};

export function Interviews() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("MANAGE_INTERVIEWS") || hasPermission("CREATE_INTERVIEWS");
  const canEdit = hasPermission("MANAGE_INTERVIEWS") || hasPermission("EDIT_INTERVIEWS");
  const canDelete = hasPermission("MANAGE_INTERVIEWS") || hasPermission("DELETE_INTERVIEWS");
  const [rows, setRows] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [round, setRound] = useState("");
  const [interviewer, setInterviewer] = useState("");
  const [interviewDate, setInterviewDate] = useState("");
  const [nextRoundDate, setNextRoundDate] = useState("");
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
      const res = await api.get("/admin/interviews/list", {
        params: { search: debouncedSearch, status, role, round, interviewer, interviewDate, nextRoundDate, page, limit },
      });
      setRows(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch interviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [debouncedSearch, status, role, round, interviewer, interviewDate, nextRoundDate, page, limit]);

  useEffect(() => {
    api.get("/admin/interviews/interviewers")
      .then((res) => setPeople(res.data.data || []))
      .catch(() => toast.error("Failed to load interviewers"));
  }, []);

  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const openCreate = () => {
    setSelected(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  };

  const openEdit = (row) => {
    setSelected(row);
    setForm({
      candidateName: row.candidateName || "",
      phone: row.phone || "",
      email: row.email || "",
      role: row.role || "",
      round: row.round || "",
      interviewDate: toDateInput(row.interviewDate),
      status: row.status || "SCHEDULED",
      interviewer: row.interviewer?._id || "",
      note: row.note || "",
      nextRoundDate: toDateInput(row.nextRoundDate),
      file: null,
      removeResume: false,
    });
    setShowForm(true);
  };

  useEffect(() => {
    const editId = location.state?.editId;
    if (!editId) return;
    const open = async () => {
      try {
        const res = await api.get(`/admin/interviews/details/${editId}`);
        openEdit(res.data.data);
        navigate("/dashboard/interviews", { replace: true, state: null });
      } catch (error) {
        toast.error(error.response?.data?.message || "Failed to open interview");
      }
    };
    open();
  }, [location.state]);

  const closeForm = () => {
    setShowForm(false);
    setSelected(null);
    setForm(emptyForm);
  };

  const save = async (event) => {
    event.preventDefault();
    if (form.candidateName.trim().length < 2) {
      toast.error("Candidate name must be at least 2 characters");
      return;
    }
    if (!/^[0-9]{10}$/.test(form.phone)) {
      toast.error("Phone number must be 10 digits");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error("Enter a valid candidate email");
      return;
    }
    if (form.role.trim().length < 2) {
      toast.error("Role must be at least 2 characters");
      return;
    }
    if (!form.round.trim()) {
      toast.error("Round is required");
      return;
    }
    if (!form.interviewDate) {
      toast.error("Interview date is required");
      return;
    }
    if (!form.interviewer) {
      toast.error("Select an interviewer");
      return;
    }
    if (form.status === "NEXT_ROUND" && !form.nextRoundDate) {
      toast.error("Next round date is required");
      return;
    }

    const data = new FormData();
    data.append("candidateName", form.candidateName.trim());
    data.append("phone", form.phone);
    data.append("email", form.email.trim().toLowerCase());
    data.append("role", form.role.trim());
    data.append("round", form.round.trim());
    data.append("interviewDate", form.interviewDate);
    data.append("status", form.status);
    data.append("interviewer", form.interviewer);
    data.append("note", form.note.trim());
    if (form.status === "NEXT_ROUND") data.append("nextRoundDate", form.nextRoundDate);
    if (form.file) data.append("resume", form.file);
    if (selected && form.removeResume) data.append("removeResume", "1");

    try {
      setSaving(true);
      let res;
      if (selected) {
        res = await api.patch(`/admin/interviews/update/${selected._id}`, data);
        toast.success("Interview updated");
      } else {
        res = await api.post("/admin/interviews/create", data);
        toast.success("Interview scheduled");
      }
      if (form.status === "NOT_SELECTED") {
        if (res.data.mail?.sent) toast.success("Rejection mail sent to candidate");
        else if (res.data.mail?.reason) toast.error(res.data.mail.reason);
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
    if (!window.confirm(`Delete interview for ${row.candidateName}?`)) return;
    try {
      await api.delete(`/admin/interviews/${row._id}`);
      toast.success("Interview deleted");
      if (selected?._id === row._id) closeForm();
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete interview");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Interviews</h1>
          <p className="mt-1 text-sm text-slate-500">Schedule a candidate, then move them to the next round, selected, or not selected.</p>
        </div>
        {canCreate && !showForm && (
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Schedule interview</Button>
        )}
      </div>

      {showForm && (selected ? canEdit : canCreate) && (
        <form onSubmit={save} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{selected ? "Edit interview" : "Schedule interview"}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Candidate name *</label>
              <Input maxLength={120} value={form.candidateName} onChange={(event) => setField("candidateName", event.target.value)} disabled={saving} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Phone *</label>
              <Input inputMode="numeric" maxLength={10} value={form.phone} onChange={(event) => setField("phone", digits(event.target.value, 10))} disabled={saving} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email *</label>
              <Input type="email" maxLength={120} value={form.email} onChange={(event) => setField("email", event.target.value)} disabled={saving} placeholder="candidate@email.com" />
              <p className="mt-1 text-xs text-slate-500">Used to send a professional mail if marked Not selected.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Role *</label>
              <Input maxLength={120} value={form.role} onChange={(event) => setField("role", event.target.value)} disabled={saving} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Round *</label>
              <Input maxLength={80} value={form.round} placeholder="Round 1" onChange={(event) => setField("round", event.target.value)} disabled={saving} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Interview date *</label>
              <Input type="date" value={form.interviewDate} onChange={(event) => setField("interviewDate", event.target.value)} disabled={saving} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Interviewer *</label>
              <select className={selectClass} value={form.interviewer} onChange={(event) => setField("interviewer", event.target.value)} disabled={saving}>
                <option value="">Select interviewer</option>
                {people.map((person) => <option key={person._id} value={person._id}>{person.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Status *</label>
              <select className={selectClass} value={form.status} onChange={(event) => setField("status", event.target.value)} disabled={saving}>
                {INTERVIEW_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            {form.status === "NEXT_ROUND" && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Next round date *</label>
                <Input type="date" value={form.nextRoundDate} onChange={(event) => setField("nextRoundDate", event.target.value)} disabled={saving} />
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Note</label>
            <textarea
              value={form.note}
              maxLength={2000}
              rows={3}
              disabled={saving}
              onChange={(event) => setField("note", event.target.value)}
              className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Resume</label>
            <FilePicker
              key={selected?._id || "new-resume"}
              accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp"
              disabled={saving}
              file={form.file}
              onChange={(file) => setField("file", file)}
              hint="Optional. PDF, Word, or image, up to 8 MB."
            />
            {selected?.resume?.url && (
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.removeResume} onChange={(event) => setField("removeResume", event.target.checked)} disabled={saving} />
                Remove current resume ({selected.resume.name})
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
        <div className="relative md:col-span-2 xl:col-span-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search name, phone, email, or role..." className="pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        </div>
        <select className={selectClass} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {INTERVIEW_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <Input placeholder="Role" value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }} />
        <Input placeholder="Round" value={round} onChange={(event) => { setRound(event.target.value); setPage(1); }} />
        <select className={selectClass} value={interviewer} onChange={(event) => { setInterviewer(event.target.value); setPage(1); }}>
          <option value="">All interviewers</option>
          {people.map((person) => <option key={person._id} value={person._id}>{person.name}</option>)}
        </select>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Interview date</label>
          <Input type="date" value={interviewDate} onChange={(event) => { setInterviewDate(event.target.value); setPage(1); }} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Next round date</label>
          <Input type="date" value={nextRoundDate} onChange={(event) => { setNextRoundDate(event.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {["Candidate", "Role", "Round", "Interview date", "Status", "Interviewer", "Next round", "Actions"].map((heading) => (
                  <th key={heading} className={cn("px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500", heading === "Actions" && "text-right")}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-500">No interviews found.</td></tr>
              ) : rows.map((row) => (
                <tr key={row._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm">
                    <button type="button" className="text-left font-medium text-slate-900 hover:text-emerald-700" onClick={() => navigate(`/dashboard/interviews/${row._id}`)}>{row.candidateName}</button>
                    <div className="text-slate-500">{row.phone}</div>
                    {row.email ? <div className="text-slate-400">{row.email}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{row.role}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{row.round}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{formatDate(row.interviewDate)}</td>
                  <td className="px-4 py-3"><span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", interviewStatusClass(row.status))}>{interviewLabel(row.status)}</span></td>
                  <td className="px-4 py-3 text-sm text-slate-700">{row.interviewer?.name || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{row.status === "NEXT_ROUND" ? formatDate(row.nextRoundDate) : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" title="View" onClick={() => navigate(`/dashboard/interviews/${row._id}`)}><Eye className="h-4 w-4 text-slate-500" /></Button>
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
