import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import api from "../../services/api";
import toast from "react-hot-toast";

export function NameModal({ isOpen, onClose, item, onSuccess, title, placeholder, endpoint }) {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setName(item?.name || "");
  }, [item, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error(`${title} name is required`);
      return;
    }

    try {
      setIsLoading(true);
      if (item) {
        await api.patch(`${endpoint}/update/${item._id}`, { name });
        toast.success(`${title} updated`);
      } else {
        await api.post(`${endpoint}/create`, { name });
        toast.success(`${title} created`);
      }
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || "Operation failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">{item ? `Edit ${title}` : `Add ${title}`}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={placeholder} disabled={isLoading} autoFocus />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>{isLoading ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
