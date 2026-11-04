import { useEffect, useMemo, useState } from "react";
import { Edit2, Mail, Plus, Search, Send, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { FilePicker } from "../../components/ui/FilePicker";
import { Pager } from "../../components/ui/Pager";
import { RichText, plainRichText } from "../../components/ui/RichText";
import api from "../../services/api";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

const emptyTemplate = { name: "", subject: "", body: "" };

export function ClientEmails() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("MANAGE_EMAIL_TEMPLATES") || hasPermission("CREATE_EMAIL_TEMPLATES");
  const canEdit = hasPermission("MANAGE_EMAIL_TEMPLATES") || hasPermission("EDIT_EMAIL_TEMPLATES");
  const canDelete = hasPermission("MANAGE_EMAIL_TEMPLATES") || hasPermission("DELETE_EMAIL_TEMPLATES");
  const canSend = hasPermission("MANAGE_EMAIL_TEMPLATES") || hasPermission("SEND_CLIENT_MAILS");

  const [rows, setRows] = useState([]);
  const [templateOptions, setTemplateOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyTemplate);

  const [showSend, setShowSend] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendTemplateId, setSendTemplateId] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendBody, setSendBody] = useState("");
  const [extraEmails, setExtraEmails] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState("");
  const debouncedClientSearch = useDebouncedValue(clientSearch, 250);
  const [selectedClients, setSelectedClients] = useState([]);
  const [sendResults, setSendResults] = useState([]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/email-templates", {
        params: { search: debouncedSearch, page, limit },
      });
      setRows(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      const res = await api.get("/admin/email-templates/recipients", {
        params: { search: debouncedClientSearch },
      });
      setClients(res.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load clients");
    }
  };

  const loadTemplateOptions = async () => {
    try {
      const res = await api.get("/admin/email-templates", { params: { limit: 100, page: 1 } });
      setTemplateOptions(res.data.data || []);
    } catch {
      setTemplateOptions(rows);
    }
  };

  useEffect(() => {
    load();
  }, [debouncedSearch, page, limit]);

  useEffect(() => {
    if (showSend && canSend) {
      loadClients();
      loadTemplateOptions();
    }
  }, [showSend, debouncedClientSearch, canSend]);

  const openCreate = () => {
    setSelected(null);
    setForm(emptyTemplate);
    setShowSend(false);
    setShowForm(true);
  };

  const openEdit = (row) => {
    setSelected(row);
    setForm({
      name: row.name || "",
      subject: row.subject || "",
      body: row.body || "",
    });
    setShowSend(false);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setSelected(null);
    setForm(emptyTemplate);
  };

  const openSend = (row) => {
    const template = row || null;
    setShowForm(false);
    setShowSend(true);
    setSendResults([]);
    setAttachments([]);
    setExtraEmails("");
    setSelectedClients([]);
    setClientSearch("");
    if (template) {
      setSendTemplateId(template._id);
      setSendSubject(template.subject || "");
      setSendBody(template.body || "");
    } else {
      setSendTemplateId("");
      setSendSubject("");
      setSendBody("");
    }
  };

  const onPickTemplate = (id) => {
    setSendTemplateId(id);
    const row = templateOptions.find((item) => item._id === id) || rows.find((item) => item._id === id);
    if (row) {
      setSendSubject(row.subject || "");
      setSendBody(row.body || "");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || form.name.trim().length < 2) {
      toast.error("Template name is required");
      return;
    }
    if (!form.subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    if (!plainRichText(form.body)) {
      toast.error("Mail body is required");
      return;
    }
    const payload = {
      name: form.name.trim(),
      subject: form.subject.trim(),
      body: form.body,
    };
    try {
      setSaving(true);
      if (selected) {
        await api.patch(`/admin/email-templates/${selected._id}`, payload);
        toast.success("Template updated");
      } else {
        await api.post("/admin/email-templates", payload);
        toast.success("Template created");
      }
      closeForm();
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not save template");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete template "${row.name}"?`)) return;
    try {
      await api.delete(`/admin/email-templates/${row._id}`);
      toast.success("Template deleted");
      if (selected?._id === row._id) closeForm();
      if (sendTemplateId === row._id) {
        setSendTemplateId("");
        setSendSubject("");
        setSendBody("");
      }
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not delete template");
    }
  };

  const toggleClient = (id) => {
    setSelectedClients((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const allVisibleSelected = useMemo(
    () => clients.length > 0 && clients.every((item) => selectedClients.includes(item._id)),
    [clients, selectedClients],
  );

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      const visible = new Set(clients.map((item) => item._id));
      setSelectedClients((current) => current.filter((id) => !visible.has(id)));
      return;
    }
    setSelectedClients((current) => [...new Set([...current, ...clients.map((item) => item._id)])]);
  };

  const handleSend = async () => {
    if (!sendSubject.trim()) {
      toast.error("Subject is required");
      return;
    }
    if (!plainRichText(sendBody)) {
      toast.error("Mail body is required");
      return;
    }
    if (!selectedClients.length && !extraEmails.trim()) {
      toast.error("Select clients or add extra emails");
      return;
    }
    const data = new FormData();
    if (sendTemplateId) data.append("templateId", sendTemplateId);
    data.append("subject", sendSubject.trim());
    data.append("body", sendBody);
    data.append("clientIds", JSON.stringify(selectedClients));
    data.append("extraEmails", extraEmails);
    attachments.forEach((file) => data.append("attachments", file));

    try {
      setSending(true);
      const res = await api.post("/admin/email-templates/send", data);
      setSendResults(res.data.results || []);
      toast.success(res.data.message || `Sent ${res.data.sent || 0} mails`);
      if (res.data.sent) {
        setAttachments([]);
      }
    } catch (error) {
      setSendResults(error.response?.data?.results || []);
      toast.error(error.response?.data?.message || "Could not send mails");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Client emails</h1>
          <p className="mt-1 text-sm text-slate-500">
            Templates banao, clients select karo, extra emails add karo, attachments ke saath mail bhejo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSend && (
            <Button type="button" variant="outline" onClick={() => openSend()}>
              <Send className="mr-2 h-4 w-4" />
              Send mail
            </Button>
          )}
          {canCreate && !showForm && (
            <Button type="button" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              New template
            </Button>
          )}
        </div>
      </div>

      {showForm && (selected ? canEdit : canCreate) && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{selected ? "Edit template" : "New template"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Template name *</label>
              <Input
                value={form.name}
                maxLength={120}
                disabled={saving}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="e.g. Renewal reminder"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Subject *</label>
              <Input
                value={form.subject}
                maxLength={200}
                disabled={saving}
                onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
                placeholder="Mail subject"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Body *</label>
            <RichText
              value={form.body}
              disabled={saving}
              placeholder="Write the mail body. Use {{name}}, {{email}}, {{clientId}}, {{phone}}"
              onChange={(value) => setForm((current) => ({ ...current, body: value }))}
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Tokens: {"{{name}}"}, {"{{email}}"}, {"{{clientId}}"}, {"{{phone}}"}
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={closeForm} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : selected ? "Update" : "Create"}</Button>
          </div>
        </form>
      )}

      {showSend && canSend && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Send mail</h2>
            <Button type="button" variant="outline" onClick={() => setShowSend(false)} disabled={sending}>Close</Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Template</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  value={sendTemplateId}
                  disabled={sending}
                  onChange={(event) => onPickTemplate(event.target.value)}
                >
                  <option value="">Custom / none</option>
                  {(templateOptions.length ? templateOptions : rows).map((row) => (
                    <option key={row._id} value={row._id}>{row.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Subject *</label>
                <Input value={sendSubject} maxLength={200} disabled={sending} onChange={(event) => setSendSubject(event.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Body *</label>
                <RichText
                  value={sendBody}
                  disabled={sending}
                  placeholder="Mail body"
                  onChange={setSendBody}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Extra emails</label>
                <textarea
                  rows={3}
                  disabled={sending}
                  value={extraEmails}
                  onChange={(event) => setExtraEmails(event.target.value)}
                  placeholder="Comma or new-line se alag emails"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Attachments</label>
                <FilePicker
                  multiple
                  files={attachments}
                  disabled={sending}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.zip"
                  onChange={setAttachments}
                  hint="Up to 8 files, 8 MB each."
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium text-slate-700">
                  Clients ({selectedClients.length} selected)
                </label>
                <button
                  type="button"
                  className="text-xs font-medium text-emerald-700 hover:underline"
                  onClick={toggleAllVisible}
                  disabled={sending || !clients.length}
                >
                  {allVisibleSelected ? "Clear visible" : "Select visible"}
                </button>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9"
                  value={clientSearch}
                  disabled={sending}
                  onChange={(event) => setClientSearch(event.target.value)}
                  placeholder="Search client name / email"
                />
              </div>
              <div className="max-h-96 space-y-1 overflow-auto rounded-md border border-slate-200 p-2">
                {clients.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-slate-500">No clients with email found</p>
                ) : clients.map((client) => {
                  const checked = selectedClients.includes(client._id);
                  return (
                    <label
                      key={client._id}
                      className={`flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-slate-50 ${checked ? "bg-emerald-50" : ""}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={checked}
                        disabled={sending}
                        onChange={() => toggleClient(client._id)}
                      />
                      <span className="min-w-0">
                        <span className="block font-medium text-slate-900">{client.name}</span>
                        <span className="block truncate text-xs text-slate-500">{client.email}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowSend(false)} disabled={sending}>Cancel</Button>
            <Button type="button" onClick={handleSend} disabled={sending}>
              <Mail className="mr-2 h-4 w-4" />
              {sending ? "Sending..." : "Send now"}
            </Button>
          </div>

          {sendResults.length > 0 && (
            <ul className="max-h-48 space-y-1 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              {sendResults.map((item, index) => (
                <li key={`${item.email}-${index}`} className={item.sent ? "text-emerald-700" : "text-red-700"}>
                  {item.sent ? "Sent" : "Failed"} — {item.name ? `${item.name} · ` : ""}{item.email}
                  {!item.sent && item.reason ? ` (${item.reason})` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Search templates"
            />
          </div>
          <p className="text-sm text-slate-500">{total} template{total === 1 ? "" : "s"}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-500">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-500">No templates yet</td></tr>
              ) : rows.map((row) => (
                <tr key={row._id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                  <td className="px-4 py-3 text-slate-600">{row.subject}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString("en-IN") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {canSend && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => openSend(row)} title="Send">
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                      {canEdit && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(row)} title="Edit">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => handleDelete(row)} title="Delete">
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pager page={page} pages={totalPages} limit={limit} total={total} onPage={setPage} onLimit={(value) => { setLimit(value); setPage(1); }} />
      </div>
    </div>
  );
}
