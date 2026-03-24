import { useState } from "react";
import { Calendar, Download, FileText } from "lucide-react";
import { API_BASE } from '../../imports/api';

const API = API_BASE;

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("authToken");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

interface AttendanceLog {
  logId: number;
  employeeId: number;
  employeeName: string;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  status: string;
  isLate: boolean;
  location: string | null;
  site: string | null;
}

export function GenerateReports() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [records, setRecords] = useState<AttendanceLog[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportError, setReportError] = useState("");

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      setReportError("Please select both start and end dates");
      return;
    }
    setReportError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/attendance`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch attendance data");
      const all: AttendanceLog[] = await res.json();
      const filtered = all.filter((r) => {
        return r.date >= startDate && r.date <= endDate;
      });
      setRecords(filtered);
      setShowPreview(true);
    } catch (err: any) {
      setReportError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const header = ["Employee Name", "Employee ID", "Date", "Time In", "Time Out", "Location", "Site", "Status"];
    const rows = records.map((r) => [
      r.employeeName,
      r.employeeId,
      // Format as "Mar 20, 2026" — prevents Excel from auto-converting to a date cell
      r.date ? new Date(r.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
      r.timeIn ?? "",
      r.timeOut ?? "",
      r.location ?? "",
      r.site ?? "",
      r.status,
    ]);
    const csv = [header, ...rows].map((row) => row.map((v) => `"${v}"`).join(",")).join("\n");
    // UTF-8 BOM ensures Excel opens the file with correct encoding
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${startDate}_to_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPrint = () => {
    window.print();
  };

  const getStatusColor = (status: string) => {
    const s = status.toUpperCase();
    if (s === "PRESENT") return "#32AD32";
    if (s === "LATE") return "#F59E0B";
    if (s === "HALF DAY") return "#F97316";
    if (s === "UNDERTIME") return "#F97316";
    if (s === "ABSENT") return "#DC2626";
    if (s === "CLOCKED IN") return "#2563EB";
    if (s.startsWith("OVERTIME")) return "#7C3AED";
    return "#6B7280";
  };

  return (
    <div className="p-8">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-8">Generate Reports</h2>

        {/* Report Configuration */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Settings</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50"
                  style={{ focusRingColor: "#32AD32" }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50"
                  style={{ focusRingColor: "#32AD32" }}
                />
              </div>
            </div>

          </div>

          <div className="flex gap-3">
            <button
              onClick={handleGenerateReport}
              disabled={loading}
              className="px-6 py-2 text-white rounded-lg transition-colors hover:opacity-90 flex items-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: "#32AD32" }}
            >
              <FileText className="w-4 h-4" />
              {loading ? "Loading..." : "Generate Report"}
            </button>

            {showPreview && (
              <button
                onClick={() => { setShowPreview(false); setRecords([]); }}
                className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Clear Preview
              </button>
            )}
          </div>
          {reportError && <p className="mt-3 text-sm text-red-600">{reportError}</p>}
        </div>

        {/* Report Preview */}
        {showPreview && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Attendance Report Preview
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {startDate && endDate
                    ? `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`
                    : "All dates"}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleExportCSV}
                  className="px-4 py-2 text-white rounded-lg transition-colors hover:opacity-90 flex items-center gap-2 text-sm"
                  style={{ backgroundColor: "#32AD32" }}
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
                <button
                  onClick={handleExportPrint}
                  className="px-4 py-2 text-white rounded-lg transition-colors hover:opacity-90 flex items-center gap-2 text-sm"
                  style={{ backgroundColor: "#32AD32" }}
                >
                  <Download className="w-4 h-4" />
                  Print / PDF
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Employee Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Employee ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Time In
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Time Out
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Site
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {records.length > 0 ? (
                    records.map((record) => (
                      <tr key={record.logId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.employeeName || "—"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{record.employeeId}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(record.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" style={{ color: record.isLate ? "#DC2626" : undefined }}>
                          {record.timeIn || <span className="text-gray-400 italic font-normal">—</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.timeOut || <span className="text-gray-400 italic">Not yet</span>}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{record.location || "—"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{record.site || "—"}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full text-white" style={{ backgroundColor: getStatusColor(record.status) }}>
                            {record.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                        No records found for the selected date range
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {records.length > 0 && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
                Total Records: {records.length}
              </div>
            )}
          </div>
        )}

        {!showPreview && (
          <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              Select date range and department, then click "Generate Report" to preview
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
