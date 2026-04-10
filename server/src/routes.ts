import { Router } from 'express';
import { signup, login, verifyAdminPassword } from './auth.js';
import { authenticate } from './middleware.js';

const authRouter = Router();

authRouter.post('/signup', async (req, res) => {
  try {
    const { employeeId, password } = req.body;

    if (!employeeId || !password) {
      return res.status(400).json({ message: 'Employee ID and password are required' });
    }

    const result = await signup(employeeId, password);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(201).json(result);
  } catch (error: any) {
    console.error('Signup error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

authRouter.post('/login', async (req, res) => {
  try {
    const { employeeId, password } = req.body;

    if (!employeeId || !password) {
      console.log(`[AUTH] 400 Bad Request — missing employeeId or password`);
      return res.status(400).json({ message: 'Employee ID and password are required' });
    }

    const result = await login(employeeId, password);

    if (!result.success) {
      console.log(`[AUTH] 401 Login failed — employeeId: ${employeeId} — reason: ${result.message}`);
      return res.status(401).json(result);
    }

    console.log(`[AUTH] Login successful — employeeId: ${employeeId}`);

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/auth/verify-password — verify the calling admin's password (for guarded UI actions)
authRouter.post('/verify-password', authenticate, async (req: any, res: any) => {
  try {
    const { password } = req.body;
    const employeeId = req.user?.employeeId;
    if (!password || !employeeId) {
      return res.status(400).json({ message: 'Password is required' });
    }
    const valid = await verifyAdminPassword(employeeId, password);
    if (!valid) return res.status(401).json({ message: 'Incorrect password' });
    return res.json({ valid: true });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

export default authRouter;
