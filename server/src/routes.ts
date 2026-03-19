import { Router } from 'express';
import { signup, login } from './auth.js';

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
      return res.status(400).json({ message: 'Employee ID and password are required' });
    }

    const result = await login(employeeId, password);

    if (!result.success) {
      return res.status(401).json(result);
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default authRouter;
