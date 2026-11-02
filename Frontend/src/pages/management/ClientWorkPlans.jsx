import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import api from "../../services/api";

const selectClass = "h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-600";
const dayLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", weekday: "short" });

const emptyQuantity = () => ([
  { key: "REEL", label: "Reel", quantity: 10 },
  { key: "POST", label: "Post", quantity: 5 },
  { key: "CAROUSEL", label: "Carousel", quantity: 5 },
]);

const emptyPhases = () => ([
  { key: "DESIGN", label: "Design", percent: 20 },
  { key: "DEVELOP", label: "Development", percent: 50 },
  { key: "CONTENT", label: "Content", percent: 15 },
  { key: "QA", label: "QA & launch", percent: 15 },
]);

const todayInput = () => new Date().toISOString().slice(0, 10);

const plusDaysInput = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const planTotalsLine = (plan) => {
  if (plan.mode === "QUANTITY") {
    const parts = (plan.deliverables || [])
      .filter((row) => Number(row.quantity) > 0)
      .map((row) => `${row.quantity} ${row.label}`);
    return parts.length ? parts.join(", ") : "";
  }
  const parts = (plan.phases || [])
    .filter((row) => Number(row.percent) > 0)
    .map((row) => `${row.label} ${row.percent}%`);
  return parts.length ? parts.join(", ") : "";
};

export function ClientWorkPlans({ client, project = null }) {
  const [plans, setPlans] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    service: "",
    mode: "QUANTITY",
    startDate: todayInput(),
    endDate: plusDaysInput(20),
    reportingManager: "",
    assignees: [],
    deliverables: emptyQuantity(),
    phases: emptyPhases(),
  });

  const load = async () => {
    try {
      setLoading(true);
      const url = project?._id
        ? `/admin/work-plans/project/${project._id}`
        : `/admin/work-plans/client/${client._id}`;
      const res = await api.get(url);
      setPlans(res.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load work plans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    api.get("/admin/work-plans/employees")
      .then((res) => setPeople(res.data.data || []))
      .catch(() => {});
  }, [client._id, project?._id]);

  const services = project
    ? (project.services || []).map((service) => (service?._id ? service : { _id: service, name: "Service" }))
    : (client.services || []);
  const canCreate = useMemo(
    () => services.some((service) => !plans.some((plan) => String(plan.service?._id || plan.service) === String(service._id) && plan.canEdit !== false)),
    [services, plans],
  );

  const openCreate = async (service) => {
    setEditing(null);
    let mode = "QUANTITY";
    let deliverables = emptyQuantity();
    let phases = emptyPhases();
    try {
      const res = await api.get("/admin/work-plans/defaults", { params: { service: service._id } });
      mode = res.data.data?.mode || mode;
      if (res.data.data?.deliverables?.length) deliverables = res.data.data.deliverables.map((row) => ({ ...row, quantity: row.quantity || 0 }));
      if (res.data.data?.phases?.length) phases = res.data.data.phases;
      if (mode === "QUANTITY") {
        deliverables = emptyQuantity();
      }
    } catch {
      // defaults already set
    }
    setForm({
      service: service._id,
      mode,
      startDate: todayInput(),
      endDate: project?.eod ? String(project.eod).slice(0, 10) : plusDaysInput(20),
      reportingManager: project?.reportingManager?._id || "",
      assignees: [],
      deliverables,
      phases,
    });
    setShowForm(true);
  };

  const openEdit = (plan) => {
    if (!plan.canEdit) {
      toast.error("Only admin or senior can edit this plan");
      return;
    }
    setEditing(plan);
    setForm({
      service: plan.service?._id || plan.service,
      mode: plan.mode,
      startDate: plan.startDate ? String(plan.startDate).slice(0, 10) : todayInput(),
      endDate: plan.endDate ? String(plan.endDate).slice(0, 10) : plusDaysInput(20),
      reportingManager: plan.reportingManager?._id || "",
      assignees: (plan.assignees || []).map((person) => person._id || person),
      deliverables: plan.deliverables?.length ? plan.deliverables.map((row) => ({ ...row })) : emptyQuantity(),
      phases: plan.phases?.length ? plan.phases.map((row) => ({ ...row })) : emptyPhases(),
    });
    setShowForm(true);
  };

  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const updateRow = (listName, index, key, value) => {
    setForm((current) => ({
      ...current,
      [listName]: current[listName].map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    }));
  };

  const addRow = (listName) => {
    if (listName === "deliverables") {
      setForm((current) => ({
        ...current,
        deliverables: [...current.deliverables, { key: "", label: "", quantity: 1 }],
      }));
      return;
    }
    setForm((current) => ({
      ...current,
      phases: [...current.phases, { key: "", label: "", percent: 10 }],
    }));
  };

  const removeRow = (listName, index) => {
    setForm((current) => ({
      ...current,
      [listName]: current[listName].filter((_, i) => i !== index),
    }));
  };

  const toggleAssignee = (id) => {
    setForm((current) => ({
      ...current,
      assignees: current.assignees.includes(id)
        ? current.assignees.filter((item) => item !== id)
        : [...current.assignees, id],
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.service) {
      toast.error("Select a service");
      return;
    }
    if (!form.reportingManager) {
      toast.error("Select reporting senior");
      return;
    }
    if (form.endDate < form.startDate) {
      toast.error("Deadline cannot be before start date");
      return;
    }

    const payload = {
      client: client._id || client,
      project: project?._id || null,
      service: form.service,
      mode: form.mode,
      startDate: form.startDate,
      endDate: form.endDate,
      reportingManager: form.reportingManager,
      assignees: form.assignees,
      deliverables: form.deliverables,
      phases: form.phases,
    };

    try {
      setSaving(true);
      if (editing) {
        await api.patch(`/admin/work-plans/update/${editing._id}`, payload);
        toast.success("Plan updated");
      } else {
        await api.post("/admin/work-plans/create", payload);
        toast.success("Work plan saved");
      }
      setShowForm(false);
      setEditing(null);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not save plan");
    } finally {
      setSaving(false);
    }
  };

  const removePlan = async (plan) => {
    if (!plan.canEdit) return;
    if (!window.confirm("Delete this work plan?")) return;
    try {
      await api.delete(`/admin/work-plans/${plan._id}`);
      toast.success("Plan deleted");
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not delete plan");
    }
  };

  const unusedServices = services.filter(
    (service) => !plans.some((plan) => String(plan.service?._id || plan.service) === String(service._id)),
  );

  return (
    <section className="space-y-4 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CalendarRange className="h-4 w-4 text-emerald-700" />
            Work plans
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Service-wise targets (quantity / %). Auto day-divide nahi hota. Admin / senior edit kar sakte hain.
          </p>
        </div>
        {!showForm && unusedServices.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {unusedServices.map((service) => (
              <Button key={service._id} type="button" variant="outline" onClick={() => openCreate(service)}>
                <Plus className="mr-1 h-4 w-4" />
                Plan · {service.name}
              </Button>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Service</label>
              <select className={selectClass} value={form.service} onChange={(e) => setField("service", e.target.value)} disabled={!!editing || saving}>
                <option value="">Select</option>
                {services.map((service) => (
                  <option key={service._id} value={service._id}>{service.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Plan type</label>
              <select className={selectClass} value={form.mode} onChange={(e) => setField("mode", e.target.value)} disabled={saving}>
                <option value="QUANTITY">Quantity (posts / reels…)</option>
                <option value="PERCENT">Percent (website / SEO…)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Start</label>
              <Input type="date" value={form.startDate} onChange={(e) => setField("startDate", e.target.value)} disabled={saving} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Deadline</label>
              <Input type="date" value={form.endDate} onChange={(e) => setField("endDate", e.target.value)} disabled={saving} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Reporting senior *</label>
              <select className={selectClass} value={form.reportingManager} onChange={(e) => setField("reportingManager", e.target.value)} disabled={saving}>
                <option value="">Select senior</option>
                {people.map((person) => (
                  <option key={person._id} value={person._id}>{person.name}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">Assignees</p>
              <div className="max-h-28 overflow-auto rounded-md border border-slate-200 bg-white p-2">
                {people.length === 0 ? (
                  <p className="text-xs text-slate-500">No employees</p>
                ) : people.map((person) => (
                  <label key={person._id} className="flex items-center gap-2 px-1 py-1 text-sm text-slate-700">
                    <input type="checkbox" checked={form.assignees.includes(person._id)} onChange={() => toggleAssignee(person._id)} disabled={saving} />
                    {person.name}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Assigned team for this plan (no auto share).</p>
            </div>
          </div>

          {form.mode === "QUANTITY" ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">What to make (+ add more)</p>
                <Button type="button" variant="outline" onClick={() => addRow("deliverables")} disabled={saving}>
                  <Plus className="mr-1 h-4 w-4" /> Add
                </Button>
              </div>
              <div className="space-y-2">
                {form.deliverables.map((row, index) => (
                  <div key={index} className="grid grid-cols-[1fr_100px_40px] gap-2">
                    <Input
                      placeholder="e.g. Reel / Post / Carousel"
                      value={row.label}
                      onChange={(e) => updateRow("deliverables", index, "label", e.target.value)}
                      disabled={saving}
                    />
                    <Input
                      type="number"
                      min={0}
                      value={row.quantity}
                      onChange={(e) => updateRow("deliverables", index, "quantity", e.target.value)}
                      disabled={saving}
                    />
                    <button type="button" className="text-slate-400 hover:text-rose-600" onClick={() => removeRow("deliverables", index)} disabled={saving}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">Phases (% must total ≤ 100)</p>
                <Button type="button" variant="outline" onClick={() => addRow("phases")} disabled={saving}>
                  <Plus className="mr-1 h-4 w-4" /> Add
                </Button>
              </div>
              <div className="space-y-2">
                {form.phases.map((row, index) => (
                  <div key={index} className="grid grid-cols-[1fr_100px_40px] gap-2">
                    <Input
                      placeholder="e.g. Design / Development"
                      value={row.label}
                      onChange={(e) => updateRow("phases", index, "label", e.target.value)}
                      disabled={saving}
                    />
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={row.percent}
                      onChange={(e) => updateRow("phases", index, "percent", e.target.value)}
                      disabled={saving}
                    />
                    <button type="button" className="text-slate-400 hover:text-rose-600" onClick={() => removeRow("phases", index)} disabled={saving}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditing(null); }} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Save plan" : "Save plan"}</Button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading plans...</p>
      ) : plans.length === 0 ? (
        <p className="text-sm text-slate-500">
          {canCreate || unusedServices.length
            ? "No plan yet. Create one per service with quantity or % targets."
            : "No work plan visible for you on this client."}
        </p>
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => (
            <div key={plan._id} className="rounded-xl border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{plan.service?.name || "Service"}</p>
                  <p className="text-xs text-slate-500">
                    {plan.mode === "QUANTITY" ? "Quantity plan" : "Percent plan"}
                    {" · "}
                    {plan.startDate ? dayLabel.format(new Date(plan.startDate)) : "—"}
                    {" → "}
                    {plan.endDate ? dayLabel.format(new Date(plan.endDate)) : "—"}
                    {" · "}
                    Senior: {plan.reportingManager?.name || "—"}
                    {!plan.canEdit ? " · view only (your items)" : ""}
                  </p>
                  {planTotalsLine(plan) ? (
                    <p className="mt-1 text-xs font-medium text-emerald-800">
                      Total plan: {planTotalsLine(plan)}
                    </p>
                  ) : null}
                </div>
                {plan.canEdit && (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => openEdit(plan)}>Edit plan</Button>
                    <Button type="button" variant="outline" onClick={() => removePlan(plan)}>Delete</Button>
                  </div>
                )}
              </div>
              <div className="space-y-2 px-4 py-3">
                {plan.mode === "QUANTITY" ? (
                  (plan.deliverables || []).filter((row) => Number(row.quantity) > 0).length ? (
                    (plan.deliverables || [])
                      .filter((row) => Number(row.quantity) > 0)
                      .map((row) => (
                        <div
                          key={row.key || row.label}
                          className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-slate-900">{row.label}</span>
                          <span className="text-slate-600">× {row.quantity}</span>
                        </div>
                      ))
                  ) : (
                    <p className="text-sm text-slate-500">No deliverable targets.</p>
                  )
                ) : (plan.phases || []).filter((row) => Number(row.percent) > 0).length ? (
                  (plan.phases || [])
                    .filter((row) => Number(row.percent) > 0)
                    .map((row) => (
                      <div
                        key={row.key || row.label}
                        className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-slate-900">{row.label}</span>
                        <span className="text-slate-600">{row.percent}%</span>
                      </div>
                    ))
                ) : (
                  <p className="text-sm text-slate-500">No phase targets.</p>
                )}
                {(plan.assignees || []).length > 0 && (
                  <p className="pt-1 text-xs text-slate-500">
                    Team: {(plan.assignees || []).map((person) => person.name || person).filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
