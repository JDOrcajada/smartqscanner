import { Router, Request, Response } from 'express';
import { query, execute } from './db.js';
import { authenticate } from './middleware.js';

const attendanceRouter = Router();
attendanceRouter.use(authenticate);

// --- Status computation ---
// Work hours: 08:00–17:00, grace period ends 08:30
// Priority: ABSENT > HALF DAY > UNDERTIME > OVERTIME > LATE > PRESENT
function computeStatus(
  timeIn: Date,
  timeOut: Date | null,
  dateStr: string,   // YYYY-MM-DD
  location: string | null
): { status: string; isLate: boolean } {
  const today = new Date().toISOString().slice(0, 10);
  const isToday = dateStr === today;
  const isOnsite = (location ?? '').toUpperCase() === 'ONSITE';

  let effectiveTimeOut: Date | null = timeOut;

  // ONSITE: cap effective timeout at 17:00 (auto-timeout past days; cap actual if > 17:00)
  if (isOnsite) {
    const cap = new Date(dateStr + 'T17:00:00');
    if (!effectiveTimeOut) {
      effectiveTimeOut = isToday ? null : cap;
    } else if (effectiveTimeOut > cap) {
      effectiveTimeOut = cap;
    }
  }

  // No timeout yet → still active
  if (!effectiveTimeOut) {
    const tiMins = timeIn.getHours() * 60 + timeIn.getMinutes();
    return { status: 'CLOCKED IN', isLate: tiMins >= 8 * 60 + 30 };
  }

  const tiMins = timeIn.getHours() * 60 + timeIn.getMinutes();
  const toMins = effectiveTimeOut.getHours() * 60 + effectiveTimeOut.getMinutes();
  const isLate = tiMins >= 8 * 60 + 30;

  // 1:00 PM+ time-in → ABSENT
  if (tiMins >= 13 * 60) return { status: 'ABSENT', isLate };

  // 9:00 AM–12:59 PM time-in = HALF DAY territory
  if (tiMins >= 9 * 60) {
    if (toMins < 17 * 60) return { status: 'ABSENT', isLate };
    return { status: 'HALF DAY', isLate };
  }

  // Before 9:00 AM — check timeout
  if (toMins < 17 * 60) return { status: 'UNDERTIME', isLate };

  // At or after 5:00 PM — OVERTIME (OFFICE only, strictly after 17:00)
  if (!isOnsite && toMins > 17 * 60) {
    const otMins = toMins - 17 * 60;
    const otHrs = Math.round(otMins / 60);
    if (otHrs < 1) return { status: 'OVERTIME <1HR', isLate };
    return { status: `OVERTIME ${otHrs}HR${otHrs !== 1 ? 'S' : ''}`, isLate };
  }

  if (isLate) return { status: 'LATE', isLate: true };
  return { status: 'PRESENT', isLate: false };
}

// GET /api/attendance — all logs with dynamically computed status
attendanceRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const rows = await query<any>(
      `SELECT l.LOG_ID, l.EMPLOYEE_ID, e.NAME, l.TIME_IN, l.TIME_OUT, l.DATE_LOG, l.STATUS, l.LOCATION, l.SITE
       FROM ATTENDANCE_LOGS l
       LEFT JOIN EMPLOYEES e ON l.EMPLOYEE_ID = e.EMPLOYEE_ID
       ORDER BY l.DATE_LOG DESC, l.TIME_IN DESC`
    );
    return res.json(
      rows.map((r) => {
        const dateStr = r.date_log ? new Date(r.date_log).toISOString().slice(0, 10) : '';
        const timeIn = r.time_in ? new Date(r.time_in) : null;
        const timeOut = r.time_out ? new Date(r.time_out) : null;

        // Use admin-set STATUS if present (override); otherwise compute dynamically
        let status: string;
        let isLate = false;
        if (r.status) {
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
          logId: r.log_id,
          employeeId: r.employee_id,
          employeeName: r.name ?? '',
          date: dateStr,
          timeIn: timeIn
            ? timeIn.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : null,
          timeOut: timeOut
            ? timeOut.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : null,
          status,
          isLate,
          location: r.location ?? null,
          site: r.site ?? null,
        };
      })
    );
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/attendance/admin — admin upsert (override) for any employee + date
// Body: { employeeId, date (YYYY-MM-DD), timeIn (HH:MM), timeOut? (HH:MM), location?, site?, status? }
attendanceRouter.post('/admin', async (req: Request, res: Response) => {
  const { employeeId, date, timeIn, timeOut, location, site, status } = req.body;
  const id = parseInt(String(employeeId), 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid employee ID' });
  if (!date || !timeIn) return res.status(400).json({ message: 'date and timeIn are required' });

  const timeInTs = new Date(`${date}T${timeIn}:00`);
  const timeOutTs = timeOut ? new Date(`${date}T${timeOut}:00`) : null;
  const now = new Date();
  const loc = (location || 'OFFICE').toUpperCase();
  const siteName = site?.trim() || null;
  const statusOverride = status?.trim() || null;

  try {
    const existing = await query<any>(
      'SELECT LOG_ID FROM ATTENDANCE_LOGS WHERE EMPLOYEE_ID = ? AND DATE_LOG = ?',
      [id, date]
    );

    if (existing.length) {
      await execute(
        'UPDATE ATTENDANCE_LOGS SET TIME_IN = ?, TIME_OUT = ?, LOCATION = ?, SITE = ?, STATUS = ?, UPDATED_AT = ? WHERE LOG_ID = ?',
        [timeInTs, timeOutTs, loc, siteName, statusOverride, now, existing[0].log_id]
      );
      return res.json({ message: 'Attendance record updated', action: 'updated' });
    } else {
      const [idRow] = await query<any>(
        'SELECT COALESCE(MAX(LOG_ID), 0) + 1 AS NEW_ID FROM ATTENDANCE_LOGS'
      );
      await execute(
        'INSERT INTO ATTENDANCE_LOGS (LOG_ID, EMPLOYEE_ID, TIME_IN, TIME_OUT, DATE_LOG, LOCATION, SITE, STATUS, CREATED_AT, UPDATED_AT) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [idRow.new_id, id, timeInTs, timeOutTs, date, loc, siteName, statusOverride, now, now]
      );
      return res.json({ message: 'Attendance record created', action: 'created' });
    }
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

export default attendanceRouter;
