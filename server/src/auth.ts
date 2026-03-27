import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { query, execute, getNextAvailableId } from './db.js';

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const verifyAdminPassword = async (
  employeeId: number,
  password: string
): Promise<boolean> => {
  const credRows = await query<any>(
    'SELECT PASSWORD_HASH FROM ADMIN_CREDENTIALS WHERE EMPLOYEE_ID = ?',
    [employeeId]
  );

  if (!credRows.length) {
    return false;
  }

  return verifyPassword(password, credRows[0].password_hash);
};

export const generateToken = (employeeId: number): string => {
  return jwt.sign({ employeeId }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRY });
};

export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, config.JWT_SECRET);
  } catch {
    return null;
  }
};

export const signup = async (
  employeeIdStr: string,
  password: string
): Promise<{ success: boolean; message: string; token?: string }> => {
  const employeeId = parseInt(employeeIdStr, 10);
  if (isNaN(employeeId)) return { success: false, message: 'Invalid employee ID' };

  try {
    const empRows = await query<any>(
      'SELECT EMPLOYEE_ID, ROLE FROM EMPLOYEES WHERE EMPLOYEE_ID = ?',
      [employeeId]
    );

    if (!empRows.length) {
      const [bootstrapRow] = await query<any>(
        'SELECT COUNT(*) AS ADMIN_COUNT FROM ADMIN_CREDENTIALS'
      );

      const adminCount = Number(bootstrapRow?.admin_count ?? 0);
      if (adminCount > 0) {
        return {
          success: false,
          message: 'Only existing admin employees can sign up.',
        };
      }

      await execute(
        'INSERT INTO EMPLOYEES (EMPLOYEE_ID, NAME, ROLE, STATUS) VALUES (?, ?, ?, ?)',
        [employeeId, '', 'ADMIN', 'ACTIVE']
      );
    } else {
      const role = String(empRows[0].role ?? '').toUpperCase();
      if (role !== 'ADMIN') {
        return {
          success: false,
          message: 'Access denied. Only employees with ADMIN role can sign up.',
        };
      }
    }

    // Check if already has credentials
    const credRows = await query<any>(
      'SELECT CREDENTIAL_ID FROM ADMIN_CREDENTIALS WHERE EMPLOYEE_ID = ?',
      [employeeId]
    );
    if (credRows.length) {
      return { success: false, message: 'This employee already has an account' };
    }

    const hashedPassword = await hashPassword(password);

    // Insert into ADMINS if not already there
    const adminRows = await query<any>(
      'SELECT ADMIN_ID FROM ADMINS WHERE EMPLOYEE_ID = ?',
      [employeeId]
    );
    if (!adminRows.length) {
      const adminId = await getNextAvailableId('ADMINS', 'ADMIN_ID');
      await execute(
        'INSERT INTO ADMINS (ADMIN_ID, EMPLOYEE_ID) VALUES (?, ?)',
        [adminId, employeeId]
      );
    }

    // Insert credentials
    const credentialId = await getNextAvailableId('ADMIN_CREDENTIALS', 'CREDENTIAL_ID');
    await execute(
      'INSERT INTO ADMIN_CREDENTIALS (CREDENTIAL_ID, EMPLOYEE_ID, PASSWORD_HASH) VALUES (?, ?, ?)',
      [credentialId, employeeId, hashedPassword]
    );

    const token = generateToken(employeeId);
    return { success: true, message: 'Account created successfully', token };
  } catch (error: any) {
    console.error('Signup error:', error);
    return { success: false, message: error.message || 'Signup failed' };
  }
};

export const login = async (
  employeeIdStr: string,
  password: string
): Promise<{ success: boolean; message: string; token?: string }> => {
  const employeeId = parseInt(employeeIdStr, 10);
  if (isNaN(employeeId)) return { success: false, message: 'Invalid employee ID' };

  try {
    // Verify employee exists
    const empRows = await query<any>(
      'SELECT EMPLOYEE_ID, ROLE FROM EMPLOYEES WHERE EMPLOYEE_ID = ?',
      [employeeId]
    );
    if (!empRows.length) return { success: false, message: 'Invalid employee ID' };

    const employee = empRows[0];
    const adminRows = await query<any>(
      'SELECT ADMIN_ID FROM ADMINS WHERE EMPLOYEE_ID = ?',
      [employeeId]
    );
    const role = String(employee.role ?? '').toUpperCase();
    if (!adminRows.length || role !== 'ADMIN') {
      return { success: false, message: 'Access denied. Admin accounts only.' };
    }

    // Fetch credentials
    const credRows = await query<any>(
      'SELECT PASSWORD_HASH FROM ADMIN_CREDENTIALS WHERE EMPLOYEE_ID = ?',
      [employeeId]
    );
    if (!credRows.length) {
      return { success: false, message: 'Account not found. Please sign up first.' };
    }

    const passwordMatch = await verifyPassword(password, credRows[0].password_hash);
    if (!passwordMatch) return { success: false, message: 'Invalid password' };

    const token = generateToken(employeeId);
    return { success: true, message: 'Login successful', token };
  } catch (error: any) {
    console.error('Login error:', error);
    return { success: false, message: error.message || 'Login failed' };
  }
};

