import { forwardRef } from "react";
import { cn } from "../../utils/cn";

const Input = forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-[6px] border border-[#E5EAF1] bg-white px-3 py-1 text-sm text-[#26364A] shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#94A3B8] focus-visible:outline-none focus-visible:border-[#3569A8] focus-visible:ring-2 focus-visible:ring-[#3569A8]/20 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
