import { Request, Response, NextFunction } from 'express';
import { verifyToken } from './auth.js';

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  (req as any).user = decoded;
  next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user || String(user.adminRole ?? '').toUpperCase() !== 'SUPERADMIN') {
    return res.status(403).json({ message: 'SuperAdmin access required' });
  }
  next();
}
