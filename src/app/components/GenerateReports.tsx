import { useState } from "react";
import { Calendar, Download, FileText, Printer } from "lucide-react";
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

function fmtLong(d: string) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtShort(d: string) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusColor(status: string): string {
  const s = status.toUpperCase();
  if (s === 'PRESENT')    return '#16a34a';
  if (s === 'LATE')       return '#d97706';
  if (s === 'HALF DAY')   return '#ea580c';
  if (s === 'UNDERTIME')  return '#ea580c';
  if (s === 'ABSENT')     return '#dc2626';
  if (s === 'CLOCKED IN') return '#2563eb';
  if (s.startsWith('OVERTIME')) return '#7c3aed';
  return '#6b7280';
}

export function GenerateReports() {
  const [startDate, setStartDate] = useState('');
  const [endDate,   setEndDate]   = useState('');
  const [records,   setRecords]   = useState<AttendanceLog[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [reportError, setReportError] = useState('');

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) { setReportError('Please select both start and end dates'); return; }
    setReportError('');
    setLoading(true);
    try {
      const res = await fetch(
        `${API}/attendance?dateFrom=${startDate}&dateTo=${endDate}`,
        { headers: getAuthHeaders() }
      );
      if (!res.ok) throw new Error('Failed to fetch attendance data');
      setRecords(await res.json());
      setShowPreview(true);
    } catch (err: any) {
      setReportError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const header = ['Employee Name', 'Employee ID', 'Date', 'Time In', 'Time Out', 'Location', 'Site', 'Status'];
    const rows = records.map((r) => [
      r.employeeName, r.employeeId, fmtShort(r.date),
      r.timeIn ?? '', r.timeOut ?? '', r.location ?? '', r.site ?? '', r.status,
    ]);
    const csv = [header, ...rows].map((row) => row.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `attendance_${startDate}_to_${endDate}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=1200,height=820');
    if (!win) return;

    const tableRows = records.map((r, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f7f7f7'}; page-break-inside:avoid">
        <td style="border:1px solid #ccc;padding:4px 7px;color:#aaa;text-align:center">${i + 1}</td>
        <td style="border:1px solid #ccc;padding:4px 7px;font-weight:600">${r.employeeName || '—'}</td>
        <td style="border:1px solid #ccc;padding:4px 7px;color:#555">${r.employeeId}</td>
        <td style="border:1px solid #ccc;padding:4px 7px">${fmtShort(r.date)}</td>
        <td style="border:1px solid #ccc;padding:4px 7px;color:${r.isLate ? '#dc2626' : '#111'};font-weight:${r.isLate ? 700 : 400}">${r.timeIn || '—'}</td>
        <td style="border:1px solid #ccc;padding:4px 7px">${r.timeOut || '—'}</td>
        <td style="border:1px solid #ccc;padding:4px 7px">${r.location || '—'}</td>
        <td style="border:1px solid #ccc;padding:4px 7px">${r.site || '—'}</td>
        <td style="border:1px solid #ccc;padding:4px 7px">
          <span style="background:${statusColor(r.status)};color:#fff;border-radius:3px;padding:1px 6px;font-size:8.5px;font-weight:700">${r.status}</span>
        </td>
      </tr>`).join('');

    const summaryCards = [
      { label: 'Total Records', value: records.length, color: '#111' },
      { label: 'Present',       value: summary.present,   color: '#16a34a' },
      { label: 'Late',          value: summary.late,      color: '#d97706' },
      { label: 'Half Day',      value: summary.halfDay,   color: '#ea580c' },
      { label: 'Undertime',     value: summary.undertime, color: '#ea580c' },
      { label: 'Absent',        value: summary.absent,    color: '#dc2626' },
      { label: 'Overtime',      value: summary.overtime,  color: '#7c3aed' },
    ].map(({ label, value, color }) => `
      <div style="text-align:center;border:1px solid #ddd;border-radius:4px;padding:6px 14px;min-width:60px">
        <div style="font-size:18px;font-weight:800;color:${color}">${value}</div>
        <div style="font-size:8.5px;color:#555;margin-top:1px;text-transform:uppercase;letter-spacing:0.5px">${label}</div>
      </div>`).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Attendance Report</title>
  <style>
    @page { size: A4 landscape; margin: 12mm 14mm; }
    body { font-family: Arial, sans-serif; color: #111; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; }
    th { border: 1px solid #bbb; padding: 5px 7px; text-align: left; font-weight: 700;
         text-transform: uppercase; font-size: 8.5px; letter-spacing: 0.4px; background: #e8e8e8; }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="text-align:center;margin-bottom:16px">
    <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#666;margin-bottom:3px">SmartQ Attendance System</div>
    <div style="font-size:22px;font-weight:800;letter-spacing:1px;margin-bottom:6px">ATTENDANCE REPORT</div>
    <div style="font-size:11px;color:#333">Period: <strong>${fmtLong(startDate)}</strong> — <strong>${fmtLong(endDate)}</strong></div>
    <div style="font-size:9px;color:#888;margin-top:3px">Generated: ${generatedAt}</div>
  </div>
  <div style="border-top:2.5px solid #111;margin-bottom:3px"></div>
  <div style="border-top:1px solid #111;margin-bottom:14px"></div>

  <!-- Table -->
  <table>
    <thead>
      <tr>
        <th>#</th><th>Employee Name</th><th>Employee ID</th><th>Date</th>
        <th>Time In</th><th>Time Out</th><th>Location</th><th>Site</th><th>Status</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  <div style="border-top:1px solid #ccc;margin:14px 0 10px"></div>

  <!-- Summary -->
  <div style="margin-bottom:24px">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Summary</div>
    <div style="display:flex;gap:20px;flex-wrap:wrap">${summaryCards}</div>
  </div>

  <!-- Signatures -->
  <div style="display:flex;justify-content:space-between;margin-top:40px;font-size:10px">
    ${['Prepared by', 'Checked by', 'Approved by'].map(label => `
      <div style="text-align:center;width:28%">
        <div style="border-top:1px solid #333;padding-top:5px;margin-top:36px"><strong>${label}</strong></div>
        <div style="font-size:9px;color:#888;margin-top:2px">Signature over Printed Name</div>
      </div>`).join('')}
  </div>
</body>
</html>`;

    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  // Summary counts
  const summary = records.reduce(
    (acc, r) => {
      const s = r.status.toUpperCase();
      if (s === 'PRESENT')        acc.present++;
      else if (s === 'LATE')      acc.late++;
      else if (s === 'HALF DAY')  acc.halfDay++;
      else if (s === 'UNDERTIME') acc.undertime++;
      else if (s === 'ABSENT')    acc.absent++;
      else if (s.startsWith('OVERTIME')) acc.overtime++;
      return acc;
    },
    { present: 0, late: 0, halfDay: 0, undertime: 0, absent: 0, overtime: 0 }
  );

  const generatedAt = new Date().toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const COLS = ['Employee Name', 'Employee ID', 'Date', 'Time In', 'Time Out', 'Location', 'Site', 'Status'];

  return (
    <div className="p-8">
      <h2 className="text-2xl font-semibold text-gray-900 mb-8">Generate Reports</h2>

      {/* ── Config panel ── */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {[['Start Date', startDate, setStartDate], ['End Date', endDate, setEndDate]].map(([label, value, setter]) => (
            <div key={label as string}>
              <label className="block text-sm font-medium text-gray-700 mb-2">{label as string}</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="date" value={value as string}
                  onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={handleGenerateReport} disabled={loading}
            className="px-6 py-2 text-white rounded-lg hover:opacity-90 flex items-center gap-2 disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: '#32AD32' }}>
            <FileText className="w-4 h-4" />
            {loading ? 'Loading…' : 'Generate Report'}
          </button>
          {showPreview && (
            <button onClick={() => { setShowPreview(false); setRecords([]); }}
              className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              Clear Preview
            </button>
          )}
        </div>
        {reportError && <p className="mt-3 text-sm text-red-600">{reportError}</p>}
      </div>

      {/* ── Screen preview ── */}
      {showPreview && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Attendance Report Preview</h3>
              <p className="text-sm text-gray-600 mt-1">{fmtLong(startDate)} — {fmtLong(endDate)}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleExportCSV}
                className="px-4 py-2 text-white rounded-lg hover:opacity-90 flex items-center gap-2 text-sm transition-opacity"
                style={{ backgroundColor: '#32AD32' }}>
                <Download className="w-4 h-4" /> Export CSV
              </button>
              <button onClick={handlePrint}
                className="px-4 py-2 text-white rounded-lg hover:opacity-90 flex items-center gap-2 text-sm transition-opacity"
                style={{ backgroundColor: '#32AD32' }}>
                <Printer className="w-4 h-4" /> Print / PDF
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {COLS.map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {records.length > 0 ? records.map((r) => (
                  <tr key={r.logId} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-900">{r.employeeName || '—'}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{r.employeeId}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{fmtShort(r.date)}</td>
                    <td className="px-6 py-3 text-sm font-medium" style={{ color: r.isLate ? '#dc2626' : undefined }}>
                      {r.timeIn || '—'}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-900">{r.timeOut || '—'}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{r.location || '—'}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{r.site || '—'}</td>
                    <td className="px-6 py-3">
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full text-white"
                        style={{ backgroundColor: statusColor(r.status) }}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">No records found for the selected date range</td>
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
          <p className="text-gray-600">Select a date range and click "Generate Report" to preview</p>
        </div>
      )}
    </div>
  );
}
