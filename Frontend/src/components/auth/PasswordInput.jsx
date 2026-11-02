import React, { useState } from "react";
import { AuthInput } from "./AuthInput";
import { Eye, EyeOff, Lock } from "lucide-react";

export const PasswordInput = React.forwardRef((props, ref) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <AuthInput
        ref={ref}
        type={showPassword ? "text" : "password"}
        icon={Lock}
        {...props}
        className={props.className}
      />
      <button
        type="button"
        onClick={() => setShowPassword((prev) => !prev)}
        className="absolute right-3.5 top-[3.15rem] -translate-y-1/2 rounded-md p-0.5 text-slate-400 transition-colors hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
        aria-label={showPassword ? "Hide password" : "Show password"}
      >
        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
});

PasswordInput.displayName = "PasswordInput";
