import { cn } from "../../utils/cn";

export function PageHeader({ title, description, actions, className, breadcrumb }) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        {breadcrumb ? (
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#94A3B8]">{breadcrumb}</p>
        ) : null}
        <h1 className="text-[22px] font-semibold tracking-tight text-[#26364A] sm:text-[24px]">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-[#718096]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
