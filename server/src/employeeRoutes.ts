import { Router, Request, Response } from 'express';
import { getAllEmployees, createEmployee, updateEmployee, deleteEmployee } from './employees.js';
import { generateToken, verifyAdminPassword } from './auth.js';
import { authenticate } from './middleware.js';

const employeeRouter = Router();

// All employee routes require a valid JWT
employeeRouter.use(authenticate);

// GET /api/employees — list all
employeeRouter.get('/', async (_req: Request, res: Response) => {
  try {
    return res.json(await getAllEmployees());
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/employees — create new
employeeRouter.post('/', async (req: Request, res: Response) => {
  const { employeeId, name, role } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ message: 'Name is required' });
  }

  if (employeeId !== undefined) {
    const parsedEmployeeId = Number(employeeId);
    if (!Number.isInteger(parsedEmployeeId) || parsedEmployeeId <= 0) {
      return res.status(400).json({ message: 'Employee ID must be a positive integer' });
    }
  }

  try {
    const employee = await createEmployee({
      id: employeeId !== undefined ? Number(employeeId) : undefined,
      name: name.trim(),
      role: role?.trim(),
    });
    return res.status(201).json(employee);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// PUT /api/employees/:id — update existing
employeeRouter.put('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid employee ID' });
  const { employeeId, name, role, picture } = req.body;

  if (employeeId !== undefined) {
    const parsedEmployeeId = Number(employeeId);
    if (!Number.isInteger(parsedEmployeeId) || parsedEmployeeId <= 0) {
      return res.status(400).json({ message: 'Employee ID must be a positive integer' });
    }
  }

  try {
    const employee = await updateEmployee(id, {
      employeeId: employeeId !== undefined ? Number(employeeId) : undefined,
      name: name?.trim(),
      role: role?.trim(),
      picture: picture !== undefined ? picture : undefined,
    });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const currentEmployeeId = Number((req as any).user?.employeeId);
    if (currentEmployeeId === id && employee.id !== id) {
      return res.json({
        ...employee,
        token: generateToken(employee.id),
      });
    }

    return res.json(employee);
  } catch (err: any) {
    if (err.message === 'Employee ID already exists' || err.message === 'Employee ID must be a positive integer') {
      return res.status(400).json({ message: err.message });
    }

    return res.status(500).json({ message: err.message });
  }
});

// DELETE /api/employees/:id — permanent delete with admin password confirmation
employeeRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid employee ID' });

  const { password } = req.body ?? {};
  if (!password?.trim()) {
    return res.status(400).json({ message: 'Admin password is required' });
  }

  try {
    const adminEmployeeId = Number((req as any).user?.employeeId);
    const passwordValid = await verifyAdminPassword(adminEmployeeId, password);
    if (!passwordValid) {
      return res.status(403).json({ message: 'Invalid admin password' });
    }

    const deleted = await deleteEmployee(id);
    if (!deleted) return res.status(404).json({ message: 'Employee not found' });
    return res.json({ message: 'Employee deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

export default employeeRouter;
