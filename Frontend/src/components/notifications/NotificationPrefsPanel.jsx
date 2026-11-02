import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import api from "../../services/api";
import { Button } from "../ui/Button";
import { playNotificationChime, unlockNotificationAudio } from "../../utils/notificationSound";

export function NotificationPrefsPanel({ title = "Notification preferences" }) {
  const fileRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [defaults, setDefaults] = useState({ soundEnabled: true, toastEnabled: true, ringtoneName: "", hasRingtone: false });
  const [useCustom, setUseCustom] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [toastEnabled, setToastEnabled] = useState(true);
  const [personal, setPersonal] = useState({ ringtoneName: "", hasRingtone: false });
  const [effective, setEffective] = useState({
    soundEnabled: true,
    toastEnabled: true,
    source: "admin",
    ringtoneUrl: "/sounds/notification.mp3",
    ringtoneName: "Default ringtone",
  });

  const apply = (data) => {
    setDefaults(data?.defaults || { soundEnabled: true, toastEnabled: true });
    setPersonal(data?.personal || {});
    setUseCustom(Boolean(data?.personal?.useCustom));
    setSoundEnabled(data?.personal?.soundEnabled !== false);
    setToastEnabled(data?.personal?.toastEnabled !== false);
    setEffective(data?.effective || {
      soundEnabled: true,
      toastEnabled: true,
      source: "admin",
      ringtoneUrl: "/sounds/notification.mp3",
      ringtoneName: "Default ringtone",
    });
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get("/auth/notification-prefs");
        if (!cancelled) apply(res.data.data);
      } catch (error) {
        if (!cancelled) toast.error(error.response?.data?.message || "Failed to load notification prefs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const save = async () => {
    try {
      setSaving(true);
      unlockNotificationAudio(effective.ringtoneUrl);
      const res = await api.patch("/auth/notification-prefs", {
        useCustom,
        soundEnabled,
        toastEnabled,
      });
      apply(res.data.data);
      toast.success(res.data.message || "Saved");
      window.dispatchEvent(new CustomEvent("gnet:notification-prefs-changed"));
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const uploadRingtone = async (file) => {
    if (!file) return;
    try {
      setUploading(true);
      const form = new FormData();
      form.append("ringtone", file);
      const res = await api.post("/auth/notification-prefs/ringtone", form);
      apply(res.data.data);
      toast.success("Ringtone uploaded");
      window.dispatchEvent(new CustomEvent("gnet:notification-prefs-changed"));
      unlockNotificationAudio(res.data.data?.effective?.ringtoneUrl);
    } catch (error) {
      toast.error(error.response?.data?.message || "Ringtone upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeRingtone = async () => {
    try {
      setUploading(true);
      const res = await api.delete("/auth/notification-prefs/ringtone");
      apply(res.data.data);
      toast.success("Personal ringtone removed");
      window.dispatchEvent(new CustomEvent("gnet:notification-prefs-changed"));
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not remove ringtone");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-500">Loading notification preferences...</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {useCustom
              ? "Using your personal settings / ringtone."
              : "Using admin defaults. Turn on personal settings to override + upload your own mp3."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            unlockNotificationAudio(effective.ringtoneUrl);
            playNotificationChime(effective.ringtoneUrl);
          }}
        >
          Test ringtone
        </Button>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={useCustom}
          onChange={(event) => setUseCustom(event.target.checked)}
          disabled={saving || uploading}
        />
        Use my personal notification settings
      </label>

      <div className={`mt-4 grid gap-3 sm:grid-cols-2 ${useCustom ? "" : "opacity-60"}`}>
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={useCustom ? soundEnabled : defaults.soundEnabled}
            onChange={(event) => setSoundEnabled(event.target.checked)}
            disabled={saving || uploading || !useCustom}
          />
          Bell sound on new notification
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={useCustom ? toastEnabled : defaults.toastEnabled}
            onChange={(event) => setToastEnabled(event.target.checked)}
            disabled={saving || uploading || !useCustom}
          />
          Toast popup on new notification
        </label>
      </div>

      <div className={`mt-4 rounded-lg border border-dashed border-slate-200 p-3 ${useCustom ? "bg-white" : "bg-slate-50 opacity-70"}`}>
        <p className="text-sm font-medium text-slate-800">My ringtone (mp3 / wav)</p>
        <p className="mt-1 text-xs text-slate-500">
          Active: {effective.ringtoneName || "Default"} · max 3 MB
        </p>
        {personal.hasRingtone ? (
          <p className="mt-1 text-xs text-emerald-700">Uploaded: {personal.ringtoneName || "ringtone"}</p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">
            {defaults.hasRingtone
              ? `No personal file · admin ringtone: ${defaults.ringtoneName || "set"}`
              : "No personal file · built-in default will play"}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/mp4,.mp3,.wav,.ogg,.m4a,.aac"
            className="hidden"
            disabled={!useCustom || uploading}
            onChange={(event) => uploadRingtone(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!useCustom || uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? "Uploading..." : "Upload ringtone"}
          </Button>
          {personal.hasRingtone && (
            <Button type="button" variant="outline" size="sm" className="text-red-600" disabled={uploading} onClick={removeRingtone}>
              Remove my ringtone
            </Button>
          )}
        </div>
      </div>

      {!useCustom && (
        <p className="mt-3 text-xs text-slate-500">
          Admin default: sound {defaults.soundEnabled ? "on" : "off"} · toast {defaults.toastEnabled ? "on" : "off"}
          {defaults.hasRingtone ? ` · ringtone ${defaults.ringtoneName}` : ""}
        </p>
      )}
      <p className="mt-1 text-xs text-slate-400">
        Active now: sound {effective.soundEnabled ? "on" : "off"} · toast {effective.toastEnabled ? "on" : "off"}
        {" "}({effective.source === "personal" ? "personal" : "admin default"})
      </p>

      <div className="mt-4 flex justify-end">
        <Button type="button" onClick={save} disabled={saving || uploading}>
          {saving ? "Saving..." : "Save preferences"}
        </Button>
      </div>
    </section>
  );
}

export default NotificationPrefsPanel;
