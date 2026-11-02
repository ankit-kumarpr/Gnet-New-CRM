import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Building2, Calendar, Pencil, UserRound, Users } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/Button";
import { plainRichText, richHtmlClass } from "../../components/ui/RichText";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { formatDate, priorityClass, priorityLabel } from "./projectOptions";
import { ProjectStatusControl } from "./ProjectStatus";
import { ClientWorkPlans } from "./ClientWorkPlans";
import { cn } from "../../utils/cn";
import { getServiceIcon, serviceIconTone } from "../../utils/serviceIcons";

export function ProjectView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("MANAGE_PROJECTS") || hasPermission("EDIT_PROJECTS");
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/admin/projects/details/${id}`);
        if (!cancelled) setProject(res.data.data);
      } catch (error) {
        if (!cancelled) toast.error(error.response?.data?.message || "Failed to load project");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Loading project...</div>;
  }
  if (!project) {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Project not found.</div>;
  }

  const assignments = project.serviceAssignments || [];
  const serviceList = (project.services || []).length
    ? project.services
    : assignments.map((row) => row.service).filter(Boolean);
  const workers = assignments.length
    ? [...new Set(assignments.map((row) => row.employee?.name).filter(Boolean))]
    : (project.workingEmployees || []).map((person) => person?.name).filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/projects")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Project</h1>
            <p className="text-sm text-slate-500">Added {formatDate(project.createdAt)}{project.createdBy?.name ? ` by ${project.createdBy.name}` : ""}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/dashboard/evening-reports")}>Evening reports</Button>
          {canEdit && (
            <Button onClick={() => navigate("/dashboard/projects", { state: { editId: project._id } })}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-800 to-teal-600 px-6 py-8 text-white">
          <h2 className="text-2xl font-semibold">{project.name}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", priorityClass(project.priority))}>{priorityLabel(project.priority)}</span>
            <ProjectStatusControl project={project} onUpdated={setProject} />
          </div>
        </div>
        <div className="grid gap-3 px-6 py-5 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <p className="flex items-start gap-2"><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />Client {project.client?.name || "—"}</p>
          <div className="sm:col-span-2 lg:col-span-2 xl:col-span-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Services</p>
            {serviceList.length === 0 ? (
              <p className="text-slate-500">—</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {serviceList.map((service) => {
                  const name = service?.name || "Service";
                  const Icon = getServiceIcon(name);
                  return (
                    <span
                      key={service?._id || name}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                        serviceIconTone(name),
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {name}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <p className="flex items-start gap-2"><UserRound className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />Reporting {project.reportingManager?.name || "—"}</p>
          <p className="flex items-start gap-2"><Calendar className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />EOD {formatDate(project.eod)}</p>
          <p className="flex items-start gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-4"><Users className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{workers.length ? workers.join(", ") : "—"}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Service assignments</h3>
        {assignments.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No service assignments yet.</p>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {assignments.map((row, index) => {
              const serviceName = row.service?.name || "Service";
              const Icon = getServiceIcon(serviceName);
              return (
                <div key={`${row.service?._id || index}`} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <span className={cn("inline-flex rounded-md border p-1", serviceIconTone(serviceName))}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      {serviceName}
                    </p>
                    <p className="text-sm font-medium text-emerald-700">{row.employee?.name || "Unassigned"}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">EOD {formatDate(row.eod || project.eod)}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{row.work || "—"}</p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Description</h3>
        {plainRichText(project.description) ? (
          <div className={cn("mt-3 text-sm text-slate-900", richHtmlClass)} dangerouslySetInnerHTML={{ __html: project.description }} />
        ) : (
          <p className="mt-3 text-sm text-slate-500">No description.</p>
        )}
      </section>

      <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Remark</h3>
        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-900">{project.remark || "—"}</p>
      </section>

      {project.client?._id && (
        <ClientWorkPlans
          client={project.client}
          project={project}
        />
      )}
    </div>
  );
}
