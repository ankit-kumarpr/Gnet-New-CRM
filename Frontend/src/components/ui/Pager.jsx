export const PAGE_SIZES = [10, 20, 50, 100];

export function pageSize(value, fallback = 10) {
  const size = Number(value);
  return PAGE_SIZES.includes(size) ? size : fallback;
}

export function Pager({ page, pages, limit, total = 0, onPage, onLimit }) {
  const safePages = Math.max(Number(pages) || 1, 1);
  const current = Math.min(Math.max(Number(page) || 1, 1), safePages);
  const size = pageSize(limit);
  const start = total > 0 ? (current - 1) * size + 1 : 0;
  const end = total > 0 ? Math.min(current * size, total) : 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3">
      <label className="flex items-center gap-2 text-sm text-slate-600">
        Per page
        <select
          className="h-8 rounded-md border border-slate-200 bg-white px-2"
          value={size}
          onChange={(event) => onLimit(Number(event.target.value))}
        >
          {PAGE_SIZES.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
      <p className="text-sm text-slate-600">
        {total > 0 ? `${start}–${end} of ${total}` : "0 records"}
      </p>
      <div className="inline-flex">
        <button
          type="button"
          disabled={current <= 1}
          onClick={() => onPage(current - 1)}
          className="rounded-l-md px-3 py-2 text-sm text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={current >= safePages}
          onClick={() => onPage(current + 1)}
          className="rounded-r-md px-3 py-2 text-sm text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
