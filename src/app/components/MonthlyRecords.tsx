import { useState, useEffect, useCallback } from "react";
import { BarChart2, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { API_BASE } from "../../imports/api";

const API = API_BASE;

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("authToken");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface MonthlyRow {
  employeeId: number;
  employeeName: string;
  late: number;
  halfDay: number;
  undertime: number;
  absent: number;
  overtimeHrs: number;
}

export function MonthlyRecords() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12

  const [rows,      setRows]      = useState<MonthlyRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [pageError, setPageError] = useState("");
  const [search,    setSearch]    = useState("");

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const res = await fetch(
        `${API}/attendance/monthly?year=${year}&month=${month}`,
        { headers: getAuthHeaders() }
      );
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data: MonthlyRow[] = await res.json();
      setRows(data);
    } catch (err: any) {
      setPageError(err.message ?? "Failed to load monthly records.");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Navigate months
  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    const nextY = month === 12 ? year + 1 : year;
    const nextM = month === 12 ? 1 : month + 1;
    // Don't go into the future
    const today = new Date();
    if (nextY > today.getFullYear() || (nextY === today.getFullYear() && nextM > today.getMonth() + 1)) return;
    setYear(nextY);
    setMonth(nextM);
  }

  const isCurrentMonth =
    year  === now.getFullYear() &&
    month === now.getMonth() + 1;

  // Totals row
  const filtered = rows.filter((r) =>
    r.employeeName.toLowerCase().includes(search.toLowerCase())
  );

  const totals = filtered.reduce(
    (acc, r) => ({
      late:        acc.late        + r.late,
      halfDay:     acc.halfDay     + r.halfDay,
      undertime:   acc.undertime   + r.undertime,
      absent:      acc.absent      + r.absent,
      overtimeHrs: Math.round((acc.overtimeHrs + r.overtimeHrs) * 10) / 10,
    }),
    { late: 0, halfDay: 0, undertime: 0, absent: 0, overtimeHrs: 0 }
  );

  function CountBadge({ value, color }: { value: number; color: string }) {
    if (value === 0) return <span className="text-gray-400">—</span>;
    return (
      <span
        className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-white text-sm font-semibold"
        style={{ backgroundColor: color }}
      >
        {value}
      </span>
    );
  }

  function OvertimeBadge({ value }: { value: number }) {
    if (value === 0) return <span className="text-gray-400">—</span>;
    return (
      <span
        className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-white text-sm font-semibold"
        style={{ backgroundColor: "#32AD32" }}
      >
        {value}h
      </span>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <BarChart2 className="w-6 h-6" style={{ color: "#32AD32" }} />
        <h1 className="text-2xl font-bold text-gray-900">Monthly Records</h1>
      </div>

      {/* Month picker */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex items-center gap-4">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>

        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2"
            style={{ "--tw-ring-color": "#32AD32" } as React.CSSProperties}
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>

          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2"
            style={{ "--tw-ring-color": "#32AD32" } as React.CSSProperties}
          >
            {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 4 + i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <button
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next month"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>

        <span className="text-sm font-medium text-gray-700 ml-1">
          {MONTH_NAMES[month - 1]} {year}
        </span>

        <button
          onClick={fetchRecords}
          className="ml-auto text-sm px-4 py-1.5 rounded-lg text-white font-medium transition-colors hover:opacity-90"
          style={{ backgroundColor: "#32AD32" }}
        >
          Refresh
        </button>
      </div>

      {/* Search bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search employee name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2"
            style={{ "--tw-ring-color": "#32AD32" } as React.CSSProperties}
          />
        </div>
      </div>

      {/* Error */}
      {pageError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {pageError}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-semibold text-gray-700">#</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Employee Name</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-700">Late</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-700">Half Day</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-700">Undertime</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-700">Absences</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-700">Overtime (hrs)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">
                  {rows.length === 0 ? "No active employees found." : "No employees match your search."}
                </td>
              </tr>
            ) : (
              filtered.map((row, idx) => (
                <tr
                  key={row.employeeId}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{row.employeeName}</td>
                  <td className="px-4 py-3 text-center">
                    <CountBadge value={row.late}      color="#F59E0B" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <CountBadge value={row.halfDay}   color="#8B5CF6" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <CountBadge value={row.undertime} color="#3B82F6" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <CountBadge value={row.absent}    color="#EF4444" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <OvertimeBadge value={row.overtimeHrs} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {!loading && filtered.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                <td colSpan={2} className="px-4 py-3 text-gray-700">Total</td>
                <td className="px-4 py-3 text-center">
                  <CountBadge value={totals.late}        color="#F59E0B" />
                </td>
                <td className="px-4 py-3 text-center">
                  <CountBadge value={totals.halfDay}     color="#8B5CF6" />
                </td>
                <td className="px-4 py-3 text-center">
                  <CountBadge value={totals.undertime}   color="#3B82F6" />
                </td>
                <td className="px-4 py-3 text-center">
                  <CountBadge value={totals.absent}      color="#EF4444" />
                </td>
                <td className="px-4 py-3 text-center">
                  <OvertimeBadge value={totals.overtimeHrs} />
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
