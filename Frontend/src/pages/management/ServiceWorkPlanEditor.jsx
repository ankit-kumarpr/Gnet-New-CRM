import { Plus, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { cn } from "../../utils/cn";

const selectClass =
  "h-8 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-600";

export const defaultQuantityPlan = () => ({
  mode: "QUANTITY",
  deliverables: [
    { key: "REEL", label: "Reel", quantity: 10 },
    { key: "POST", label: "Post", quantity: 5 },
    { key: "CAROUSEL", label: "Carousel", quantity: 5 },
  ],
  phases: [
    { key: "DESIGN", label: "Design", percent: 20 },
    { key: "DEVELOP", label: "Development", percent: 50 },
    { key: "CONTENT", label: "Content", percent: 15 },
    { key: "QA", label: "QA & launch", percent: 15 },
  ],
});

export const defaultPercentPlan = () => ({
  mode: "PERCENT",
  deliverables: defaultQuantityPlan().deliverables.map((row) => ({ ...row, quantity: 0 })),
  phases: defaultQuantityPlan().phases,
});

export const suggestPlanForService = (name = "") => {
  const text = String(name).toLowerCase();
  if (/seo|web|site|app|develop/.test(text)) return defaultPercentPlan();
  return defaultQuantityPlan();
};

export function ServiceWorkPlanEditor({ value, onChange, disabled, serviceName, compact = false }) {
  const plan = value || suggestPlanForService(serviceName);

  const setMode = (mode) => onChange({ ...plan, mode });

  const updateRow = (listName, index, key, next) => {
    onChange({
      ...plan,
      [listName]: plan[listName].map((row, i) => (i === index ? { ...row, [key]: next } : row)),
    });
  };

  const addRow = (listName) => {
    if (listName === "deliverables") {
      onChange({
        ...plan,
        deliverables: [...(plan.deliverables || []), { key: "", label: "", quantity: 1 }],
      });
      return;
    }
    onChange({
      ...plan,
      phases: [...(plan.phases || []), { key: "", label: "", percent: 10 }],
    });
  };

  const removeRow = (listName, index) => {
    onChange({
      ...plan,
      [listName]: plan[listName].filter((_, i) => i !== index),
    });
  };

  const inputClass = cn("h-8 px-2 py-0.5 text-sm", compact && "text-xs");

  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      <div>
        <label className="mb-0.5 block text-xs font-medium text-slate-700">Work plan type *</label>
        <select className={selectClass} value={plan.mode} onChange={(e) => setMode(e.target.value)} disabled={disabled}>
          <option value="QUANTITY">Quantity (posts / reels…)</option>
          <option value="PERCENT">Percent (website / SEO…)</option>
        </select>
      </div>

      {plan.mode === "QUANTITY" ? (
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-700">Deliverables *</p>
            <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => addRow("deliverables")} disabled={disabled}>
              <Plus className="mr-1 h-3 w-3" /> Add
            </Button>
          </div>
          <div className="space-y-1.5">
            {(plan.deliverables || []).map((row, index) => (
              <div key={index} className="grid grid-cols-[1fr_64px_28px] gap-1.5">
                <Input
                  className={inputClass}
                  placeholder="Reel / Post…"
                  value={row.label}
                  onChange={(e) => updateRow("deliverables", index, "label", e.target.value)}
                  disabled={disabled}
                />
                <Input
                  className={inputClass}
                  type="number"
                  min={0}
                  value={row.quantity}
                  onChange={(e) => updateRow("deliverables", index, "quantity", e.target.value)}
                  disabled={disabled}
                />
                <button type="button" className="text-slate-400 hover:text-rose-600" onClick={() => removeRow("deliverables", index)} disabled={disabled}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-700">Phases % *</p>
            <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => addRow("phases")} disabled={disabled}>
              <Plus className="mr-1 h-3 w-3" /> Add
            </Button>
          </div>
          <div className="space-y-1.5">
            {(plan.phases || []).map((row, index) => (
              <div key={index} className="grid grid-cols-[1fr_56px_28px] gap-1.5">
                <Input
                  className={inputClass}
                  placeholder="Design…"
                  value={row.label}
                  onChange={(e) => updateRow("phases", index, "label", e.target.value)}
                  disabled={disabled}
                />
                <Input
                  className={inputClass}
                  type="number"
                  min={0}
                  max={100}
                  value={row.percent}
                  onChange={(e) => updateRow("phases", index, "percent", e.target.value)}
                  disabled={disabled}
                />
                <button type="button" className="text-slate-400 hover:text-rose-600" onClick={() => removeRow("phases", index)} disabled={disabled}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
