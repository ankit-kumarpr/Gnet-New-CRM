import React from "react";
import { Input } from "../ui/Input";
import { cn } from "../../utils/cn";

export const AuthInput = React.forwardRef(
  ({ icon: Icon, label, error, className, ...props }, ref) => {
    return (
      <div className={cn("space-y-1.5 w-full", className)}>
        {label && (
          <label
            htmlFor={props.id || props.name}
            className="text-sm font-medium leading-none text-slate-700 peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {Icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
              <Icon size={18} />
            </div>
          )}
          <Input
            ref={ref}
            id={props.id || props.name}
            className={cn(
              "h-12 rounded-xl border-slate-200/90 bg-white shadow-sm transition-all duration-200 placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-600/25",
              Icon && "pl-10",
              error && "border-rose-400 focus-visible:border-rose-400 focus-visible:ring-rose-500/25"
            )}
            {...props}
          />
        </div>
        {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
      </div>
    );
  }
);

AuthInput.displayName = "AuthInput";
