import { useState, useEffect } from "react";
import { Search } from "lucide-react";

const API = "http://localhost:5000/api";

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

export function SearchAttendance() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [records, setRecords] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/attendance`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((data) => { setRecords(data); setLoading(false); })
      .catch(() => { setPageError("Failed to load attendance records"); setLoading(false); });
  }, []);

  const filteredRecords = records.filter((record) => {
    const matchesSearch =
      record.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(record.employeeId).includes(searchTerm);
    const matchesDate = selectedDate ? record.date === selectedDate : true;
    return matchesSearch && matchesDate;
  });

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
        <h2 className="text-2xl font-semibold text-gray-900 mb-8">Search Attendance</h2>

        {/* Search and Filter Bar */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by Employee Name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none"
              />
            </div>
            <div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none"
              />
            </div>
            {(searchTerm || selectedDate) && (
              <button
                onClick={() => { setSearchTerm(""); setSelectedDate(""); }}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Attendance Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {pageError && (
            <div className="px-6 py-4 text-sm text-red-600 bg-red-50 border-b border-red-200">{pageError}</div>
          )}
          {loading ? (
            <div className="py-16 text-center text-gray-500">Loading attendance records...</div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Employee Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Employee ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Time In</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Time Out</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Site</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredRecords.length > 0 ? (
                  filteredRecords.map((record) => (
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
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">No attendance records found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </div>

        {filteredRecords.length > 0 && (
          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredRecords.length} record{filteredRecords.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
