import { useEffect, useState } from "react";
import { Edit2, ImagePlus, Plus, Search, Shield, ShieldOff, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/Button";
import { FilePicker } from "../../components/ui/FilePicker";
import { Input } from "../../components/ui/Input";
import { Pager } from "../../components/ui/Pager";
import api from "../../services/api";
import { cn } from "../../utils/cn";
import { useAuth } from "../../context/AuthContext";

const emptyForm = {
  title: "",
  subtitle: "",
  linkUrl: "",
  sortOrder: "0",
  status: "ACTIVE",
  startsAt: "",
  endsAt: "",
};

export function OfferBanners() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(["CREATE_OFFER_BANNERS", "MANAGE_OFFER_BANNERS", "MANAGE_SETTINGS"]);
  const canEdit = hasPermission(["EDIT_OFFER_BANNERS", "MANAGE_OFFER_BANNERS", "MANAGE_SETTINGS"]);
  const canDelete = hasPermission(["DELETE_OFFER_BANNERS", "MANAGE_OFFER_BANNERS", "MANAGE_SETTINGS"]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [clearImage, setClearImage] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/offer-banners", {
        params: { search: search || undefined, status: statusFilter || undefined, page, limit },
      });
      setRows(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load offer banners");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [search, statusFilter, page, limit]);

  const openCreate = () => {
    setSelected(null);
    setForm(emptyForm);
    setImageFile(null);
    setClearImage(false);
    setOpen(true);
  };

  const openEdit = (row) => {
    setSelected(row);
    setForm({
      title: row.title || "",
      subtitle: row.subtitle || "",
      linkUrl: row.linkUrl || "",
      sortOrder: String(row.sortOrder ?? 0),
      status: row.status || "ACTIVE",
      startsAt: row.startsAt ? String(row.startsAt).slice(0, 10) : "",
      endsAt: row.endsAt ? String(row.endsAt).slice(0, 10) : "",
    });
    setImageFile(null);
    setClearImage(false);
    setOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    const hasImage = Boolean(imageFile) || (Boolean(selected?.imageUrl) && !clearImage);
    if (!form.title.trim() && !form.subtitle.trim() && !form.linkUrl.trim() && !hasImage) {
      toast.error("Add at least an image, title, subtitle, or link");
      return;
    }
    try {
      setSaving(true);
      const data = new FormData();
      data.append("title", form.title.trim());
      data.append("subtitle", form.subtitle.trim());
      data.append("linkUrl", form.linkUrl.trim());
      data.append("sortOrder", form.sortOrder || "0");
      data.append("status", form.status);
      data.append("startsAt", form.startsAt || "");
      data.append("endsAt", form.endsAt || "");
      if (imageFile) data.append("image", imageFile);
      if (selected && clearImage && !imageFile) data.append("clearImage", "true");

      if (selected) {
        await api.patch(`/admin/offer-banners/${selected._id}`, data);
        toast.success("Banner updated");
      } else {
        await api.post("/admin/offer-banners", data);
        toast.success("Banner created");
      }
      setOpen(false);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not save banner");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (row) => {
    try {
      const status = row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await api.patch(`/admin/offer-banners/status/${row._id}`, { status });
      toast.success("Status updated");
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update status");
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete banner "${row.title || "Untitled"}"?`)) return;
    try {
      await api.delete(`/admin/offer-banners/${row._id}`);
      toast.success("Banner deleted");
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not delete banner");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Offer banners</h1>
          <p className="mt-1 text-sm text-slate-500">
            These banners show on the GNetApp home slider. Active banners with a live date window appear first.
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add banner
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search banners..."
            className="pl-9"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          className="h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-600"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Banner</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Order</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">Loading...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">No banners yet.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row._id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {row.imageUrl ? (
                          <img src={row.imageUrl} alt="" className="h-12 w-20 rounded-md object-cover" />
                        ) : (
                          <div className="flex h-12 w-20 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                            <ImagePlus className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{row.title || "Untitled banner"}</p>
                          <p className="truncate text-xs text-slate-500">{row.subtitle || (row.imageUrl ? "Image banner" : "No details")}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{row.sortOrder ?? 0}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                          row.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
                        )}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {canEdit && (
                          <button type="button" className="rounded-md p-2 text-slate-500 hover:bg-slate-100" onClick={() => openEdit(row)} title="Edit">
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        {canEdit && (
                          <button type="button" className="rounded-md p-2 text-slate-500 hover:bg-slate-100" onClick={() => toggleStatus(row)} title="Toggle status">
                            {row.status === "ACTIVE" ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                          </button>
                        )}
                        {canDelete && (
                          <button type="button" className="rounded-md p-2 text-rose-500 hover:bg-rose-50" onClick={() => remove(row)} title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pager
          page={page}
          pages={totalPages}
          total={total}
          limit={limit}
          onPage={setPage}
          onLimit={(value) => {
            setLimit(value);
            setPage(1);
          }}
        />
      </div>

      {open && (selected ? canEdit : canCreate) && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <form onSubmit={save} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">{selected ? "Edit banner" : "Add banner"}</h2>
              <button type="button" className="text-slate-400 hover:text-slate-700" onClick={() => setOpen(false)}>✕</button>
            </div>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Title (optional)</label>
                  <Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} maxLength={120} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Subtitle (optional)</label>
                  <Input value={form.subtitle} onChange={(e) => setForm((prev) => ({ ...prev, subtitle: e.target.value }))} maxLength={240} />
                </div>
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="mb-1 block text-xs font-medium text-slate-500">Link URL (optional)</label>
                  <Input value={form.linkUrl} onChange={(e) => setForm((prev) => ({ ...prev, linkUrl: e.target.value }))} placeholder="https://..." />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Sort order</label>
                  <Input type="number" value={form.sortOrder} onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
                  <select
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                    value={form.status}
                    onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Starts on</label>
                  <Input type="date" value={form.startsAt} onChange={(e) => setForm((prev) => ({ ...prev, startsAt: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Ends on</label>
                  <Input type="date" value={form.endsAt} onChange={(e) => setForm((prev) => ({ ...prev, endsAt: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Banner image</label>
                <FilePicker accept="image/jpeg,image/png,image/webp,image/avif" file={imageFile} onChange={setImageFile} hint="JPG, PNG, WEBP, AVIF up to 2 MB" />
                {selected?.imageUrl && !imageFile && !clearImage ? (
                  <div className="mt-2 flex items-center gap-3">
                    <img src={selected.imageUrl} alt="" className="h-16 w-28 rounded-md object-cover" />
                    <button type="button" className="text-xs font-medium text-rose-600" onClick={() => setClearImage(true)}>
                      Remove current image
                    </button>
                  </div>
                ) : null}
                {clearImage ? <p className="mt-1 text-xs text-amber-700">Current image will be removed on save.</p> : null}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : selected ? "Update" : "Create"}</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
