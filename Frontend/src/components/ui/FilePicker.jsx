import { useRef } from "react";
import { Upload, X } from "lucide-react";
import { cn } from "../../utils/cn";

export function FilePicker({ accept, disabled, file, files, multiple = false, onChange, hint, className }) {
  const inputRef = useRef(null);
  const selected = multiple ? (files || []) : (file ? [file] : []);

  const pick = (event) => {
    const list = Array.from(event.target.files || []);
    if (multiple) onChange([...(files || []), ...list]);
    else onChange(list[0] || null);
    event.target.value = "";
  };

  const clearAt = (index) => {
    if (multiple) onChange((files || []).filter((_, item) => item !== index));
    else onChange(null);
  };

  return (
    <div className={className}>
      <div className={cn("flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 shadow-sm", disabled && "pointer-events-none opacity-50")}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:pointer-events-none"
        >
          <Upload className="h-4 w-4" />
          {multiple ? "Add files" : "Choose file"}
        </button>
        <span className="flex max-h-16 min-w-0 flex-1 flex-wrap gap-1 overflow-auto">
          {selected.length === 0 ? (
            <span className="text-sm text-slate-400">No file chosen</span>
          ) : selected.map((item, index) => (
            <span key={`${item.name}-${index}`} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
              <span className="max-w-40 truncate">{item.name}</span>
              <button type="button" disabled={disabled} aria-label={`Remove ${item.name}`} onClick={() => clearAt(index)} className="rounded-full text-emerald-500 hover:text-emerald-800">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </span>
        <input ref={inputRef} type="file" accept={accept} multiple={multiple} disabled={disabled} onChange={pick} className="sr-only" />
      </div>
      {hint ? <p className="mt-1.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
