import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../imports/api';
import { CheckCircle, XCircle, RefreshCw, UserCheck } from 'lucide-react';

interface SignupRequest {
  requestId: number;
  employeeId: number;
  employeeName: string;
  status: string;
  createdAt: string;
}

export function AdminApproval() {
  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const token = localStorage.getItem('authToken');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/superadmin/requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch requests');
      const data = await res.json();
      setRequests(data);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleAction = async (requestId: number, action: 'approve' | 'reject') => {
    setProcessing(requestId);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/superadmin/requests/${requestId}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setMessage({ text: data.message, type: 'success' });
      setRequests((prev) => prev.filter((r) => r.requestId !== requestId));
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (raw: string) => {
    try { return new Date(raw).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }); }
    catch { return raw; }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <UserCheck className="w-6 h-6 text-green-700" />
          <h1 className="text-2xl font-bold text-gray-900">Admin Signup Requests</h1>
        </div>
        <button
          onClick={fetchRequests}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No pending signup requests.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">Employee</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">Employee ID</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">Requested At</th>
                <th className="text-right px-6 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map((req) => (
                <tr key={req.requestId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{req.employeeName}</td>
                  <td className="px-6 py-4 text-gray-500">{req.employeeId}</td>
                  <td className="px-6 py-4 text-gray-500">{formatDate(req.createdAt)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => handleAction(req.requestId, 'approve')}
                        disabled={processing === req.requestId}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(req.requestId, 'reject')}
                        disabled={processing === req.requestId}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
