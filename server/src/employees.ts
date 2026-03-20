import { query, execute } from './db.js';

export interface Employee {
  id: number;
  name: string;
  role: string;
  picture: string | null;
  status: string;
}

export const getAllEmployees = async (): Promise<Employee[]> => {
  const rows = await query<any>(
    'SELECT EMPLOYEE_ID, NAME, ROLE, PICTURE, STATUS FROM EMPLOYEES ORDER BY NAME'
  );
  return rows.map((r) => ({
    id: r.employee_id,
    name: r.name ?? '',
    role: r.role ?? '',
    picture: r.picture ?? null,
    status: r.status ?? 'ACTIVE',
  }));
};

export const getEmployeeById = async (id: number): Promise<Employee | null> => {
  const rows = await query<any>(
    'SELECT EMPLOYEE_ID, NAME, ROLE, PICTURE, STATUS FROM EMPLOYEES WHERE EMPLOYEE_ID = ?',
    [id]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: r.employee_id,
    name: r.name ?? '',
    role: r.role ?? '',
    picture: r.picture ?? null,
    status: r.status ?? 'ACTIVE',
  };
};

const getNextAvailableEmployeeId = async (): Promise<number> => {
  const rows = await query<any>(
    'SELECT EMPLOYEE_ID FROM EMPLOYEES ORDER BY EMPLOYEE_ID'
  );

  let nextId = 1;
  for (const row of rows) {
    const currentId = Number(row.employee_id);
    if (currentId > nextId) {
      break;
    }
    if (currentId === nextId) {
      nextId += 1;
    }
  }

  return nextId;
};

export const createEmployee = async (data: {
  name: string;
  role?: string;
}): Promise<Employee> => {
  const newId = await getNextAvailableEmployeeId();
  await execute(
    'INSERT INTO EMPLOYEES (EMPLOYEE_ID, NAME, ROLE, STATUS) VALUES (?, ?, ?, ?)',
    [newId, data.name, data.role ?? null, 'ACTIVE']
  );
  return {
    id: newId,
    name: data.name,
    role: data.role ?? '',
    picture: null,
    status: 'ACTIVE',
  };
};

export const updateEmployee = async (
  id: number,
  data: Partial<{ name: string; role: string; picture: string | null }>
): Promise<Employee | null> => {
  const existing = await getEmployeeById(id);
  if (!existing) return null;
  const updated = {
    name: data.name ?? existing.name,
    role: data.role ?? existing.role,
    picture: data.picture !== undefined ? data.picture : existing.picture,
  };
  await execute(
    'UPDATE EMPLOYEES SET NAME = ?, ROLE = ?, PICTURE = ? WHERE EMPLOYEE_ID = ?',
    [updated.name, updated.role || null, updated.picture || null, id]
  );
  return { ...existing, ...updated };
};

export const deleteEmployee = async (id: number): Promise<boolean> => {
  const existing = await getEmployeeById(id);
  if (!existing) return false;

  await execute('DELETE FROM ATTENDANCE_LOGS WHERE EMPLOYEE_ID = ?', [id]);
  await execute('DELETE FROM ADMIN_CREDENTIALS WHERE EMPLOYEE_ID = ?', [id]);
  await execute('DELETE FROM ADMINS WHERE EMPLOYEE_ID = ?', [id]);
  await execute('DELETE FROM EMPLOYEES WHERE EMPLOYEE_ID = ?', [id]);

  return true;
};

