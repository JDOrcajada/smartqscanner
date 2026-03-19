import { useState } from "react";
import { Calendar, Download, FileText } from "lucide-react";
import { attendanceRecords } from "../data/mockData";

export function GenerateReports() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const handleGenerateReport = () => {
    if (!startDate || !endDate) {
      alert("Please select both start and end dates");
      return;
    }
    setShowPreview(true);
  };

  const filteredRecords = attendanceRecords.filter((record) => {
    const recordDate = new Date(record.date);
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const matchesDateRange =
      (!start || recordDate >= start) && (!end || recordDate <= end);

    return matchesDateRange;
  });

  const handleExport = (format: string) => {
    alert(`Exporting report as ${format}...`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Present":
        return "#32AD32";
      case "Late":
        return "#FFA500";
      case "Absent":
        return "#DC2626";
      default:
        return "#6B7280";
    }
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
              className="px-6 py-2 text-white rounded-lg transition-colors hover:opacity-90 flex items-center gap-2"
              style={{ backgroundColor: "#32AD32" }}
            >
              <FileText className="w-4 h-4" />
              Generate Report
            </button>

            {showPreview && (
              <button
                onClick={() => setShowPreview(false)}
                className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Clear Preview
              </button>
            )}
          </div>
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
                  onClick={() => handleExport("PDF")}
                  className="px-4 py-2 text-white rounded-lg transition-colors hover:opacity-90 flex items-center gap-2 text-sm"
                  style={{ backgroundColor: "#32AD32" }}
                >
                  <Download className="w-4 h-4" />
                  Export PDF
                </button>
                <button
                  onClick={() => handleExport("Excel")}
                  className="px-4 py-2 text-white rounded-lg transition-colors hover:opacity-90 flex items-center gap-2 text-sm"
                  style={{ backgroundColor: "#32AD32" }}
                >
                  <Download className="w-4 h-4" />
                  Export Excel
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
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRecords.length > 0 ? (
                    filteredRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.employeeName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {record.employeeId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(record.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.timeIn}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.timeOut || (
                            <span className="text-gray-400 italic">Not yet</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full text-white"
                            style={{ backgroundColor: getStatusColor(record.status) }}
                          >
                            {record.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        No records found for the selected date range
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {filteredRecords.length > 0 && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
                Total Records: {filteredRecords.length}
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
