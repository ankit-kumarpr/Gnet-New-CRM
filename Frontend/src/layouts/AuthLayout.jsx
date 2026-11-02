import React from "react";
import { ShieldCheck, Users, Layers3 } from "lucide-react";
import { BrandMark } from "../components/brand/BrandMark";
import { useBrand } from "../context/BrandContext";

const highlights = [
  { icon: Layers3, label: "Services & catalog" },
  { icon: Users, label: "Team & clients" },
  { icon: ShieldCheck, label: "Role-based access" },
];

export const AuthLayout = ({ children }) => {
  const { brand } = useBrand();
  const companyName = brand.companyName || "GrandeurNet";

  return (
    <div className="auth-shell min-h-screen w-full flex overflow-hidden bg-[#f4faf7] font-[family-name:var(--font-auth)]">
      {/* Left — brand plane */}
      <div className="relative hidden lg:flex lg:w-[48%] xl:w-1/2 flex-col justify-between overflow-hidden px-12 py-10 text-white xl:px-16 xl:py-12">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(145deg, #042f2e 0%, #065f46 42%, #0f766e 78%, #134e4a 100%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.09) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse 80% 70% at 40% 40%, black 20%, transparent 75%)",
          }}
        />
        <div className="auth-float pointer-events-none absolute -left-20 top-16 h-72 w-72 rounded-full bg-emerald-400/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-teal-300/20 blur-3xl" />
        <div className="pointer-events-none absolute right-24 top-1/3 h-40 w-40 rounded-full bg-lime-300/15 blur-2xl" />

        <div className="relative z-10 auth-fade-up">
          <BrandMark tone="dark" />
        </div>

        <div className="relative z-10 max-w-lg auth-fade-up-delay-1">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200/90">
            Workspace sign-in
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-5xl font-bold leading-[1.05] tracking-tight text-white xl:text-[3.4rem]">
            {companyName}
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-emerald-50/85">
            One place for clients, services, meetings, and daily reporting — built for your team.
          </p>

          <ul className="mt-10 space-y-3">
            {highlights.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-3 text-sm font-medium text-emerald-50/95"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/10 backdrop-blur-sm">
                  <Icon className="h-4 w-4 text-emerald-100" strokeWidth={2} />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 auth-fade-up-delay-2 text-sm font-medium text-emerald-200/80">
          &copy; {new Date().getFullYear()} {companyName}. All rights reserved.
        </div>
      </div>

      {/* Right — form */}
      <div className="relative flex w-full flex-1 items-center justify-center px-5 py-10 sm:px-10 lg:px-14 xl:px-20">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 100% 0%, rgba(16,185,129,0.14), transparent 55%), radial-gradient(ellipse 45% 40% at 0% 100%, rgba(20,184,166,0.1), transparent 50%)",
          }}
        />

        <div className="relative z-10 w-full max-w-[420px]">
          <div className="mb-8 flex justify-center lg:hidden">
            <BrandMark />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
};
