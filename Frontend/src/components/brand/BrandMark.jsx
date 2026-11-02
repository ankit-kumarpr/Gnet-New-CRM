import { LayoutDashboard } from "lucide-react";
import { useBrand } from "../../context/BrandContext";
import { cn } from "../../utils/cn";

export function BrandMark({ tone = "light", compact = false, className }) {
  const { brand } = useBrand();
  const name = brand.companyName || "GrandeurNet";
  const onDark = tone === "dark";

  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      {brand.logoUrl ? (
        <img src={brand.logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg bg-white object-contain p-0.5" />
      ) : (
        <div className={cn("shrink-0 rounded-lg p-2", onDark ? "bg-emerald-600" : "bg-emerald-600")}>
          <LayoutDashboard className={cn(compact ? "h-4 w-4" : "h-5 w-5", "text-white")} />
        </div>
      )}
      {!compact && (
        <span className={cn("truncate font-bold tracking-tight", onDark ? "text-white" : "text-slate-900", compact ? "text-base" : "text-lg")}>
          {name}
        </span>
      )}
    </div>
  );
}
