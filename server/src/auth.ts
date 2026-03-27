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

export const generateToken = (employeeId: number, adminRole: string): string => {
  return jwt.sign({ employeeId, adminRole }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRY });
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
): Promise<{ success: boolean; message: string; token?: string; adminRole?: string; pending?: boolean }> => {
  const employeeId = parseInt(employeeIdStr, 10);
  if (isNaN(employeeId)) return { success: false, message: 'Invalid employee ID' };

  try {
    const empRows = await query<any>(
      'SELECT EMPLOYEE_ID, ROLE FROM EMPLOYEES WHERE EMPLOYEE_ID = ?',
      [employeeId]
    );

    if (!empRows.length) {
      return {
        success: false,
        message: 'Employee ID not found. Contact your SuperAdmin to be added first.',
      };
    }

    // Check if already has credentials
    const credRows = await query<any>(
      'SELECT CREDENTIAL_ID FROM ADMIN_CREDENTIALS WHERE EMPLOYEE_ID = ?',
      [employeeId]
    );
    if (credRows.length) {
      return { success: false, message: 'This employee already has an account' };
    }

    // Determine if this employee is a SuperAdmin (can bypass approval)
    const adminRows = await query<any>(
      'SELECT ADMIN_ID, ADMIN_ROLE FROM ADMINS WHERE EMPLOYEE_ID = ?',
      [employeeId]
    );
    const isSuperAdmin =
      adminRows.length &&
      String(adminRows[0].admin_role ?? '').toUpperCase() === 'SUPERADMIN';

    const hashedPassword = await hashPassword(password);

    if (isSuperAdmin) {
      // SuperAdmin signs up directly — no approval needed
      const credentialId = await getNextAvailableId('ADMIN_CREDENTIALS', 'CREDENTIAL_ID');
      await execute(
        'INSERT INTO ADMIN_CREDENTIALS (CREDENTIAL_ID, EMPLOYEE_ID, PASSWORD_HASH) VALUES (?, ?, ?)',
        [credentialId, employeeId, hashedPassword]
      );
      const token = generateToken(employeeId, 'SUPERADMIN');
      return { success: true, message: 'SuperAdmin account created successfully', token, adminRole: 'SUPERADMIN' };
    }

    // Regular admin — check for an existing pending request
    const existingRequest = await query<any>(
      `SELECT REQUEST_ID FROM ADMIN_SIGNUP_REQUESTS WHERE EMPLOYEE_ID = ? AND REQUEST_STATUS = 'PENDING'`,
      [employeeId]
    );
    if (existingRequest.length) {
      return { success: false, message: 'A signup request for this employee is already pending approval.' };
    }

    // Create pending signup request
    const requestId = await getNextAvailableId('ADMIN_SIGNUP_REQUESTS', 'REQUEST_ID');
    await execute(
      `INSERT INTO ADMIN_SIGNUP_REQUESTS (REQUEST_ID, EMPLOYEE_ID, PASSWORD_HASH, REQUEST_STATUS, CREATED_AT)
       VALUES (?, ?, ?, 'PENDING', ?)`,
      [requestId, employeeId, hashedPassword, new Date()]
    );

    return {
      success: true,
      message: 'Your signup request has been submitted. A SuperAdmin will review it shortly.',
      pending: true,
    };
  } catch (error: any) {
    console.error('Signup error:', error);
    return { success: false, message: error.message || 'Signup failed' };
  }
};

export const login = async (
  employeeIdStr: string,
  password: string
): Promise<{ success: boolean; message: string; token?: string; adminRole?: string }> => {
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
      'SELECT ADMIN_ID, ADMIN_ROLE FROM ADMINS WHERE EMPLOYEE_ID = ?',
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

    const adminRole = String(adminRows[0].admin_role ?? 'ADMIN').toUpperCase();
    const token = generateToken(employeeId, adminRole);
    return { success: true, message: 'Login successful', token, adminRole };
  } catch (error: any) {
    console.error('Login error:', error);
    return { success: false, message: error.message || 'Login failed' };
  }
};

