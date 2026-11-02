import React, { useState } from "react";
import { ArrowRight, UserRound } from "lucide-react";
import { AuthInput } from "./AuthInput";
import { PasswordInput } from "./PasswordInput";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useBrand } from "../../context/BrandContext";

export const LoginForm = () => {
  const [formData, setFormData] = useState({ identifier: "", password: "", rememberMe: false });
  const [errors, setErrors] = useState({ identifier: "", password: "", general: "" });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { brand } = useBrand();
  const companyName = brand.companyName || "GrandeurNet";

  const validate = () => {
    let valid = true;
    const newErrors = { identifier: "", password: "", general: "" };

    if (!formData.identifier.trim()) {
      newErrors.identifier = "Enter email or Client ID.";
      valid = false;
    }

    if (!formData.password) {
      newErrors.password = "Password is required.";
      valid = false;
    }

    setErrors(newErrors);
    return valid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({ identifier: "", password: "", general: "" });

    if (!validate()) return;

    setIsLoading(true);

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}auth/login`,
        {
          email: formData.identifier.trim(),
          password: formData.password,
        },
        { withCredentials: true }
      );

      const { accessToken, refreshToken, user } = response.data.data || {};

      if (!accessToken || !user) {
        throw new Error("Invalid response from server");
      }

      login(user, accessToken, refreshToken);
      toast.success("Login successful!");
      navigate("/dashboard");
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || "Something went wrong.";
      toast.error(errorMessage);
      setErrors((prev) => ({ ...prev, general: errorMessage }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (errors[name] || errors.general) {
      setErrors((prev) => ({ ...prev, [name]: "", general: "" }));
    }
  };

  return (
    <div className="w-full auth-fade-up">
      <div className="mb-9">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700/80">
          Sign in
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-slate-900 sm:text-[2.1rem]">
          Welcome back
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-500">
          Enter your email or Client ID to continue to {companyName}.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {errors.general && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700"
          >
            {errors.general}
          </div>
        )}

        <div className="space-y-4">
          <AuthInput
            label="Email or Client ID"
            name="identifier"
            type="text"
            inputMode="text"
            placeholder="you@company.com or Client ID"
            icon={UserRound}
            value={formData.identifier}
            onChange={handleChange}
            error={errors.identifier}
            disabled={isLoading}
            autoComplete="username"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />

          <div className="space-y-1">
            <PasswordInput
              label="Password"
              name="password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              disabled={isLoading}
            />

            <div className="flex items-center justify-between gap-3 pt-2.5">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="rememberMe"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                  disabled={isLoading}
                />
                <label
                  htmlFor="rememberMe"
                  className="cursor-pointer text-sm font-medium text-slate-600"
                >
                  Remember me
                </label>
              </div>
              <a
                href="#"
                className="text-sm font-semibold text-emerald-700 transition-colors hover:text-emerald-800 focus:outline-none focus-visible:underline"
              >
                Forgot password?
              </a>
            </div>
          </div>
        </div>

        <Button
          type="submit"
          className="group mt-1 h-12 w-full rounded-xl text-[15px] font-semibold tracking-wide shadow-md shadow-emerald-900/10 transition-all hover:shadow-lg hover:shadow-emerald-900/15"
          isLoading={isLoading}
        >
          {isLoading ? (
            "Signing in..."
          ) : (
            <span className="inline-flex items-center gap-2">
              Sign in
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          )}
        </Button>
      </form>

      <p className="mt-8 text-center text-xs leading-relaxed text-slate-400 lg:text-left">
        Need access? Ask your admin to create an account for you.
      </p>
    </div>
  );
};
