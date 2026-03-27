/**
 * superadminRoutes.ts — RBAC endpoints exclusively for SUPERADMIN users.
 *
 * Routes (all require JWT + SUPERADMIN role):
 *   GET  /api/superadmin/requests          — list PENDING signup requests
 *   POST /api/superadmin/requests/:id/approve — approve, create account
 *   POST /api/superadmin/requests/:id/reject  — reject request
 */
import { Router, Request, Response } from 'express';
import { query, execute, getNextAvailableId } from './db.js';
import { authenticate, requireSuperAdmin } from './middleware.js';

const superadminRouter = Router();
superadminRouter.use(authenticate);
superadminRouter.use(requireSuperAdmin);

// GET /api/superadmin/requests
superadminRouter.get('/requests', async (_req: Request, res: Response) => {
  try {
    const rows = await query<any>(`
      SELECT r.REQUEST_ID, r.EMPLOYEE_ID, r.REQUEST_STATUS, r.CREATED_AT,
             e.NAME AS EMPLOYEE_NAME
      FROM ADMIN_SIGNUP_REQUESTS r
      LEFT JOIN EMPLOYEES e ON e.EMPLOYEE_ID = r.EMPLOYEE_ID
      WHERE r.REQUEST_STATUS = 'PENDING'
      ORDER BY r.CREATED_AT ASC
    `);
    return res.json(
      rows.map((r) => ({
        requestId:    r.request_id,
        employeeId:   r.employee_id,
        employeeName: r.employee_name ?? '(unknown)',
        status:       r.request_status,
        createdAt:    r.created_at,
      }))
    );
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/superadmin/requests/:id/approve
superadminRouter.post('/requests/:id/approve', async (req: Request, res: Response) => {
  const requestId = parseInt(req.params.id, 10);
  const reviewerId = (req as any).user.employeeId;

  if (isNaN(requestId)) return res.status(400).json({ message: 'Invalid request ID' });

  try {
    const [request] = await query<any>(
      `SELECT REQUEST_ID, EMPLOYEE_ID, PASSWORD_HASH
       FROM ADMIN_SIGNUP_REQUESTS WHERE REQUEST_ID = ? AND REQUEST_STATUS = 'PENDING'`,
      [requestId]
    );
    if (!request) return res.status(404).json({ message: 'Pending request not found' });

    const employeeId = request.employee_id;

    // Insert into ADMINS if not already there (with default ADMIN role)
    const adminRows = await query<any>(
      'SELECT ADMIN_ID FROM ADMINS WHERE EMPLOYEE_ID = ?', [employeeId]
    );
    if (!adminRows.length) {
      const adminId = await getNextAvailableId('ADMINS', 'ADMIN_ID');
      await execute(
        `INSERT INTO ADMINS (ADMIN_ID, EMPLOYEE_ID, ADMIN_ROLE) VALUES (?, ?, 'ADMIN')`,
        [adminId, employeeId]
      );
    }

    // Create credentials if not already there
    const credCheck = await query<any>(
      'SELECT CREDENTIAL_ID FROM ADMIN_CREDENTIALS WHERE EMPLOYEE_ID = ?', [employeeId]
    );
    if (!credCheck.length) {
      const credId = await getNextAvailableId('ADMIN_CREDENTIALS', 'CREDENTIAL_ID');
      await execute(
        `INSERT INTO ADMIN_CREDENTIALS (CREDENTIAL_ID, EMPLOYEE_ID, PASSWORD_HASH) VALUES (?, ?, ?)`,
        [credId, employeeId, request.password_hash]
      );
    }

    // Mark request as approved
    await execute(
      `UPDATE ADMIN_SIGNUP_REQUESTS
       SET REQUEST_STATUS = 'APPROVED', REVIEWED_AT = CURRENT_TIMESTAMP, REVIEWED_BY = ?
       WHERE REQUEST_ID = ?`,
      [reviewerId, requestId]
    );

    return res.json({ message: 'Request approved. Account is now active.' });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/superadmin/requests/:id/reject
superadminRouter.post('/requests/:id/reject', async (req: Request, res: Response) => {
  const requestId = parseInt(req.params.id, 10);
  const reviewerId = (req as any).user.employeeId;

  if (isNaN(requestId)) return res.status(400).json({ message: 'Invalid request ID' });

  try {
    const rows = await query<any>(
      `SELECT REQUEST_ID FROM ADMIN_SIGNUP_REQUESTS WHERE REQUEST_ID = ? AND REQUEST_STATUS = 'PENDING'`,
      [requestId]
    );
    if (!rows.length) return res.status(404).json({ message: 'Pending request not found' });

    await execute(
      `UPDATE ADMIN_SIGNUP_REQUESTS
       SET REQUEST_STATUS = 'REJECTED', REVIEWED_AT = CURRENT_TIMESTAMP, REVIEWED_BY = ?
       WHERE REQUEST_ID = ?`,
      [reviewerId, requestId]
    );

    return res.json({ message: 'Request rejected.' });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

export default superadminRouter;
