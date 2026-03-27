/**
 * leaveRoutes.ts — SL / VL leave balance management.
 *
 * Each employee is allocated 15 Sick Leaves (SL) and 15 Vacation Leaves (VL)
 * per calendar year, tracked in EMPLOYEE_LEAVES.
 *
 * Routes:
 *   GET  /api/leaves                      — balances for all active employees (current year)
 *   POST /api/leaves/assign               — assign or clear SL/VL on an absent record
 */
import { Router, Request, Response } from 'express';
import { query, execute, getNextAvailableId } from './db.js';
import { authenticate } from './middleware.js';

const leaveRouter = Router();
leaveRouter.use(authenticate);

const DEFAULT_SL = 15;
const DEFAULT_VL = 15;

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

/** Retrieve or lazily create the EMPLOYEE_LEAVES row for a given employee + year. */
async function getOrCreateLeave(employeeId: number, year: number) {
  const rows = await query<any>(
    `SELECT LEAVE_ID, SL_BALANCE, VL_BALANCE
     FROM EMPLOYEE_LEAVES WHERE EMPLOYEE_ID = ? AND LEAVE_YEAR = ?`,
    [employeeId, year]
  );
  if (rows.length) return rows[0];

  const leaveId = await getNextAvailableId('EMPLOYEE_LEAVES', 'LEAVE_ID');
  await execute(
    `INSERT INTO EMPLOYEE_LEAVES (LEAVE_ID, EMPLOYEE_ID, LEAVE_YEAR, SL_BALANCE, VL_BALANCE, UPDATED_AT)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [leaveId, employeeId, year, DEFAULT_SL, DEFAULT_VL, new Date()]
  );
  return { leave_id: leaveId, sl_balance: DEFAULT_SL, vl_balance: DEFAULT_VL };
}

// ──────────────────────────────────────────────────────────────
// GET /api/leaves  — all employees' leave balances for a year
// ?year=YYYY  (default: current year)
// ──────────────────────────────────────────────────────────────
leaveRouter.get('/', async (req: Request, res: Response) => {
  try {
    const year = parseInt((req.query.year as string) || String(new Date().getFullYear()), 10);

    // Fetch all active employees
    const employees = await query<any>(
      `SELECT EMPLOYEE_ID, NAME FROM EMPLOYEES WHERE STATUS = 'ACTIVE' ORDER BY NAME`
    );

    // Fetch existing leave rows for that year
    const leaveRows = await query<any>(
      `SELECT EMPLOYEE_ID, SL_BALANCE, VL_BALANCE FROM EMPLOYEE_LEAVES WHERE LEAVE_YEAR = ?`,
      [year]
    );
    const leaveMap = new Map(leaveRows.map((r: any) => [Number(r.employee_id), r]));

    const result = employees.map((emp: any) => {
      const leave = leaveMap.get(Number(emp.employee_id));
      return {
        employeeId:  Number(emp.employee_id),
        employeeName: emp.name ?? '',
        year,
        slBalance: leave ? Number(leave.sl_balance) : DEFAULT_SL,
        vlBalance: leave ? Number(leave.vl_balance) : DEFAULT_VL,
      };
    });

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/leaves/assign
//
// Body: { employeeId, date (YYYY-MM-DD), leaveType: 'SL' | 'VL' | null }
//
// Behaviour:
//   1. Find or create ATTENDANCE_LOGS row for employee+date with STATUS='ABSENT'
//   2. If a different leave type was previously set, restore that balance
//   3. Set LEAVE_TYPE on the log row
//   4. Deduct 1 from the chosen leave balance (can go negative)
//   5. leaveType = null → clears assignment and restores balance
// ──────────────────────────────────────────────────────────────
leaveRouter.post('/assign', async (req: Request, res: Response) => {
  const { employeeId, date, leaveType } = req.body;

  const empId = parseInt(String(employeeId), 10);
  if (isNaN(empId)) return res.status(400).json({ message: 'Invalid employeeId' });
  if (!date) return res.status(400).json({ message: 'date is required (YYYY-MM-DD)' });

  const newLeave = leaveType ?? null;
  if (newLeave !== null && newLeave !== 'SL' && newLeave !== 'VL') {
    return res.status(400).json({ message: 'leaveType must be "SL", "VL", or null' });
  }

  const year = new Date(date + 'T00:00:00').getFullYear();
  const now  = new Date();

  try {
    // 1. Ensure attendance row exists
    let logRows = await query<any>(
      `SELECT LOG_ID, LEAVE_TYPE FROM ATTENDANCE_LOGS WHERE EMPLOYEE_ID = ? AND DATE_LOG = ?`,
      [empId, date]
    );

    let logId: number;
    let previousLeave: string | null = null;

    if (logRows.length) {
      logId = logRows[0].log_id;
      previousLeave = logRows[0].leave_type ?? null;
    } else {
      // Virtual absent: create the DB row
      logId = await getNextAvailableId('ATTENDANCE_LOGS', 'LOG_ID');
      await execute(
        `INSERT INTO ATTENDANCE_LOGS
           (LOG_ID, EMPLOYEE_ID, DATE_LOG, STATUS, LEAVE_TYPE, CREATED_AT, UPDATED_AT)
         VALUES (?, ?, ?, 'ABSENT', ?, ?, ?)`,
        [logId, empId, date, newLeave, now, now]
      );
      // Balance will be adjusted below
      previousLeave = null;
    }

    // 2. Adjust leave balances
    if (previousLeave !== newLeave) {
      const leaveRow = await getOrCreateLeave(empId, year);

      // Restore previous balance
      if (previousLeave === 'SL') {
        await execute(
          `UPDATE EMPLOYEE_LEAVES SET SL_BALANCE = SL_BALANCE + 1, UPDATED_AT = ?
           WHERE EMPLOYEE_ID = ? AND LEAVE_YEAR = ?`,
          [now, empId, year]
        );
      } else if (previousLeave === 'VL') {
        await execute(
          `UPDATE EMPLOYEE_LEAVES SET VL_BALANCE = VL_BALANCE + 1, UPDATED_AT = ?
           WHERE EMPLOYEE_ID = ? AND LEAVE_YEAR = ?`,
          [now, empId, year]
        );
      }

      // Deduct new balance (can go negative intentionally)
      if (newLeave === 'SL') {
        await execute(
          `UPDATE EMPLOYEE_LEAVES SET SL_BALANCE = SL_BALANCE - 1, UPDATED_AT = ?
           WHERE EMPLOYEE_ID = ? AND LEAVE_YEAR = ?`,
          [now, empId, year]
        );
      } else if (newLeave === 'VL') {
        await execute(
          `UPDATE EMPLOYEE_LEAVES SET VL_BALANCE = VL_BALANCE - 1, UPDATED_AT = ?
           WHERE EMPLOYEE_ID = ? AND LEAVE_YEAR = ?`,
          [now, empId, year]
        );
      }

      // 3. Update LEAVE_TYPE on the log row (if row was just created, already set)
      if (logRows.length) {
        await execute(
          `UPDATE ATTENDANCE_LOGS SET LEAVE_TYPE = ?, UPDATED_AT = ? WHERE LOG_ID = ?`,
          [newLeave, now, logId]
        );
      }
    }

    // Return updated balances
    const updated = await getOrCreateLeave(empId, year);
    return res.json({
      message:   'Leave assigned',
      logId,
      leaveType: newLeave,
      slBalance: Number(updated.sl_balance),
      vlBalance: Number(updated.vl_balance),
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// PATCH /api/leaves/balance
//
// Body: { employeeId, year, slBalance, vlBalance }
// Allows SuperAdmin to manually set leave balances for an employee+year.
// ──────────────────────────────────────────────────────────────
leaveRouter.patch('/balance', async (req: Request, res: Response) => {
  const { employeeId, year, slBalance, vlBalance } = req.body;

  const empId = parseInt(String(employeeId), 10);
  const yr    = parseInt(String(year), 10);
  const sl    = parseInt(String(slBalance), 10);
  const vl    = parseInt(String(vlBalance), 10);

  if (isNaN(empId) || isNaN(yr) || isNaN(sl) || isNaN(vl)) {
    return res.status(400).json({ message: 'employeeId, year, slBalance, vlBalance are required numbers' });
  }

  try {
    const leaveRow = await getOrCreateLeave(empId, yr);
    await execute(
      `UPDATE EMPLOYEE_LEAVES SET SL_BALANCE = ?, VL_BALANCE = ?, UPDATED_AT = ?
       WHERE EMPLOYEE_ID = ? AND LEAVE_YEAR = ?`,
      [sl, vl, new Date(), empId, yr]
    );
    return res.json({ message: 'Leave balances updated', slBalance: sl, vlBalance: vl });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

export default leaveRouter;
