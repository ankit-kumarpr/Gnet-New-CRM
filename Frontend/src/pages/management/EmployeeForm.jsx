import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Eye, EyeOff, FileText, Plus, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { FilePicker } from "../../components/ui/FilePicker";
import { Input } from "../../components/ui/Input";
import { EmployeeSelect } from "../../components/ui/EmployeeSelect";
import { RichText, plainRichText } from "../../components/ui/RichText";
import api from "../../services/api";
import toast from "react-hot-toast";

const dateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

export function EmployeeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    department: "",
    designation: "",
    employeeType: "",
    workMode: "",
    salary: "",
    joiningDate: "",
    dob: "",
    responsibility: "",
    reportingManager: "",
    address: {
      city: "",
      state: "",
      pincode: "",
      locality: "",
      street: "",
      landmark: ""
    }
  });

  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [employeeTypes, setEmployeeTypes] = useState([]);
  const [workModes, setWorkModes] = useState([]);
  const [existingDocuments, setExistingDocuments] = useState([]);
  const [removedDocumentIds, setRemovedDocumentIds] = useState([]);
  const [documentRows, setDocumentRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(isEditMode);
  const [showPassword, setShowPassword] = useState(false);

  // Fetch departments and employee details if in edit mode
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [deptRes, typeRes, modeRes] = await Promise.all([
          api.get("/admin/departments/list", { params: { status: "ACTIVE", limit: 100 } }),
          api.get("/admin/employee-types/list", { params: { status: "ACTIVE", limit: 100 } }),
          api.get("/admin/work-modes/list", { params: { status: "ACTIVE", limit: 100 } }),
        ]);
        setDepartments(deptRes.data.data || []);
        setEmployeeTypes(typeRes.data.data || []);
        setWorkModes(modeRes.data.data || []);

        if (isEditMode) {
          const empRes = await api.get(`/admin/employees/details/${id}`);
          const employee = empRes.data.data;
          const manager = employee.reportingManager;

          setFormData({
            name: employee.name || "",
            email: employee.email || "",
            phone: employee.phone || "",
            password: "",
            department: employee.department?._id || employee.department || "",
            designation: employee.designation?._id || employee.designation || "",
            employeeType: employee.employeeType?._id || employee.employeeType || "",
            workMode: employee.workMode?._id || employee.workMode || "",
            salary: employee.salary ?? "",
            joiningDate: dateInput(employee.joiningDate),
            dob: dateInput(employee.dob),
            responsibility: employee.responsibility || "",
            reportingManager: manager?._id || "",
            address: {
              city: employee.address?.city || "",
              state: employee.address?.state || "",
              pincode: employee.address?.pincode || "",
              locality: employee.address?.locality || "",
              street: employee.address?.street || "",
              landmark: employee.address?.landmark || ""
            }
          });
          setExistingDocuments(employee.documents || []);
          setRemovedDocumentIds([]);
        }
      } catch (error) {
        console.error("Failed to fetch initial data", error);
        toast.error("Failed to load data");
      } finally {
        setIsFetching(false);
      }
    };
    fetchInitialData();
  }, [id, isEditMode]);

  // Fetch designations based on selected department
  useEffect(() => {
    if (formData.department) {
      const fetchDesignations = async () => {
        try {
          const res = await api.get("/admin/designations/list", { params: { department: formData.department, status: "ACTIVE", limit: 100 } });
          setDesignations(res.data.data || []);
        } catch (error) {
          console.error("Failed to fetch designations", error);
        }
      };
      fetchDesignations();
    } else {
      setDesignations([]);
    }
  }, [formData.department]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "phone") {
      setFormData((prev) => ({ ...prev, phone: value.replace(/\D/g, "").slice(0, 10) }));
      return;
    }
    if (["city", "state", "pincode", "locality", "street", "landmark"].includes(name)) {
      setFormData(prev => ({ ...prev, address: { ...prev.address, [name]: value } }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const addDocumentRow = () => {
    setDocumentRows((rows) => [...rows, { key: `${Date.now()}-${rows.length}`, name: "", file: null }]);
  };

  const updateDocumentRow = (key, patch) => {
    setDocumentRows((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const removeDocumentRow = (key) => {
    setDocumentRows((rows) => rows.filter((row) => row.key !== key));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const filledRows = documentRows.filter((row) => row.name.trim() || row.file);
    if (filledRows.some((row) => !row.name.trim() || !row.file)) {
      toast.error("Har document ka naam aur file dono chahiye");
      return;
    }
    if (filledRows.some((row) => row.name.trim().length > 80)) {
      toast.error("Document name 80 characters se chhota hona chahiye");
      return;
    }
    if (!/^[0-9]{10}$/.test(formData.phone)) {
      toast.error("Phone number must be 10 digits");
      return;
    }
    if (!plainRichText(formData.responsibility)) {
      toast.error("Responsibility is required");
      return;
    }
    const keptDocuments = existingDocuments.filter((doc) => !removedDocumentIds.includes(doc._id));
    if (keptDocuments.length + filledRows.length > 8) {
      toast.error("Ek employee par 8 documents tak add ho sakte hain");
      return;
    }

    try {
      setIsLoading(true);
      const payload = new FormData();
      payload.append("name", formData.name);
      payload.append("phone", formData.phone);
      payload.append("department", formData.department);
      payload.append("designation", formData.designation);
      payload.append("employeeType", formData.employeeType);
      payload.append("workMode", formData.workMode);
      payload.append("salary", formData.salary);
      payload.append("joiningDate", formData.joiningDate);
      payload.append("dob", formData.dob);
      payload.append("responsibility", formData.responsibility);
      payload.append("reportingManager", formData.reportingManager || "");
      payload.append("address", JSON.stringify(formData.address));
      if (!isEditMode) {
        payload.append("email", formData.email);
        payload.append("password", formData.password);
      }
      if (filledRows.length) {
        payload.append("documentNames", JSON.stringify(filledRows.map((row) => row.name.trim())));
        filledRows.forEach((row) => payload.append("documents", row.file));
      }
      if (isEditMode && removedDocumentIds.length) {
        payload.append("removeDocumentIds", JSON.stringify(removedDocumentIds));
      }

      if (isEditMode) {
        await api.patch(`/admin/employees/update/${id}`, payload);
        toast.success("Employee updated successfully");
      } else {
        const { data } = await api.post("/admin/employees/create", payload);
        toast.success(data?.message || "Employee created successfully");
      }

      navigate("/dashboard/employees");
    } catch (error) {
      toast.error(error.response?.data?.message || "Operation failed");
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return <div className="p-8 text-center text-slate-500">Loading data...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/employees")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {isEditMode ? "Edit Employee" : "Create New Employee"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isEditMode ? "Update the employee's details and assignments." : "Fill in the details to add a new employee to the system."}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <form onSubmit={handleSubmit} className="divide-y divide-slate-100">
          
          <div className="p-6 space-y-4">
            <h3 className="text-lg font-medium text-slate-900">Basic Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                <Input name="name" value={formData.name} onChange={handleChange} required disabled={isLoading} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                <Input name="email" type="email" value={formData.email} onChange={handleChange} required disabled={isLoading || isEditMode} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number *</label>
                <Input name="phone" inputMode="numeric" maxLength={10} pattern="[0-9]{10}" title="Enter a 10 digit phone number" value={formData.phone} onChange={handleChange} required disabled={isLoading} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {isEditMode ? "Password (leave blank to keep current)" : "Password *"}
                </label>
                <div className="relative">
                  <Input name="password" type={showPassword ? "text" : "password"} value={formData.password} onChange={handleChange} required={!isEditMode} disabled={isLoading} className="pr-10" />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {!isEditMode && (
                  <p className="mt-1 text-xs text-slate-500">
                    Save pe Employee ID + email + password is email par welcome mail jayegi.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4 bg-slate-50">
            <h3 className="text-lg font-medium text-slate-900">Job Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Department *</label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Select a department</option>
                  {departments.map((dept) => (
                    <option key={dept._id} value={dept._id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Designation *</label>
                <select
                  name="designation"
                  value={formData.designation}
                  onChange={handleChange}
                  required
                  disabled={isLoading || !formData.department}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">Select a designation</option>
                  {designations.map((desig) => (
                    <option key={desig._id} value={desig._id}>{desig.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Employee type *</label>
                <select name="employeeType" value={formData.employeeType} onChange={handleChange} required disabled={isLoading} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                  <option value="">Select employee type</option>
                  {employeeTypes.map((item) => (
                    <option key={item._id} value={item._id}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Work mode *</label>
                <select name="workMode" value={formData.workMode} onChange={handleChange} required disabled={isLoading} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                  <option value="">Select work mode</option>
                  {workModes.map((item) => (
                    <option key={item._id} value={item._id}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Salary *</label>
                <Input name="salary" type="number" min="0" step="0.01" value={formData.salary} onChange={handleChange} required disabled={isLoading} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Joining date *</label>
                <Input name="joiningDate" type="date" value={formData.joiningDate} onChange={handleChange} required disabled={isLoading} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date of birth *</label>
                <Input name="dob" type="date" value={formData.dob} onChange={handleChange} required disabled={isLoading} />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Responsibility *</label>
                <RichText
                  value={formData.responsibility}
                  placeholder="What this employee is responsible for"
                  disabled={isLoading}
                  onChange={(html) => setFormData((prev) => ({ ...prev, responsibility: html }))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Reports to</label>
                <EmployeeSelect
                  value={formData.reportingManager}
                  onChange={(next) => setFormData((prev) => ({ ...prev, reportingManager: next === id ? "" : next }))}
                  placeholder="No manager"
                  allowEmpty
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <h3 className="text-lg font-medium text-slate-900">Address Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Street</label>
                <Input name="street" value={formData.address.street} onChange={handleChange} disabled={isLoading} />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Locality</label>
                <Input name="locality" value={formData.address.locality} onChange={handleChange} disabled={isLoading} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Landmark</label>
                <Input name="landmark" value={formData.address.landmark} onChange={handleChange} disabled={isLoading} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                <Input name="city" value={formData.address.city} onChange={handleChange} disabled={isLoading} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                <Input name="state" value={formData.address.state} onChange={handleChange} disabled={isLoading} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pincode</label>
                <Input name="pincode" value={formData.address.pincode} onChange={handleChange} disabled={isLoading} />
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4 bg-slate-50">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-medium text-slate-900">Documents</h3>
                <p className="text-sm text-slate-500 mt-1">Optional. Document ka naam likho aur PDF ya image attach karo. Files Cloudinary par save hongi.</p>
              </div>
              <Button type="button" variant="outline" className="gap-2" onClick={addDocumentRow} disabled={isLoading}>
                <Plus className="h-4 w-4" />
                Add document
              </Button>
            </div>

            {existingDocuments.filter((doc) => !removedDocumentIds.includes(doc._id)).length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {existingDocuments
                  .filter((doc) => !removedDocumentIds.includes(doc._id))
                  .map((doc) => (
                    <div key={doc._id} className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-white px-3 py-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                        <FileText className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{doc.name}</p>
                        <p className="text-xs uppercase tracking-wide text-slate-400">{doc.format || doc.resourceType || "file"}</p>
                      </div>
                      <a href={doc.url} target="_blank" rel="noreferrer" className="rounded-md p-2 text-emerald-700 hover:bg-emerald-50" title="View">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => setRemovedDocumentIds((ids) => [...ids, doc._id])}
                        className="rounded-md p-2 text-rose-600 hover:bg-rose-50"
                        title="Remove"
                        disabled={isLoading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
              </div>
            )}

            {documentRows.length === 0 && existingDocuments.filter((doc) => !removedDocumentIds.includes(doc._id)).length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                Koi document add nahi kiya. Employee bina documents ke bhi save ho sakta hai.
              </p>
            )}

            {documentRows.length > 0 && (
              <div className="space-y-3">
                {documentRows.map((row, index) => (
                  <div key={row.key} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_1.2fr_auto] sm:items-end">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Document name</label>
                      <Input
                        value={row.name}
                        placeholder="Aadhaar, PAN, photo"
                        maxLength={80}
                        disabled={isLoading}
                        onChange={(event) => updateDocumentRow(row.key, { name: event.target.value })}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">PDF or image</label>
                      <FilePicker
                        accept="application/pdf,image/jpeg,image/png,image/webp,image/avif"
                        disabled={isLoading}
                        file={row.file}
                        onChange={(file) => updateDocumentRow(row.key, { file })}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDocumentRow(row.key)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm text-rose-600 hover:bg-rose-50"
                      disabled={isLoading}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sm:hidden">Remove {index + 1}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-6 bg-white flex items-center justify-end gap-3 rounded-b-xl">
            <Button type="button" variant="outline" onClick={() => navigate("/dashboard/employees")} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="min-w-[120px]">
              {isLoading ? "Saving..." : (isEditMode ? "Update Employee" : "Create Employee")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
