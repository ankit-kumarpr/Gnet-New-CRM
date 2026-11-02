import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import { cn } from "../../utils/cn";

export function ProfilePhotoEditor({
  name = "",
  avatarUrl = "",
  canEdit = false,
  size = "lg",
  className,
  onUpdated,
}) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState("");
  const initials = String(name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "?";
  const shown = preview || avatarUrl;
  const dim = size === "sm" ? "h-12 w-12 text-sm" : size === "md" ? "h-16 w-16 text-lg" : "h-20 w-20 text-2xl";

  const upload = async (file) => {
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) {
      toast.error("Choose a jpg, png, or webp image");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Photo must be 2 MB or smaller");
      return;
    }
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    try {
      setBusy(true);
      const data = new FormData();
      data.append("photo", file);
      const res = await api.patch("/auth/profile/photo", data);
      const nextUrl = res.data.data?.avatarUrl || res.data.data?.avatar?.url || "";
      setPreview("");
      onUpdated?.(nextUrl, res.data.data?.avatar);
      toast.success(res.data.message || "Profile photo updated");
    } catch (error) {
      setPreview("");
      toast.error(error.response?.data?.message || "Could not update photo");
    } finally {
      URL.revokeObjectURL(localUrl);
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    if (!avatarUrl && !preview) return;
    if (!window.confirm("Remove your profile photo?")) return;
    try {
      setBusy(true);
      await api.delete("/auth/profile/photo");
      setPreview("");
      onUpdated?.("", { url: "", publicId: "" });
      toast.success("Profile photo removed");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not remove photo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      {shown ? (
        <img
          src={shown}
          alt={name || "Profile"}
          className={cn("rounded-full object-cover shadow-md ring-2 ring-white/40", dim)}
        />
      ) : (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-300 font-semibold text-white shadow-md",
            dim,
          )}
        >
          {initials}
        </div>
      )}

      {canEdit && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
            disabled={busy}
            onChange={(event) => upload(event.target.files?.[0])}
          />
          <button
            type="button"
            disabled={busy}
            title="Change photo"
            onClick={() => inputRef.current?.click()}
            className="absolute -bottom-1 -right-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-700 shadow-sm hover:bg-emerald-50 disabled:opacity-60"
          >
            <Camera className="h-4 w-4" />
          </button>
          {(avatarUrl || preview) && (
            <button
              type="button"
              disabled={busy}
              title="Remove photo"
              onClick={remove}
              className="absolute -bottom-1 -left-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 shadow-sm hover:bg-rose-50 disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
