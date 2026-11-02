import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { PendingTasksModal } from "./PendingTasksModal";
import { TaskAlertProvider, useTaskAlerts } from "../../context/TaskAlertContext";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../utils/cn";
import { X } from "lucide-react";

function DashboardShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [showPendingPopup, setShowPendingPopup] = useState(false);
  const { pathname } = useLocation();
  const { user } = useAuth();
  const isClient = user?.userType === "CLIENT";
  const isChatPage = pathname === "/dashboard/chat" || pathname.startsWith("/dashboard/chat/");
  const { openCount, pending, partial, tasks, refreshAlerts } = useTaskAlerts();

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isClient || pathname !== "/dashboard") {
      setShowPendingPopup(false);
      return;
    }
    refreshAlerts().finally(() => {
      // Show on every dashboard open/refresh when open tasks exist.
      setShowPendingPopup(true);
    });
  }, [pathname, refreshAlerts, isClient]);

  return (
    <div className="min-h-screen font-sans">
      {isMobile && mobileMenuOpen && (
        <div className="relative z-50 lg:hidden">
          <div className="fixed inset-0 bg-slate-900/80 transition-opacity" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-0 flex">
            <div className="relative mr-16 flex w-full max-w-xs flex-1">
              <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                <button type="button" className="-m-2.5 p-2.5" onClick={() => setMobileMenuOpen(false)}>
                  <span className="sr-only">Close sidebar</span>
                  <X className="h-6 w-6 text-white" aria-hidden="true" />
                </button>
              </div>
              <div className="h-full w-full overflow-hidden bg-emerald-950">
                <Sidebar
                  variant="drawer"
                  collapsed={false}
                  setCollapsed={() => {}}
                  onNavigate={() => setMobileMenuOpen(false)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {!isMobile && <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />}

      <div className={cn("flex min-h-screen flex-col transition-all duration-300 ease-in-out", !isMobile && (collapsed ? "pl-[72px]" : "pl-64"))}>
        <Header setMobileMenuOpen={setMobileMenuOpen} isMobile={isMobile} />
        <main className={cn("flex-1", isChatPage ? "overflow-hidden p-0" : "px-4 py-8 sm:px-6 lg:px-8")}>
          <Outlet />
        </main>
      </div>

      {!isClient && (
        <PendingTasksModal
          open={pathname === "/dashboard" && showPendingPopup && openCount > 0}
          pending={pending}
          partial={partial}
          tasks={tasks}
          onClose={() => setShowPendingPopup(false)}
        />
      )}
    </div>
  );
}

export function DashboardLayout() {
  return (
    <TaskAlertProvider>
      <DashboardShell />
    </TaskAlertProvider>
  );
}
