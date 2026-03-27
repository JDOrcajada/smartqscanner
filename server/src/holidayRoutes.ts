/**
 * holidayRoutes.ts — Holiday calendar management.
 *
 * Holidays suppress the automatic absent-generation for those dates.
 * SuperAdmin configuration for holidays will expand here in a later step.
 *
 * Routes (all require JWT):
 *   GET    /api/holidays          — list all holidays
 *   POST   /api/holidays          — add a holiday  { date, name }
 *   DELETE /api/holidays/:id      — remove a holiday
 */
import { Router, Request, Response } from 'express';
import { query, execute, getNextAvailableId } from './db.js';
import { authenticate } from './middleware.js';

const holidayRouter = Router();
holidayRouter.use(authenticate);

// GET /api/holidays
holidayRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const rows = await query<any>(
      `SELECT HOLIDAY_ID, HOLIDAY_DATE, HOLIDAY_NAME, CREATED_AT
       FROM HOLIDAYS ORDER BY HOLIDAY_DATE ASC`
    );
    return res.json(
      rows.map((r) => ({
        id:   r.holiday_id,
        date: new Date(r.holiday_date).toISOString().slice(0, 10),
        name: r.holiday_name ?? '',
      }))
    );
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/holidays  { date: 'YYYY-MM-DD', name: string }
holidayRouter.post('/', async (req: Request, res: Response) => {
  const { date, name } = req.body;
  if (!date) return res.status(400).json({ message: 'date is required (YYYY-MM-DD)' });

  try {
    // Duplicate check
    const existing = await query<any>(
      `SELECT COUNT(*) AS CNT FROM HOLIDAYS WHERE HOLIDAY_DATE = ?`, [date]
    );
    if (Number(existing[0].cnt) > 0) {
      return res.status(409).json({ message: 'Holiday already exists for this date' });
    }

    const holidayId = await getNextAvailableId('HOLIDAYS', 'HOLIDAY_ID');
    await execute(
      `INSERT INTO HOLIDAYS (HOLIDAY_ID, HOLIDAY_DATE, HOLIDAY_NAME, CREATED_AT)
       VALUES (?, ?, ?, ?)`,
      [holidayId, date, (name ?? '').trim() || null, new Date()]
    );
    return res.status(201).json({ id: holidayId, date, name: name ?? '' });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// DELETE /api/holidays/:id
holidayRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid holiday ID' });

  try {
    const existing = await query<any>(
      `SELECT COUNT(*) AS CNT FROM HOLIDAYS WHERE HOLIDAY_ID = ?`, [id]
    );
    if (Number(existing[0].cnt) === 0) {
      return res.status(404).json({ message: 'Holiday not found' });
    }

    await execute(`DELETE FROM HOLIDAYS WHERE HOLIDAY_ID = ?`, [id]);
    return res.json({ message: 'Holiday deleted' });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

export default holidayRouter;
