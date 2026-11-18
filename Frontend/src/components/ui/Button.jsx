import { forwardRef } from "react";
import { cn } from "../../utils/cn";

const Button = forwardRef(({ className, variant = "default", size = "default", isLoading, children, ...props }, ref) => {
  const baseStyles =
    "inline-flex items-center justify-center whitespace-nowrap rounded-[6px] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3569A8]/35 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50";

  const variants = {
    default: "bg-[#142B4A] text-white hover:bg-[#102238] shadow-sm",
    destructive: "bg-[#DC5454] text-white hover:bg-[#c44747] shadow-sm",
    outline: "border border-[#E5EAF1] bg-white text-[#26364A] hover:bg-[#F7F9FC]",
    secondary: "bg-[#EAF1FA] text-[#142B4A] hover:bg-[#dce7f5]",
    ghost: "text-[#26364A] hover:bg-[#EAF1FA]",
    link: "text-[#3569A8] underline-offset-4 hover:underline",
    success: "bg-[#16A36A] text-white hover:bg-[#128a59] shadow-sm",
  };

  const sizes = {
    default: "h-9 px-4 py-2",
    sm: "h-8 rounded-[6px] px-3 text-xs",
    lg: "h-10 rounded-[6px] px-8",
    icon: "h-9 w-9",
  };

  return (
    <button
      ref={ref}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {children}
    </button>
  );
});
Button.displayName = "Button";

export { Button };
