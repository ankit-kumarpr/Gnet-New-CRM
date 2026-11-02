import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Paperclip, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/Button";
import { RichText, plainRichText, richHtmlClass } from "../../components/ui/RichText";
import api from "../../services/api";
import { TICKET_STATUSES, formatDateTime, ticketPriorityClass, ticketPriorityLabel, ticketStatusClass, ticketStatusLabel } from "./ticketOptions";
import { cn } from "../../utils/cn";

const selectClass = "h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-600";

export function TicketView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [replyKey, setReplyKey] = useState(0);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/admin/tickets/details/${id}`);
      setTicket(res.data.data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load ticket");
      setTicket(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const sendReply = async (event) => {
    event.preventDefault();
    if (!plainRichText(reply)) {
      toast.error("Reply is required");
      return;
    }
    try {
      setSaving(true);
      await api.post(`/admin/tickets/${id}/replies`, { message: reply });
      toast.success("Reply sent");
      setReply("");
      setReplyKey((value) => value + 1);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not send the reply");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (status) => {
    try {
      await api.patch(`/admin/tickets/${id}/status`, { status });
      toast.success("Status updated");
      setTicket((current) => (current ? { ...current, status } : current));
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update the status");
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this ticket?")) return;
    try {
      await api.delete(`/admin/tickets/${id}`);
      toast.success("Ticket deleted");
      navigate("/dashboard/help");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not delete the ticket");
    }
  };

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Loading ticket...</div>;
  }
  if (!ticket) {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Ticket not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/help")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Ticket</h1>
            <p className="text-sm text-slate-500">Raised by {ticket.raisedBy?.name || "—"} · {formatDateTime(ticket.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ticket.canChangeStatus ? (
            <select className={selectClass} value={ticket.status} onChange={(event) => changeStatus(event.target.value)}>
              {TICKET_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          ) : (
            <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", ticketStatusClass(ticket.status))}>{ticketStatusLabel(ticket.status)}</span>
          )}
          {ticket.canDelete && (
            <Button variant="outline" onClick={remove}><Trash2 className="mr-2 h-4 w-4 text-red-500" />Delete</Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-800 to-teal-600 px-6 py-8 text-white">
          <h2 className="text-2xl font-semibold">{ticket.subject}</h2>
          <span className={cn("mt-3 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", ticketPriorityClass(ticket.priority))}>{ticketPriorityLabel(ticket.priority)}</span>
        </div>
        <div className={cn("px-6 py-5 text-sm text-slate-900", richHtmlClass)} dangerouslySetInnerHTML={{ __html: ticket.content }} />
        {ticket.file?.url && (
          <div className="border-t border-slate-100 px-6 py-4">
            <a href={ticket.file.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:underline">
              <Paperclip className="h-4 w-4" />
              {ticket.file.name || "Open file"}
            </a>
          </div>
        )}
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Replies</h3>
        {(ticket.replies || []).length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">No replies yet.</p>
        ) : ticket.replies.map((item) => (
          <article key={item._id} className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-900">{item.author?.name || "—"} <span className="font-normal text-slate-500">· {formatDateTime(item.createdAt)}</span></p>
            <div className={cn("mt-2 text-sm text-slate-800", richHtmlClass)} dangerouslySetInnerHTML={{ __html: item.message }} />
          </article>
        ))}
      </section>

      {ticket.canReply && (
        <form onSubmit={sendReply} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Reply</h3>
          <RichText key={replyKey} value={reply} onChange={setReply} placeholder="Write a reply" disabled={saving} />
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? "Sending..." : "Send reply"}</Button>
          </div>
        </form>
      )}
    </div>
  );
}
