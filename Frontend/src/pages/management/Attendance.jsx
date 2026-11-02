import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/Button";
import api from "../../services/api";
import { formatDateTime } from "./leadOptions";

const shotTime = (shot) => (shot?.at ? formatDateTime(shot.at) : "—");

export function Attendance() {
  const [payload, setPayload] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [punching, setPunching] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const load = async () => {
    const res = await api.get("/admin/attendance", { params: { scope: "mine", limit: 1 } });
    setPayload(res.data);
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => {
    let cancelled = false;
    api.get("/admin/attendance", { params: { scope: "mine", limit: 1 } })
      .then((res) => { if (!cancelled) setPayload(res.data); })
      .catch((error) => { if (!cancelled) toast.error(error.response?.data?.message || "Failed to load attendance"); });
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
  }, [cameraOn]);

  const today = payload?.today;
  const punchedIn = Boolean(today?.punchIn);
  const punchedOut = Boolean(today?.punchOut);
  const action = !punchedIn ? "in" : !punchedOut ? "out" : "";

  const startCamera = async () => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !navigator.geolocation) {
      toast.error("Punch needs location and camera. Use the phone browser on this site.");
      return;
    }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      setCameraOn(true);
    } catch {
      toast.error("Allow the camera, then try again");
    }
  };

  const captureAndPunch = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth) {
      toast.error("Camera is not ready");
      return;
    }
    const width = Math.min(video.videoWidth, 1280);
    const height = Math.round((width * video.videoHeight) / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(video, 0, 0, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) {
      toast.error("Could not take the photo");
      return;
    }
    try {
      setPunching(true);
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
      });
      const data = new FormData();
      data.append("photo", blob, "punch.jpg");
      data.append("latitude", String(pos.coords.latitude));
      data.append("longitude", String(pos.coords.longitude));
      data.append("accuracy", String(pos.coords.accuracy || ""));
      data.append("action", action);
      await api.post("/admin/attendance/punch", data);
      toast.success(action === "in" ? "Punched in" : "Punched out");
      stopCamera();
      setCameraOn(false);
      await load();
    } catch (error) {
      if (error.response) toast.error(error.response?.data?.message || "Punch failed");
      else if (error.code === 1) toast.error("Allow location, then try again");
      else toast.error("Could not read your location. Step outside and try again");
    } finally {
      setPunching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Attendance</h1>
          <p className="mt-1 text-sm text-slate-500">Punch in and punch out with a live photo while you are inside the office range. One punch in and one punch out each day.</p>
        </div>
        <Link to="/dashboard/attendance-report" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">Attendance report</Link>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Today</h2>
            <p className="mt-1 text-sm text-slate-500">
              {payload?.officeReady ? `Office range is ${payload.radiusMeters} m. The photo is taken now, not chosen from the gallery.` : "Office location is not set yet. An admin can save it in Settings."}
            </p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-slate-500">Punch in</dt>
                <dd className="text-sm font-medium text-slate-900">{shotTime(today?.punchIn)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Punch out</dt>
                <dd className="text-sm font-medium text-slate-900">{shotTime(today?.punchOut)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Hours</dt>
                <dd className="text-sm font-medium text-slate-900">{today?.hours || "—"}</dd>
              </div>
            </dl>
          </div>
          {action && (
            <Button type="button" onClick={startCamera} disabled={!payload?.officeReady || cameraOn || punching}>
              {action === "in" ? "Punch in" : "Punch out"}
            </Button>
          )}
        </div>
        {cameraOn && (
          <div className="mt-4 max-w-md space-y-3">
            <video ref={videoRef} autoPlay playsInline muted className="aspect-[4/3] w-full rounded-xl bg-slate-900 object-cover" />
            <div className="flex gap-2">
              <Button type="button" onClick={captureAndPunch} disabled={punching}>{punching ? "Punching..." : "Take photo and punch"}</Button>
              <Button type="button" variant="outline" disabled={punching} onClick={() => { stopCamera(); setCameraOn(false); }}>Cancel</Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
