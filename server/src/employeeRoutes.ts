import { Router, Request, Response } from 'express';
import { loadEmployees, saveEmployees, Employee } from './employees.js';
import { authenticate } from './middleware.js';

const employeeRouter = Router();

// All employee routes require a valid JWT
employeeRouter.use(authenticate);

// GET /api/employees — list all
employeeRouter.get('/', (req: Request, res: Response) => {
  const employees = loadEmployees();
  return res.json(employees);
});

// POST /api/employees — create new
employeeRouter.post('/', (req: Request, res: Response) => {
  const { id, name, role, profilePicture } = req.body;

  if (!id || !name || !role) {
    return res.status(400).json({ message: 'ID, name, and role are required' });
  }

  const employees = loadEmployees();

  if (employees.find((e) => e.id === id.trim())) {
    return res.status(400).json({ message: 'Employee ID already exists' });
  }

  const newEmployee: Employee = {
    id: id.trim(),
    name: name.trim(),
    role: role.trim(),
    profilePicture: profilePicture || '',
  };

  employees.push(newEmployee);
  saveEmployees(employees);

  return res.status(201).json(newEmployee);
});

// PUT /api/employees/:id — update existing
employeeRouter.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, role, profilePicture } = req.body;

  const employees = loadEmployees();
  const idx = employees.findIndex((e) => e.id === id);

  if (idx === -1) {
    return res.status(404).json({ message: 'Employee not found' });
  }

  employees[idx] = {
    ...employees[idx],
    ...(name !== undefined && { name: name.trim() }),
    ...(role !== undefined && { role: role.trim() }),
    ...(profilePicture !== undefined && { profilePicture }),
  };

  saveEmployees(employees);
  return res.json(employees[idx]);
});

// DELETE /api/employees/:id — remove
employeeRouter.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  const employees = loadEmployees();
  const idx = employees.findIndex((e) => e.id === id);

  if (idx === -1) {
    return res.status(404).json({ message: 'Employee not found' });
  }

  employees.splice(idx, 1);
  saveEmployees(employees);

  return res.json({ message: 'Employee deleted successfully' });
});

export default employeeRouter;
