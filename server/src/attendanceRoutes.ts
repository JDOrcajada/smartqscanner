import { Router, Request, Response } from 'express';
import { query, execute, getNextAvailableId } from './db.js';
import { authenticate } from './middleware.js';

const attendanceRouter = Router();
attendanceRouter.use(authenticate);

// ──────────────────────────────────────────────────────────────
// Status computation
// Work hours: 08:00–17:00, grace period ends 08:30
// Priority: within-1hr-ABSENT > ABSENT(late-in) > HALF DAY > UNDERTIME > OVERTIME > LATE > PRESENT
// ──────────────────────────────────────────────────────────────
function computeStatus(
  timeIn: Date,
  timeOut: Date | null,
  dateStr: string,
  location: string | null,
  bypassOnsiteCap = false
): { status: string; isLate: boolean } {
  const today = new Date().toISOString().slice(0, 10);
  const isToday = dateStr === today;
  const isOnsite = (location ?? '').toUpperCase() === 'ONSITE';

  const tiMins = timeIn.getHours() * 60 + timeIn.getMinutes();
  const isLate = tiMins >= 8 * 60 + 30;

  // For ONSITE, cap timeOut at 17:00 for status computation (no overtime credit for onsite)
  // unless bypassOnsiteCap is set (admin manual entry with proof)
  // For OFFICE, allow timeOut beyond 17:00 — overtime accrues from actual timeOut
  let effectiveTimeOut: Date | null = timeOut;

  if (isOnsite && !bypassOnsiteCap) {
    const cap = new Date(dateStr + 'T17:00:00');
    if (!effectiveTimeOut) {
      effectiveTimeOut = isToday ? null : cap;
    } else if (effectiveTimeOut > cap) {
      effectiveTimeOut = cap;
    }
  }

  if (!effectiveTimeOut) {
    return { status: 'CLOCKED IN', isLate };
  }

  const durationMins = (effectiveTimeOut.getTime() - timeIn.getTime()) / 60000;
  if (durationMins < 60) {
    return { status: 'ABSENT', isLate };
  }

  if (tiMins >= 13 * 60) return { status: 'ABSENT', isLate };

  // Compare timeOut against 17:00 on the *date of clock-in* using ms difference
  const eod = new Date(dateStr + 'T17:00:00');
  const msPast5 = effectiveTimeOut.getTime() - eod.getTime();

  if (tiMins >= 9 * 60) {
    if (msPast5 < 0) return { status: 'ABSENT', isLate };
    return { status: 'HALF DAY', isLate };
  }

  if (msPast5 < 0) return { status: 'UNDERTIME', isLate };

  if (!isOnsite || bypassOnsiteCap) {
    if (msPast5 > 0) {
      const otMins = msPast5 / 60000;
      const otHrs = Math.round(otMins / 60);
      if (otHrs < 1) return { status: 'OVERTIME <1HR', isLate };
      return { status: `OVERTIME ${otHrs}HR${otHrs !== 1 ? 'S' : ''}`, isLate };
    }
  }

  if (isLate) return { status: 'LATE', isLate: true };
  return { status: 'PRESENT', isLate: false };
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr + 'T00:00:00').getDay();
  return day === 0 || day === 6;
}

function* daysInRange(start: string, end: string): Generator<string> {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    yield d.toISOString().slice(0, 10);
  }
}

function buildRow(r: any, statusOverride?: string, isVirtual = false) {
  const dateStr = r.date_log ? new Date(r.date_log).toISOString().slice(0, 10) : '';
  const timeIn  = r.time_in  ? new Date(r.time_in)  : null;
  const timeOut = r.time_out ? new Date(r.time_out) : null;

  let status: string;
  let isLate = false;

  if (statusOverride !== undefined) {
    status = statusOverride;
  } else if (r.status) {
    status = r.status;
    isLate = timeIn ? (timeIn.getHours() * 60 + timeIn.getMinutes()) >= 8 * 60 + 30 : false;
  } else if (timeIn) {
    const computed = computeStatus(timeIn, timeOut, dateStr, r.location);
    status = computed.status;
    isLate = computed.isLate;
  } else {
    status = 'ABSENT';
  }

  return {
    logId:        isVirtual ? null : (r.log_id ?? null),
    employeeId:   r.employee_id,
    employeeName: r.name ?? '',
    date:         dateStr,
    timeIn:       timeIn ? formatTime(timeIn) : null,
    timeOut:      timeOut ? formatTime(timeOut) : null,
    status,
    isLate,
    location:     r.location ?? null,
    site:         r.site ?? null,
    leaveType:    r.leave_type ?? null,
    isVirtual,
  };
}

// GET /api/attendance
// Query params (all optional):
//   dateFrom      YYYY-MM-DD  default: today
//   dateTo        YYYY-MM-DD  default: dateFrom
//   includeAbsent true       include virtual absent records
//   status        filter by status string
attendanceRouter.get('/', async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const dateFrom      = (req.query.dateFrom as string) || today;
    const dateTo        = (req.query.dateTo   as string) || dateFrom;
    const includeAbsent = req.query.includeAbsent === 'true';
    const statusFilter  = (req.query.status as string) || '';

    const effectiveDateTo = dateTo >= dateFrom ? dateTo : dateFrom;

    const rows = await query<any>(
      `SELECT l.LOG_ID, l.EMPLOYEE_ID, e.NAME, l.TIME_IN, l.TIME_OUT,
              l.DATE_LOG, l.STATUS, l.LOCATION, l.SITE, l.LEAVE_TYPE
       FROM ATTENDANCE_LOGS l
       LEFT JOIN EMPLOYEES e ON l.EMPLOYEE_ID = e.EMPLOYEE_ID
       WHERE l.DATE_LOG >= ? AND l.DATE_LOG <= ?
       ORDER BY l.DATE_LOG DESC, l.TIME_IN DESC`,
      [dateFrom, effectiveDateTo]
    );

    const realEntries = rows.map((r: any) => buildRow(r));

    let virtualAbsents: ReturnType<typeof buildRow>[] = [];

    if (includeAbsent) {
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const pastOnePM = nowMins >= 13 * 60;

      const employees = await query<any>(
        `SELECT EMPLOYEE_ID, NAME FROM EMPLOYEES WHERE STATUS = 'ACTIVE'`
      );

      const holidayRows = await query<any>(
        `SELECT HOLIDAY_DATE FROM HOLIDAYS WHERE HOLIDAY_DATE >= ? AND HOLIDAY_DATE <= ?`,
        [dateFrom, effectiveDateTo]
      );
      const holidayDates = new Set(
        holidayRows.map((h: any) => new Date(h.holiday_date).toISOString().slice(0, 10))
      );

      const coveredSet = new Set(
        rows.map((r: any) => {
          const ds = r.date_log ? new Date(r.date_log).toISOString().slice(0, 10) : '';
          return `${r.employee_id}_${ds}`;
        })
      );

      for (const dateStr of daysInRange(dateFrom, effectiveDateTo)) {
        if (isWeekend(dateStr)) continue;
        if (holidayDates.has(dateStr)) continue;
        if (dateStr === today && !pastOnePM) continue;

        for (const emp of employees) {
          const key = `${emp.employee_id}_${dateStr}`;
          if (!coveredSet.has(key)) {
            virtualAbsents.push(buildRow(
              {
                log_id: null, employee_id: emp.employee_id, name: emp.name,
                date_log: dateStr + 'T00:00:00', time_in: null, time_out: null,
                status: null, location: null, site: null, leave_type: null,
              },
              'ABSENT',
              true
            ));
          }
        }
      }
    }

    let combined = [...realEntries, ...virtualAbsents];

    if (statusFilter) {
      combined = combined.filter(
        (r) => r.status.toUpperCase() === statusFilter.toUpperCase()
      );
    }

    return res.json(combined);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// GET /api/attendance/monthly
// Query params: year (default: current), month (1-12, default: current)
// Returns per-employee aggregation: late, halfDay, undertime, absent for the month
attendanceRouter.get('/monthly', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const year  = parseInt((req.query.year  as string) || String(now.getFullYear()), 10);
    const month = parseInt((req.query.month as string) || String(now.getMonth() + 1), 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: 'Invalid year or month' });
    }

    const monthStr = String(month).padStart(2, '0');
    const dateFrom = `${year}-${monthStr}-01`;
    const lastDay  = new Date(year, month, 0).getDate();
    const dateTo   = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
    const today    = now.toISOString().slice(0, 10);

    const employees = await query<any>(
      `SELECT EMPLOYEE_ID, NAME FROM EMPLOYEES WHERE STATUS = 'ACTIVE' ORDER BY NAME`
    );

    const logs = await query<any>(
      `SELECT l.EMPLOYEE_ID, l.TIME_IN, l.TIME_OUT, l.DATE_LOG, l.STATUS, l.LOCATION
       FROM ATTENDANCE_LOGS l
       WHERE l.DATE_LOG >= ? AND l.DATE_LOG <= ?`,
      [dateFrom, dateTo]
    );

    const holidayRows = await query<any>(
      `SELECT HOLIDAY_DATE FROM HOLIDAYS WHERE HOLIDAY_DATE >= ? AND HOLIDAY_DATE <= ?`,
      [dateFrom, dateTo]
    );
    const holidayDates = new Set(
      holidayRows.map((h: any) => new Date(h.holiday_date).toISOString().slice(0, 10))
    );

    // Index logs by employeeId_date (first log per employee per day)
    const logsByKey = new Map<string, any>();
    for (const r of logs) {
      const ds  = r.date_log ? new Date(r.date_log).toISOString().slice(0, 10) : '';
      const key = `${r.employee_id}_${ds}`;
      if (!logsByKey.has(key)) logsByKey.set(key, r);
    }

    // Collect workdays that have already passed 1 PM (or are in the past)
    const nowMins   = now.getHours() * 60 + now.getMinutes();
    const pastOnePM = nowMins >= 13 * 60;
    const workDates: string[] = [];
    for (const ds of daysInRange(dateFrom, dateTo)) {
      if (isWeekend(ds))        continue;
      if (holidayDates.has(ds)) continue;
      if (ds > today)           continue;
      if (ds === today && !pastOnePM) continue;
      workDates.push(ds);
    }

    const result = employees.map((emp: any) => {
      let late = 0, halfDay = 0, undertime = 0, absent = 0, overtimeMins = 0;

      for (const ds of workDates) {
        const key = `${emp.employee_id}_${ds}`;
        const r   = logsByKey.get(key);

        let status: string;
        if (r) {
          const timeIn  = r.time_in  ? new Date(r.time_in)  : null;
          const timeOut = r.time_out ? new Date(r.time_out) : null;
          if (timeIn) {
            // Prefer the stored status (set correctly at write time, including admin overrides)
            // Fall back to recompute only when status is null/empty
            if (r.status) {
              status = r.status;
            } else {
              status = computeStatus(timeIn, timeOut, ds, r.location).status;
            }
            // Accumulate overtime minutes: ms past 17:00 on the clock-in date
            if (status.startsWith('OVERTIME') && timeOut) {
              const eod = new Date(ds + 'T17:00:00');
              const ot  = (timeOut.getTime() - eod.getTime()) / 60000;
              if (ot > 0) overtimeMins += ot;
            }
          } else {
            status = 'ABSENT';
          }
        } else {
          status = 'ABSENT';
        }

        if      (status === 'LATE')      late++;
        else if (status === 'HALF DAY')  halfDay++;
        else if (status === 'UNDERTIME') undertime++;
        else if (status === 'ABSENT')    absent++;
      }

      const overtimeHrs = Math.round((overtimeMins / 60) * 10) / 10;
      return { employeeId: emp.employee_id, employeeName: emp.name, late, halfDay, undertime, absent, overtimeHrs };
    });

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/attendance/admin — admin upsert
attendanceRouter.post('/admin', async (req: Request, res: Response) => {
  // timeOutDate is optional — defaults to same as date (allows next-day timeouts)
  const { employeeId, date, timeIn, timeOut, timeOutDate, location, site, status } = req.body;
  const id = parseInt(String(employeeId), 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid employee ID' });
  if (!date || !timeIn) return res.status(400).json({ message: 'date and timeIn are required' });

  const timeInTs  = new Date(`${date}T${timeIn}:00`);
  const resolvedTimeOutDate = (timeOutDate && timeOutDate.trim()) ? timeOutDate.trim() : date;
  const timeOutTs = timeOut ? new Date(`${resolvedTimeOutDate}T${timeOut}:00`) : null;
  const now       = new Date();
  const loc       = (location || 'OFFICE').toUpperCase();
  const siteName  = site?.trim() || null;

  // Always store an explicit status so the row is self-contained.
  // Admin override takes priority; otherwise auto-compute from the times supplied.
  const statusOverride = status?.trim() || null;
  const resolvedStatus = statusOverride ?? computeStatus(timeInTs, timeOutTs, date, loc, true).status;

  try {
    const existing = await query<any>(
      'SELECT LOG_ID FROM ATTENDANCE_LOGS WHERE EMPLOYEE_ID = ? AND DATE_LOG = ?',
      [id, date]
    );

    if (existing.length) {
      await execute(
        `UPDATE ATTENDANCE_LOGS SET TIME_IN = ?, TIME_OUT = ?, LOCATION = ?, SITE = ?, STATUS = ?, UPDATED_AT = ? WHERE LOG_ID = ?`,
        [timeInTs, timeOutTs, loc, siteName, resolvedStatus, now, existing[0].log_id]
      );
      return res.json({ message: 'Attendance record updated', action: 'updated', statusSaved: resolvedStatus });
    } else {
      const logId = await getNextAvailableId('ATTENDANCE_LOGS', 'LOG_ID');
      await execute(
        `INSERT INTO ATTENDANCE_LOGS (LOG_ID, EMPLOYEE_ID, TIME_IN, TIME_OUT, DATE_LOG, LOCATION, SITE, STATUS, CREATED_AT, UPDATED_AT) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [logId, id, timeInTs, timeOutTs, date, loc, siteName, resolvedStatus, now, now]
      );
      return res.json({ message: 'Attendance record created', action: 'created', statusSaved: resolvedStatus });
    }
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

export default attendanceRouter;
