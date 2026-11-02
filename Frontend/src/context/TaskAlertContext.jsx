import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import api, { isRequestCanceled } from "../services/api";
import { useAuth } from "./AuthContext";
import { playNotificationChime, unlockNotificationAudio } from "../utils/notificationSound";

const TaskAlertContext = createContext({
  openCount: 0,
  pending: 0,
  partial: 0,
  tasks: [],
  items: [],
  badgeCount: 0,
  unreadCount: 0,
  loading: false,
  prefs: { soundEnabled: true, toastEnabled: true, ringtoneUrl: "/sounds/notification.mp3" },
  refreshAlerts: async () => {},
  markRead: async () => {},
  markAllRead: async () => {},
});

function formatToastTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

const POLL_MS = 90_000;

export function TaskAlertProvider({ children }) {
  const { token, user } = useAuth();
  const isClient = user?.userType === "CLIENT";
  const [openCount, setOpenCount] = useState(0);
  const [pending, setPending] = useState(0);
  const [partial, setPartial] = useState(0);
  const [tasks, setTasks] = useState([]);
  const [items, setItems] = useState([]);
  const [badgeCount, setBadgeCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [prefs, setPrefs] = useState({
    soundEnabled: true,
    toastEnabled: true,
    ringtoneUrl: "/sounds/notification.mp3",
  });
  const prefsRef = useRef(prefs);
  const seenIdsRef = useRef(new Set());
  const primedRef = useRef(false);
  const abortRef = useRef(null);

  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  const loadPrefs = useCallback(async () => {
    if (!token) {
      setPrefs({ soundEnabled: true, toastEnabled: true, ringtoneUrl: "/sounds/notification.mp3" });
      return;
    }
    try {
      const res = await api.get("/auth/notification-prefs");
      const effective = res.data.data?.effective || {};
      setPrefs({
        soundEnabled: effective.soundEnabled !== false,
        toastEnabled: effective.toastEnabled !== false,
        ringtoneUrl: effective.ringtoneUrl || "/sounds/notification.mp3",
      });
    } catch {
      setPrefs({ soundEnabled: true, toastEnabled: true, ringtoneUrl: "/sounds/notification.mp3" });
    }
  }, [token]);

  const refreshAlerts = useCallback(async () => {
    if (!token || isClient) {
      setOpenCount(0);
      setPending(0);
      setPartial(0);
      setTasks([]);
      setItems([]);
      setBadgeCount(0);
      setUnreadCount(0);
      seenIdsRef.current = new Set();
      primedRef.current = false;
      return;
    }
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      setLoading(true);
      const res = await api.get("/admin/notifications", { signal: controller.signal });
      const data = res.data.data || {};
      const nextItems = data.items || [];
      const taskBag = data.tasks || {};

      setOpenCount(taskBag.openCount || 0);
      setPending(taskBag.pending || 0);
      setPartial(taskBag.partial || 0);
      setTasks(taskBag.tasks || []);
      setItems(nextItems);
      setBadgeCount(data.badgeCount || 0);
      setUnreadCount(data.unreadCount || 0);

      const eventItems = nextItems.filter((row) => row.source === "event" && !row.read);
      if (!primedRef.current) {
        seenIdsRef.current = new Set(eventItems.map((row) => row.id));
        primedRef.current = true;
      } else {
        const fresh = eventItems.filter((row) => !seenIdsRef.current.has(row.id));
        if (fresh.length) {
          const { soundEnabled, toastEnabled, ringtoneUrl } = prefsRef.current;
          if (soundEnabled) playNotificationChime(ringtoneUrl);
          if (toastEnabled) {
            for (const row of fresh.slice(0, 2)) {
              toast(`${row.title}${row.body ? ` — ${row.body}` : ""}`, {
                duration: 5000,
              });
            }
          }
        }
        for (const row of eventItems) seenIdsRef.current.add(row.id);
      }
    } catch (error) {
      if (!isRequestCanceled(error)) {
        // Keep last known alert state if the request fails.
      }
    } finally {
      setLoading(false);
    }
  }, [token, isClient]);

  const markRead = useCallback(async (id) => {
    if (!id || String(id).startsWith("reminder:")) {
      setItems((prev) => prev.map((row) => (row.id === id ? { ...row, read: true } : row)));
      return;
    }
    try {
      await api.patch(`/admin/notifications/${id}/read`);
      setItems((prev) => prev.map((row) => (row.id === id ? { ...row, read: true } : row)));
      setUnreadCount((n) => Math.max(0, n - 1));
      setBadgeCount((n) => Math.max(0, n - 1));
    } catch {
      // ignore
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await api.patch("/admin/notifications/read-all");
      setItems((prev) => prev.map((row) => (row.source === "event" ? { ...row, read: true } : row)));
      setUnreadCount(0);
      setBadgeCount((n) => Math.max(0, n - unreadCount));
    } catch {
      // ignore
    }
  }, [unreadCount]);

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  useEffect(() => {
    const onPrefs = () => loadPrefs();
    window.addEventListener("gnet:notification-prefs-changed", onPrefs);
    return () => window.removeEventListener("gnet:notification-prefs-changed", onPrefs);
  }, [loadPrefs]);

  useEffect(() => {
    const unlock = () => unlockNotificationAudio();
    document.addEventListener("pointerdown", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    refreshAlerts();
    if (!token || isClient) return undefined;

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshAlerts();
    }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") refreshAlerts();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      abortRef.current?.abort();
    };
  }, [token, isClient, refreshAlerts]);

  const value = useMemo(() => ({
    openCount,
    pending,
    partial,
    tasks,
    items,
    badgeCount,
    unreadCount,
    loading,
    prefs,
    refreshAlerts,
    markRead,
    markAllRead,
    formatToastTime,
  }), [openCount, pending, partial, tasks, items, badgeCount, unreadCount, loading, prefs, refreshAlerts, markRead, markAllRead]);

  return (
    <TaskAlertContext.Provider value={value}>
      {children}
    </TaskAlertContext.Provider>
  );
}

export const useTaskAlerts = () => useContext(TaskAlertContext);
