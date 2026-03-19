import fs from 'fs';
import path from 'path';

const DATA_DIR = './data';
const EMPLOYEES_FILE = path.join(DATA_DIR, 'employees.json');

export interface Employee {
  id: string;
  name: string;
  role: string;
  profilePicture: string; // base64 data URL or empty string
}

const defaultEmployees: Employee[] = [
  { id: 'EMP001', name: 'John Smith', role: 'Engineer', profilePicture: '' },
  { id: 'EMP002', name: 'Sarah Johnson', role: 'HR Manager', profilePicture: '' },
  { id: 'EMP003', name: 'Michael Chen', role: 'Sales Representative', profilePicture: '' },
  { id: 'EMP004', name: 'Emily Williams', role: 'Engineer', profilePicture: '' },
  { id: 'EMP005', name: 'David Brown', role: 'Marketing Specialist', profilePicture: '' },
  { id: 'EMP006', name: 'Jessica Davis', role: 'Finance Analyst', profilePicture: '' },
  { id: 'EMP007', name: 'Robert Wilson', role: 'Operations Manager', profilePicture: '' },
  { id: 'EMP008', name: 'Amanda Martinez', role: 'Engineer', profilePicture: '' },
];

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const loadEmployees = (): Employee[] => {
  try {
    if (fs.existsSync(EMPLOYEES_FILE)) {
      const data = fs.readFileSync(EMPLOYEES_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading employees:', error);
  }
  // First run: seed with defaults
  saveEmployees(defaultEmployees);
  return defaultEmployees;
};

export const saveEmployees = (employees: Employee[]): void => {
  try {
    fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify(employees, null, 2));
  } catch (error) {
    console.error('Error saving employees:', error);
  }
};
