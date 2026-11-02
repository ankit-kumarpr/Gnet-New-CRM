import { Bell, Menu, LogOut, ChevronDown, UserRound } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTaskAlerts } from "../../context/TaskAlertContext";
import { useLocation, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { cn } from "../../utils/cn";
import { unlockNotificationAudio } from "../../utils/notificationSound";

function formatWhen(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function Header({ setMobileMenuOpen, isMobile }) {
  const { user, logout, token } = useAuth();
  const { badgeCount, items, unreadCount, markRead, markAllRead } = useTaskAlerts();
  const { pathname } = useLocation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const dropdownRef = useRef(null);
  const alertRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (alertRef.current && !alertRef.current.contains(event.target)) {
        setIsAlertOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      if (token) {
        await axios.post(
          `${import.meta.env.VITE_API_URL}auth/logout`,
          {},
          {
            headers: { Authorization: `Bearer ${token}` },
            withCredentials: true,
          }
        );
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      logout();
      navigate("/");
    }
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-x-4 border-b border-slate-200 bg-white/80 px-4 shadow-sm backdrop-blur-md sm:gap-x-6 sm:px-6 lg:px-8">
      {isMobile && (
        <button
          type="button"
          className="-m-2.5 p-2.5 text-slate-700 lg:hidden"
          onClick={() => setMobileMenuOpen(true)}
        >
          <span className="sr-only">Open sidebar</span>
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>
      )}

      {isMobile && <div className="h-6 w-px bg-slate-200 lg:hidden" aria-hidden="true" />}

      {pathname === "/dashboard" && (
        <p className="hidden text-sm font-semibold text-slate-900 sm:block">Dashboard</p>
      )}

      <div className="flex flex-1 justify-end self-stretch">
        <div className="flex items-center gap-2">
          {user?.userType !== "CLIENT" && (
          <div className="relative" ref={alertRef}>
            <button
              type="button"
              onClick={() => {
                unlockNotificationAudio();
                setIsAlertOpen((open) => !open);
              }}
              className={cn(
                "relative rounded-full p-2 text-slate-600 transition hover:bg-slate-50",
                badgeCount > 0 && "task-bell-blink text-amber-600",
              )}
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {badgeCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-4 text-white">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </button>

            {isAlertOpen && (
              <div className="absolute right-0 z-20 mt-2 w-[22rem] origin-top-right rounded-xl border border-slate-200 bg-white py-2 shadow-xl ring-1 ring-slate-900/5">
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Notifications</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {badgeCount > 0
                        ? `${unreadCount} new · important updates`
                        : "You're all caught up"}
                    </p>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => markAllRead()}
                      className="shrink-0 text-xs font-medium text-emerald-700 hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-auto py-1">
                  {items.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-slate-500">No notifications yet.</p>
                  ) : items.slice(0, 20).map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => {
                        markRead(row.id);
                        setIsAlertOpen(false);
                        if (row.href) navigate(row.href);
                      }}
                      className={cn(
                        "block w-full px-4 py-2.5 text-left hover:bg-emerald-50",
                        !row.read && row.source === "event" && "bg-amber-50/60",
                        row.source === "reminder" && "bg-slate-50/80",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-medium text-slate-900">{row.title}</p>
                        {!row.read && (
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                        )}
                      </div>
                      {row.body ? (
                        <p className="mt-0.5 truncate text-xs text-slate-500">{row.body}</p>
                      ) : null}
                      <p className="mt-0.5 text-[11px] text-slate-400">{formatWhen(row.at)}</p>
                    </button>
                  ))}
                </div>
                <div className="border-t border-slate-100 px-3 py-2">
                  <Link
                    to="/dashboard/daily-tasks"
                    onClick={() => setIsAlertOpen(false)}
                    className="block rounded-md px-2 py-2 text-center text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                  >
                    Open daily tasks
                  </Link>
                </div>
              </div>
            )}
          </div>
          )}

          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              className="-m-1.5 flex items-center rounded-md p-1.5 transition-colors hover:bg-slate-50"
              id="user-menu-button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <span className="sr-only">Open user menu</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-400 font-bold text-white shadow-sm">
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <span className="ml-4 hidden lg:flex lg:flex-col lg:items-start">
                <span className="text-sm font-semibold leading-6 text-slate-900" aria-hidden="true">
                  {user?.name || "User"}
                </span>
                <span className="text-xs leading-4 text-slate-500" aria-hidden="true">
                  {user?.userType === "CLIENT"
                    ? (user?.clientId || "Client")
                    : (user?.designation?.name || user?.userType || "Guest")}
                </span>
              </span>
              <ChevronDown className="ml-2 hidden h-4 w-4 text-slate-400 lg:block" />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 z-10 mt-2.5 w-64 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-slate-900/5 focus:outline-none">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="truncate text-sm font-medium text-slate-900">{user?.name}</p>
                  <p className="truncate text-xs text-slate-500">{user?.email}</p>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      navigate("/dashboard/profile");
                    }}
                    className="flex w-full items-center px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <UserRound className="mr-2 h-4 w-4" />
                    My profile
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
