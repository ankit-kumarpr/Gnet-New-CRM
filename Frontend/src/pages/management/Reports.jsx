import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Input } from "../../components/ui/Input";
import { Pager } from "../../components/ui/Pager";
import api from "../../services/api";

const selectClass = "h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-600";

const FILTER_KEYS = ["employee", "assigned", "source", "service", "status", "priority", "project", "manager", "department", "leaveType", "interviewer", "overdue", "bucket", "search"];

const emptyFilters = () => Object.fromEntries(FILTER_KEYS.map((key) => [key, ""]));

export function Reports() {
  const [params, setParams] = useSearchParams();
  const type = params.get("type") || "overview";
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const page = Math.max(parseInt(params.get("page") || "1", 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(params.get("limit") || "10", 10) || 10, 1), 100);
  const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) || ""]));
  const filterKey = FILTER_KEYS.map((key) => filters[key]).join("|");
  const [groups, setGroups] = useState([]);
  const [options, setOptions] = useState({ people: [], services: [], projects: [], departments: [], leaveTypes: [] });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const current = groups.flatMap((group) => group.reports).find((item) => item.id === type);

  const setQuery = (patch, resetPage = true) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === "" || value == null) next.delete(key);
      else next.set(key, String(value));
    });
    if (resetPage) next.delete("page");
    setParams(next);
  };

  useEffect(() => {
    let cancelled = false;
    api.get("/admin/reports/catalog")
      .then((res) => { if (!cancelled) setGroups(res.data.data || []); })
      .catch((error) => { if (!cancelled) toast.error(error.response?.data?.message || "Failed to load reports"); });
    api.get("/admin/reports/options")
      .then((res) => { if (!cancelled) setOptions(res.data.data || { people: [], services: [], projects: [], departments: [], leaveTypes: [] }); })
      .catch(() => { if (!cancelled) toast.error("Failed to load report filters"); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const query = { type, from, to, page, limit };
        FILTER_KEYS.forEach((key) => {
          if (filters[key]) query[key] = filters[key];
        });
        const res = await api.get("/admin/reports", { params: query });
        if (!cancelled) setReport(res.data.data);
      } catch (error) {
        if (!cancelled) {
          setReport(null);
          toast.error(error.response?.data?.message || "Failed to load the report");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [type, from, to, page, limit, filterKey]);

  const lists = {
    people: options.people || [],
    services: options.services || [],
    projects: options.projects || [],
    departments: options.departments || [],
    leaveTypes: options.leaveTypes || [],
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reports</h1>
        <p className="mt-1 text-sm text-slate-500">Pick a report. Filters, dates, and pages stay in the address, so the same view can be opened again.</p>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="report-type">Report</label>
          <select
            id="report-type"
            className={selectClass}
            value={type}
            onChange={(event) => setQuery({ type: event.target.value, ...emptyFilters() })}
          >
            {groups.map((group) => (
              <optgroup key={group.name} label={group.name}>
                {group.reports.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        {current?.dates !== false && (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">From</label>
              <Input type="date" value={from} onChange={(event) => setQuery({ from: event.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">To</label>
              <Input type="date" value={to} onChange={(event) => setQuery({ to: event.target.value })} />
            </div>
          </>
        )}
        {(current?.filters || []).map((filter) => (
          <div key={filter.key} className={filter.kind === "search" ? "md:col-span-2 xl:col-span-4" : undefined}>
            <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor={`report-${filter.key}`}>{filter.label}</label>
            {filter.kind === "search" ? (
              <Input id={`report-${filter.key}`} placeholder="Search" value={filters[filter.key]} onChange={(event) => setQuery({ [filter.key]: event.target.value })} />
            ) : (
              <select id={`report-${filter.key}`} className={selectClass} value={filters[filter.key]} onChange={(event) => setQuery({ [filter.key]: event.target.value })}>
                <option value="">All</option>
                {filter.kind === "select"
                  ? (filter.options || []).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)
                  : (lists[filter.kind] || []).map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
              </select>
            )}
          </div>
        ))}
      </div>

      {report && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{report.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{report.description}</p>
        </div>
      )}

      {report?.summary?.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {report.summary.map((item) => (
            <div key={item.label} className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">{item.label}</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {(report?.columns || []).map((heading) => (
                  <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={report?.columns?.length || 1} className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
              ) : !report?.rows?.length ? (
                <tr><td colSpan={report?.columns?.length || 1} className="px-4 py-8 text-center text-slate-500">Nothing in this report.</td></tr>
              ) : report.rows.map((row, index) => (
                <tr key={`${type}-${page}-${index}`} className="hover:bg-slate-50">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {report?.pagination && (
          <Pager
            page={report.pagination.page}
            pages={report.pagination.pages}
            limit={report.pagination.limit}
            total={report.pagination.total}
            onPage={(next) => setQuery({ page: next }, false)}
            onLimit={(size) => setQuery({ limit: size })}
          />
        )}
      </div>
    </div>
  );
}
