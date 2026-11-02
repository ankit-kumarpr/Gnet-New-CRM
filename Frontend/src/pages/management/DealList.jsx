import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Search } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Pager } from "../../components/ui/Pager";
import api from "../../services/api";
import { LEAD_SOURCES, LEAD_STATUSES, formatDateTime, formatMoney, leadLabel, statusClass } from "./leadOptions";
import { cn } from "../../utils/cn";

const selectClass = "h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-600";

const copy = {
  sale: {
    title: "Sales",
    text: "Converted leads. The sale counts for whoever marked it converted, and for the person it is assigned to.",
    path: "/admin/sales/list",
    dateLabel: "Converted",
  },
  payment: {
    title: "Payments",
    text: "Leads marked as payment, with the sale and payment details.",
    path: "/admin/payments/list",
    dateLabel: "Payment",
  },
  revenue: {
    title: "Revenue",
    text: "Amount collected when a lead is marked payment. The total follows the filters.",
    path: "/admin/revenue/list",
    dateLabel: "Payment",
  },
};

export function DealList({ mode }) {
  const navigate = useNavigate();
  const pageCopy = copy[mode];
  const [rows, setRows] = useState([]);
  const [people, setPeople] = useState([]);
  const [seesAll, setSeesAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [soldBy, setSoldBy] = useState("");
  const [paymentBy, setPaymentBy] = useState("");
  const [totalAmount, setTotalAmount] = useState(0);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    api.get("/admin/leads/assignees", { params: { scope: "directory" } })
      .then((res) => setPeople(res.data.data || []))
      .catch(() => toast.error("Failed to load team"));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get(pageCopy.path, {
          params: { search, source, status, assignedTo, soldBy, paymentBy, from, to, page, limit },
        });
        if (cancelled) return;
        setRows(res.data.data || []);
        setSeesAll(Boolean(res.data.seesAll));
        setTotalAmount(Number(res.data.totalAmount) || 0);
        setTotal(res.data.pagination?.total || 0);
        setTotalPages(res.data.pagination?.pages || 1);
      } catch (error) {
        if (!cancelled) toast.error(error.response?.data?.message || "Failed to load records");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [pageCopy.path, search, source, status, assignedTo, soldBy, paymentBy, from, to, page, limit]);

  const paid = mode === "payment" || mode === "revenue";
  const columns = paid ? 12 : 9;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{pageCopy.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{pageCopy.text}</p>
      </div>

      {mode === "revenue" && (
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total revenue</p>
          <p className="mt-1 text-3xl font-semibold text-slate-900">{formatMoney(totalAmount)}</p>
          <p className="mt-1 text-sm text-slate-500">{total} payment{total === 1 ? "" : "s"} in this filter</p>
        </div>
      )}

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        <div className="relative md:col-span-2 xl:col-span-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search name, phone, company, or address..." className="pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        </div>
        <select className={selectClass} value={source} onChange={(event) => { setSource(event.target.value); setPage(1); }}>
          <option value="">All sources</option>
          {LEAD_SOURCES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        {mode === "sale" && (
          <select className={selectClass} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="">Converted and payment</option>
            <option value="CONVERTED">Converted</option>
            <option value="PAYMENT">Payment</option>
          </select>
        )}
        {seesAll && (
          <>
            <select className={selectClass} value={assignedTo} onChange={(event) => { setAssignedTo(event.target.value); setPage(1); }}>
              <option value="">All assigned</option>
              {people.map((person) => <option key={person._id} value={person._id}>{person.name}</option>)}
            </select>
            <select className={selectClass} value={soldBy} onChange={(event) => { setSoldBy(event.target.value); setPage(1); }}>
              <option value="">All sale by</option>
              {people.map((person) => <option key={person._id} value={person._id}>{person.name}</option>)}
            </select>
            {paid && (
              <select className={selectClass} value={paymentBy} onChange={(event) => { setPaymentBy(event.target.value); setPage(1); }}>
                <option value="">All payment by</option>
                {people.map((person) => <option key={person._id} value={person._id}>{person.name}</option>)}
              </select>
            )}
          </>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">{pageCopy.dateLabel} from</label>
          <Input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">{pageCopy.dateLabel} to</label>
          <Input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {["Lead", "Phone", "Address", "Source", "Services", "Assigned", "Sale by", "Converted", ...(paid ? ["Payment", "Payment by", "Amount"] : []), "Actions"].map((heading) => (
                  <th key={heading} className={cn("px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500", heading === "Actions" && "text-right")}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={columns} className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={columns} className="px-4 py-8 text-center text-slate-500">No records found.</td></tr>
              ) : rows.map((row) => (
                <tr key={row._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm">
                    <button type="button" className="text-left font-medium text-slate-900 hover:text-emerald-700" onClick={() => navigate(`/dashboard/leads/${row._id}`)}>{row.name}</button>
                    {row.companyName && <div className="text-slate-500">{row.companyName}</div>}
                    <span className={cn("mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", statusClass(row.status))}>{leadLabel(LEAD_STATUSES, row.status)}</span>
                    {row.remark && <p className="mt-1 max-w-xs text-xs text-slate-500">{row.remark}</p>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{row.phone}</td>
                  <td className="max-w-xs px-4 py-3 text-sm text-slate-700">{row.address || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{leadLabel(LEAD_SOURCES, row.source)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{(row.services || []).map((service) => service.name).filter(Boolean).join(", ") || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{row.assignedTo?.name || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{row.soldBy?.name || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{formatDateTime(row.convertedAt)}</td>
                  {paid && <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{formatDateTime(row.paymentAt)}</td>}
                  {paid && <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{row.paymentBy?.name || "—"}</td>}
                  {paid && <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">{formatMoney(row.amount)}</td>}
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" title="View" onClick={() => navigate(`/dashboard/leads/${row._id}`)}><Eye className="h-4 w-4 text-slate-500" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={page} pages={totalPages} limit={limit} total={total} onPage={setPage} onLimit={(size) => { setLimit(size); setPage(1); }} />
      </div>
    </div>
  );
}

export function Sales() {
  return <DealList mode="sale" />;
}

export function Payments() {
  return <DealList mode="payment" />;
}

export function Revenue() {
  return <DealList mode="revenue" />;
}
