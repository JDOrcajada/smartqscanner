import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../imports/api';
import { BadgeCheck, RefreshCw, Save, X } from 'lucide-react';

interface LeaveBalance {
  employeeId: number;
  employeeName: string;
  year: number;
  slBalance: number;
  vlBalance: number;
}

interface EditState {
  employeeId: number;
  sl: string;
  vl: string;
}

const currentYear = new Date().getFullYear();

export function LeaveManager() {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(currentYear);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const token = localStorage.getItem('authToken');

  const fetchBalances = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/leaves?year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch leave balances');
      setBalances(await res.json());
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [token, year]);

  useEffect(() => { fetchBalances(); }, [fetchBalances]);

  const startEdit = (bal: LeaveBalance) => {
    setEditing({ employeeId: bal.employeeId, sl: String(bal.slBalance), vl: String(bal.vlBalance) });
  };

  const cancelEdit = () => setEditing(null);

  const handleSave = async () => {
    if (!editing) return;
    const sl = parseInt(editing.sl, 10);
    const vl = parseInt(editing.vl, 10);
    if (isNaN(sl) || isNaN(vl)) {
      setMessage({ text: 'Balances must be valid numbers', type: 'error' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/leaves/balance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ employeeId: editing.employeeId, year, slBalance: sl, vlBalance: vl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setBalances((prev) =>
        prev.map((b) =>
          b.employeeId === editing.employeeId
            ? { ...b, slBalance: sl, vlBalance: vl }
            : b
        )
      );
      setEditing(null);
      setMessage({ text: 'Leave balances updated.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const filtered = balances.filter((b) =>
    b.employeeName.toLowerCase().includes(search.toLowerCase()) ||
    String(b.employeeId).includes(search)
  );

  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BadgeCheck className="w-6 h-6 text-green-700" />
          <h1 className="text-2xl font-bold text-gray-900">Leave Balances (SL / VL)</h1>
        </div>
        <button
          onClick={fetchBalances}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search employee…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No employees found.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">Employee</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">ID</th>
                <th className="text-center px-6 py-3 font-semibold text-gray-600">SL Balance</th>
                <th className="text-center px-6 py-3 font-semibold text-gray-600">VL Balance</th>
                <th className="text-right px-6 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((bal) => {
                const isEditing = editing?.employeeId === bal.employeeId;
                return (
                  <tr key={bal.employeeId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{bal.employeeName}</td>
                    <td className="px-6 py-4 text-gray-500">{bal.employeeId}</td>

                    {isEditing ? (
                      <>
                        <td className="px-6 py-3 text-center">
                          <input
                            type="number"
                            value={editing.sl}
                            onChange={(e) => setEditing({ ...editing, sl: e.target.value })}
                            className="w-20 text-center px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </td>
                        <td className="px-6 py-3 text-center">
                          <input
                            type="number"
                            value={editing.vl}
                            onChange={(e) => setEditing({ ...editing, vl: e.target.value })}
                            className="w-20 text-center px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={handleSave}
                              disabled={saving}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                            >
                              <Save className="w-3.5 h-3.5" />
                              {saving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="flex items-center gap-1 px-3 py-1.5 text-gray-600 hover:bg-gray-100 border border-gray-200 text-xs font-semibold rounded-lg transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                              Cancel
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 text-center">
                          <span className={`font-semibold ${bal.slBalance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                            {bal.slBalance}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`font-semibold ${bal.vlBalance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                            {bal.vlBalance}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => startEdit(bal)}
                            className="px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-50 border border-green-200 rounded-lg transition-colors"
                          >
                            Edit
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
            Showing {filtered.length} of {balances.length} employees · {year}
          </div>
        </div>
      )}
    </div>
  );
}
