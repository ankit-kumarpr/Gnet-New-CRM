export function ListPager({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
      <p className="text-sm text-slate-700">
        Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span>
      </p>
      <div className="inline-flex -space-x-px rounded-md shadow-sm">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="rounded-l-md px-3 py-2 text-sm text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className="rounded-r-md px-3 py-2 text-sm text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
