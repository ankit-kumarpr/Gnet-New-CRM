import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, Mail, Pencil, Phone, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/Button";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { formatDate, interviewLabel, interviewStatusClass } from "./interviewOptions";
import { cn } from "../../utils/cn";

const show = (value) => (value ? value : "—");

export function InterviewView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("MANAGE_INTERVIEWS") || hasPermission("EDIT_INTERVIEWS");
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/admin/interviews/details/${id}`);
        if (!cancelled) setInterview(res.data.data);
      } catch (error) {
        if (!cancelled) toast.error(error.response?.data?.message || "Failed to load interview");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Loading interview...</div>;
  }
  if (!interview) {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Interview not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/interviews")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Interview</h1>
            <p className="text-sm text-slate-500">Added {formatDate(interview.createdAt)}{interview.createdBy?.name ? ` by ${interview.createdBy.name}` : ""}</p>
          </div>
        </div>
        {canEdit && (
          <Button onClick={() => navigate("/dashboard/interviews", { state: { editId: interview._id } })}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-800 to-teal-600 px-6 py-8 text-white">
          <h2 className="text-2xl font-semibold">{interview.candidateName}</h2>
          <p className="mt-1 text-sm text-emerald-100">{interview.role} · {interview.round}</p>
          <span className={cn("mt-3 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", interviewStatusClass(interview.status))}>{interviewLabel(interview.status)}</span>
        </div>
        <div className="grid gap-3 px-6 py-5 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <p className="flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{show(interview.phone)}</p>
          <p className="flex items-start gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{show(interview.email)}</p>
          <p className="flex items-start gap-2"><UserRound className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{show(interview.interviewer?.name)}</p>
          <p className="flex items-start gap-2"><Calendar className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />Interview {formatDate(interview.interviewDate)}</p>
          <p className="flex items-start gap-2"><Calendar className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />Next round {interview.status === "NEXT_ROUND" ? formatDate(interview.nextRoundDate) : "—"}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Note</h3>
        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-900">{show(interview.note)}</p>
      </section>

      <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Resume</h3>
        {interview.resume?.url ? (
          <a href={interview.resume.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-medium text-emerald-700 hover:underline">{interview.resume.name || "Open resume"}</a>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No resume uploaded.</p>
        )}
      </section>
    </div>
  );
}
