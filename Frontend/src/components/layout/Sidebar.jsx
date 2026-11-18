import { useState } from "react";
import {
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
} from "lucide-react";

import { cn } from "../../utils/cn";
import { navigationData } from "../../data/mockData";
import { BrandMark } from "../brand/BrandMark";
import { useAuth } from "../../context/AuthContext";

function NavEntry({ item, collapsed, onNavigate }) {
  const location = useLocation();
  const navigate = useNavigate();
  const Icon = item.icon || LayoutDashboard;

  const childActive = item.children?.some(
    (child) =>
      location.pathname === child.href ||
      location.pathname.startsWith(`${child.href}/`)
  );

  const [manualOpen, setManualOpen] = useState(null);

  const open = manualOpen === null ? childActive : manualOpen;

  if (!item.children?.length) {
    return (
      <li>
        <NavLink
          to={item.href}
          end={item.href === "/dashboard"}
          onClick={() => onNavigate?.()}
          className={({ isActive }) =>
            cn(
              "group flex items-center rounded-[6px] px-2.5 py-2 text-[13px] font-medium transition-colors",
              isActive
                ? "bg-[#1E416B] text-white shadow-sm"
                : "text-white/70 hover:bg-white/8 hover:text-white",
              collapsed && "justify-center px-2"
            )
          }
          title={collapsed ? item.name : undefined}
        >
          <Icon
            className={cn(
              "shrink-0",
              collapsed ? "h-5 w-5" : "mr-3 h-[18px] w-[18px]"
            )}
          />

          {!collapsed && <span className="truncate">{item.name}</span>}
        </NavLink>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        title={collapsed ? item.name : undefined}
        onClick={() => {
          if (collapsed) {
            navigate(item.children[0].href);
            onNavigate?.();
            return;
          }

          setManualOpen((current) =>
            !(current === null ? childActive : current)
          );
        }}
        className={cn(
          "flex w-full items-center rounded-[6px] px-2.5 py-2 text-[13px] font-medium transition-colors",
          childActive
            ? "bg-[#1E416B] text-white"
            : "text-white/70 hover:bg-white/8 hover:text-white",
          collapsed && "justify-center px-2"
        )}
      >
        <Icon
          className={cn(
            "shrink-0",
            collapsed ? "h-5 w-5" : "mr-3 h-[18px] w-[18px]"
          )}
        />

        {!collapsed && (
          <>
            <span className="flex-1 truncate text-left">{item.name}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                open && "rotate-180"
              )}
            />
          </>
        )}
      </button>

      {!collapsed && open && (
        <ul className="mt-1 space-y-0.5 pl-9">
          {item.children.map((child) => (
            <li key={child.href}>
              <NavLink
                to={child.href}
                end={child.end !== false}
                onClick={() => onNavigate?.()}
                className={({ isActive }) =>
                  cn(
                    "block rounded-[6px] px-2 py-1.5 text-[13px] transition-colors",
                    isActive
                      ? "bg-[#3569A8]/35 font-medium text-white"
                      : "text-white/55 hover:bg-white/8 hover:text-white"
                  )
                }
              >
                {child.name}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function Sidebar({
  collapsed,
  setCollapsed,
  variant = "fixed",
  onNavigate,
}) {
  const { user, hasRole, hasPermission } = useAuth();

  const visibleGroups = navigationData
    .map((group) => {
      const filteredItems = group.items.flatMap((item) => {
        if (
          item.allowedRoles?.length &&
          !hasRole(item.allowedRoles)
        ) {
          return [];
        }

        if (item.children?.length) {
          const children = item.children.filter(
            (child) =>
              !child.permissionsNeeded?.length ||
              hasPermission(child.permissionsNeeded)
          );

          return children.length ? [{ ...item, children }] : [];
        }

        if (
          item.permissionsNeeded?.length &&
          !hasPermission(item.permissionsNeeded)
        ) {
          return [];
        }

        return [item];
      });

      return { ...group, items: filteredItems };
    })
    .filter((group) => group.items.length > 0);

  const isDrawer = variant === "drawer";

  return (
    <aside
      className={cn(
        "z-20 flex h-full flex-col border-r border-[#102238] bg-[#142B4A] transition-all duration-300 ease-in-out",
        isDrawer
          ? "relative w-full"
          : cn(
              "fixed inset-y-0 left-0",
              collapsed ? "w-[72px]" : "w-64"
            )
      )}
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-4">
        {(!collapsed || isDrawer) && <BrandMark tone="dark" />}

        {!isDrawer && (
          <button
            type="button"
            onClick={() => setCollapsed?.(!collapsed)}
            aria-label={
              collapsed ? "Expand sidebar" : "Collapse sidebar"
            }
            className={cn(
              "rounded-[6px] p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white",
              collapsed && "mx-auto"
            )}
          >
            {collapsed ? (
              <PanelLeftOpen size={20} />
            ) : (
              <PanelLeftClose size={20} />
            )}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-5 px-3">
          {visibleGroups.length === 0 ? (
            <p className="px-2 text-xs text-white/50">
              {user
                ? "No menu items for this account."
                : "Loading menu..."}
            </p>
          ) : (
            visibleGroups.map((group) => (
              <div key={group.group}>
                {(!collapsed || isDrawer) && (
                  <div className="mb-2 px-2.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">
                      {group.group}
                    </span>
                  </div>
                )}

                <ul className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavEntry
                      key={`${group.group}-${item.name}`}
                      item={item}
                      collapsed={isDrawer ? false : collapsed}
                      onNavigate={onNavigate}
                    />
                  ))}
                </ul>
              </div>
            ))
          )}
        </nav>
      </div>

      {(!collapsed || isDrawer) && user && (
        <div className="shrink-0 border-t border-white/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#3569A8] text-sm font-semibold text-white">
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-white">{user?.name || "User"}</p>
              <p className="truncate text-[11px] text-white/45">
                {user?.userType === "CLIENT"
                  ? (user?.clientId || "Client")
                  : (user?.designation?.name || user?.userType || "Member")}
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
