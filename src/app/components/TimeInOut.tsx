import { useState } from "react";
import { CheckCircle, UserCheck } from "lucide-react";
import { API_BASE } from '../../imports/api';

const API = API_BASE;

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("authToken");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

const STATUS_OPTIONS = [
  { value: "", label: "Auto-compute" },
  { value: "PRESENT", label: "Present" },
  { value: "LATE", label: "Late" },
  { value: "HALF DAY", label: "Half Day" },
  { value: "UNDERTIME", label: "Undertime" },
  { value: "ABSENT", label: "Absent" },
  { value: "CLOCKED IN", label: "Clocked In" },
];

type SubmitStatus = "idle" | "loading" | "success" | "error";

export function TimeInOut() {
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [timeIn, setTimeIn] = useState("");
  const [timeOut, setTimeOut] = useState("");
  const [timeOutDate, setTimeOutDate] = useState("");  // empty = same as date
  const [location, setLocation] = useState<"OFFICE" | "ONSITE">("OFFICE");
  const [site, setSite] = useState("");
  const [statusOverride, setStatusOverride] = useState("");
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleReset = () => {
    setSubmitStatus("idle");
    setErrorMessage("");
    setSuccessMsg("");
    setEmployeeId("");
    setDate(new Date().toISOString().slice(0, 10));
    setTimeIn("");
    setTimeOut("");
    setTimeOutDate("");
    setLocation("OFFICE");
    setSite("");
    setStatusOverride("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(employeeId.trim(), 10);
    if (isNaN(id)) {
      setSubmitStatus("error");
      setErrorMessage("Employee ID must be a number");
      return;
    }
    if (!timeIn) {
      setSubmitStatus("error");
      setErrorMessage("Time In is required");
      return;
    }
    setSubmitStatus("loading");
    setErrorMessage("");
    try {
      const body: Record<string, any> = { employeeId: id, date, timeIn, location };
      if (timeOut) body.timeOut = timeOut;
      if (timeOut && timeOutDate && timeOutDate !== date) body.timeOutDate = timeOutDate;
      if (location === "ONSITE" && site.trim()) body.site = site.trim();
      if (statusOverride) body.status = statusOverride;

      const res = await fetch(`${API}/attendance/admin`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitStatus("error");
        setErrorMessage(data.message || "Failed to save attendance record");
        return;
      }
      const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      });
      setSuccessMsg(`${data.message} — Employee #${id} on ${dateLabel}`);
      setSubmitStatus("success");
      setTimeout(() => handleReset(), 5000);
    } catch {
      setSubmitStatus("error");
      setErrorMessage("Cannot reach server. Check your connection.");
    }
  };

  return (
    <div className="p-8">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-8">Time In / Time Out</h2>

        <div className="bg-white rounded-lg border border-gray-200 p-12">
          {(submitStatus === "idle" || submitStatus === "error" || submitStatus === "loading") && (
            <div className="max-w-lg mx-auto">
              <div className="flex items-center justify-center w-16 h-16 rounded-full mx-auto mb-6" style={{ backgroundColor: "#E8F5E8" }}>
                <UserCheck className="w-8 h-8" style={{ color: "#32AD32" }} />
              </div>

              <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">Manual Attendance Entry</h3>
              <p className="text-gray-500 text-center mb-8 text-sm">
                Override or create an attendance record for any employee and date.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Row 1: Employee ID + Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Employee ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={employeeId}
                      onChange={(e) => { setEmployeeId(e.target.value); if (submitStatus === "error") setSubmitStatus("idle"); }}
                      placeholder="e.g. 103"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none"
                    />
                  </div>
                </div>

                {/* Row 2: Time In + Time Out */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Time In <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={timeIn}
                      onChange={(e) => setTimeIn(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Time Out <span className="text-gray-400 text-xs">(optional)</span>
                    </label>
                    <input
                      type="time"
                      value={timeOut}
                      onChange={(e) => setTimeOut(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none"
                    />
                  </div>
                </div>

                {/* Row 2b: Time Out date (only shown when timeOut is filled) */}
                {timeOut && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Time Out Date
                      <span className="text-gray-400 text-xs font-normal ml-1">(if different from the date above, e.g. next-day overtime)</span>
                    </label>
                    <input
                      type="date"
                      value={timeOutDate || date}
                      onChange={(e) => setTimeOutDate(e.target.value)}
                      min={date}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none"
                    />
                  </div>
                )}

                {/* Row 3: Location + Site */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <select
                      value={location}
                      onChange={(e) => {
                        setLocation(e.target.value as "OFFICE" | "ONSITE");
                        if (e.target.value !== "ONSITE") setSite("");
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none bg-white"
                    >
                      <option value="OFFICE">Office</option>
                      <option value="ONSITE">Onsite</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${location !== "ONSITE" ? "text-gray-400" : "text-gray-700"}`}>
                      Site{location !== "ONSITE" && <span className="text-xs font-normal"> (select Onsite first)</span>}
                    </label>
                    <input
                      type="text"
                      value={site}
                      onChange={(e) => setSite(e.target.value)}
                      placeholder="e.g. BGC Office"
                      disabled={location !== "ONSITE"}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none ${
                        location !== "ONSITE"
                          ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                          : "border-gray-300"
                      }`}
                    />
                  </div>
                </div>

                {/* Row 4: Status override */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status Override{" "}
                    <span className="text-gray-400 text-xs font-normal">(leave blank to auto-compute)</span>
                  </label>
                  <select
                    value={statusOverride}
                    onChange={(e) => setStatusOverride(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none bg-white"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Error */}
                {submitStatus === "error" && (
                  <p className="text-sm text-red-600">{errorMessage}</p>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={!employeeId.trim() || !timeIn || submitStatus === "loading"}
                  className="w-full py-3 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  style={{ backgroundColor: "#32AD32" }}
                >
                  {submitStatus === "loading" ? "Saving..." : "Save Attendance Record"}
                </button>
              </form>
            </div>
          )}

          {submitStatus === "success" && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full mb-6" style={{ backgroundColor: "#E8F5E8" }}>
                <CheckCircle className="w-12 h-12" style={{ color: "#32AD32" }} />
              </div>
              <div className="text-2xl font-semibold mb-2" style={{ color: "#32AD32" }}>Saved Successfully!</div>
              <p className="text-gray-600 mb-6">{successMsg}</p>
              <button
                onClick={handleReset}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors text-sm"
              >
                Record Another
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

