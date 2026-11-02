import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, Paperclip, Pencil, Users } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/Button";
import { plainRichText, richHtmlClass } from "../../components/ui/RichText";
import api from "../../services/api";
import { formatDate, workPriorityClass, workPriorityLabel } from "./urgentWorkOptions";
import { cn } from "../../utils/cn";

export function UrgentWorkView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/admin/urgent-works/details/${id}`);
        if (!cancelled) setRow(res.data.data);
      } catch (error) {
        if (!cancelled) toast.error(error.response?.data?.message || "Failed to load urgent work");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Loading urgent work...</div>;
  if (!row) return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Urgent work not found.</div>;

  const names = (row.assignees || []).map((person) => person?.name).filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/urgent-work")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Urgent work</h1>
            <p className="text-sm text-slate-500">Added {formatDate(row.createdAt)}{row.createdBy?.name ? ` by ${row.createdBy.name}` : ""}</p>
          </div>
        </div>
        {row.canEdit && (
          <Button onClick={() => navigate("/dashboard/urgent-work", { state: { editId: row._id } })}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-800 to-teal-600 px-6 py-8 text-white">
          <h2 className="text-2xl font-semibold">{row.project?.name || "Project"}</h2>
          <span className={cn("mt-3 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", workPriorityClass(row.priority))}>{workPriorityLabel(row.priority)}</span>
        </div>
        <div className="grid gap-3 px-6 py-5 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <p className="flex items-start gap-2"><Calendar className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />EOD {formatDate(row.eod)}</p>
          <p className="flex items-start gap-2"><Users className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{names.length ? names.join(", ") : "—"}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Work</h3>
        {plainRichText(row.work) ? (
          <div className={cn("mt-3 text-sm text-slate-900", richHtmlClass)} dangerouslySetInnerHTML={{ __html: row.work }} />
        ) : (
          <p className="mt-3 text-sm text-slate-500">No work written.</p>
        )}
      </section>

      {row.file?.url && (
        <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">File</h3>
          <a href={row.file.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:underline">
            <Paperclip className="h-4 w-4" />
            {row.file.name || "Open file"}
          </a>
        </section>
      )}
    </div>
  );
}
