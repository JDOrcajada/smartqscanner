import { query, execute, getNextAvailableId } from './db.js';

export interface Employee {
  id: number;
  name: string;
  role: string;
  picture: string | null;
  status: string;
}

const normalizeEmployeeId = (value: number): number => Math.trunc(value);

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

export const createEmployee = async (data: {
  id?: number;
  name: string;
  role?: string;
}): Promise<Employee> => {
  const requestedId = data.id !== undefined ? normalizeEmployeeId(data.id) : undefined;
  const newId = requestedId ?? await getNextAvailableId('EMPLOYEES', 'EMPLOYEE_ID');

  if (newId <= 0) {
    throw new Error('Employee ID must be a positive integer');
  }

  const existing = await getEmployeeById(newId);
  if (existing) {
    throw new Error('Employee ID already exists');
  }

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
  data: Partial<{ employeeId: number; name: string; role: string; picture: string | null }>
): Promise<Employee | null> => {
  const existing = await getEmployeeById(id);
  if (!existing) return null;

  const requestedEmployeeId = data.employeeId !== undefined
    ? normalizeEmployeeId(data.employeeId)
    : existing.id;

  if (requestedEmployeeId <= 0) {
    throw new Error('Employee ID must be a positive integer');
  }

  if (requestedEmployeeId !== existing.id) {
    const duplicate = await getEmployeeById(requestedEmployeeId);
    if (duplicate) {
      throw new Error('Employee ID already exists');
    }
  }

  const updated = {
    id: requestedEmployeeId,
    name: data.name ?? existing.name,
    role: data.role ?? existing.role,
    picture: data.picture !== undefined ? data.picture : existing.picture,
  };

  if (updated.id !== existing.id) {
    await execute(
      'INSERT INTO EMPLOYEES (EMPLOYEE_ID, NAME, ROLE, PICTURE, STATUS, CREATED_AT) VALUES (?, ?, ?, ?, ?, ?)',
      [updated.id, updated.name, updated.role || null, updated.picture || null, existing.status, new Date()]
    );

    await execute('UPDATE ATTENDANCE_LOGS SET EMPLOYEE_ID = ? WHERE EMPLOYEE_ID = ?', [updated.id, existing.id]);
    await execute('UPDATE ADMINS SET EMPLOYEE_ID = ? WHERE EMPLOYEE_ID = ?', [updated.id, existing.id]);
    await execute('UPDATE ADMIN_CREDENTIALS SET EMPLOYEE_ID = ? WHERE EMPLOYEE_ID = ?', [updated.id, existing.id]);
    await execute('DELETE FROM EMPLOYEES WHERE EMPLOYEE_ID = ?', [existing.id]);

    return {
      id: updated.id,
      name: updated.name,
      role: updated.role,
      picture: updated.picture,
      status: existing.status,
    };
  }

  await execute(
    'UPDATE EMPLOYEES SET NAME = ?, ROLE = ?, PICTURE = ? WHERE EMPLOYEE_ID = ?',
    [updated.name, updated.role || null, updated.picture || null, id]
  );

  return {
    id: existing.id,
    name: updated.name,
    role: updated.role,
    picture: updated.picture,
    status: existing.status,
  };
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

