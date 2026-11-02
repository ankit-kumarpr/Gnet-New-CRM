import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, CheckCircle2, Lock, MessageSquare, Plus, Trash2, Unlock } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Pager } from "../../components/ui/Pager";
import { RichText, plainRichText, richHtmlClass } from "../../components/ui/RichText";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useBrand } from "../../context/BrandContext";
import { cn } from "../../utils/cn";
import { openClientReportWhatsApp } from "../../utils/whatsappShare";

const selectClass = "h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-600";

const todayKey = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

const dateLabel = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const statusClass = (status) => {
  if (status === "APPROVED") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (status === "LOCKED") return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
};

const emptyLine = () => ({
  slotId: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  serviceName: "",
  label: "",
  note: "",
  status: "DONE",
  kind: "MANUAL",
});

function ReportDetail({ id, onBack }) {
  const { user } = useAuth();
  const { brand } = useBrand();
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([]);
  const [feedback, setFeedback] = useState("");

  const shareWhatsApp = (report = row) => {
    if (!report?._id) return;
    if (report.status !== "APPROVED") {
      toast.error("Pehle report approve karo, phir WhatsApp share karo");
      return;
    }
    try {
      openClientReportWhatsApp({
        phone: report.client?.phone,
        whatsapp: report.client?.whatsapp,
        clientName: report.client?.name,
        reportId: report._id,
        reportDate: report.date,
        companyName: brand?.companyName,
      });
    } catch (error) {
      toast.error(error.message || "WhatsApp open nahi hua");
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/admin/evening-reports/${id}`);
      const data = res.data.data;
      setRow(data);
      setNotes(data?.notes || "");
      const loaded = (data?.items || []).map((item) => ({ ...item }));
      setItems(loaded.length ? loaded : (data?.canEditMyItems ? [emptyLine()] : []));
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const saveMine = async () => {
    const cleaned = items.filter((item) => (item.label || "").trim() || (item.note || "").trim() || (item.serviceName || "").trim());
    if (!plainRichText(notes) && !cleaned.length) {
      toast.error("Rich text me report likho, ya kam se kam 1 work line add karo");
      return;
    }
    try {
      setSaving(true);
      const payload = row?.canEditNotes
        ? { notes, items: cleaned }
        : { items: cleaned };
      // Always send notes when editor is available for this user.
      if (row?.canEditNotes) payload.notes = notes;
      const res = await api.patch(`/admin/evening-reports/${id}`, payload);
      setRow(res.data.data);
      setNotes(res.data.data?.notes || "");
      setItems((res.data.data?.items || []).map((item) => ({ ...item })));
      toast.success(res.data.message || "Saved");
    } catch (error) {
      toast.error(error.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const setItemField = (index, field, value) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const addLine = () => setItems((current) => [...current, emptyLine()]);

  const removeLine = (index) => {
    setItems((current) => (current.length <= 1 ? current : current.filter((_, i) => i !== index)));
  };

  const act = async (path, ok) => {
    try {
      setSaving(true);
      const res = await api.post(`/admin/evening-reports/${id}/${path}`);
      setRow(res.data.data);
      toast.success(res.data.message || ok);
      if (path === "approve" && res.data.data) {
        // After approve, offer WhatsApp share to client number.
        setTimeout(() => shareWhatsApp(res.data.data), 400);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Action failed");
    } finally {
      setSaving(false);
    }
  };

  const sendFeedback = async () => {
    if (!feedback.trim()) {
      toast.error("Write feedback first");
      return;
    }
    try {
      setSaving(true);
      const res = await api.post(`/admin/evening-reports/${id}/feedback`, { body: feedback.trim() });
      setRow(res.data.data);
      setFeedback("");
      toast.success("Feedback added");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not add feedback");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="rounded-xl border bg-white p-6 text-sm text-slate-500">Loading report...</p>;
  if (!row) return <p className="rounded-xl border bg-white p-6 text-sm text-slate-500">Report not found.</p>;

  const mineOnly = row.viewScope === "mine";
  const editable = !!row.canEditMyItems;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{row.client?.name || "Client"}</h2>
            <p className="text-sm text-slate-500">
              {dateLabel(row.date)} · RM {row.reportingManager?.name || "—"}
              {mineOnly ? ` · Sirf aapka kaam` : ` · Combined team report`}
            </p>
          </div>
        </div>
        <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", statusClass(row.status))}>{row.status}</span>
      </div>

      {editable && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900">
          Neeche <strong>rich text editor</strong> me proper report likho (yahi client ko dikhegi). Optional lines se short checklist bhi add kar sakte ho.
          Save/Submit ke baad RM <strong>Lock → Approve</strong> karega.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {editable && (
          <Button type="button" onClick={saveMine} disabled={saving}>
            {saving ? "Saving..." : (mineOnly ? "Save / Submit my work" : "Save report")}
          </Button>
        )}
        {editable && (
          <Button type="button" variant="outline" onClick={addLine} disabled={saving}>
            <Plus className="mr-2 h-4 w-4" /> Add line
          </Button>
        )}
        {row.canLock && (
          <Button type="button" variant="outline" onClick={() => act("lock", "Locked")} disabled={saving}>
            <Lock className="mr-2 h-4 w-4" /> Lock for approval
          </Button>
        )}
        {row.canApprove && (
          <Button type="button" onClick={() => act("approve", "Approved")} disabled={saving}>
            <CheckCircle2 className="mr-2 h-4 w-4" /> Approve (client visible)
          </Button>
        )}
        {row.status === "LOCKED" && row.canApprove && (
          <Button type="button" variant="outline" onClick={() => act("unlock", "Unlocked")} disabled={saving}>
            <Unlock className="mr-2 h-4 w-4" /> Send back to draft
          </Button>
        )}
        {row.status === "APPROVED" && (
          <Button type="button" variant="outline" onClick={() => shareWhatsApp(row)} disabled={saving}>
            <MessageSquare className="mr-2 h-4 w-4" /> WhatsApp share report
          </Button>
        )}
      </div>

      {(row.canEditNotes || plainRichText(row.notes)) && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Work report (client will see this)</h3>
          <p className="mt-1 text-xs text-slate-500">
            Bold, headings, lists use karke proper detail likho — yehi approved report me client ko jayegi.
          </p>
          {row.canEditNotes ? (
            <div className="mt-3">
              <RichText
                key={`${row._id}-notes`}
                value={notes}
                onChange={setNotes}
                disabled={saving}
                placeholder="Today's work update for the client…"
              />
            </div>
          ) : (
            <div
              className={cn("mt-3 text-sm text-slate-800", richHtmlClass)}
              dangerouslySetInnerHTML={{ __html: row.notes }}
            />
          )}
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">
            {mineOnly ? "Optional short lines (checklist)" : "Optional work lines (all employees)"}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Service</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Kaam (kya)</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Kitna / detail</th>
                {!mineOnly && (
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">By</th>
                )}
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
                {editable && <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={editable ? (mineOnly ? 5 : 6) : (mineOnly ? 4 : 5)} className="px-4 py-6 text-center text-slate-500">
                    Abhi koi line nahi. Add line karke kaam likho.
                  </td>
                </tr>
              ) : items.map((item, index) => (
                <tr key={`${item.slotId}-${index}`}>
                  <td className="px-3 py-2 align-top">
                    {editable ? (
                      <input
                        className="h-9 w-full min-w-[110px] rounded-md border border-slate-200 px-2 text-sm outline-none focus:ring-2 focus:ring-emerald-600"
                        value={item.serviceName || ""}
                        disabled={saving}
                        placeholder="SEO / Social…"
                        onChange={(e) => setItemField(index, "serviceName", e.target.value)}
                      />
                    ) : (item.serviceName || "—")}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {editable ? (
                      <input
                        className="h-9 w-full min-w-[140px] rounded-md border border-slate-200 px-2 text-sm outline-none focus:ring-2 focus:ring-emerald-600"
                        value={item.label || ""}
                        disabled={saving}
                        placeholder="Reels / Posts / Page…"
                        onChange={(e) => setItemField(index, "label", e.target.value)}
                      />
                    ) : (item.label || "—")}
                  </td>
                  <td className="px-3 py-2 align-top min-w-[160px]">
                    {editable ? (
                      <input
                        className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm outline-none focus:ring-2 focus:ring-emerald-600"
                        value={item.note || ""}
                        disabled={saving}
                        placeholder="e.g. 5 done, 2 pending"
                        onChange={(e) => setItemField(index, "note", e.target.value)}
                      />
                    ) : (item.note || "—")}
                  </td>
                  {!mineOnly && (
                    <td className="px-3 py-2 align-top text-slate-700">{item.assigneeName || "—"}</td>
                  )}
                  <td className="px-3 py-2 align-top">
                    {editable ? (
                      <select
                        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium"
                        value={item.status || "DONE"}
                        disabled={saving}
                        onChange={(e) => setItemField(index, "status", e.target.value)}
                      >
                        <option value="DONE">DONE</option>
                        <option value="PARTIAL">PARTIAL</option>
                        <option value="PENDING">PENDING</option>
                        <option value="HOLD">HOLD</option>
                      </select>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">{item.status}</span>
                    )}
                  </td>
                  {editable && (
                    <td className="px-3 py-2 align-top text-right">
                      <button
                        type="button"
                        className="text-slate-400 hover:text-rose-600"
                        onClick={() => removeLine(index)}
                        disabled={saving || items.length <= 1}
                        title="Remove line"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <MessageSquare className="h-4 w-4" /> Feedback
        </h3>
        <ul className="space-y-2">
          {(row.feedback || []).length === 0 ? (
            <li className="text-sm text-slate-500">No feedback yet.</li>
          ) : row.feedback.map((f) => (
            <li key={f._id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
              <p className="font-medium text-slate-800">{f.authorName || f.authorKind} · {dateLabel(f.createdAt)}</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-700">{f.body}</p>
            </li>
          ))}
        </ul>
        {row.canFeedback && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Add feedback..." disabled={saving} />
            <Button type="button" onClick={sendFeedback} disabled={saving}>Post</Button>
          </div>
        )}
      </section>
    </div>
  );
}

export function EveningReports({ todayMode = false } = {}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { brand } = useBrand();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayKey());
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const shareRowWhatsApp = (row) => {
    if (row.status !== "APPROVED") {
      toast.error("Sirf approved report WhatsApp pe share hoti hai");
      return;
    }
    try {
      openClientReportWhatsApp({
        phone: row.client?.phone,
        whatsapp: row.client?.whatsapp,
        clientName: row.client?.name,
        reportId: row._id,
        reportDate: row.date,
        companyName: brand?.companyName,
      });
    } catch (error) {
      toast.error(error.message || "WhatsApp open nahi hua");
    }
  };

  const [showCreate, setShowCreate] = useState(false);
  const [clients, setClients] = useState([]);
  const [createClient, setCreateClient] = useState("");
  const [createDate, setCreateDate] = useState(todayKey());
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      if (todayMode) {
        const params = { date };
        if (status) params.status = status;
        const res = await api.get("/admin/evening-reports/today", { params });
        setRows(res.data.data || []);
        setTotal((res.data.data || []).length);
        setPages(1);
      } else {
        const params = { page, limit, date };
        if (status) params.status = status;
        const res = await api.get("/admin/evening-reports", { params });
        setRows(res.data.data || []);
        setTotal(res.data.pagination?.total || 0);
        setPages(res.data.pagination?.pages || 1);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load evening reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (!id) load(); }, [id, date, status, page, limit, todayMode]);

  const openCreate = async () => {
    setShowCreate(true);
    setCreateDate(date || todayKey());
    try {
      const res = await api.get("/admin/evening-reports/meta/clients");
      setClients(res.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Clients load nahi hue");
      setClients([]);
    }
  };

  const createReport = async (event) => {
    event.preventDefault();
    if (!createClient) return toast.error("Client select karo");
    try {
      setCreating(true);
      const res = await api.post("/admin/evening-reports", {
        client: createClient,
        date: createDate,
      });
      toast.success(res.data.message || "Report ready");
      setShowCreate(false);
      navigate(`/dashboard/evening-reports/${res.data.data._id}`);
    } catch (error) {
      toast.error(error.response?.data?.message || "Create failed");
    } finally {
      setCreating(false);
    }
  };

  if (id) {
    return (
      <ReportDetail
        id={id}
        onBack={() => navigate(todayMode ? "/dashboard/evening-reports/today" : "/dashboard/evening-reports")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {todayMode ? "Today's reports" : "Evening client reports"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manual: har client pe kitna kaam kiya likho → Save/Submit → RM Lock → Approve → client ko dikhe.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/dashboard/evening-reports">
            <Button type="button" variant={todayMode ? "outline" : "default"}>All reports</Button>
          </Link>
          <Link to="/dashboard/evening-reports/today">
            <Button type="button" variant={todayMode ? "default" : "outline"}>Today&apos;s reports</Button>
          </Link>
          <Button type="button" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> New report
          </Button>
        </div>
      </div>

      {showCreate && (
        <form onSubmit={createReport} className="grid gap-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 shadow-sm sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Client *</label>
            <select className={selectClass} value={createClient} onChange={(e) => setCreateClient(e.target.value)} disabled={creating}>
              <option value="">Select assigned client</option>
              {clients.map((client) => {
                const projectNames = (client.projects || []).map((p) => p.name).filter(Boolean);
                const suffix = projectNames.length ? ` · ${projectNames.slice(0, 2).join(", ")}${projectNames.length > 2 ? "…" : ""}` : "";
                return (
                  <option key={client._id} value={client._id}>
                    {client.name}{suffix}
                  </option>
                );
              })}
            </select>
            {!creating && clients.length === 0 && (
              <p className="mt-1 text-[11px] text-amber-700">Koi assigned client/project nahi mila.</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Date *</label>
            <Input type="date" value={createDate} onChange={(e) => setCreateDate(e.target.value)} disabled={creating} />
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={creating}>{creating ? "Creating..." : "Create & fill"}</Button>
            <Button type="button" variant="outline" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Date</label>
          <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
          <select className={selectClass} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All (Draft + Locked + Approved)</option>
            <option value="DRAFT">Draft</option>
            <option value="LOCKED">Locked</option>
            <option value="APPROVED">Approved</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Client</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Lines</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Koi report nahi. <strong>New report</strong> se client choose karke manual fill karo.
                </td>
              </tr>
            ) : rows.map((row) => (
              <tr key={row._id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{row.client?.name || "—"}</td>
                <td className="px-4 py-3 text-slate-700">{dateLabel(row.date)}</td>
                <td className="px-4 py-3 text-slate-700">{(row.items || []).length}</td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", statusClass(row.status))}>{row.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    {row.status === "APPROVED" && (
                      <Button type="button" variant="outline" size="sm" onClick={() => shareRowWhatsApp(row)}>
                        <MessageSquare className="mr-1 h-3.5 w-3.5" />
                        WhatsApp
                      </Button>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => navigate(`/dashboard/evening-reports/${row._id}`)}>
                      Open
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!todayMode && (
          <Pager page={page} pages={pages} limit={limit} total={total} onPage={setPage} onLimit={(size) => { setLimit(size); setPage(1); }} />
        )}
      </div>
    </div>
  );
}
