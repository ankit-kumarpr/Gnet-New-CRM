import { cn } from "../../utils/cn";

function Badge({ className, variant = "default", ...props }) {
  const baseStyles =
    "inline-flex items-center rounded-[6px] px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#3569A8]/30 focus:ring-offset-1";

  const variants = {
    default: "border-transparent bg-[#142B4A] text-white",
    secondary: "border-transparent bg-[#EAF1FA] text-[#1E416B]",
    destructive: "border-transparent bg-[#DC5454]/12 text-[#DC5454]",
    outline: "text-[#26364A] border border-[#E5EAF1] bg-white",
    success: "border-transparent bg-[#16A36A]/12 text-[#16A36A]",
    warning: "border-transparent bg-[#E6A23C]/15 text-[#b87a1c]",
    info: "border-transparent bg-[#4285C5]/12 text-[#4285C5]",
  };

  return (
    <div className={cn(baseStyles, variants[variant], className)} {...props} />
  );
}

export { Badge };
