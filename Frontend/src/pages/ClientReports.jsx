import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, ClipboardList, MessageSquare } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { plainRichText, richHtmlClass } from "../components/ui/RichText";
import api from "../services/api";
import { cn } from "../utils/cn";

const dateLabel = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

function ReportDetail({ id, onBack }) {
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/auth/evening-reports/${id}`);
      setRow(res.data.data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Report load nahi hui");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const sendFeedback = async () => {
    if (!feedback.trim()) return toast.error("Feedback likho");
    try {
      setSaving(true);
      const res = await api.post(`/auth/evening-reports/${id}/feedback`, { body: feedback.trim() });
      setRow(res.data.data);
      setFeedback("");
      toast.success("Feedback bhej diya");
    } catch (error) {
      toast.error(error.response?.data?.message || "Feedback fail");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="rounded-xl border bg-white p-6 text-sm text-slate-500">Loading report...</p>;
  }
  if (!row) {
    return <p className="rounded-xl border bg-white p-6 text-sm text-slate-500">Report nahi mili.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Daily report</h1>
            <p className="text-sm text-slate-500">{dateLabel(row.date)}</p>
          </div>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          {row.status}
        </span>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Kaam ki detail</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Service</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Task</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">By</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(row.items || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">No items.</td>
                </tr>
              ) : (
                row.items.map((item, index) => (
                  <tr key={`${item.slotId}-${index}`}>
                    <td className="px-4 py-2 text-slate-800">{item.serviceName || "—"}</td>
                    <td className="px-4 py-2 text-slate-800">{item.label || "—"}</td>
                    <td className="px-4 py-2 text-slate-700">{item.assigneeName || "—"}</td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          item.status === "DONE"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-700",
                        )}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{item.note || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {plainRichText(row.notes) ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Work report</h3>
          <div
            className={cn("mt-2 text-sm text-slate-800", richHtmlClass)}
            dangerouslySetInnerHTML={{ __html: row.notes }}
          />
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <MessageSquare className="h-4 w-4" /> Feedback
        </h3>
        <ul className="space-y-2">
          {(row.feedback || []).length === 0 ? (
            <li className="text-sm text-slate-500">Abhi koi feedback nahi.</li>
          ) : (
            row.feedback.map((f) => (
              <li key={f._id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                <p className="font-medium text-slate-800">
                  {f.authorName || f.authorKind} · {dateLabel(f.createdAt)}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">{f.body}</p>
              </li>
            ))
          )}
        </ul>
        {row.canFeedback && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Team ke liye feedback..."
              disabled={saving}
            />
            <Button type="button" onClick={sendFeedback} disabled={saving}>
              Send
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

export function ClientReports() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get("/auth/evening-reports", { params: { limit: 50 } });
      setRows(res.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Reports load nahi hui");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) load();
  }, [id]);

  if (id) {
    return <ReportDetail id={id} onBack={() => navigate("/dashboard/my-reports")} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">My reports</h1>
        <p className="mt-1 text-sm text-slate-500">
          Approved daily / evening reports from your team. Open karke detail aur feedback de sakte ho.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Items</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Done</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">Loading...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  Abhi koi approved report nahi. Team approve karegi tab yahan dikhegi.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const items = row.items || [];
                const done = items.filter((item) => item.status === "DONE").length;
                return (
                  <tr key={row._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{dateLabel(row.date)}</td>
                    <td className="px-4 py-3 text-slate-700">{items.length}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {done}/{items.length}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/dashboard/my-reports/${row._id}`)}
                      >
                        <ClipboardList className="mr-1 h-4 w-4" />
                        View
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Dashboard pe bhi short list milti hai — poori list yahan se dekho.
        {" "}
        <Link to="/dashboard" className="font-medium text-emerald-700 hover:underline">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}

export default ClientReports;
