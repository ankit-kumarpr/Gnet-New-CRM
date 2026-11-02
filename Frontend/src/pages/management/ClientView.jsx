import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Mail, MapPin, MessageCircle, Pencil, Phone } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/Button";
import { richHtmlClass } from "../../components/ui/RichText";
import { cn } from "../../utils/cn";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { ClientWorkPlans } from "./ClientWorkPlans";

const when = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const show = (value) => (value ? value : "—");

const addressLine = (address) => {
  if (!address) return "";
  return [address.street, address.landmark, address.city, address.state, address.pincode].filter(Boolean).join(", ");
};

export function ClientView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("MANAGE_CLIENTS") || hasPermission("EDIT_CLIENTS");
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentBusy, setPaymentBusy] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/admin/clients/details/${id}`);
        if (!cancelled) setClient(res.data.data);
      } catch (error) {
        if (!cancelled) toast.error(error.response?.data?.message || "Failed to load client");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id]);

  const markPayment = async (paymentId, paid) => {
    try {
      setPaymentBusy(paymentId);
      const res = await api.patch(`/admin/clients/${id}/payments/${paymentId}/paid`, { paid });
      setClient(res.data.data);
      toast.success(paid ? "Payment marked done — alerts stopped" : "Payment marked unpaid");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update payment");
    } finally {
      setPaymentBusy("");
    }
  };

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Loading client...</div>;
  }
  if (!client) {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Client not found.</div>;
  }

  const initials = client.name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const line = addressLine(client.address);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/clients")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Client</h1>
            <p className="text-sm text-slate-500">Added {client.createdAt ? when.format(new Date(client.createdAt)) : "—"}</p>
          </div>
        </div>
        {canEdit && (
          <Button onClick={() => navigate("/dashboard/clients", { state: { editId: client._id } })}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-800 to-teal-600 px-6 py-8 text-white">
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-300 text-2xl font-semibold text-white shadow-md">{initials || "C"}</div>
            <div>
              <h2 className="text-2xl font-semibold">{client.name}</h2>
              <p className="text-sm text-emerald-100">
                {client.clientId ? `${client.clientId} · ` : ""}
                {(client.services || []).map((service) => service.name).join(", ") || "No service"}
              </p>
              {client.reportingManager?.name ? (
                <p className="mt-1 text-sm text-emerald-50">Reporting manager: {client.reportingManager.name}</p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="grid gap-3 px-6 py-5 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
          <p className="flex items-start gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{show(client.email)}</p>
          <p className="flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{show(client.phone)}</p>
          <p className="flex items-start gap-2"><MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{show(client.whatsapp)}</p>
          <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{line || "No address saved"}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Address</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Street</dt><dd className="text-right text-slate-900">{show(client.address?.street)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Landmark</dt><dd className="text-right text-slate-900">{show(client.address?.landmark)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">City</dt><dd className="text-right text-slate-900">{show(client.address?.city)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">State</dt><dd className="text-right text-slate-900">{show(client.address?.state)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Pincode</dt><dd className="text-right text-slate-900">{show(client.address?.pincode)}</dd></div>
          </dl>
        </section>

        <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Payment / renewal</h3>
          <p className="mt-1 text-xs text-slate-500">Alerts start 5 days before unpaid renewal dates. Mark paid to stop them.</p>
          {!(client.payments || []).length ? (
            <p className="mt-3 text-sm text-slate-500">No payment schedule set.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {[...(client.payments || [])]
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .map((row, index) => (
                  <li key={row._id || index} className={`rounded-lg border px-3 py-2 ${row.paid ? "border-emerald-200 bg-emerald-50/70" : "border-slate-100"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-slate-900">
                        {row.date ? when.format(new Date(row.date)) : "—"}
                      </span>
                      <span className="text-slate-700">
                        {row.amount === null || row.amount === undefined
                          ? "—"
                          : `₹${Number(row.amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`}
                      </span>
                    </div>
                    {row.note ? <p className="mt-1 text-xs text-slate-500">{row.note}</p> : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {row.paid ? (
                        <>
                          <span className="text-xs font-medium text-emerald-700">
                            Paid{row.paidAt ? ` · ${when.format(new Date(row.paidAt))}` : ""}
                          </span>
                          {canEdit && row._id ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={paymentBusy === row._id}
                              onClick={() => markPayment(row._id, false)}
                            >
                              Undo paid
                            </Button>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <span className="text-xs font-medium text-amber-700">Unpaid · notifying</span>
                          {canEdit && row._id ? (
                            <Button
                              type="button"
                              size="sm"
                              disabled={paymentBusy === row._id}
                              onClick={() => markPayment(row._id, true)}
                            >
                              {paymentBusy === row._id ? "Saving..." : "Mark payment done"}
                            </Button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Remark</h3>
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-900">{show(client.remark)}</p>
        </section>
      </div>

      <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Services</h3>
        {(client.services || []).length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No service assigned.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {client.services.map((service) => (
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

      <ClientWorkPlans client={client} />
    </div>
  );
}
