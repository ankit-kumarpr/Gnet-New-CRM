import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/Button";
import { FilePicker } from "../../components/ui/FilePicker";
import { Input } from "../../components/ui/Input";
import api from "../../services/api";
import { useBrand } from "../../context/BrandContext";
import { playNotificationChime, unlockNotificationAudio } from "../../utils/notificationSound";

const LETTER_FIELDS = [
  { key: "companyAddress", label: "Company address", max: 300 },
  { key: "companyPhone", label: "Company phone", max: 20 },
  { key: "companyEmail", label: "Company email", max: 120 },
  { key: "companyWebsite", label: "Website", max: 160 },
  { key: "offerPrefix", label: "Offer letter prefix", max: 8, hint: "Ref number starts with this, for example GN" },
  { key: "probationPeriod", label: "Probation period", max: 40, hint: "Example: 6 months" },
  { key: "workingHours", label: "Working hours", max: 80, hint: "Example: 9:30 AM to 6:30 PM" },
  { key: "signatoryName", label: "Signatory name", max: 80 },
  { key: "signatoryTitle", label: "Signatory title", max: 80, hint: "Example: Director" },
];

export function SoftwareSettings() {
  const { refreshBrand } = useBrand();
  const [companyName, setCompanyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [savingLogo, setSavingLogo] = useState(false);
  const [extra, setExtra] = useState({});
  const [savingLetter, setSavingLetter] = useState(false);
  const [officeLat, setOfficeLat] = useState("");
  const [officeLng, setOfficeLng] = useState("");
  const [officeRadius, setOfficeRadius] = useState("20");
  const [savingOffice, setSavingOffice] = useState(false);
  const [locating, setLocating] = useState(false);
  const [notifySound, setNotifySound] = useState(true);
  const [notifyToast, setNotifyToast] = useState(true);
  const [savingNotify, setSavingNotify] = useState(false);
  const [ringtoneUrl, setRingtoneUrl] = useState("");
  const [ringtoneName, setRingtoneName] = useState("");
  const [uploadingRingtone, setUploadingRingtone] = useState(false);
  const ringtoneRef = useRef(null);
  const [eveningEnabled, setEveningEnabled] = useState(true);
  const [eveningTime, setEveningTime] = useState("18:30");
  const [savingEvening, setSavingEvening] = useState(false);

  const apply = (data) => {
    setCompanyName(data?.companyName || "");
    setLogoUrl(data?.logoUrl || "");
    setLogoFile(null);
    setLogoPreview("");
    setExtra(Object.fromEntries(LETTER_FIELDS.map((field) => [field.key, data?.[field.key] || ""])));
    setOfficeLat(data?.officeLatitude == null ? "" : String(data.officeLatitude));
    setOfficeLng(data?.officeLongitude == null ? "" : String(data.officeLongitude));
    setOfficeRadius(String(data?.officeRadiusMeters || 20));
    setNotifySound(data?.notificationDefaults?.soundEnabled !== false);
    setNotifyToast(data?.notificationDefaults?.toastEnabled !== false);
    setRingtoneUrl(data?.notificationDefaults?.ringtoneUrl || "");
    setRingtoneName(data?.notificationDefaults?.ringtoneName || "");
    setEveningEnabled(data?.eveningReportEnabled !== false);
    setEveningTime(data?.eveningReportTime || "18:30");
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const res = await api.get("/admin/settings");
        if (!cancelled) apply(res.data.data);
      } catch (error) {
        if (!cancelled) toast.error(error.response?.data?.message || "Failed to load settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  const saveName = async () => {
    const name = companyName.trim();
    if (name.length < 2) {
      toast.error("Company name must be at least 2 characters");
      return;
    }
    try {
      setSavingName(true);
      const res = await api.patch("/admin/settings", { companyName: name });
      apply(res.data.data);
      await refreshBrand();
      toast.success("Company name updated");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update company name");
    } finally {
      setSavingName(false);
    }
  };

  const clearName = async () => {
    try {
      setSavingName(true);
      const res = await api.delete("/admin/settings/field/companyName");
      apply(res.data.data);
      await refreshBrand();
      toast.success("Company name removed");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove company name");
    } finally {
      setSavingName(false);
    }
  };

  const onLogo = (file) => {
    setLogoPreview((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : "";
    });
    setLogoFile(file || null);
  };

  const saveLogo = async () => {
    if (!logoFile) {
      toast.error("Choose a logo image");
      return;
    }
    try {
      setSavingLogo(true);
      const data = new FormData();
      data.append("logo", logoFile);
      const res = await api.patch("/admin/settings", data);
      apply(res.data.data);
      await refreshBrand();
      toast.success("Logo updated");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update logo");
    } finally {
      setSavingLogo(false);
    }
  };

  const clearLogo = async () => {
    try {
      setSavingLogo(true);
      const res = await api.delete("/admin/settings/field/logo");
      apply(res.data.data);
      await refreshBrand();
      toast.success("Logo removed");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove logo");
    } finally {
      setSavingLogo(false);
    }
  };

  const useHere = () => {
    if (!navigator.geolocation) {
      toast.error("This browser cannot read location");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOfficeLat(pos.coords.latitude.toFixed(6));
        setOfficeLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
        toast.success("Location captured. Save it to use this as the office.");
      },
      () => {
        setLocating(false);
        toast.error("Allow location, then try again");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  const saveOffice = async () => {
    const radius = String(officeRadius).trim();
    if (!officeLat || !officeLng) {
      toast.error("Capture the office location first");
      return;
    }
    if (!/^\d+$/.test(radius) || Number(radius) < 5 || Number(radius) > 5000) {
      toast.error("Range must be a whole number from 5 to 5000 meters");
      return;
    }
    try {
      setSavingOffice(true);
      const res = await api.patch("/admin/settings", {
        officeLatitude: Number(officeLat),
        officeLongitude: Number(officeLng),
        officeRadiusMeters: Number(radius),
      });
      apply(res.data.data);
      toast.success("Office location saved");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save office location");
    } finally {
      setSavingOffice(false);
    }
  };

  const saveLetter = async () => {
    const payload = Object.fromEntries(LETTER_FIELDS.map((field) => [field.key, String(extra[field.key] || "").trim()]));
    try {
      setSavingLetter(true);
      const res = await api.patch("/admin/settings", payload);
      apply(res.data.data);
      toast.success("Offer letter details saved");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save offer letter details");
    } finally {
      setSavingLetter(false);
    }
  };

  const saveEveningReport = async () => {
    try {
      setSavingEvening(true);
      const res = await api.patch("/admin/settings", {
        eveningReportEnabled: eveningEnabled,
        eveningReportTime: eveningTime,
      });
      apply(res.data.data);
      toast.success("Evening report schedule saved");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save evening schedule");
    } finally {
      setSavingEvening(false);
    }
  };

  const saveNotifyDefaults = async () => {
    try {
      setSavingNotify(true);
      const res = await api.patch("/admin/settings", {
        notificationDefaults: {
          soundEnabled: notifySound,
          toastEnabled: notifyToast,
        },
      });
      apply(res.data.data);
      toast.success("Notification defaults saved");
      window.dispatchEvent(new CustomEvent("gnet:notification-prefs-changed"));
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save notification defaults");
    } finally {
      setSavingNotify(false);
    }
  };

  const uploadDefaultRingtone = async (file) => {
    if (!file) return;
    try {
      setUploadingRingtone(true);
      const form = new FormData();
      form.append("ringtone", file);
      const res = await api.post("/admin/settings/ringtone", form);
      apply(res.data.data);
      toast.success("Default ringtone uploaded");
      window.dispatchEvent(new CustomEvent("gnet:notification-prefs-changed"));
    } catch (error) {
      toast.error(error.response?.data?.message || "Ringtone upload failed");
    } finally {
      setUploadingRingtone(false);
      if (ringtoneRef.current) ringtoneRef.current.value = "";
    }
  };

  const removeDefaultRingtone = async () => {
    try {
      setUploadingRingtone(true);
      const res = await api.delete("/admin/settings/field/ringtone");
      apply(res.data.data);
      toast.success("Default ringtone removed");
      window.dispatchEvent(new CustomEvent("gnet:notification-prefs-changed"));
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not remove ringtone");
    } finally {
      setUploadingRingtone(false);
    }
  };

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Loading settings...</div>;
  }

  const shownLogo = logoPreview || logoUrl;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Software settings</h1>
        <p className="mt-1 text-sm text-slate-500">Company name, logo, and office location save on their own. Offer letter details save together.</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Company name</h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input className="sm:max-w-md" maxLength={120} value={companyName} onChange={(event) => setCompanyName(event.target.value)} disabled={savingName} />
          <div className="flex gap-2">
            <Button type="button" onClick={saveName} disabled={savingName}>{savingName ? "Saving..." : "Save name"}</Button>
            <Button type="button" variant="outline" onClick={clearName} disabled={savingName || !companyName}>Remove</Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Logo</h2>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {shownLogo ? <img src={shownLogo} alt="Company logo" className="h-full w-full object-contain" /> : <span className="text-xs text-slate-400">No logo</span>}
          </div>
          <div className="space-y-3">
            <FilePicker
              key={logoUrl || "no-logo"}
              accept="image/jpeg,image/png,image/webp,image/avif"
              disabled={savingLogo}
              file={logoFile}
              onChange={onLogo}
              hint="JPG, PNG, WEBP, or AVIF. Up to 2 MB."
            />
            <div className="flex gap-2">
              <Button type="button" onClick={saveLogo} disabled={savingLogo}>{savingLogo ? "Saving..." : "Save logo"}</Button>
              <Button type="button" variant="outline" onClick={clearLogo} disabled={savingLogo || !logoUrl}>Remove</Button>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Office location</h2>
          <p className="mt-1 text-sm text-slate-500">Stand at the office gate, capture this phone or computer location, then save. Attendance punch works inside the range. Change the meters whenever you want.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Latitude</label>
            <Input value={officeLat} onChange={(event) => setOfficeLat(event.target.value)} disabled={savingOffice} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Longitude</label>
            <Input value={officeLng} onChange={(event) => setOfficeLng(event.target.value)} disabled={savingOffice} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Range in meters</label>
            <Input type="number" min={5} max={5000} step={1} value={officeRadius} onChange={(event) => setOfficeRadius(event.target.value)} disabled={savingOffice} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={useHere} disabled={locating || savingOffice}>{locating ? "Reading location..." : "Use my current location"}</Button>
          <Button type="button" onClick={saveOffice} disabled={savingOffice || locating}>{savingOffice ? "Saving..." : "Save office"}</Button>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Evening client reports</h2>
          <p className="mt-1 text-sm text-slate-500">
            Evening reports ab manual hain. Ye setting legacy hai — employees client pe kitna kaam likhte hain, phir RM lock → approve → client sees.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={eveningEnabled}
            onChange={(event) => setEveningEnabled(event.target.checked)}
            disabled={savingEvening}
          />
          Legacy: auto-generate (ab off / unused — reports manual hain)
        </label>
        <div className="max-w-xs">
          <label className="mb-1 block text-xs font-medium text-slate-600">Legacy run time (HH:mm)</label>
          <Input type="time" value={eveningTime} onChange={(event) => setEveningTime(event.target.value)} disabled={savingEvening} />
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={saveEveningReport} disabled={savingEvening}>
            {savingEvening ? "Saving..." : "Save"}
          </Button>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Notification defaults</h2>
          <p className="mt-1 text-sm text-slate-500">
            These apply for every employee/client who has not set personal preferences. Personal overrides win when they enable “Use my personal settings”.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={notifySound}
              onChange={(event) => setNotifySound(event.target.checked)}
              disabled={savingNotify || uploadingRingtone}
            />
            Bell sound on new notification
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={notifyToast}
              onChange={(event) => setNotifyToast(event.target.checked)}
              disabled={savingNotify || uploadingRingtone}
            />
            Toast popup on new notification
          </label>
        </div>

        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-3">
          <p className="text-sm font-medium text-slate-800">Default ringtone (mp3 / wav)</p>
          <p className="mt-1 text-xs text-slate-500">
            {ringtoneUrl
              ? `Uploaded: ${ringtoneName || "ringtone"}`
              : "No custom file — built-in default ringtone will play"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              ref={ringtoneRef}
              type="file"
              accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/mp4,.mp3,.wav,.ogg,.m4a,.aac"
              className="hidden"
              disabled={uploadingRingtone}
              onChange={(event) => uploadDefaultRingtone(event.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              disabled={uploadingRingtone}
              onClick={() => ringtoneRef.current?.click()}
            >
              {uploadingRingtone ? "Uploading..." : "Upload ringtone"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={uploadingRingtone || (!ringtoneUrl && !ringtoneName)}
              onClick={() => {
                const src = ringtoneUrl || "/sounds/notification.mp3";
                unlockNotificationAudio(src);
                playNotificationChime(src);
              }}
            >
              Test ringtone
            </Button>
            {ringtoneUrl ? (
              <Button type="button" variant="outline" className="text-red-600" disabled={uploadingRingtone} onClick={removeDefaultRingtone}>
                Remove ringtone
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={saveNotifyDefaults} disabled={savingNotify || uploadingRingtone}>
            {savingNotify ? "Saving..." : "Save notification defaults"}
          </Button>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Offer letter</h2>
          <p className="mt-1 text-sm text-slate-500">These lines print on the joining letter. A blank line is cleared when you save.</p>
        </div>
        {LETTER_FIELDS.map((field) => (
          <div key={field.key} className="grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-[180px_1fr] sm:items-center">
            <div>
              <p className="text-sm font-medium text-slate-700">{field.label}</p>
              {field.hint && <p className="text-xs text-slate-500">{field.hint}</p>}
            </div>
            <Input
              maxLength={field.max}
              value={extra[field.key] || ""}
              disabled={savingLetter}
              onChange={(event) => setExtra((current) => ({ ...current, [field.key]: event.target.value }))}
            />
          </div>
        ))}
        <div className="flex justify-end border-t border-slate-100 pt-4">
          <Button type="button" onClick={saveLetter} disabled={savingLetter}>{savingLetter ? "Saving..." : "Save"}</Button>
        </div>
      </section>
    </div>
  );
}
