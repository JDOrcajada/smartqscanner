import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';

const DATA_DIR = './data';
const CREDS_FILE = path.join(DATA_DIR, 'credentials.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Sample employees (in real app, these come from Firebird)
const EMPLOYEES = [
  { id: 1, name: 'John Admin', email: 'admin@company.com', department: 'IT' },
  { id: 101, name: 'Jane Employee', email: 'jane@company.com', department: 'Sales' },
  { id: 102, name: 'Bob Employee', email: 'bob@company.com', department: 'HR' },
];

const loadCredentials = (): Record<string, string> => {
  try {
    if (fs.existsSync(CREDS_FILE)) {
      const data = fs.readFileSync(CREDS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading credentials:', error);
  }
  return {};
};

const saveCredentials = (creds: Record<string, string>): void => {
  try {
    fs.writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2));
  } catch (error) {
    console.error('Error saving credentials:', error);
  }
};

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateToken = (employeeId: string | number): string => {
  return jwt.sign({ employeeId }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRY });
};

export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, config.JWT_SECRET);
  } catch (err) {
    return null;
  }
};

export const signup = async (
  employeeId: string,
  password: string
): Promise<{ success: boolean; message: string; token?: string }> => {
  try {
    // Check if employee exists
    const employee = EMPLOYEES.find(e => e.id.toString() === employeeId);
    if (!employee) {
      return { success: false, message: 'Employee ID does not exist in the system' };
    }

    // Check if already has account
    const credentials = loadCredentials();
    if (credentials[employeeId]) {
      return { success: false, message: 'This employee already has an account' };
    }

    // Hash and store password
    const hashedPassword = await hashPassword(password);
    credentials[employeeId] = hashedPassword;
    saveCredentials(credentials);

    // Generate token
    const token = generateToken(employeeId);

    return {
      success: true,
      message: 'Account created successfully',
      token,
    };
  } catch (error: any) {
    console.error('Signup error:', error);
    return { success: false, message: error.message || 'Signup failed' };
  }
};

export const login = async (
  employeeId: string,
  password: string
): Promise<{ success: boolean; message: string; token?: string }> => {
  try {
    // Check if employee exists
    const employee = EMPLOYEES.find(e => e.id.toString() === employeeId);
    if (!employee) {
      return { success: false, message: 'Invalid employee ID' };
    }

    // Check credentials
    const credentials = loadCredentials();
    const hashedPassword = credentials[employeeId];

    if (!hashedPassword) {
      return { success: false, message: 'Account not found. Please sign up first.' };
    }

    const passwordMatch = await verifyPassword(password, hashedPassword);
    if (!passwordMatch) {
      return { success: false, message: 'Invalid password' };
    }

    // Generate token
    const token = generateToken(employeeId);

    return {
      success: true,
      message: 'Login successful',
      token,
    };
  } catch (error: any) {
    console.error('Login error:', error);
    return { success: false, message: error.message || 'Login failed' };
  }
};

