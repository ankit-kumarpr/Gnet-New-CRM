import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ExternalLink, Video } from "lucide-react";
import api from "../services/api";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { cn } from "../utils/cn";

const whenLabel = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const meetStatusClass = (status) => {
  if (status === "APPROVED") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (status === "PENDING") return "bg-amber-50 text-amber-800 border-amber-200";
  if (status === "REJECTED") return "bg-rose-50 text-rose-800 border-rose-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
};

export function ClientMeetings() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meetForm, setMeetForm] = useState({ scheduledAt: "", agenda: "" });
  const [savingMeet, setSavingMeet] = useState(false);
  const [showMeetForm, setShowMeetForm] = useState(false);

  const loadMeetings = async () => {
    try {
      setLoading(true);
      const res = await api.get("/auth/meetings", { params: { limit: 50 } });
      setMeetings(res.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Meetings load nahi hui");
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  const requestMeet = async (event) => {
    event.preventDefault();
    if (!meetForm.scheduledAt) return toast.error("Date & time chuno");
    if (meetForm.agenda.trim().length < 5) return toast.error("Short agenda likho");
    try {
      setSavingMeet(true);
      await api.post("/auth/meetings", {
        scheduledAt: new Date(meetForm.scheduledAt).toISOString(),
        agenda: meetForm.agenda.trim(),
      });
      toast.success("Meet request bhej di — approval ka wait");
      setMeetForm({ scheduledAt: "", agenda: "" });
      setShowMeetForm(false);
      await loadMeetings();
    } catch (error) {
      toast.error(error.response?.data?.message || "Request fail");
    } finally {
      setSavingMeet(false);
    }
  };

  const cancelMeet = async (row) => {
    if (!window.confirm("Is meet request ko cancel karein?")) return;
    try {
      await api.post(`/auth/meetings/${row._id}/cancel`);
      toast.success("Cancelled");
      await loadMeetings();
    } catch (error) {
      toast.error(error.response?.data?.message || "Cancel fail");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Google Meet</h1>
          <p className="mt-1 text-sm text-slate-500">
            Time aur agenda ke saath meet request bhejo. Approve hone ke baad Join Meet se link khulega.
          </p>
        </div>
        <Button type="button" onClick={() => setShowMeetForm((v) => !v)}>
          <Video className="mr-1.5 h-4 w-4" />
          {showMeetForm ? "Close" : "Request meet"}
        </Button>
      </div>

      {showMeetForm && (
        <form
          onSubmit={requestMeet}
          className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 shadow-sm"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Preferred date & time *</label>
            <Input
              type="datetime-local"
              value={meetForm.scheduledAt}
              onChange={(e) => setMeetForm((c) => ({ ...c, scheduledAt: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Agenda *</label>
            <textarea
              rows={3}
              value={meetForm.agenda}
              onChange={(e) => setMeetForm((c) => ({ ...c, agenda: e.target.value }))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-600"
              placeholder="Kya discuss karna hai?"
              required
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={savingMeet}>
              {savingMeet ? "Sending..." : "Submit request"}
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Loading...</p>
        ) : meetings.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Abhi koi meeting nahi.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {meetings.map((row) => (
              <li key={row._id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-xs font-semibold",
                          meetStatusClass(row.status),
                        )}
                      >
                        {row.status}
                      </span>
                      <span className="text-xs text-slate-500">
                        {row.origin === "CLIENT" ? "Your request" : "Scheduled by team"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-900">{whenLabel(row.scheduledAt)}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{row.agenda}</p>
                    {row.rejectReason ? (
                      <p className="mt-1 text-xs text-rose-600">Reason: {row.rejectReason}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.status === "APPROVED" && row.meetLink ? (
                      <a href={row.meetLink} target="_blank" rel="noreferrer">
                        <Button type="button" size="sm">
                          <ExternalLink className="mr-1 h-4 w-4" />
                          Join Meet
                        </Button>
                      </a>
                    ) : null}
                    {row.canCancel ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => cancelMeet(row)}>
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default ClientMeetings;
