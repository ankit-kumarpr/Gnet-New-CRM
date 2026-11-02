import { useEffect, useState } from "react";
import api from "../../services/api";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { cn } from "../../utils/cn";

const selectClass =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-600";

/**
 * Searchable employee select — loads a small page from API instead of all employees.
 * value = employee _id string (or "" for empty).
 */
export function EmployeeSelect({
  value = "",
  onChange,
  placeholder = "All employees",
  allowEmpty = true,
  disabled = false,
  className,
  name,
}) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [options, setOptions] = useState([]);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get("/admin/employees/list", {
          params: {
            search: debouncedQuery || undefined,
            page: 1,
            limit: 30,
          },
        });
        if (cancelled) return;
        const rows = res.data.data || [];
        setOptions(rows);
        if (value) {
          const match = rows.find((row) => String(row._id) === String(value));
          if (match) setSelectedLabel(match.name);
        }
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [debouncedQuery, value]);

  useEffect(() => {
    if (!value) {
      setSelectedLabel("");
      return;
    }
    const match = options.find((row) => String(row._id) === String(value));
    if (match) setSelectedLabel(match.name);
  }, [value, options]);

  return (
    <div className={cn("space-y-1", className)}>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={loading ? "Loading..." : "Type to search employee"}
        disabled={disabled}
        className={selectClass}
        autoComplete="off"
      />
      <select
        name={name}
        className={selectClass}
        value={value || ""}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value;
          const match = options.find((row) => String(row._id) === next);
          setSelectedLabel(match?.name || "");
          onChange?.(next);
        }}
      >
        {allowEmpty && <option value="">{placeholder}</option>}
        {value && selectedLabel && !options.some((row) => String(row._id) === String(value)) && (
          <option value={value}>{selectedLabel}</option>
        )}
        {options.map((row) => (
          <option key={row._id} value={row._id}>
            {row.name}{row.employeeId ? ` (${row.employeeId})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

export default EmployeeSelect;
