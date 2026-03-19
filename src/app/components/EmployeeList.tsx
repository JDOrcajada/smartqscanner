import { useState, useEffect, useRef } from "react";
import { Plus, Pencil, Trash2, User, X, AlertTriangle } from "lucide-react";

interface Employee {
  id: string;
  name: string;
  role: string;
  profilePicture: string;
}

const API = "http://localhost:5000/api";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("authToken");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export function EmployeeList() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewPicture, setPreviewPicture] = useState<{ src: string; name: string } | null>(null);

  // Modal
  const [modalMode, setModalMode] = useState<"insert" | "edit" | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form fields
  const [formId, setFormId] = useState("");
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formPicture, setFormPicture] = useState("");
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedEmployee = employees.find((e) => e.id === selectedId) ?? null;

  const fetchEmployees = async () => {
    setLoading(true);
    setPageError("");
    try {
      const res = await fetch(`${API}/employees`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch employees");
      setEmployees(await res.json());
    } catch (err: any) {
      setPageError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const openInsert = () => {
    setFormId("");
    setFormName("");
    setFormRole("");
    setFormPicture("");
    setFormError("");
    setModalMode("insert");
  };

  const openEdit = () => {
    if (!selectedEmployee) return;
    setFormId(selectedEmployee.id);
    setFormName(selectedEmployee.name);
    setFormRole(selectedEmployee.role);
    setFormPicture(selectedEmployee.profilePicture);
    setFormError("");
    setModalMode("edit");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setFormError("Image must be smaller than 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setFormPicture(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formId.trim() || !formName.trim() || !formRole.trim()) {
      setFormError("ID, Name, and Role are required.");
      return;
    }
    setFormLoading(true);
    setFormError("");
    try {
      if (modalMode === "insert") {
        const res = await fetch(`${API}/employees`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            id: formId,
            name: formName,
            role: formRole,
            profilePicture: formPicture,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
      } else {
        const res = await fetch(`${API}/employees/${selectedId}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            name: formName,
            role: formRole,
            profilePicture: formPicture,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
      }
      setModalMode(null);
      setSelectedId(null);
      await fetchEmployees();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    try {
      const res = await fetch(`${API}/employees/${selectedId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }
      setSelectedId(null);
      setShowDeleteConfirm(false);
      await fetchEmployees();
    } catch (err: any) {
      setPageError(err.message);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="p-8">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-8">Employee List</h2>

        <div className="bg-white rounded-lg border border-gray-200">
          {/* Action bar */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200">
            <button
              onClick={openInsert}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg transition-colors hover:opacity-90"
              style={{ backgroundColor: "#32AD32" }}
            >
              <Plus className="w-4 h-4" />
              Insert
            </button>

            <button
              onClick={openEdit}
              disabled={!selectedId}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg transition-colors hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#2563EB" }}
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>

            <button
              onClick={() => selectedId && setShowDeleteConfirm(true)}
              disabled={!selectedId}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg transition-colors hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#DC2626" }}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>

            {selectedId && (
              <span className="ml-auto text-sm text-gray-500">
                Selected:{" "}
                <span className="font-semibold text-gray-800">
                  {selectedEmployee?.name}
                </span>
              </span>
            )}
          </div>

          {/* Page-level error */}
          {pageError && (
            <div className="mx-6 mt-4 px-4 py-3 rounded-lg bg-red-50 text-sm text-red-700 border border-red-200">
              {pageError}
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div className="py-16 text-center text-gray-500">Loading employees...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-16">
                      Photo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Employee ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Employee Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Role
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employees.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-12 text-center text-gray-400"
                      >
                        No employees found. Click Insert to add one.
                      </td>
                    </tr>
                  ) : (
                    employees.map((emp) => {
                      const isSelected = emp.id === selectedId;
                      return (
                        <tr
                          key={emp.id}
                          onClick={() =>
                            setSelectedId(isSelected ? null : emp.id)
                          }
                          className="cursor-pointer hover:bg-gray-50 transition-colors"
                          style={
                            isSelected
                              ? { backgroundColor: "#E8F5E8" }
                              : undefined
                          }
                        >
                          <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                            {emp.profilePicture ? (
                              <img
                                src={emp.profilePicture}
                                alt={emp.name}
                                onClick={() => setPreviewPicture({ src: emp.profilePicture, name: emp.name })}
                                className="w-9 h-9 rounded-full object-cover border border-gray-200 cursor-zoom-in hover:ring-2 hover:ring-offset-1 transition-all"
                                style={{ '--tw-ring-color': '#32AD32' } as React.CSSProperties}
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
                                <User className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-3 text-sm font-medium text-gray-900">
                            {emp.id}
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-800">
                            {emp.name}
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-600">
                            {emp.role}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Insert / Edit Modal ── */}
      {modalMode && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {modalMode === "insert" ? "Add Employee" : "Edit Employee"}
              </h3>
              <button
                onClick={() => setModalMode(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {/* Employee ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee ID
                </label>
                <input
                  type="text"
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                  disabled={modalMode === "edit"}
                  placeholder="e.g. EMP009"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>

              {/* Employee Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Full name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <input
                  type="text"
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  placeholder="e.g. Engineer"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1"
                />
              </div>

              {/* Profile Picture */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Profile Picture
                </label>
                <div className="flex items-center gap-4">
                  {formPicture ? (
                    <img
                      src={formPicture}
                      alt="preview"
                      className="w-14 h-14 rounded-full object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
                      <User className="w-7 h-7 text-gray-400" />
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {formPicture ? "Change Photo" : "Upload Photo"}
                    </button>
                    {formPicture && (
                      <button
                        type="button"
                        onClick={() => setFormPicture("")}
                        className="text-xs text-red-500 hover:text-red-700 text-left"
                      >
                        Remove photo
                      </button>
                    )}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <p className="mt-1 text-xs text-gray-400">Max 2 MB. JPG, PNG, WebP accepted.</p>
              </div>

              {formError && (
                <p className="text-sm text-red-600">{formError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-2.5 text-sm text-white rounded-lg disabled:opacity-50 transition-colors hover:opacity-90"
                  style={{ backgroundColor: "#32AD32" }}
                >
                  {formLoading
                    ? "Saving..."
                    : modalMode === "insert"
                    ? "Add Employee"
                    : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-5 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Image Preview Modal ── */}
      {previewPicture && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setPreviewPicture(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-4 max-w-sm w-full mx-4 flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full">
              <span className="font-semibold text-gray-900 truncate">{previewPicture.name}</span>
              <button
                onClick={() => setPreviewPicture(null)}
                className="text-gray-400 hover:text-gray-600 ml-3 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={previewPicture.src}
              alt={previewPicture.name}
              className="w-64 h-64 rounded-xl object-cover border border-gray-200"
            />
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ── */}
      {showDeleteConfirm && selectedEmployee && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Delete Employee
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete{" "}
              <strong>{selectedEmployee.name}</strong> (
              {selectedEmployee.id})? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 text-sm text-white rounded-lg bg-red-600 hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-5 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
