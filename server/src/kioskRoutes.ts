import { Router, Request, Response } from 'express';
import { getEmployeeById } from './employees.js';
import { query, execute } from './db.js';

const kioskRouter = Router();

// No JWT auth — kiosk is a public device

// GET /api/kiosk/employee/:id — look up employee for display on scan
kioskRouter.get('/employee/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ message: 'Invalid employee ID' });
  }
  try {
    const employee = await getEmployeeById(id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    if (employee.status === 'INACTIVE') {
      return res.status(403).json({ message: 'Employee is inactive' });
    }
    return res.json(employee);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/kiosk/attendance — clock in or out
// Body: { employeeId: number, action: 'IN' | 'OUT', location?: string, site?: string }
kioskRouter.post('/attendance', async (req: Request, res: Response) => {
  const { employeeId, action, location, site } = req.body;
  const id = parseInt(String(employeeId), 10);

  if (isNaN(id)) {
    return res.status(400).json({ message: 'Invalid employee ID' });
  }
  if (action !== 'IN' && action !== 'OUT') {
    return res.status(400).json({ message: 'action must be IN or OUT' });
  }

  try {
    const employee = await getEmployeeById(id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    if (employee.status === 'INACTIVE') {
      return res.status(403).json({ message: 'Employee is inactive' });
    }

    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const loc = (location ?? 'OFFICE').toUpperCase();

    // --- ONSITE SERVICE: update location/site on existing record only ---
    if (action === 'IN' && loc === 'ONSITE') {
      const existing = await query<any>(
        'SELECT LOG_ID, TIME_IN FROM ATTENDANCE_LOGS WHERE EMPLOYEE_ID = ? AND DATE_LOG = ?',
        [id, today]
      );
      if (!existing.length || !existing[0].time_in) {
        return res.status(409).json({ message: 'Employee has not clocked in yet' });
      }
      await execute(
        'UPDATE ATTENDANCE_LOGS SET LOCATION = ?, SITE = ?, UPDATED_AT = ? WHERE LOG_ID = ?',
        ['ONSITE', site ?? null, now, existing[0].log_id]
      );
      return res.json({ message: 'Location updated to onsite', time: now });
    }

    // --- Regular OFFICE clock IN/OUT ---
    const existing = await query<any>(
      'SELECT LOG_ID, TIME_IN, TIME_OUT FROM ATTENDANCE_LOGS WHERE EMPLOYEE_ID = ? AND DATE_LOG = ?',
      [id, today]
    );

    if (action === 'IN') {
      if (existing.length && existing[0].time_in) {
        return res.status(409).json({ message: 'Already clocked in today' });
      }
      if (existing.length) {
        // Row exists but TIME_IN is null — update it
        await execute(
          'UPDATE ATTENDANCE_LOGS SET TIME_IN = ?, LOCATION = ?, STATUS = NULL, UPDATED_AT = ? WHERE LOG_ID = ?',
          [now, loc, now, existing[0].log_id]
        );
      } else {
        // Insert new row — STATUS = NULL so it is computed dynamically
        const [idRow] = await query<any>(
          'SELECT COALESCE(MAX(LOG_ID), 0) + 1 AS NEW_ID FROM ATTENDANCE_LOGS'
        );
        await execute(
          'INSERT INTO ATTENDANCE_LOGS (LOG_ID, EMPLOYEE_ID, TIME_IN, DATE_LOG, STATUS, LOCATION, SITE, CREATED_AT, UPDATED_AT) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)',
          [idRow.new_id, id, now, today, loc, site ?? null, now, now]
        );
      }
      return res.json({ message: 'Clocked in successfully', time: now });
    }

    // action === 'OUT'
    if (!existing.length || !existing[0].time_in) {
      return res.status(409).json({ message: 'No clock-in found for today' });
    }
    if (existing[0].time_out) {
      return res.status(409).json({ message: 'Already clocked out today' });
    }
    // STATUS = NULL — computed dynamically on fetch
    await execute(
      'UPDATE ATTENDANCE_LOGS SET TIME_OUT = ?, STATUS = NULL, UPDATED_AT = ? WHERE LOG_ID = ?',
      [now, now, existing[0].log_id]
    );
    return res.json({ message: 'Clocked out successfully', time: now });

  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

export default kioskRouter;
