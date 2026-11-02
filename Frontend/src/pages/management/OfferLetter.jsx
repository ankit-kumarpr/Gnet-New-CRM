import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Send } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/Button";
import api from "../../services/api";

const when = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const readError = async (error, fallback) => {
  const data = error.response?.data;
  if (data instanceof Blob) {
    try {
      const json = JSON.parse(await data.text());
      return json.message || fallback;
    } catch {
      return fallback;
    }
  }
  return data?.message || fallback;
};

export function OfferLetter() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [letter, setLetter] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const previewRef = useRef("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const showPdf = (url) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = url;
    setPreviewUrl(url);
  };

  const loadPdf = async () => {
    const res = await api.get(`/admin/employees/${id}/offer-letter/pdf`, { responseType: "blob" });
    showPdf(URL.createObjectURL(res.data));
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/admin/employees/${id}/offer-letter`);
        if (cancelled) return;
        setLetter(res.data.data);
        if (res.data.data) await loadPdf();
      } catch (error) {
        if (!cancelled) toast.error(await readError(error, "Failed to load offer letter"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  const generate = async () => {
    try {
      setWorking(true);
      const res = await api.post(`/admin/employees/${id}/offer-letter`);
      setLetter(res.data.data);
      await loadPdf();
      toast.success("Offer letter ready");
    } catch (error) {
      toast.error(await readError(error, "Failed to generate offer letter"));
    } finally {
      setWorking(false);
    }
  };

  const send = async () => {
    try {
      setWorking(true);
      const res = await api.post(`/admin/employees/${id}/offer-letter/send`);
      setLetter(res.data.data);
      toast.success(res.data.message || "Offer letter sent");
    } catch (error) {
      toast.error(await readError(error, "Failed to send offer letter"));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/dashboard/employees/${id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Offer letter</h1>
            <p className="text-sm text-slate-500">
              {letter ? `Ref ${letter.refNumber}` : "Generate a PDF, check it, then send it to the employee."}
              {letter?.sentAt ? ` · Sent ${when.format(new Date(letter.sentAt))} to ${letter.sentTo}` : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!letter && (
            <Button onClick={generate} disabled={working || loading}>
              <FileText className="mr-2 h-4 w-4" />
              {working ? "Generating..." : "Generate"}
            </Button>
          )}
          {letter && (
            <Button onClick={send} disabled={working || loading}>
              <Send className="mr-2 h-4 w-4" />
              {working ? "Sending..." : "Send to email"}
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Loading offer letter...</div>
      ) : previewUrl ? (
        <iframe title="Offer letter preview" src={previewUrl} className="h-[80vh] w-full rounded-xl border border-slate-200 bg-white" />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Generate the letter to preview the PDF.</div>
      )}
    </div>
  );
}
