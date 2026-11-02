import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Mail, MapPin, Phone, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/Button";
import { ProfilePhotoEditor } from "../../components/profile/ProfilePhotoEditor";
import { NotificationPrefsPanel } from "../../components/notifications/NotificationPrefsPanel";
import { plainRichText, richHtmlClass } from "../../components/ui/RichText";
import { cn } from "../../utils/cn";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const when = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const showDate = (value) => (value ? when.format(new Date(value)) : "—");
const showMoney = (value) => (value === 0 || value ? money.format(value) : "—");

const PERMISSION_LABELS = {
  VIEW_EMPLOYEES: "View employees",
  CREATE_EMPLOYEES: "Create employees",
  EDIT_EMPLOYEES: "Edit employees",
  DELETE_EMPLOYEES: "Delete employees",
  MANAGE_EMPLOYEES: "Manage employees",
  VIEW_DEPARTMENTS: "View departments",
  CREATE_DEPARTMENTS: "Create departments",
  EDIT_DEPARTMENTS: "Edit departments",
  DELETE_DEPARTMENTS: "Delete departments",
  MANAGE_DEPARTMENTS: "Manage departments",
  VIEW_DESIGNATIONS: "View designations",
  CREATE_DESIGNATIONS: "Create designations",
  EDIT_DESIGNATIONS: "Edit designations",
  DELETE_DESIGNATIONS: "Delete designations",
  MANAGE_DESIGNATIONS: "Manage designations",
  VIEW_DAILY_TASKS: "View daily tasks",
  CREATE_DAILY_TASKS: "Create daily tasks",
  EDIT_DAILY_TASKS: "Edit daily tasks",
  DELETE_DAILY_TASKS: "Delete daily tasks",
  MANAGE_DAILY_TASKS: "Manage daily tasks",
  MANAGE_PERMISSIONS: "Manage permissions",
};

const addressLine = (address) => {
  if (!address) return "";
  return [address.street, address.locality, address.landmark, address.city, address.state, address.pincode].filter(Boolean).join(", ");
};

export function EmployeeProfile() {
  const { id } = useParams();
  const mine = !id;
  const navigate = useNavigate();
  const { hasPermission, updateUser } = useAuth();
  const canEdit = hasPermission("MANAGE_EMPLOYEES") || hasPermission("EDIT_EMPLOYEES");
  const [employee, setEmployee] = useState(null);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get(mine ? "/auth/profile" : `/admin/employees/details/${id}`);
        if (cancelled) return;
        setEmployee(res.data.data);
        setTeam(res.data.team || []);
      } catch (error) {
        if (!cancelled) toast.error(error.response?.data?.message || "Failed to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id, mine]);

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Loading profile...</div>;
  }
  if (!employee) {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Employee not found.</div>;
  }

  const hasResponsibility = Boolean(plainRichText(employee.responsibility));
  const workRows = [
    ["Department", employee.department?.name],
    ["Designation", employee.designation?.name],
    ["Employee type", employee.employeeType?.name],
    ["Work mode", employee.workMode?.name],
    ["Salary", employee.salary === 0 || employee.salary ? showMoney(employee.salary) : ""],
    ["Joining date", employee.joiningDate ? showDate(employee.joiningDate) : ""],
    ["Date of birth", employee.dob ? showDate(employee.dob) : ""],
  ].filter(([, value]) => value);
  const showWork = workRows.length > 0 || hasResponsibility || employee.reportingManager?.name;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(mine ? "/dashboard" : "/dashboard/employees")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{mine ? "My profile" : "Employee profile"}</h1>
            <p className="text-sm text-slate-500">Joined {employee.createdAt ? when.format(new Date(employee.createdAt)) : "—"}</p>
          </div>
        </div>
        {canEdit && employee.userType === "EMPLOYEE" && (
          <div className="flex gap-2">
            {!mine && (
              <Button variant="outline" onClick={() => navigate(`/dashboard/employees/${employee._id}/offer-letter`)}>
                <FileText className="mr-2 h-4 w-4" />
                Offer letter
              </Button>
            )}
            <Button onClick={() => navigate(`/dashboard/employees/edit/${employee._id}`)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-800 to-teal-600 px-6 py-8 text-white">
          <div className="flex flex-wrap items-center gap-5">
            <ProfilePhotoEditor
              name={employee.name}
              avatarUrl={employee.avatar?.url || employee.avatarUrl || ""}
              canEdit={mine}
              onUpdated={(url, avatar) => {
                setEmployee((current) => current ? {
                  ...current,
                  avatarUrl: url,
                  avatar: avatar || { url, publicId: current.avatar?.publicId || "" },
                } : current);
                if (mine) updateUser({ avatarUrl: url, avatar: avatar || { url, publicId: "" } });
              }}
            />
            <div>
              <h2 className="text-2xl font-semibold">{employee.name}</h2>
              {mine && <p className="mt-1 text-xs text-emerald-100/90">Tap the camera icon to update your photo</p>}
              <p className="text-sm text-emerald-100">{[employee.employeeId, employee.designation?.name || employee.userType].filter(Boolean).join(" · ")}</p>
              <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${employee.status === "ACTIVE" ? "border-emerald-300/40 bg-emerald-400/20 text-emerald-50" : "border-rose-200 bg-rose-500/20 text-rose-50"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${employee.status === "ACTIVE" ? "bg-emerald-300" : "bg-rose-300"}`} />
                {employee.status || "ACTIVE"}
              </span>
            </div>
          </div>
        </div>
        <div className="grid gap-3 px-6 py-5 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <p className="flex items-start gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{employee.email}</p>
          <p className="flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{employee.phone}</p>
          {addressLine(employee.address) && (
            <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{addressLine(employee.address)}</p>
          )}
        </div>
      </div>

      {(showWork || team.length > 0) && (
        <div className={cn("grid gap-6", showWork && team.length > 0 && "lg:grid-cols-2")}>
          {showWork && (
            <section className="rounded-2xl border border-emerald-100 bg-white/90 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Work</h3>
              <dl className="mt-3 space-y-2 text-sm">
                {workRows.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4"><dt className="text-slate-500">{label}</dt><dd className="text-right text-slate-900">{value}</dd></div>
                ))}
                {hasResponsibility && (
                  <div>
                    <dt className="text-slate-500">Responsibility</dt>
                    <dd className={cn("mt-1 text-slate-900", richHtmlClass)} dangerouslySetInnerHTML={{ __html: employee.responsibility }} />
                  </div>
                )}
                {employee.reportingManager?.name && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Reports to</dt>
                    <dd className="text-right text-slate-900">
                      <Link className="text-emerald-700 hover:underline" to={`/dashboard/employees/${employee.reportingManager._id}`}>{employee.reportingManager.name}</Link>
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          {team.length > 0 && (
            <section className="rounded-2xl border border-emerald-100 bg-white/90 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Team</h3>
              <ul className="mt-3 divide-y divide-emerald-50">
                {team.map((person) => (
                  <li key={person._id} className="flex items-center justify-between py-2">
                    <div>
                      <Link className="text-sm font-medium text-emerald-700 hover:underline" to={`/dashboard/employees/${person._id}`}>{person.name}</Link>
                      {person.employeeId && <p className="text-xs text-slate-500">{person.employeeId}</p>}
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${person.status === "ACTIVE" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{person.status || "ACTIVE"}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {mine && <NotificationPrefsPanel title="My notification preferences" />}

      {(employee.documents || []).length > 0 && (
        <section className="rounded-2xl border border-emerald-100 bg-white/90 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Documents</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {employee.documents.map((doc) => (
              <li key={doc._id}>
                <a href={doc.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-gradient-to-r from-white to-emerald-50 px-3 py-2 text-sm text-emerald-800 hover:border-emerald-200">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">{doc.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(employee.permissions || []).length > 0 && (
        <section className="rounded-2xl border border-emerald-100 bg-white/90 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Permissions</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {employee.permissions.map((key) => (
              <span key={key} className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">{PERMISSION_LABELS[key] || key}</span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
