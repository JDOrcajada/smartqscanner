import { useState, useEffect, useCallback } from "react";
import { Search, Filter } from "lucide-react";
import { API_BASE } from "../../imports/api";

const API = API_BASE;

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("authToken");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Monday of the week containing date */
function weekStart(date: string): string {
  const d = new Date(date + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Sunday of the week containing date */
function weekEnd(date: string): string {
  const d = new Date(date + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

interface AttendanceLog {
  logId: number | null;
  employeeId: number;
  employeeName: string;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  status: string;
  isLate: boolean;
  location: string | null;
  site: string | null;
  leaveType: string | null;
  isVirtual: boolean;
}

interface LeaveBalance {
  employeeId: number;
  slBalance: number;
  vlBalance: number;
}

const STATUS_OPTIONS = [
  "ALL", "PRESENT", "LATE", "HALF DAY",
  "UNDERTIME", "ABSENT", "CLOCKED IN", "OVERTIME",
];

export function SearchAttendance() {
  const today = todayStr();

  // ── Filter state
  const [searchTerm, setSearchTerm]     = useState("");
  const [dateFrom, setDateFrom]         = useState(today);
  const [dateTo, setDateTo]             = useState(today);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [filtersApplied, setFiltersApplied] = useState(false);

  // ── Data state
  const [records, setRecords]     = useState<AttendanceLog[]>([]);
  const [leaveMap, setLeaveMap]   = useState<Map<number, LeaveBalance>>(new Map());
  const [loading, setLoading]     = useState(true);
  const [pageError, setPageError] = useState("");
  const [assigningLeave, setAssigningLeave] = useState<string | null>(null);
  const [leaveModal, setLeaveModal] = useState<{
    employeeId: number;
    date: string;
    leaveType: "SL" | "VL";
    employeeName: string;
    slBal: number;
    vlBal: number;
  } | null>(null);

  // ── Fetch leave balances
  const fetchLeaves = useCallback(async () => {
    try {
      const r = await fetch(`${API}/leaves`, { headers: getAuthHeaders() });
      if (!r.ok) return;
      const data: { employeeId: number; slBalance: number; vlBalance: number }[] = await r.json();
      const map = new Map<number, LeaveBalance>();
      data.forEach((l) => map.set(l.employeeId, l));
      setLeaveMap(map);
    } catch (_) {}
  }, []);

  // ── Fetch attendance records
  const fetchRecords = useCallback(async (from: string, to: string, withAbsent: boolean) => {
    setLoading(true);
    setPageError("");
    try {
      const params = new URLSearchParams({
        dateFrom: from,
        dateTo: to,
        includeAbsent: String(withAbsent),
      });
      const r = await fetch(`${API}/attendance?${params}`, { headers: getAuthHeaders() });
      if (!r.ok)
        throw new Error(
          r.status === 401 ? "Session expired — please log in again" : "Failed to load records"
        );
      const data = await r.json();
      setRecords(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setPageError(err.message || "Failed to load attendance records");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load: today
  useEffect(() => {
    fetchRecords(today, today, true);
    fetchLeaves();
  }, []);

  // ── Actions
  const handleApplyFilters = () => {
    setFiltersApplied(true);
    fetchRecords(dateFrom, dateTo, true);
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setDateFrom(today);
    setDateTo(today);
    setStatusFilter("ALL");
    setFiltersApplied(false);
    fetchRecords(today, today, true);
  };

  const handleThisWeek = () => {
    const from = weekStart(today);
    const to   = weekEnd(today);
    setDateFrom(from);
    setDateTo(to);
    setFiltersApplied(true);
    fetchRecords(from, to, true);
  };

  // ── Leave assignment
  const handleAssignLeave = async (
    employeeId: number,
    date: string,
    leaveType: "SL" | "VL" | null
  ) => {
    const key = `${employeeId}_${date}`;
    setAssigningLeave(key);
    try {
      const r = await fetch(`${API}/leaves/assign`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ employeeId, date, leaveType }),
      });
      if (!r.ok) {
        const errData = await r.json().catch(() => ({}));
        alert((errData as any).message || "Failed to assign leave");
        return;
      }
      const data = await r.json();
      setLeaveMap((prev) => {
        const next = new Map(prev);
        next.set(employeeId, { employeeId, slBalance: data.slBalance, vlBalance: data.vlBalance });
        return next;
      });
      setRecords((prev) =>
        prev.map((rec) =>
          rec.employeeId === employeeId && rec.date === date
            ? { ...rec, leaveType: data.leaveType, isVirtual: false, logId: data.logId }
            : rec
        )
      );
    } catch (_) {
      alert("Network error while assigning leave");
    } finally {
      setAssigningLeave(null);
    }
  };

  // ── Client-side filtering
  const filteredRecords = records.filter((record) => {
    const matchesSearch =
      !searchTerm ||
      record.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(record.employeeId).includes(searchTerm);
    const matchesStatus =
      statusFilter === "ALL" ||
      record.status.toUpperCase() === statusFilter.toUpperCase() ||
      (statusFilter === "OVERTIME" && record.status.toUpperCase().startsWith("OVERTIME"));
    return matchesSearch && matchesStatus;
  });

  // ── Status badge colour
  const getStatusColor = (status: string) => {
    const s = status.toUpperCase();
    if (s === "PRESENT")          return "#32AD32";
    if (s === "LATE")             return "#F59E0B";
    if (s === "HALF DAY")         return "#F97316";
    if (s === "UNDERTIME")        return "#F97316";
    if (s === "ABSENT")           return "#DC2626";
    if (s === "CLOCKED IN")       return "#2563EB";
    if (s.startsWith("OVERTIME")) return "#7C3AED";
    return "#6B7280";
  };

  // ── Leave cell
  const renderLeaveCell = (record: AttendanceLog) => {
    if (record.status.toUpperCase() !== "ABSENT")
      return <span className="text-gray-300 text-sm">—</span>;

    const key    = `${record.employeeId}_${record.date}`;
    const isBusy = assigningLeave === key;
    const bal    = leaveMap.get(record.employeeId);
    const slBal  = bal?.slBalance ?? 15;
    const vlBal  = bal?.vlBalance ?? 15;

    const slAssigned = record.leaveType === "SL";
    const vlAssigned = record.leaveType === "VL";
    const slColor    = slBal > 0 ? "#3B82F6" : "#EF4444";
    const vlColor    = vlBal > 0 ? "#8B5CF6" : "#EF4444";

    return (
      <div className="flex items-center gap-1.5">
        {/* SL */}
        {slAssigned ? (
          <div className="flex items-center gap-0.5">
            <span
              className="px-2.5 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full text-white opacity-40 select-none"
              style={{ backgroundColor: "#3B82F6" }}
            >
              SL&nbsp;{slBal}
            </span>
            <button
              onClick={() => handleAssignLeave(record.employeeId, record.date, null)}
              disabled={isBusy}
              title="Clear leave"
              className="px-1.5 py-0.5 rounded-full text-xs font-bold text-white disabled:opacity-40 hover:opacity-80 transition-opacity"
              style={{ backgroundColor: "#DC2626" }}
            >✕</button>
          </div>
        ) : (
          <button
            onClick={() =>
              setLeaveModal({ employeeId: record.employeeId, date: record.date, leaveType: "SL", employeeName: record.employeeName, slBal, vlBal })
            }
            disabled={isBusy || vlAssigned}
            title={`Sick Leave — ${slBal} remaining`}
            className={`px-2.5 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full text-white transition-opacity ${
              vlAssigned ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:opacity-80 active:opacity-70"
            } disabled:opacity-40`}
            style={{ backgroundColor: slColor }}
          >
            SL&nbsp;{slBal}
          </button>
        )}

        {/* VL */}
        {vlAssigned ? (
          <div className="flex items-center gap-0.5">
            <span
              className="px-2.5 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full text-white opacity-40 select-none"
              style={{ backgroundColor: "#8B5CF6" }}
            >
              VL&nbsp;{vlBal}
            </span>
            <button
              onClick={() => handleAssignLeave(record.employeeId, record.date, null)}
              disabled={isBusy}
              title="Clear leave"
              className="px-1.5 py-0.5 rounded-full text-xs font-bold text-white disabled:opacity-40 hover:opacity-80 transition-opacity"
              style={{ backgroundColor: "#DC2626" }}
            >✕</button>
          </div>
        ) : (
          <button
            onClick={() =>
              setLeaveModal({ employeeId: record.employeeId, date: record.date, leaveType: "VL", employeeName: record.employeeName, slBal, vlBal })
            }
            disabled={isBusy || slAssigned}
            title={`Vacation Leave — ${vlBal} remaining`}
            className={`px-2.5 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full text-white transition-opacity ${
              slAssigned ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:opacity-80 active:opacity-70"
            } disabled:opacity-40`}
            style={{ backgroundColor: vlColor }}
          >
            VL&nbsp;{vlBal}
          </button>
        )}
      </div>
    );
  };

  const fmtDate = (ds: string) =>
    new Date(ds + "T00:00:00").toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });

  const rangeLabel =
    dateFrom === dateTo
      ? fmtDate(dateFrom)
      : `${fmtDate(dateFrom)} – ${fmtDate(dateTo)}`;

  return (
    <>
      <div className="p-8">
      <h2 className="text-2xl font-semibold text-gray-900 mb-8">Search Attendance</h2>

      {/* Filter Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex flex-wrap gap-3 items-end mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none"
            />
          </div>
          <button
            onClick={handleThisWeek}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
          >
            This Week
          </button>
          <button
            onClick={handleApplyFilters}
            className="px-4 py-2 text-sm text-white rounded-lg font-medium"
            style={{ backgroundColor: "#32AD32" }}
          >
            Apply
          </button>
          {filtersApplied && (
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-48 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or employee ID…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === "ALL" ? "All Statuses" : s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <span className="text-sm font-medium text-gray-700">{rangeLabel}</span>
          {!loading && (
            <span className="text-xs text-gray-500">
              {filteredRecords.length} record{filteredRecords.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {pageError && (
          <div className="px-6 py-4 text-sm text-red-600 bg-red-50 border-b border-red-200">
            {pageError}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-gray-500">Loading attendance records…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Employee Name
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Time In
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Time Out
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Leave
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredRecords.length > 0 ? (
                  filteredRecords.map((record, idx) => (
                    <tr
                      key={
                        record.logId != null
                          ? record.logId
                          : `v-${record.employeeId}-${record.date}-${idx}`
                      }
                      className={`hover:bg-gray-50 ${record.isVirtual ? "bg-red-50/30" : ""}`}
                    >
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-900">
                        {record.employeeName || "—"}
                        {record.isVirtual && (
                          <span className="ml-1 text-xs text-red-400 italic font-normal">
                            (no clock-in)
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-600">
                        {record.employeeId}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-600">
                        {fmtDate(record.date)}
                      </td>
                      <td
                        className="px-5 py-3 whitespace-nowrap text-sm font-medium"
                        style={{ color: record.isLate ? "#DC2626" : undefined }}
                      >
                        {record.timeIn || <span className="text-gray-400 italic font-normal">—</span>}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-900">
                        {record.timeOut || <span className="text-gray-400 italic">—</span>}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-600">
                        {record.location || "—"}
                        {record.site ? (
                          <span className="text-gray-400 text-xs ml-1">({record.site})</span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span
                          className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full text-white"
                          style={{ backgroundColor: getStatusColor(record.status) }}
                        >
                          {record.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {renderLeaveCell(record)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      No attendance records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>

      {/* Leave confirmation modal */}
      {leaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80 mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Confirm Leave</h3>
            <p className="text-sm text-gray-600 mb-1">
              Mark{" "}
              <span className="font-semibold">{leaveModal.employeeName}</span>'s absence on{" "}
              <span className="font-semibold">{fmtDate(leaveModal.date)}</span> as{" "}
              <span className="font-semibold">
                {leaveModal.leaveType === "SL" ? "Sick Leave (SL)" : "Vacation Leave (VL)"}
              </span>
              ?
            </p>
            <p className="text-xs text-gray-400 mb-5">
              Remaining after:{" "}
              {leaveModal.leaveType === "SL"
                ? leaveModal.slBal - 1
                : leaveModal.vlBal - 1}{" "}
              day(s)
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setLeaveModal(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const { employeeId, date, leaveType } = leaveModal;
                  setLeaveModal(null);
                  await handleAssignLeave(employeeId, date, leaveType);
                }}
                className="px-4 py-2 text-sm rounded-lg text-white font-medium hover:opacity-90 transition-colors"
                style={{ backgroundColor: leaveModal.leaveType === "SL" ? "#3B82F6" : "#8B5CF6" }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}