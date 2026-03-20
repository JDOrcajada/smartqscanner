import React, { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, X, AlertTriangle, User } from "lucide-react";

interface Employee {
  id: number;
  name: string;
  role: string;
  picture: string | null;
  status: string;
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
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Modal
  const [modalMode, setModalMode] = useState<"insert" | "edit" | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeletePasswordConfirm, setShowDeletePasswordConfirm] = useState(false);

  // Form fields
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Delete confirmation
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Picture modal
  const [pictureModal, setPictureModal] = useState<Employee | null>(null);

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
    setFormName("");
    setFormRole("");
    setFormError("");
    setModalMode("insert");
  };

  const openEdit = () => {
    if (!selectedEmployee) return;
    setFormName(selectedEmployee.name);
    setFormRole(selectedEmployee.role);
    setFormError("");
    setModalMode("edit");
  };

  const openPictureModal = (emp: Employee) => {
    setPictureModal(emp);
  };

  const openDeleteConfirm = () => {
    if (!selectedEmployee) return;
    setDeletePassword("");
    setDeleteError("");
    setShowDeletePasswordConfirm(false);
    setShowDeleteConfirm(true);
  };

  const closeDeleteFlow = () => {
    setDeletePassword("");
    setDeleteError("");
    setDeleteLoading(false);
    setShowDeleteConfirm(false);
    setShowDeletePasswordConfirm(false);
  };

  const handlePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pictureModal) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      await fetch(`${API}/employees/${pictureModal.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ picture: base64 }),
      });
      await fetchEmployees();
      window.dispatchEvent(new Event("profile-updated"));
      setPictureModal(null);
    };
    reader.readAsDataURL(file);
  };

  const handlePictureRemove = async () => {
    if (!pictureModal) return;
    await fetch(`${API}/employees/${pictureModal.id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ picture: null }),
    });
    await fetchEmployees();
    window.dispatchEvent(new Event("profile-updated"));
    setPictureModal(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError("Name is required.");
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
            name: formName,
            role: formRole,
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
    if (!deletePassword) {
      setDeleteError("Admin password is required.");
      return;
    }

    setDeleteLoading(true);
    setDeleteError("");
    try {
      const res = await fetch(`${API}/employees/${selectedId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message);
      }
      setSelectedId(null);
      closeDeleteFlow();
      await fetchEmployees();
    } catch (err: any) {
      setDeleteError(err.message);
    } finally {
      setDeleteLoading(false);
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
              onClick={openDeleteConfirm}
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
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Employee ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Employee Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Photo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employees.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
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
                          <td className="px-6 py-3 text-sm font-medium text-gray-900">
                            {emp.id}
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-800">
                            {emp.name}
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-600">
                            {emp.role || <span className="text-gray-300 italic">—</span>}
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-600">
                            <button
                              onClick={(e) => { e.stopPropagation(); openPictureModal(emp); }}
                              className="focus:outline-none"
                            >
                              {emp.picture
                                ? <img src={emp.picture} className="w-10 h-10 rounded-full object-cover" alt="photo" />
                                : <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                                    <User className="w-5 h-5 text-gray-400" />
                                  </div>
                              }
                            </button>
                          </td>
                          <td className="px-6 py-3 text-sm">
                            <span
                              className="px-2 py-0.5 rounded-full text-xs font-medium"
                              style={emp.status === 'ACTIVE'
                                ? { backgroundColor: '#E8F5E8', color: '#32AD32' }
                                : { backgroundColor: '#F3F4F6', color: '#6B7280' }}
                            >
                              {emp.status}
                            </span>
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
              {/* Employee Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee Name <span className="text-red-500">*</span>
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
                  placeholder="e.g. Technician"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1"
                />
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
                onClick={() => {
                  setDeleteError("");
                  setShowDeleteConfirm(false);
                  setShowDeletePasswordConfirm(true);
                }}
                className="flex-1 py-2.5 text-sm text-white rounded-lg bg-red-600 hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={closeDeleteFlow}
                className="px-5 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeletePasswordConfirm && selectedEmployee && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Confirm Admin Password
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Enter your admin password to permanently delete <strong>{selectedEmployee.name}</strong> ({selectedEmployee.id}). This also removes their attendance and admin records from the database.
            </p>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => {
                setDeletePassword(e.target.value);
                setDeleteError("");
              }}
              placeholder="Admin password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 mb-3"
              autoFocus
            />
            {deleteError && (
              <p className="text-sm text-red-600 mb-3">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 py-2.5 text-sm text-white rounded-lg bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteLoading ? "Deleting..." : "Confirm Delete"}
              </button>
              <button
                onClick={() => {
                  setDeleteError("");
                  setShowDeletePasswordConfirm(false);
                  setShowDeleteConfirm(true);
                }}
                disabled={deleteLoading}
                className="px-5 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Picture Modal ── */}
      {pictureModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Employee Photo</h3>
              <button onClick={() => setPictureModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-col items-center gap-4">
              {pictureModal.picture
                ? <img src={pictureModal.picture} className="w-40 h-40 rounded-full object-cover" alt="photo" />
                : <div className="w-40 h-40 rounded-full bg-gray-100 flex items-center justify-center">
                    <User className="w-16 h-16 text-gray-400" />
                  </div>
              }
              <label className="cursor-pointer px-4 py-2 text-sm text-white rounded-lg hover:opacity-90 transition-colors" style={{ backgroundColor: "#32AD32" }}>
                {pictureModal.picture ? "Change Photo" : "Upload Photo"}
                <input type="file" accept="image/*" className="hidden" onChange={handlePictureChange} />
              </label>
              {pictureModal.picture && (
                <button onClick={handlePictureRemove} className="text-sm text-red-500 hover:underline">
                  Remove Photo
                </button>
              )}
              <p className="text-xs text-gray-400 text-center">For best results, use a square photo under 500KB.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
