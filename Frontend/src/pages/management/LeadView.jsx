import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Building2, MapPin, Pencil, Phone } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/Button";
import { richHtmlClass } from "../../components/ui/RichText";
import { Input } from "../../components/ui/Input";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { FOLLOW_UP_TYPES, LEAD_SOURCES, LEAD_STATUSES, canEditLead, canFollowLead, followUpTone, formatDate, formatDateTime, formatMoney, isClosedLead, leadLabel, statusClass, toDateInput } from "./leadOptions";
import { cn } from "../../utils/cn";

const selectClass = "h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-600";
const show = (value) => (value ? value : "—");

const emptyNote = (lead) => ({
  type: "CALL",
  remark: "",
  status: lead?.status || "NEW",
  nextFollowUpAt: isClosedLead(lead?.status) ? "" : toDateInput(lead?.nextFollowUpAt),
  lostReason: lead?.lostReason || "",
  amount: lead?.status === "PAYMENT" && Number(lead?.amount) ? String(lead.amount) : "",
});

export function LeadView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [lead, setLead] = useState(null);
  const [notes, setNotes] = useState([]);
  const [note, setNote] = useState(emptyNote());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assignees, setAssignees] = useState([]);
  const [assigning, setAssigning] = useState(false);

  const load = async () => {
    const [leadRes, noteRes] = await Promise.all([
      api.get(`/admin/leads/details/${id}`),
      api.get(`/admin/leads/${id}/follow-ups`),
    ]);
    const nextLead = leadRes.data.data;
    setLead(nextLead);
    setNotes(noteRes.data.data || []);
    setNote(emptyNote(nextLead));
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const [leadRes, noteRes] = await Promise.all([
          api.get(`/admin/leads/details/${id}`),
          api.get(`/admin/leads/${id}/follow-ups`),
        ]);
        if (cancelled) return;
        const nextLead = leadRes.data.data;
        setLead(nextLead);
        setNotes(noteRes.data.data || []);
        setNote(emptyNote(nextLead));
      } catch (error) {
        if (!cancelled) toast.error(error.response?.data?.message || "Failed to load lead");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (loading || !lead || !location.state?.follow) return;
    document.getElementById("follow")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading, lead, location.state]);

  useEffect(() => {
    if (!lead?.canAssign) return undefined;
    let cancelled = false;
    api.get("/admin/leads/assignees")
      .then((res) => { if (!cancelled) setAssignees(res.data.data || []); })
      .catch(() => { if (!cancelled) toast.error("Failed to load team"); });
    return () => { cancelled = true; };
  }, [lead?.canAssign]);

  const setField = (name, value) => setNote((current) => ({ ...current, [name]: value }));

  const reassign = async (assignedTo) => {
    if (!assignedTo || assignedTo === lead.assignedTo?._id) return;
    try {
      setAssigning(true);
      const res = await api.patch(`/admin/leads/${id}/assign`, { assignedTo });
      setLead(res.data.data);
      toast.success("Lead assigned");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not assign the lead");
    } finally {
      setAssigning(false);
    }
  };

  const saveNote = async (event) => {
    event.preventDefault();
    if (note.remark.trim().length < 2) {
      toast.error("Write what happened in this follow-up");
      return;
    }
    if (note.status === "LOST" && note.lostReason.trim().length < 2) {
      toast.error("Add a reason when the lead is lost");
      return;
    }
    if (note.status === "PAYMENT" && lead.status !== "CONVERTED" && lead.status !== "PAYMENT") {
      toast.error("Mark the lead converted before payment");
      return;
    }
    if (note.status === "PAYMENT" && !/^\d+(\.\d{1,2})?$/.test(String(note.amount || "").trim())) {
      toast.error("Enter the revenue amount");
      return;
    }
    try {
      setSaving(true);
      await api.post(`/admin/leads/${id}/follow-ups`, note);
      toast.success("Follow-up saved");
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save follow-up");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Loading lead...</div>;
  }
  if (!lead) {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Lead not found.</div>;
  }

  const allowEdit = canEditLead(user, lead);
  const allowFollow = canFollowLead(user, lead);
  const initials = lead.name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/leads")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Lead</h1>
            <p className="text-sm text-slate-500">
              Added {formatDate(lead.createdAt)}
              {lead.createdBy?.name ? ` by ${lead.createdBy.name}` : ""}
            </p>
          </div>
        </div>
        {allowEdit && (
          <Button onClick={() => navigate("/dashboard/leads", { state: { editId: lead._id } })}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-800 to-teal-600 px-6 py-8 text-white">
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-300 text-2xl font-semibold text-white shadow-md">{initials || "L"}</div>
            <div>
              <h2 className="text-2xl font-semibold">{lead.name}</h2>
              <p className="text-sm text-emerald-100">{leadLabel(LEAD_SOURCES, lead.source)}</p>
              <span className={cn("mt-3 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", statusClass(lead.status))}>{leadLabel(LEAD_STATUSES, lead.status)}</span>
            </div>
          </div>
        </div>
        <div className="grid gap-3 px-6 py-5 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <p className="flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{show(lead.phone)}</p>
          <p className="flex items-start gap-2"><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{show(lead.companyName)}</p>
          <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{show(lead.address)}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span>Assigned to</span>
            {lead.canAssign ? (
              <select
                className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900"
                value={lead.assignedTo?._id || ""}
                disabled={assigning}
                onChange={(event) => reassign(event.target.value)}
              >
                {lead.assignedTo?._id && !assignees.some((person) => person._id === lead.assignedTo._id) && (
                  <option value={lead.assignedTo._id}>{lead.assignedTo.name}</option>
                )}
                {assignees.map((person) => <option key={person._id} value={person._id}>{person.name}</option>)}
              </select>
            ) : (
              <span className="font-medium text-slate-900">{show(lead.assignedTo?.name)}</span>
            )}
          </div>
          <p>Next follow-up <span className={cn("font-medium", followUpTone(lead.nextFollowUpAt, lead.status))}>{isClosedLead(lead.status) ? "—" : formatDate(lead.nextFollowUpAt)}</span></p>
          {lead.soldBy?.name && <p>Sale by <span className="font-medium text-slate-900">{lead.soldBy.name}</span></p>}
          {lead.convertedAt && <p>Converted <span className="font-medium text-slate-900">{formatDateTime(lead.convertedAt)}</span></p>}
          {lead.paymentBy?.name && <p>Payment by <span className="font-medium text-slate-900">{lead.paymentBy.name}</span></p>}
          {lead.paymentAt && <p>Payment <span className="font-medium text-slate-900">{formatDateTime(lead.paymentAt)}</span></p>}
          {lead.status === "PAYMENT" && <p>Revenue <span className="font-medium text-slate-900">{formatMoney(lead.amount)}</span></p>}
          {lead.status === "LOST" && <p>Lost reason <span className="font-medium text-slate-900">{show(lead.lostReason)}</span></p>}
        </div>
      </div>

      <section id="follow" className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Follow-up</h3>
        <p className="mt-1 text-sm text-slate-500">Status changes from here. Lead name, phone, and services stay on Edit.</p>
        {allowFollow && (
          <form onSubmit={saveNote} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Type *</label>
                <select className={selectClass} value={note.type} onChange={(event) => setField("type", event.target.value)} disabled={saving}>
                  {FOLLOW_UP_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Status *</label>
                <select className={selectClass} value={note.status} onChange={(event) => setField("status", event.target.value)} disabled={saving}>
                  {LEAD_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              {note.status === "CONVERTED" && (
                <p className="text-sm text-emerald-700 sm:col-span-2 lg:col-span-3 xl:col-span-4">This sale counts for you, and it stays with the person this lead is assigned to.</p>
              )}
              {note.status === "PAYMENT" && lead.status !== "CONVERTED" && lead.status !== "PAYMENT" && (
                <p className="text-sm text-amber-700 sm:col-span-2 lg:col-span-3 xl:col-span-4">Mark this lead converted first. Payment comes after the sale.</p>
              )}
              {note.status === "PAYMENT" && (lead.status === "CONVERTED" || lead.status === "PAYMENT") && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Revenue amount *</label>
                  <Input inputMode="decimal" value={note.amount} onChange={(event) => setField("amount", event.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1").replace(/^(\d+\.\d{0,2}).*$/, "$1"))} disabled={saving} placeholder="0.00" />
                </div>
              )}
              {!isClosedLead(note.status) && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Next follow-up</label>
                  <Input type="date" value={note.nextFollowUpAt} onChange={(event) => setField("nextFollowUpAt", event.target.value)} disabled={saving} />
                </div>
              )}
              {note.status === "LOST" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Lost reason *</label>
                  <Input value={note.lostReason} maxLength={500} onChange={(event) => setField("lostReason", event.target.value)} disabled={saving} />
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">What happened *</label>
              <textarea
                value={note.remark}
                maxLength={2000}
                rows={3}
                disabled={saving}
                onChange={(event) => setField("remark", event.target.value)}
                className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save follow-up"}</Button>
            </div>
          </form>
        )}

        {notes.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No follow-up yet.</p>
        ) : (
          <ol className="mt-5 space-y-3">
            {notes.map((item) => (
              <li key={item._id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">
                    {leadLabel(FOLLOW_UP_TYPES, item.type)}
                    <span className="font-normal text-slate-500"> · {item.createdBy?.name || "—"}</span>
                  </p>
                  <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", statusClass(item.status))}>{leadLabel(LEAD_STATUSES, item.status)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.remark}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {formatDateTime(item.createdAt)}
                  {item.status === "LOST" ? ` · Lost: ${item.lostReason || "—"}` : isClosedLead(item.status) ? "" : ` · Next: ${formatDate(item.nextFollowUpAt)}`}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Remark</h3>
        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-900">{show(lead.remark)}</p>
      </section>

      <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Services</h3>
        {(lead.services || []).length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No service selected.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {lead.services.map((service) => (
              <li key={service._id} className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-medium text-slate-900">{service.name}</p>
                {service.description ? (
                  <div className={cn("mt-2 text-sm text-slate-700", richHtmlClass)} dangerouslySetInnerHTML={{ __html: service.description }} />
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No description.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
