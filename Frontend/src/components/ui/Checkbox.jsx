import React from "react";
import { cn } from "../../utils/cn";
import { Check } from "lucide-react";

export const Checkbox = React.forwardRef(({ className, ...props }, ref) => (
  <div className="flex items-center">
    <input
      type="checkbox"
      ref={ref}
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-sm border border-slate-300 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 checked:bg-emerald-600 checked:border-emerald-600",
        className
      )}
      {...props}
    />
  </div>
));
Checkbox.displayName = "Checkbox";
