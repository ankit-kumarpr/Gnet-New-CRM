import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import api from "../../services/api";
import toast from "react-hot-toast";

export function DesignationModal({ isOpen, onClose, designation, onSuccess }) {
  const [name, setName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [departments, setDepartments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch departments for the select dropdown
  useEffect(() => {
    if (isOpen) {
      const fetchDepartments = async () => {
        try {
          const res = await api.get("/admin/departments/list", { params: { status: "ACTIVE", limit: 100 } });
          setDepartments(res.data.data || []);
        } catch (error) {
          console.error("Failed to fetch departments", error);
        }
      };
      fetchDepartments();
    }
  }, [isOpen]);

  useEffect(() => {
    if (designation) {
      setName(designation.name);
      setDepartmentId(designation.department?._id || designation.department);
    } else {
      setName("");
      setDepartmentId("");
    }
  }, [designation, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Designation name is required");
      return;
    }
    if (!departmentId) {
      toast.error("Please select a department");
      return;
    }

    try {
      setIsLoading(true);
      if (designation) {
        await api.patch(`/admin/designations/update/${designation._id}`, { name });
        // The backend updateDesignation seems to only update name based on the swagger docs.
        toast.success("Designation updated successfully");
      } else {
        await api.post("/admin/designations/create", { name, department: departmentId });
        toast.success("Designation created successfully");
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
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold text-slate-900">
            {designation ? "Edit Designation" : "Add Designation"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Department
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              disabled={isLoading || !!designation} // Usually cannot change dept of existing designation
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
            >
              <option value="">Select a department</option>
              {departments.map((dept) => (
                <option key={dept._id} value={dept._id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Designation Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Software Engineer"
              disabled={isLoading}
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
