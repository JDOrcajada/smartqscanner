import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../imports/api';
import { ChevronLeft, ChevronRight, CalendarDays, X, Plus } from 'lucide-react';

type HolidayType = 'REGULAR' | 'SPECIAL_NON_WORKING' | 'SPECIAL_WORKING';

interface Holiday {
  id: number;
  date: string;
  name: string;
  type: HolidayType;
}

const TYPE_CONFIG: Record<HolidayType, { label: string; bg: string; text: string; dot: string; border: string }> = {
  REGULAR: {
    label: 'Regular Holiday',
    bg: 'bg-red-100',
    text: 'text-red-800',
    dot: 'bg-red-500',
    border: 'border-red-300',
  },
  SPECIAL_NON_WORKING: {
    label: 'Special Non-Working Holiday',
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    dot: 'bg-orange-400',
    border: 'border-orange-300',
  },
  SPECIAL_WORKING: {
    label: 'Special Working Holiday',
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    dot: 'bg-blue-400',
    border: 'border-blue-300',
  },
};

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function HolidayManager() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [addForm, setAddForm] = useState<{ name: string; type: HolidayType } | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const token = localStorage.getItem('authToken');

  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/holidays`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch holidays');
      setHolidays(await res.json());
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchHolidays(); }, [fetchHolidays]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const holidayMap = new Map<string, Holiday>();
  holidays.forEach((h) => holidayMap.set(h.date, h));

  const toDateStr = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${viewYear}-${m}-${d}`;
  };

  const prevMonth = () => {
    setSelectedDay(null);
    setAddForm(null);
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    setSelectedDay(null);
    setAddForm(null);
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const handleDayClick = (day: number) => {
    const dateStr = toDateStr(day);
    const existing = holidayMap.get(dateStr);
    setSelectedDay(day);
    setAddForm(existing ? null : { name: '', type: 'REGULAR' });
  };

  const handleAdd = async () => {
    if (!addForm || selectedDay === null) return;
    const dateStr = toDateStr(selectedDay);
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/holidays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ date: dateStr, name: addForm.name, type: addForm.type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setHolidays((prev) => [...prev, data].sort((a, b) => a.date.localeCompare(b.date)));
      setSelectedDay(null);
      setAddForm(null);
      setMessage({ text: 'Holiday added.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/holidays/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setHolidays((prev) => prev.filter((h) => h.id !== id));
      setSelectedDay(null);
      setMessage({ text: 'Holiday removed.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Build calendar grid cells
  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const selectedDateStr = selectedDay !== null ? toDateStr(selectedDay) : null;
  const selectedHoliday = selectedDateStr ? holidayMap.get(selectedDateStr) : undefined;

  // Count holidays this month for the header
  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const monthHolidays = holidays.filter((h) => h.date.startsWith(monthPrefix));

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <CalendarDays className="w-6 h-6 text-green-700" />
        <h1 className="text-2xl font-bold text-gray-900">Holiday Calendar</h1>
        <span className="ml-auto text-sm text-gray-400">
          {monthHolidays.length} holiday{monthHolidays.length !== 1 ? 's' : ''} this month · click any day to add or remove
        </span>
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Month navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading…</div>
        ) : (
          <div className="p-4">
            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_NAMES.map((d) => (
                <div
                  key={d}
                  className="text-center text-xs font-semibold text-gray-400 py-2"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar day cells */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (!day) return <div key={`pad-${i}`} className="min-h-14" />;

                const dateStr = toDateStr(day);
                const holiday = holidayMap.get(dateStr);
                const isSelected = selectedDay === day;
                const isToday =
                  today.getFullYear() === viewYear &&
                  today.getMonth() === viewMonth &&
                  today.getDate() === day;
                const conf = holiday ? TYPE_CONFIG[holiday.type as HolidayType] : null;

                return (
                  <button
                    key={day}
                    onClick={() => handleDayClick(day)}
                    className={[
                      'relative min-h-14 p-1.5 rounded-lg text-left transition-all border text-sm',
                      isSelected
                        ? `ring-2 ring-green-500 ${conf ? conf.border : 'border-green-300'}`
                        : conf
                        ? `${conf.border} border`
                        : 'border-transparent hover:border-gray-200 hover:bg-gray-50',
                      conf ? conf.bg : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <span
                      className={[
                        'text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full',
                        isToday
                          ? 'bg-green-600 text-white'
                          : conf
                          ? conf.text
                          : 'text-gray-700',
                      ].join(' ')}
                    >
                      {day}
                    </span>
                    {holiday && (
                      <span
                        className={`block text-xs mt-0.5 leading-tight truncate ${conf?.text}`}
                        title={holiday.name}
                      >
                        {holiday.name}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Inline action panel */}
        {selectedDay !== null && (
          <div className="border-t border-gray-100 px-6 py-4 bg-gray-50">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900 mb-2">
                  {MONTH_NAMES[viewMonth]} {selectedDay}, {viewYear}
                </p>

                {selectedHoliday ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        TYPE_CONFIG[selectedHoliday.type as HolidayType].bg
                      } ${TYPE_CONFIG[selectedHoliday.type as HolidayType].text}`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          TYPE_CONFIG[selectedHoliday.type as HolidayType].dot
                        }`}
                      />
                      {TYPE_CONFIG[selectedHoliday.type as HolidayType].label}
                    </span>
                    <span className="text-sm text-gray-700">{selectedHoliday.name}</span>
                    <button
                      onClick={() => handleDelete(selectedHoliday.id)}
                      disabled={actionLoading}
                      className="ml-auto px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {actionLoading ? 'Removing…' : 'Remove Holiday'}
                    </button>
                  </div>
                ) : addForm ? (
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500 font-medium">Type</label>
                      <select
                        value={addForm.type}
                        onChange={(e) =>
                          setAddForm({ ...addForm, type: e.target.value as HolidayType })
                        }
                        className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="REGULAR">Regular Holiday</option>
                        <option value="SPECIAL_NON_WORKING">Special Non-Working Holiday</option>
                        <option value="SPECIAL_WORKING">Special Working Holiday</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1 flex-1 min-w-40">
                      <label className="text-xs text-gray-500 font-medium">Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Independence Day"
                        value={addForm.name}
                        onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <button
                      onClick={handleAdd}
                      disabled={actionLoading}
                      className="flex items-center gap-1 px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                      {actionLoading ? 'Adding…' : 'Add'}
                    </button>
                  </div>
                ) : null}
              </div>

              <button
                onClick={() => { setSelectedDay(null); setAddForm(null); }}
                className="p-1.5 hover:bg-gray-200 rounded-lg flex-shrink-0"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="border-t border-gray-100 px-6 py-3 flex flex-wrap gap-6">
          {(
            Object.entries(TYPE_CONFIG) as [HolidayType, (typeof TYPE_CONFIG)[HolidayType]][]
          ).map(([, conf]) => (
            <div key={conf.label} className="flex items-center gap-2 text-xs text-gray-600">
              <span className={`w-3 h-3 rounded-sm flex-shrink-0 ${conf.dot}`} />
              {conf.label}
            </div>
          ))}
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-xs">
              1
            </span>
            Today
          </div>
        </div>
      </div>
    </div>
  );
}
