import { useState } from "react";
import { Search } from "lucide-react";
import { attendanceRecords } from "../data/mockData";

export function SearchAttendance() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  const filteredRecords = attendanceRecords.filter((record) => {
    const matchesSearch = 
      record.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDate = selectedDate ? record.date === selectedDate : true;
    
    return matchesSearch && matchesDate;
  });

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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={{ focusRingColor: "#32AD32" }}
              />
            </div>

            <div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={{ focusRingColor: "#32AD32" }}
              />
            </div>

            {(searchTerm || selectedDate) && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedDate("");
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Attendance Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
                      No attendance records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
